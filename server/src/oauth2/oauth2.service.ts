import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as jwt from 'jsonwebtoken';
import { request } from 'undici';
import { EnvironmentVariables } from 'src/env.validation';
import { InjectRepository } from '@nestjs/typeorm';
import GoogleOAuth2 from './google-oauth2.entity';
import { DataSource, DeepPartial, Repository } from 'typeorm';
import { normalizeDBError, UniqueConstraintFailed } from 'src/database.utils';
import User from 'src/users/user.entity';
import { assert } from 'src/misc.utils';
import { columnsForGetUser } from 'src/users/users.service';
import type { GoogleOIDCResponse, GoogleDecodedOIDCIDToken, GoogleRefreshTokenResponse, GoogleListEventsResponse, GoogleListEventsResponseItem, GoogleInsertEventResponse } from './oauth2-response-types';
import { customToISOString, getSecondsSinceUnixEpoch } from 'src/dates.utils';
import MeetingsService from 'src/meetings/meetings.service';
import GoogleCalendarEvents, { GoogleCalendarEvent } from './google-calendar-events.entity';
import GoogleCalendarCreatedEvent from './google-calendar-created-event.entity';

// TODO: add Microsoft
export enum OAuth2Provider {
  GOOGLE = 1,
}
export const oauth2Reasons = ['link', 'signup', 'login'] as const;
export type OAuth2Reason = typeof oauth2Reasons[number];
export type OAuth2State = {
  reason: OAuth2Reason;
  postRedirect: string;
  userID?: number;
};
export class OAuth2NotConfiguredError extends Error {}
export class OAuth2ErrorResponseError extends Error {
  constructor(public statusCode: number) { super(); }
}
export class OAuth2NoRefreshTokenError extends Error {}
export class OAuth2NotAllScopesGrantedError extends Error {}
export class OAuth2AccountAlreadyLinkedError extends Error {}
export class OAuth2AccountNotLinkedError extends Error {}

type OAuth2Config = {
  authzEndpoint: string;
  tokenEndpoint: string;
  revokeEndpoint: string;
  scopes: string[];
};
type OAuth2Configs = {
  [key in OAuth2Provider]: OAuth2Config;
};
type OAuth2EnvConfig = {
  client_id: string;
  secret: string;
  redirect_uri: string;
};

const oidcScopes = ['openid', 'profile', 'email'] as const;
const oauth2Configs: OAuth2Configs = {
  [OAuth2Provider.GOOGLE]: {
    // See https://developers.google.com/identity/protocols/oauth2/web-server
    authzEndpoint: 'https://accounts.google.com/o/oauth2/v2/auth',
    tokenEndpoint: 'https://oauth2.googleapis.com/token',
    revokeEndpoint: 'https://oauth2.googleapis.com/revoke',
    scopes: [
      ...oidcScopes,
      'https://www.googleapis.com/auth/calendar.readonly',
      'https://www.googleapis.com/auth/calendar.events.owned',
    ],
  },
};
const GOOGLE_API_BASE_URL = 'https://www.googleapis.com';
const GOOGLE_API_CALENDAR_EVENTS_BASE_URL = `${GOOGLE_API_BASE_URL}/calendar/v3/calendars/primary/events`;
const MAX_EVENT_RESULTS = 100;

function stripTrailingSlash(s: string): string {
  if (s.endsWith('/')) {
    return s.substring(0, s.length - 1);
  }
  return s;
}

@Injectable()
export default class OAuth2Service {
  private readonly logger = new Logger(OAuth2Service.name);

  constructor(
    private configService: ConfigService<EnvironmentVariables, true>,
    private meetingsService: MeetingsService,
    private dataSource: DataSource,
    @InjectRepository(GoogleOAuth2) private googleOAuth2Repository: Repository<GoogleOAuth2>,
    @InjectRepository(GoogleCalendarEvents) private googleCalendarEventsRepository: Repository<GoogleCalendarEvents>,
    @InjectRepository(GoogleCalendarCreatedEvent) private googleCalendarCreatedEventsRepository: Repository<GoogleCalendarCreatedEvent>,
    @InjectRepository(User) private usersRepository: Repository<User>,
  ) {}

  private getEnvKey<K extends keyof EnvironmentVariables>(key: K): EnvironmentVariables[K] {
    return this.configService.get(key, {infer: true});
  }

  private getEnvKeyOrThrow<K extends keyof EnvironmentVariables>(key: K): EnvironmentVariables[K] {
    const val = this.getEnvKey(key);
    if (!val) {
      throw new OAuth2NotConfiguredError();
    }
    return val;
  }

  private getEnvConfigOrThrow(provider: OAuth2Provider): OAuth2EnvConfig {
    if (provider === OAuth2Provider.GOOGLE) {
      return {
        client_id: this.getEnvKeyOrThrow('OAUTH2_GOOGLE_CLIENT_ID'),
        secret: this.getEnvKeyOrThrow('OAUTH2_GOOGLE_CLIENT_SECRET'),
        redirect_uri: this.getEnvKeyOrThrow('OAUTH2_GOOGLE_REDIRECT_URI'),
      };
    }
  }

  private encodeQueryParams(params: Record<string, string>): string {
    return Object.entries(params)
      .map(([key, value]) => key + '=' + encodeURIComponent(value))
      .join('&');
  }

  // When submitting content of type application/x-www-form-urlencoded,
  // ' ' needs to be converted into '+' instead of '%20'.
  // See https://developer.mozilla.org/en-US/docs/Glossary/percent-encoding.
  private encodeFormQueryParams(params: Record<string, string>): string {
    return new URLSearchParams(params).toString();
  }

  private isSuccessStatusCode(statusCode: number): boolean {
    return statusCode - (statusCode % 100) === 200;
  }

  private async request(...args: Parameters<typeof request>) {
    const response = await request(...args);
    const {statusCode, body} = response;
    if (!this.isSuccessStatusCode(statusCode)) {
      this.logger.error(`statusCode=${statusCode} body=${await body.text()}`)
      throw new OAuth2ErrorResponseError(statusCode);
    }
    return response;
  }

  private async requestJSON<T>(...args: Parameters<typeof request>): Promise<T> {
    return (await this.request(...args)).body.json();
  }

  private allRequestedScopesArePresent(provider: OAuth2Provider, scopeStr: string): boolean {
    const responseScopes = scopeStr.split(' ');
    const requestedScopes = oauth2Configs[provider].scopes;
    // I've noticed that Google renames some of the common OIDC scopes
    // (e.g. profile => https://www.googleapis.com/auth/userinfo.profile),
    // so we don't need to check those ones.
    return requestedScopes.every(
      reqScope => (oidcScopes as readonly string[]).includes(reqScope)
               || responseScopes.includes(reqScope)
    );
  }

  getRequestURL(provider: OAuth2Provider, state: OAuth2State): string {
    const {client_id, secret, redirect_uri} = this.getEnvConfigOrThrow(provider);
    if (!client_id || !secret || !redirect_uri) {
      throw new OAuth2NotConfiguredError();
    }
    const {authzEndpoint, scopes} = oauth2Configs[provider];
    // TODO: nonce (required by Microsoft API)
    const params: Record<string, string> = {
      client_id,
      redirect_uri,
      response_type: 'code',
      scope: scopes.join(' '),
      access_type: 'offline',
      state: JSON.stringify(state),
    };
    if (state.reason === 'link' || state.reason === 'signup') {
      params.prompt = 'consent';
    }
    return authzEndpoint + '?' + this.encodeQueryParams(params);
  }

  private async google_getTokenFromCode(code: string, state: OAuth2State): Promise<{
    data: GoogleOIDCResponse;
    decodedIDToken: GoogleDecodedOIDCIDToken;
  }> {
    const provider = OAuth2Provider.GOOGLE;
    const {client_id, secret, redirect_uri} = this.getEnvConfigOrThrow(provider);
    const {tokenEndpoint} = oauth2Configs[provider];
    // See https://developers.google.com/identity/protocols/oauth2/web-server#exchange-authorization-code
    const requestBody = this.encodeFormQueryParams({
      code,
      client_id,
      client_secret: secret,
      redirect_uri,
      grant_type: 'authorization_code',
    });
    const data = await this.requestJSON<GoogleOIDCResponse>(tokenEndpoint, {
      method: 'POST',
      body: requestBody,
      headers: {'content-type': 'application/x-www-form-urlencoded'},
    });
    this.logger.debug(data);
    const decodedIDToken = jwt.decode(data.id_token) as GoogleDecodedOIDCIDToken;
    this.logger.debug(decodedIDToken);
    return {data, decodedIDToken};
  }

  private async google_refreshAccessToken(creds: GoogleOAuth2): Promise<GoogleOAuth2> {
    const provider = OAuth2Provider.GOOGLE;
    const {client_id, secret} = this.getEnvConfigOrThrow(provider);
    const {tokenEndpoint} = oauth2Configs[provider];
    // See https://developers.google.com/identity/protocols/oauth2/web-server#offline
    const requestBody = this.encodeFormQueryParams({
      client_id,
      client_secret: secret,
      grant_type: 'refresh_token',
      refresh_token: creds.RefreshToken,
    });
    const data = await this.requestJSON<GoogleRefreshTokenResponse>(tokenEndpoint, {
      method: 'POST',
      body: requestBody,
      headers: {'content-type': 'application/x-www-form-urlencoded'},
    });
    const partialCreds: Partial<GoogleOAuth2> = {
      AccessToken: data.access_token,
      AccessTokenExpiresAt: this.calculateTokenExpirationTime(data.expires_in),
    };
    await this.googleOAuth2Repository.update({UserID: creds.UserID}, partialCreds);
    return {...creds, ...partialCreds};
  }

  private checkThatNameAndEmailClaimsArePresent<T extends {
    name?: string;
    email?: string;
  }>(decodedIDToken: T) {
    for (const claim of ['name', 'email'] as const) {
      if (!decodedIDToken[claim]) {
        this.logger.error(`'${claim}' is missing from the ID token`);
        throw new OAuth2NoRefreshTokenError();
      }
    }
  }

  /*
    Three possible response types:
    1. user: set; isLinkedToAccountFromOIDCResponse: true; pendingOAuth2Entity: not set
       The response from the OIDC server was successfully associated with
       an existing account and the user may be logged in.
    2. user: set; isLinkedToAccountFromOIDCResponse: false; pendingOAuth2Entity: set
       An account exists with the email address received from the OIDC server,
       but it was never explicitly linked. We need to ask the user for confirmation
       that they want to link these accounts.
    3. user: not set; isLinkedToAccountFromOIDCResponse: false; pendingOAuth2Entity: not set
       An account linked to this Google account existed previously, but it was
       deleted, and the OIDC server still thinks that we own the credentials, so
       it's not giving us a refresh token, but we already discarded the credentials.
       We need to force the user to go through the consent screen again.
  */
  async google_handleLogin(code: string, state: OAuth2State): Promise<{
    isLinkedToAccountFromOIDCResponse: boolean;
    user?: User;
    pendingOAuth2Entity?: DeepPartial<GoogleOAuth2>;
  }> {
    assert(state.reason === 'login');
    const {data, decodedIDToken} = await this.google_getTokenFromCode(code, state);
    this.checkThatNameAndEmailClaimsArePresent(decodedIDToken);
    const userBySub: User | null = await this.usersRepository
      .createQueryBuilder('User')
      .leftJoin('User.GoogleOAuth2', 'GoogleOAuth2')
      .select(columnsForGetUser)
      .where('GoogleOAuth2.Sub = :sub', {sub: decodedIDToken.sub})
      .getOne();
    if (userBySub) {
      return {user: userBySub, isLinkedToAccountFromOIDCResponse: true};
    }
    const userByEmail: User | null = await this.usersRepository
      .createQueryBuilder('User')
      .leftJoin('User.GoogleOAuth2', 'GoogleOAuth2')
      .select(columnsForGetUser)
      .where('User.Email = :email', {email: decodedIDToken.email!})
      .getOne();
    if (userByEmail) {
      return {
        user: userByEmail,
        isLinkedToAccountFromOIDCResponse: false,
        pendingOAuth2Entity: this.google_createOAuth2Entity(userByEmail.ID, data, decodedIDToken),
      };
    }
    // At this point, assume that the user actually wanted to sign up
    // rather than logging in. This is an easy mistake to make, given
    // that "Sign in with Google" buttons are commonly used to sign up
    // new users.
    if (!data.refresh_token) {
      // We need to force the user to go through the consent screen again
      return {isLinkedToAccountFromOIDCResponse: false};
    }
    const newUser = await this.google_updateDatabaseFromOIDCResponseForSignup(data, decodedIDToken);
    return {user: newUser, isLinkedToAccountFromOIDCResponse: true};
  }

  private calculateTokenExpirationTime(expires_in: number): number {
    // Subtract a few seconds to compensate for the time it takes for
    // requests to the OAuth2 server to complete
    return getSecondsSinceUnixEpoch() + expires_in - 5;
  }

  private google_createOAuth2Entity(
    userID: number,
    data: GoogleOIDCResponse,
    decodedIDToken: GoogleDecodedOIDCIDToken,
  ): DeepPartial<GoogleOAuth2> {
    return {
      UserID: userID,
      Sub: decodedIDToken.sub,
      AccessTokenExpiresAt: this.calculateTokenExpirationTime(data.expires_in),
      AccessToken: data.access_token,
      RefreshToken: data.refresh_token,
    };
  }

  async google_fetchAndStoreUserInfoForSignup(code: string, state: OAuth2State): Promise<User> {
    const {data, decodedIDToken} = await this.google_getTokenFromCode(code, state);
    this.google_checkThatRefreshTokenAndScopesArePresent(data, decodedIDToken);
    return this.google_updateDatabaseFromOIDCResponseForSignup(data, decodedIDToken);
  }

  async google_fetchAndStoreUserInfoForLinking(code: string, state: OAuth2State) {
    const {data, decodedIDToken} = await this.google_getTokenFromCode(code, state);
    this.google_checkThatRefreshTokenAndScopesArePresent(data, decodedIDToken);
    await this.google_updateDatabaseFromOIDCResponseForLinking(state.userID!, data, decodedIDToken);
  }

  private google_checkThatRefreshTokenAndScopesArePresent(data: GoogleOIDCResponse, decodedIDToken: GoogleDecodedOIDCIDToken) {
    const provider = OAuth2Provider.GOOGLE;
    if (!data.refresh_token) {
      this.logger.error('Refresh token was not present');
      throw new OAuth2NoRefreshTokenError();
    }
    if (!this.allRequestedScopesArePresent(provider, data.scope)) {
      this.logger.error('Not all requested scopes were present: ' + data.scope);
      throw new OAuth2NotAllScopesGrantedError();
    }
  }

  private async google_updateDatabaseFromOIDCResponseForSignup(
    data: GoogleOIDCResponse,
    decodedIDToken: GoogleDecodedOIDCIDToken,
  ): Promise<User> {
    this.checkThatNameAndEmailClaimsArePresent(decodedIDToken);
    this.google_checkThatRefreshTokenAndScopesArePresent(data, decodedIDToken);
    try {
      let newUser: User;
      await this.dataSource.transaction(async manager => {
        await manager.insert(User, {
          Name: decodedIDToken.name!,
          Email: decodedIDToken.email!,
        });
        newUser = await manager.findOneBy(User, {Email: decodedIDToken.email!});
        await manager.insert(
          GoogleOAuth2,
          this.google_createOAuth2Entity(newUser.ID, data, decodedIDToken)
        );
      });
      return newUser;
    } catch (err: any) {
      err = normalizeDBError(err as Error);
      if (err instanceof UniqueConstraintFailed) {
        throw new OAuth2AccountAlreadyLinkedError();
      }
      throw err;
    }
  }

  private async google_updateDatabaseFromOIDCResponseForLinking(
    userID: number,
    data: GoogleOIDCResponse,
    decodedIDToken: GoogleDecodedOIDCIDToken,
  ) {
    try {
      await this.googleOAuth2Repository.insert(
        this.google_createOAuth2Entity(userID, data, decodedIDToken)
      );
    } catch (err: any) {
      err = normalizeDBError(err as Error);
      if (err instanceof UniqueConstraintFailed) {
        throw new OAuth2AccountAlreadyLinkedError();
      }
      throw err;
    }
  }

  private async google_getOrRefreshCreds(userID: number): Promise<GoogleOAuth2 | null> {
    const creds = await this.googleOAuth2Repository.findOneBy({UserID: userID});
    if (!creds) {
      return null;
    }
    if (creds.AccessTokenExpiresAt > getSecondsSinceUnixEpoch()) {
      return creds;
    }
    return this.google_refreshAccessToken(creds);
  }

  private async google_apiRequest<T>(creds: GoogleOAuth2, ...args: Parameters<typeof request>): Promise<T | null> {
    const accessToken = creds.AccessToken;
    if (args.length < 2) {
      args.push({});
    }
    if (!args[1].headers) {
      args[1].headers = {};
    }
    if (Array.isArray(args[1].headers)) {
      args[1].headers.push('authorization', `Bearer ${accessToken}`);
    } else {
      args[1].headers.authorization = `Bearer ${accessToken}`;
    }
    // Log the method and URL
    this.logger.debug((args[1]?.method || 'GET') + ' ' + args[0]);
    try {
      const {headers, body} = await this.request(...args);
      // The content-type can be e.g. "application/json; charset=UTF-8"
      if (headers['content-type']?.startsWith('application/json')) {
        return body.json();
      } else {
        // Some API endpoints, like deleting an event, return no response body
        return null;
      }
    } catch (err: any) {
      if (err instanceof OAuth2ErrorResponseError && (err as OAuth2ErrorResponseError).statusCode == 401) {
        // Invalid authentication credentials. Assume that the user revoked access
        this.logger.warn(`Invalid credentials for userID=${creds.UserID}. Deleting all OAuth2 data.`);
        await this.googleOAuth2Repository.delete(creds.UserID);
      }
      throw err;
    }
  }

  async google_unlinkAccount(userID: number) {
    const {revokeEndpoint} = oauth2Configs[OAuth2Provider.GOOGLE];
    const creds = await this.googleOAuth2Repository.findOneBy({UserID: userID});
    if (!creds) {
      return;
    }
    const user = await this.usersRepository.findOneBy({ID: userID})!;
    if (!user.PasswordHash) {
      // We want to make sure that the user has at least one way to sign in.
      // If they originally signed up via an OAuth2 provider, then we'll delete
      // the calendar data, but keep the OAuth2 token so that they can still sign in.
      await this.dataSource.transaction(async manager => {
        await manager.update(GoogleOAuth2, {UserID: userID}, {LinkedCalendar: false});
        await manager.delete(GoogleCalendarEvents, {UserID: userID});
      });
      return;
    }
    // See https://developers.google.com/identity/protocols/oauth2/web-server#tokenrevoke
    await this.request(revokeEndpoint, {
      method: 'POST',
      body: this.encodeFormQueryParams({token: creds.RefreshToken}),
      headers: {'content-type': 'application/x-www-form-urlencoded'},
    });
    await this.googleOAuth2Repository.delete(userID);
  }

  private GoogleListEventsResponseItem_to_GoogleCalendarEvent(item: GoogleListEventsResponseItem): GoogleCalendarEvent {
    return {
      ID: item.id,
      summary: item.summary,
      start: customToISOString(new Date(item.start.dateTime)),
      end: customToISOString(new Date(item.end.dateTime)),
    };
  }

  private google_mergeResultsFromIncrementalSync(
    events: GoogleCalendarEvent[],
    newItems: GoogleListEventsResponseItem[]
  ): GoogleCalendarEvent[] {
    const eventsMap: Record<string, GoogleCalendarEvent> = {};
    for (const event of events) {
      eventsMap[event.ID] = event;
    }
    for (const item of newItems) {
      // See https://developers.google.com/calendar/api/v3/reference/events#resource
      if (item.status === 'cancelled') {
        delete eventsMap[item.id];
      } else {
        // update or insert
        eventsMap[item.id] = this.GoogleListEventsResponseItem_to_GoogleCalendarEvent(item);
      }
    }
    return Object.values(eventsMap);
  }

  private async google_getEventsForMeetingUsingIncrementalSync(
    creds: GoogleOAuth2,
    userID: number,
    meetingID: number,
    minDate: string,
    maxDate: string,
  ): Promise<{
    events: GoogleCalendarEvent[],
    nextSyncToken: string | null,
    needToSaveEvents: boolean;
  } | null> {
    const existingEventsData = await this.googleCalendarEventsRepository.findOneBy({
      UserID: userID, MeetingID: meetingID
    });
    if (
      !existingEventsData
      || !existingEventsData.SyncToken
      || existingEventsData.MeetingMinDate !== minDate
      || existingEventsData.MeetingMaxDate !== maxDate
    ) {
      return null;
    }
    const params = {syncToken: existingEventsData.SyncToken};
    const url = GOOGLE_API_CALENDAR_EVENTS_BASE_URL + '?' + this.encodeQueryParams(params);
    let response: GoogleListEventsResponse | undefined;
    try {
      response = await this.google_apiRequest<GoogleListEventsResponse>(creds, url);
      this.logger.debug(response);
    } catch (err: any) {
      // See https://developers.google.com/calendar/api/guides/sync#full_sync_required_by_server
      if (!(
        err instanceof OAuth2ErrorResponseError
        && (err as OAuth2ErrorResponseError).statusCode === 410
      )) {
        throw err;
      }
    }
    // We don't want to perform pagination (for now)
    if (!response || response.nextPageToken) {
      return null;
    }
    const thereAreNewEvents = response.items.length > 0;
    const existingEvents = JSON.parse(existingEventsData.Events) as GoogleCalendarEvent[];
    const events =
      thereAreNewEvents
      ? this.google_mergeResultsFromIncrementalSync(existingEvents, response.items)
      : existingEvents;
    return {
      events,
      nextSyncToken: response.nextSyncToken || null,
      needToSaveEvents: thereAreNewEvents,
    };
  }

  private async google_getEventsForMeetingUsingFullSync(
    creds: GoogleOAuth2,
    minDate: string,
    maxDate: string,
  ): Promise<{
    events: GoogleCalendarEvent[],
    nextSyncToken: string | null,
  } | null> {
    // Make sure to NOT use orderBy, otherwise a syncToken won't be returned
    const params: Record<string, string> = {
      maxAttendees: '1',
      maxResults: String(MAX_EVENT_RESULTS),
      singleEvents: 'true',
      timeMin: `${minDate}T00:00:00Z`,
      timeMax: `${maxDate}T00:00:00Z`,
    };
    const url = GOOGLE_API_CALENDAR_EVENTS_BASE_URL + '?' + this.encodeQueryParams(params);
    const response = await this.google_apiRequest<GoogleListEventsResponse>(creds, url);
    this.logger.debug(response);
    const events = response.items.map(
      item => this.GoogleListEventsResponseItem_to_GoogleCalendarEvent(item)
    );
    return {events, nextSyncToken: response.nextSyncToken || null};
  }

  async google_getEventsForMeeting(userID: number, meetingID: number): Promise<GoogleCalendarEvent[]> {
    const creds = await this.google_getOrRefreshCreds(userID);
    if (!creds || !creds.LinkedCalendar) {
      return [];
    }
    const tentativeDates = await this.meetingsService.getMeetingTentativeDates(meetingID);
    const minDate = tentativeDates.reduce((a, b) => a < b ? a : b);
    const maxDate = tentativeDates.reduce((a, b) => a > b ? a : b);
    let existingEventsData = await this.google_getEventsForMeetingUsingIncrementalSync(creds, userID, meetingID, minDate, maxDate);
    let events: GoogleCalendarEvent[];
    let nextSyncToken: string | null = null;
    let needToSaveEvents = true;
    if (existingEventsData) {
      ({events, nextSyncToken, needToSaveEvents} = existingEventsData);
    } else {
      const newEventsData = await this.google_getEventsForMeetingUsingFullSync(creds, minDate, maxDate);
      ({events, nextSyncToken} = newEventsData);
    }
    if (needToSaveEvents) {
      await this.googleCalendarEventsRepository.save({
        MeetingID: meetingID,
        UserID: userID,
        Events: JSON.stringify(events),
        MeetingMinDate: minDate,
        MeetingMaxDate: maxDate,
        SyncToken: nextSyncToken,
      });
    }
    // Filter out the event which we created for this meeting
    const createdEvent = await this.googleCalendarCreatedEventsRepository.findOneBy({MeetingID: meetingID, UserID: userID});
    if (createdEvent) {
      events = events.filter(event => event.ID !== createdEvent.CreatedGoogleMeetingID);
    }
    return events;
  }

  private async google_apiDeleteEvent(creds: GoogleOAuth2, meetingID: number): Promise<void> {
    const event = await this.googleCalendarCreatedEventsRepository.findOneBy({MeetingID: meetingID});
    if (!event) {
      return;
    }
    const url = `${GOOGLE_API_CALENDAR_EVENTS_BASE_URL}/${event.CreatedGoogleMeetingID}`;
    try {
      await this.google_apiRequest(creds, url, {method: 'DELETE'});
    } catch (err: any) {
      if (!(
        err instanceof OAuth2ErrorResponseError
        && (
          (err as OAuth2ErrorResponseError).statusCode === 404
          || (err as OAuth2ErrorResponseError).statusCode === 410
        )
      )) {
        throw err;
      }
    }
  }

  async google_createEventForMeeting(
    userID: number,
    meetingID: number,
    startDateTime: string,
    endDateTime: string
  ): Promise<void> {
    const creds = await this.google_getOrRefreshCreds(userID);
    if (!creds || !creds.LinkedCalendar) {
      return;
    }
    const meeting = await this.meetingsService.getMeetingOrThrow(meetingID);
    // Check if existing Google event exists, delete it if necessary
    await this.google_apiDeleteEvent(creds, meetingID);
    const params: Record<string, any> = {
      start: {
        dateTime: startDateTime,
      },
      end: {
        dateTime: endDateTime,
      },
      description: meeting.About,
      summary: meeting.Name,
    };
    const publicURL = stripTrailingSlash(this.configService.get('PUBLIC_URL', {infer: true}));
    if (publicURL) {
      params.source = {
        url: `${publicURL}/m/${meetingID}`,
      };
    }
    const response = await this.google_apiRequest<GoogleInsertEventResponse>(creds, GOOGLE_API_CALENDAR_EVENTS_BASE_URL, {
      method: 'POST',
      body: JSON.stringify(params),
      headers: {'content-type': 'application/json'},
    });
    await this.googleCalendarCreatedEventsRepository.save({
      MeetingID: meetingID,
      UserID: userID,
      CreatedGoogleMeetingID: response.id,
    });
  }

  async google_deleteEventForMeeting(userID: number, meetingID: number): Promise<void> {
    const creds = await this.google_getOrRefreshCreds(userID);
    if (!creds || !creds.LinkedCalendar) {
      return;
    }
    await this.google_apiDeleteEvent(creds, meetingID);
    await this.googleCalendarCreatedEventsRepository.delete({MeetingID: meetingID, UserID: userID});
  }
}