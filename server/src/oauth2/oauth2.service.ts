import { Injectable, Logger } from '@nestjs/common';
import ConfigService from '../config/config.service';
import { InjectRepository } from '@nestjs/typeorm';
import * as jwt from 'jsonwebtoken';
import { request } from 'undici';
import GoogleOAuth2 from './google-oauth2.entity';
import { DataSource, Repository } from 'typeorm';
import CacherService from '../cacher/cacher.service';
import { normalizeDBError, UniqueConstraintFailed } from '../database.utils';
import User from '../users/user.entity';
import { assert, encodeQueryParams } from '../misc.utils';
import { selectUserLeftJoinOAuth2Tables } from '../users/users.service';
import type {
  OIDCResponse,
  DecodedIDToken,
  RefreshTokenResponse,
} from './oauth2-response-types';
import { getSecondsSinceUnixEpoch } from '../dates.utils';
import MeetingsService from '../meetings/meetings.service';
import GoogleCalendarEvents from './google-calendar-events.entity';
import {
  AbstractOAuth2CalendarCreatedEvent,
  OAuth2CalendarEvent,
  oauth2CreatedEventTableNamesMap,
  oauth2TableNamesMap,
} from './oauth2-common';
import GoogleCalendarCreatedEvent from './google-calendar-created-event.entity';
import Meeting from '../meetings/meeting.entity';
import {
  oauth2Reasons,
  OAuth2ProviderType,
  OAuth2ErrorResponseError,
  OAuth2NotConfiguredError,
  OAuth2NoRefreshTokenError,
  OAuth2NotAllScopesGrantedError,
  OAuth2AccountAlreadyLinkedError,
} from './oauth2-common';
import GoogleOAuth2Provider from './google-oauth2-provider';
import MicrosoftOAuth2Provider from './microsoft-oauth2-provider';
import AbstractOAuth2 from './abstract-oauth2.entity';
import MicrosoftOAuth2 from './microsoft-oauth2.entity';
import MicrosoftCalendarEvents from './microsoft-calendar-events.entity';
import MicrosoftCalendarCreatedEvent from './microsoft-calendar-created-event.entity';

// TODO: use truncated exponential backoff
// See https://developers.google.com/calendar/api/guides/quota

const oauth2EntityClasses: Record<
  OAuth2ProviderType,
  typeof GoogleOAuth2 | typeof MicrosoftOAuth2
> = {
  [OAuth2ProviderType.GOOGLE]: GoogleOAuth2,
  [OAuth2ProviderType.MICROSOFT]: MicrosoftOAuth2,
};
const calendarEventsEntityClasses: Record<
  OAuth2ProviderType,
  typeof GoogleCalendarEvents | typeof MicrosoftCalendarEvents
> = {
  [OAuth2ProviderType.GOOGLE]: GoogleCalendarEvents,
  [OAuth2ProviderType.MICROSOFT]: MicrosoftCalendarEvents,
};

export enum OIDCLoginResultType {
  // The response from the OIDC server was successfully associated with
  // an existing account and the user may be logged in.
  USER_EXISTS_AND_IS_LINKED,
  // An account exists with the email address received from the OIDC server,
  // but it was never explicitly linked. We need to ask the user for confirmation
  // that they want to link these accounts.
  USER_EXISTS_BUT_IS_NOT_LINKED,
  // An account was previously linked to this OAuth2 account, but it is now
  // unlinked, and the OIDC server still thinks that we own the credentials.
  // We need to force the user to go through the consent screen again.
  USER_EXISTS_BUT_IS_NOT_LINKED_AND_NEED_A_NEW_REFRESH_TOKEN,
  // An account linked to this Google account existed previously, but it was
  // deleted, and the OIDC server still thinks that we own the credentials.
  // We need to force the user to go through the consent screen again.
  USER_DOES_NOT_EXIST_AND_NEED_A_NEW_REFRESH_TOKEN,
}
export type OIDCLoginResult =
  | {
      type:
        | OIDCLoginResultType.USER_EXISTS_AND_IS_LINKED
        | OIDCLoginResultType.USER_EXISTS_BUT_IS_NOT_LINKED_AND_NEED_A_NEW_REFRESH_TOKEN;
      user: User;
    }
  | {
      type: OIDCLoginResultType.USER_EXISTS_BUT_IS_NOT_LINKED;
      user: User;
      pendingOAuth2Entity: Partial<AbstractOAuth2>;
    }
  | {
      type: OIDCLoginResultType.USER_DOES_NOT_EXIST_AND_NEED_A_NEW_REFRESH_TOKEN;
    };
export type OAuth2Reason = typeof oauth2Reasons[number];
export type OAuth2State = {
  reason: OAuth2Reason;
  postRedirect: string;
  userID?: number;
  // This is a nonce passed from the client (browser) to the app server.
  clientNonce?: string;
  // This is a nonce passed from the app server to the OIDC server.
  serverNonce?: string;
};

export interface OAuth2Config {
  authzEndpoint: string;
  tokenEndpoint: string;
  revokeEndpoint?: string;
  scopes: string[];
}
export interface PartialAuthzQueryParams {
  client_id: string;
  redirect_uri: string;
  access_type?: 'offline'; // Google only
  code_challenge?: string; // Microsoft only (PKCE)
  code_challenge_method?: 'S256'; // Microsoft only (PKCE)

  // This isn't actually a query param; it gets inserted into the 'state' param.
  // Used only for Microsoft so that we can lookup the code verifier.
  serverNonce?: string;
}
export interface PartialTokenFormParams {
  client_id: string;
  redirect_uri: string;
  client_secret?: string; // Google only
  code_verifier?: string; // Microsoft only (PKCE)
  client_assertion_type?: string; // Microsoft only (certificate credential)
  client_assertion?: string; // Microsoft only (certificate credential)
}
export interface PartialRefreshParams {
  client_id: string;
  client_secret?: string; // Google only
  client_assertion_type?: string; // Microsoft only (certificate credential)
  client_assertion?: string; // Microsoft only (certificate credential)
}
export interface IOAuth2Provider {
  type: OAuth2ProviderType;
  isConfigured(): boolean;
  getStaticOAuth2Config(): OAuth2Config;
  getScopesToExpectInResponse(): string[];
  getPartialAuthzQueryParams(): Promise<PartialAuthzQueryParams>;
  getPartialTokenFormParams(
    serverNonce?: string,
  ): Promise<PartialTokenFormParams>;
  getPartialRefreshParams(): Promise<PartialRefreshParams>;
  setLinkedCalendarToTrue(user: User): void;
  getEventsForMeeting(
    creds: AbstractOAuth2,
    meeting: Meeting,
  ): Promise<OAuth2CalendarEvent[]>;
  createOrUpdateEventForMeeting(
    creds: AbstractOAuth2,
    existingEvent: AbstractOAuth2CalendarCreatedEvent | null,
    meeting: Meeting,
  ): Promise<void>;
  deleteEventForMeeting(
    creds: AbstractOAuth2,
    event: AbstractOAuth2CalendarCreatedEvent,
  ): Promise<void>;
}

@Injectable()
export default class OAuth2Service {
  private readonly logger = new Logger(OAuth2Service.name);
  private readonly oauth2Providers: Record<OAuth2ProviderType, IOAuth2Provider>;
  private readonly oauth2Repositories: Record<
    OAuth2ProviderType,
    Repository<AbstractOAuth2>
  >;

  constructor(
    configService: ConfigService,
    cacherService: CacherService,
    private meetingsService: MeetingsService,
    private dataSource: DataSource,
    @InjectRepository(User) private usersRepository: Repository<User>,
    @InjectRepository(GoogleOAuth2)
    googleOAuth2Repository: Repository<GoogleOAuth2>,
    @InjectRepository(GoogleCalendarEvents)
    googleCalendarEventsRepository: Repository<GoogleCalendarEvents>,
    @InjectRepository(GoogleCalendarCreatedEvent)
    googleCalendarCreatedEventsRepository: Repository<GoogleCalendarCreatedEvent>,
    @InjectRepository(MicrosoftOAuth2)
    microsoftOAuth2Repository: Repository<MicrosoftOAuth2>,
    @InjectRepository(MicrosoftCalendarEvents)
    microsoftCalendarEventsRepository: Repository<MicrosoftCalendarEvents>,
    @InjectRepository(MicrosoftCalendarCreatedEvent)
    microsoftCalendarCreatedEventsRepository: Repository<MicrosoftCalendarCreatedEvent>,
  ) {
    this.oauth2Providers = {
      [OAuth2ProviderType.GOOGLE]: new GoogleOAuth2Provider(
        configService,
        this,
        googleCalendarEventsRepository,
        googleCalendarCreatedEventsRepository,
      ),
      [OAuth2ProviderType.MICROSOFT]: new MicrosoftOAuth2Provider(
        configService,
        cacherService,
        this,
        microsoftCalendarEventsRepository,
        microsoftCalendarCreatedEventsRepository,
      ),
    };
    this.oauth2Repositories = {
      [OAuth2ProviderType.GOOGLE]: googleOAuth2Repository,
      [OAuth2ProviderType.MICROSOFT]: microsoftOAuth2Repository,
    };
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
    this.logger.debug(`${args[1]?.method || 'GET'} ${args[0]}`);
    const response = await request(...args);
    const { statusCode, body } = response;
    if (!this.isSuccessStatusCode(statusCode)) {
      const errorText = await body.text();
      let errorBody: any;
      let errorCodeStr: string | undefined;
      try {
        errorBody = JSON.parse(errorText);
      } catch (jsonErr) {}
      // If the token is expired or revoked, the Google API will return a 400 response like
      // {"error": "invalid_grant", "error_description": "Token has been expired or revoked."}
      if (
        typeof errorBody === 'object' &&
        typeof errorBody.error === 'string'
      ) {
        errorCodeStr = errorBody.error;
      }
      this.logger.error(`statusCode=${statusCode} body=${errorText}`);
      throw new OAuth2ErrorResponseError(statusCode, errorCodeStr);
    }
    return response;
  }

  private async requestJSON<T>(
    ...args: Parameters<typeof request>
  ): Promise<T> {
    return (await this.request(...args)).body.json();
  }

  private allRequestedScopesArePresent(
    provider: IOAuth2Provider,
    scopeStr: string,
  ): boolean {
    const responseScopes = scopeStr.split(' ');
    const expectedScopes = provider.getScopesToExpectInResponse();
    return expectedScopes.every((scope) => responseScopes.includes(scope));
  }

  private getProvider(providerType: OAuth2ProviderType): IOAuth2Provider {
    const provider = this.oauth2Providers[providerType];
    if (!provider.isConfigured()) throw new OAuth2NotConfiguredError();
    return provider;
  }

  providerIsSupported(providerType: OAuth2ProviderType): boolean {
    return this.oauth2Providers[providerType].isConfigured();
  }

  private getSupportedProviders(): IOAuth2Provider[] {
    return Object.values(this.oauth2Providers).filter((provider) =>
      provider.isConfigured(),
    );
  }

  async getRequestURL(
    providerType: OAuth2ProviderType,
    state: OAuth2State,
    promptConsent: boolean,
  ): Promise<string> {
    const provider = this.getProvider(providerType);
    const { authzEndpoint, scopes } = provider.getStaticOAuth2Config();
    const { serverNonce, ...partialParams } =
      await provider.getPartialAuthzQueryParams();
    if (serverNonce) {
      state.serverNonce = serverNonce;
    }
    const params: Record<string, string> = {
      ...partialParams,
      response_type: 'code',
      response_mode: 'query',
      scope: scopes.join(' '),
      state: JSON.stringify(state),
    };
    if (promptConsent) {
      params.prompt = 'consent';
    }
    return authzEndpoint + '?' + encodeQueryParams(params);
  }

  private async getTokenFromCode(
    provider: IOAuth2Provider,
    code: string,
    state: OAuth2State,
  ): Promise<{
    data: OIDCResponse;
    decodedIDToken: DecodedIDToken;
  }> {
    if (!provider.isConfigured()) throw new OAuth2NotConfiguredError();
    const partialParams = await provider.getPartialTokenFormParams(
      state.serverNonce,
    );
    const { tokenEndpoint } = provider.getStaticOAuth2Config();
    // See https://developers.google.com/identity/protocols/oauth2/web-server#exchange-authorization-code
    //     https://learn.microsoft.com/en-us/azure/active-directory/develop/v2-oauth2-auth-code-flow#request-an-access-token-with-a-certificate-credential
    const requestBody = this.encodeFormQueryParams({
      ...partialParams,
      code,
      grant_type: 'authorization_code',
    });
    const data = await this.requestJSON<OIDCResponse>(tokenEndpoint, {
      method: 'POST',
      body: requestBody,
      headers: { 'content-type': 'application/x-www-form-urlencoded' },
    });
    this.logger.debug(data);
    // TODO: validate the ID token
    const decodedIDToken = jwt.decode(data.id_token) as DecodedIDToken;
    this.logger.debug(decodedIDToken);
    return { data, decodedIDToken };
  }

  private async refreshAccessToken(
    provider: IOAuth2Provider,
    creds: AbstractOAuth2,
  ): Promise<AbstractOAuth2> {
    const partialParams = await provider.getPartialRefreshParams();
    const { tokenEndpoint } = provider.getStaticOAuth2Config();
    // See https://developers.google.com/identity/protocols/oauth2/web-server#offline
    //     https://learn.microsoft.com/en-us/graph/auth-v2-user#request
    const requestBody = this.encodeFormQueryParams({
      ...partialParams,
      grant_type: 'refresh_token',
      refresh_token: creds.RefreshToken,
    });
    let data: RefreshTokenResponse | undefined;
    try {
      data = await this.requestJSON<RefreshTokenResponse>(tokenEndpoint, {
        method: 'POST',
        body: requestBody,
        headers: { 'content-type': 'application/x-www-form-urlencoded' },
      });
    } catch (err: any) {
      await this.deleteCredsIfErrorIsInvalidToken(provider, err, creds);
      throw err;
    }
    const partialCreds: Partial<AbstractOAuth2> = {
      AccessToken: data.access_token,
      AccessTokenExpiresAt: this.calculateTokenExpirationTime(data.expires_in),
    };
    if (data.refresh_token) {
      partialCreds.RefreshToken = data.refresh_token;
    }
    const oauth2Repository = this.oauth2Repositories[provider.type];
    await oauth2Repository.update({ UserID: creds.UserID }, partialCreds);
    return { ...creds, ...partialCreds };
  }

  private checkThatNameAndEmailClaimsArePresent<
    T extends {
      name?: string;
      email?: string;
    },
  >(decodedIDToken: T) {
    for (const claim of ['name', 'email'] as const) {
      if (!decodedIDToken[claim]) {
        this.logger.error(`'${claim}' is missing from the ID token`);
        throw new OAuth2NoRefreshTokenError();
      }
    }
  }

  async handleLogin(
    providerType: OAuth2ProviderType,
    code: string,
    state: OAuth2State,
  ): Promise<OIDCLoginResult> {
    assert(state.reason === 'login');
    const provider = this.getProvider(providerType);
    const oauth2ClassName = oauth2EntityClasses[providerType].name;
    const oauth2Repository = this.oauth2Repositories[providerType];
    const { data, decodedIDToken } = await this.getTokenFromCode(
      provider,
      code,
      state,
    );
    this.checkThatNameAndEmailClaimsArePresent(decodedIDToken);
    const userBySub: User | null = await selectUserLeftJoinOAuth2Tables(
      this.usersRepository,
    )
      .where(`${oauth2ClassName}.Sub = :sub`, { sub: decodedIDToken.sub })
      .getOne();
    if (userBySub) {
      // update the credentials stored in the database
      const partialCreds: Partial<AbstractOAuth2> = {
        AccessToken: data.access_token,
        AccessTokenExpiresAt: this.calculateTokenExpirationTime(
          data.expires_in,
        ),
      };
      if (data.refresh_token) {
        partialCreds.RefreshToken = data.refresh_token;
      }
      await oauth2Repository.update({ UserID: userBySub.ID }, partialCreds);
      return {
        type: OIDCLoginResultType.USER_EXISTS_AND_IS_LINKED,
        user: userBySub,
      };
    }
    const userByEmail: User | null = await selectUserLeftJoinOAuth2Tables(
      this.usersRepository,
    )
      .where('User.Email = :email', { email: decodedIDToken.email! })
      .getOne();
    if (userByEmail) {
      if (data.refresh_token) {
        return {
          type: OIDCLoginResultType.USER_EXISTS_BUT_IS_NOT_LINKED,
          user: userByEmail,
          pendingOAuth2Entity: this.createPartialOAuth2Entity(
            userByEmail.ID,
            data,
            decodedIDToken,
          ),
        };
      } else {
        return {
          type: OIDCLoginResultType.USER_EXISTS_BUT_IS_NOT_LINKED_AND_NEED_A_NEW_REFRESH_TOKEN,
          user: userByEmail,
        };
      }
    }
    // At this point, assume that the user actually wanted to sign up
    // rather than logging in. This is an easy mistake to make, given
    // that "Sign in with Google" buttons are commonly used to sign up
    // new users.
    if (!data.refresh_token) {
      // We need to force the user to go through the consent screen again
      return {
        type: OIDCLoginResultType.USER_DOES_NOT_EXIST_AND_NEED_A_NEW_REFRESH_TOKEN,
      };
    }
    const newUser = await this.updateDatabaseFromOIDCResponseForSignup(
      provider,
      data,
      decodedIDToken,
    );
    return {
      type: OIDCLoginResultType.USER_EXISTS_AND_IS_LINKED,
      user: newUser,
    };
  }

  private calculateTokenExpirationTime(expires_in: number): number {
    // Subtract a few seconds to compensate for the time it takes for
    // requests to the OAuth2 server to complete
    return getSecondsSinceUnixEpoch() + expires_in - 5;
  }

  private createPartialOAuth2Entity(
    userID: number,
    data: OIDCResponse,
    decodedIDToken: DecodedIDToken,
  ): Partial<AbstractOAuth2> {
    return {
      UserID: userID,
      Sub: decodedIDToken.sub,
      AccessTokenExpiresAt: this.calculateTokenExpirationTime(data.expires_in),
      AccessToken: data.access_token,
      RefreshToken: data.refresh_token,
    };
  }

  async fetchAndStoreUserInfoForSignup(
    providerType: OAuth2ProviderType,
    code: string,
    state: OAuth2State,
  ): Promise<User> {
    const provider = this.getProvider(providerType);
    const { data, decodedIDToken } = await this.getTokenFromCode(
      provider,
      code,
      state,
    );
    return this.updateDatabaseFromOIDCResponseForSignup(
      provider,
      data,
      decodedIDToken,
    );
  }

  async fetchAndStoreUserInfoForLinking(
    providerType: OAuth2ProviderType,
    code: string,
    state: OAuth2State,
  ) {
    const provider = this.getProvider(providerType);
    const { data, decodedIDToken } = await this.getTokenFromCode(
      provider,
      code,
      state,
    );
    await this.updateDatabaseFromOIDCResponseForLinking(
      provider,
      state.userID!,
      data,
      decodedIDToken,
    );
  }

  private checkThatRefreshTokenAndScopesArePresent(
    provider: IOAuth2Provider,
    data: OIDCResponse,
  ) {
    if (!data.refresh_token) {
      this.logger.error('Refresh token was not present');
      throw new OAuth2NoRefreshTokenError();
    }
    if (!this.allRequestedScopesArePresent(provider, data.scope)) {
      this.logger.error('Not all requested scopes were present: ' + data.scope);
      throw new OAuth2NotAllScopesGrantedError();
    }
  }

  private async updateDatabaseFromOIDCResponseForSignup(
    provider: IOAuth2Provider,
    data: OIDCResponse,
    decodedIDToken: DecodedIDToken,
  ): Promise<User> {
    this.checkThatRefreshTokenAndScopesArePresent(provider, data);
    this.checkThatNameAndEmailClaimsArePresent(decodedIDToken);
    try {
      let newUser: User;
      await this.dataSource.transaction(async (manager) => {
        await manager.insert(User, {
          Name: decodedIDToken.name!,
          Email: decodedIDToken.email!,
        });
        // TODO: use RETURNING clause to avoid reading the row which we just created
        newUser = await manager.findOneBy(User, {
          Email: decodedIDToken.email!,
        });
        await manager.insert(
          oauth2EntityClasses[provider.type],
          this.createPartialOAuth2Entity(newUser.ID, data, decodedIDToken),
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

  private async updateDatabaseFromOIDCResponseForLinking(
    provider: IOAuth2Provider,
    userID: number,
    data: OIDCResponse,
    decodedIDToken: DecodedIDToken,
  ) {
    this.checkThatRefreshTokenAndScopesArePresent(provider, data);
    this.checkThatNameAndEmailClaimsArePresent(decodedIDToken);
    const repository = this.oauth2Repositories[provider.type];
    try {
      await repository.insert(
        this.createPartialOAuth2Entity(userID, data, decodedIDToken),
      );
    } catch (err: any) {
      err = normalizeDBError(err as Error);
      if (err instanceof UniqueConstraintFailed) {
        throw new OAuth2AccountAlreadyLinkedError();
      }
      throw err;
    }
  }

  async linkAccountFromConfirmation(
    providerType: OAuth2ProviderType,
    user: User,
    oauth2Entity: Partial<AbstractOAuth2>,
  ) {
    const provider = this.getProvider(providerType);
    const repository = this.oauth2Repositories[providerType];
    try {
      await repository.insert(oauth2Entity);
      provider.setLinkedCalendarToTrue(user);
    } catch (err: any) {
      err = normalizeDBError(err as Error);
      if (err instanceof UniqueConstraintFailed) {
        throw new OAuth2AccountAlreadyLinkedError();
      }
      throw err;
    }
  }

  private async refreshCredsIfNecessary(
    provider: IOAuth2Provider,
    creds: AbstractOAuth2,
  ): Promise<AbstractOAuth2> {
    if (creds.AccessTokenExpiresAt > getSecondsSinceUnixEpoch()) {
      return creds;
    }
    return this.refreshAccessToken(provider, creds);
  }

  async getOrRefreshCreds(
    provider: IOAuth2Provider,
    userID: number,
  ): Promise<AbstractOAuth2 | null> {
    const oauth2Repository = this.oauth2Repositories[provider.type];
    const creds = await oauth2Repository.findOneBy({ UserID: userID });
    if (!creds) {
      return null;
    }
    return this.refreshCredsIfNecessary(provider, creds);
  }

  private async deleteCredsIfErrorIsInvalidToken(
    provider: IOAuth2Provider,
    err: any,
    creds: AbstractOAuth2,
  ) {
    if (
      err instanceof OAuth2ErrorResponseError &&
      ((err as OAuth2ErrorResponseError).statusCode === 401 ||
        (err as OAuth2ErrorResponseError).errorCode === 'invalid_grant')
    ) {
      // Invalid authentication credentials. Assume that the user revoked access
      this.logger.warn(
        `Invalid credentials for userID=${creds.UserID}. Deleting all OAuth2 data.`,
      );
      const oauth2Repository = this.oauth2Repositories[provider.type];
      await oauth2Repository.delete(creds.UserID);
    }
  }

  async apiRequest<T>(
    provider: IOAuth2Provider,
    creds: AbstractOAuth2,
    ...args: Parameters<typeof request>
  ): Promise<T | null> {
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
    try {
      const { headers, body } = await this.request(...args);
      // The content-type can be e.g. "application/json; charset=UTF-8"
      if (headers['content-type']?.startsWith('application/json')) {
        return body.json();
      } else {
        // Some API endpoints, like deleting an event, return no response body
        return null;
      }
    } catch (err: any) {
      await this.deleteCredsIfErrorIsInvalidToken(provider, err, creds);
      throw err;
    }
  }

  async unlinkAccount(providerType: OAuth2ProviderType, userID: number) {
    const provider = this.getProvider(providerType);
    const oauth2Repository = this.oauth2Repositories[providerType];
    const creds = await oauth2Repository.findOneBy({ UserID: userID });
    if (!creds) {
      return;
    }
    const user = await this.usersRepository.findOneBy({ ID: userID })!;
    if (!user.PasswordHash) {
      // We want to make sure that the user has at least one way to sign in.
      // If they originally signed up via an OAuth2 provider, then we'll delete
      // the calendar data, but keep the OAuth2 token so that they can still sign in.
      const oauth2EntityClass = oauth2EntityClasses[providerType];
      const calendarEventsEntityClass =
        calendarEventsEntityClasses[providerType];
      await this.dataSource.transaction(async (manager) => {
        await manager.update(
          oauth2EntityClass,
          { UserID: userID },
          { LinkedCalendar: false },
        );
        await manager.delete(calendarEventsEntityClass, { UserID: userID });
      });
      return;
    }
    const { revokeEndpoint } = provider.getStaticOAuth2Config();
    // Microsoft doesn't have a revocation endpoint
    if (revokeEndpoint) {
      // See https://developers.google.com/identity/protocols/oauth2/web-server#tokenrevoke
      await this.request(revokeEndpoint, {
        method: 'POST',
        body: this.encodeFormQueryParams({ token: creds.RefreshToken }),
        headers: { 'content-type': 'application/x-www-form-urlencoded' },
      });
    }
    await oauth2Repository.delete(userID);
  }

  async unlinkAllOAuth2Accounts(userID: number) {
    const results = await Promise.allSettled(
      this.getSupportedProviders().map((provider) =>
        this.unlinkAccount(provider.type, userID),
      ),
    );
    for (const result of results) {
      if (result.status === 'rejected') {
        this.logger.error(result.reason);
      }
    }
  }

  async getEventsForMeeting(
    providerType: OAuth2ProviderType,
    userID: number,
    meetingID: number,
  ): Promise<OAuth2CalendarEvent[]> {
    const provider = this.getProvider(providerType);
    const meeting = await this.meetingsService.getMeetingOrThrow(meetingID);
    const creds = await this.getOrRefreshCreds(provider, userID);
    if (!creds || !creds.LinkedCalendar) {
      return [];
    }
    const events = await provider.getEventsForMeeting(creds, meeting);
    // sort by start date
    events.sort((event1, event2) => event1.start.localeCompare(event2.start));
    return events;
  }

  private getOAuth2LinkedRespondents(
    provider: IOAuth2Provider,
    meetingID: number,
  ): Promise<AbstractOAuth2[]> {
    const oauth2TableName = oauth2TableNamesMap[provider.type];
    const createdEventTableName =
      oauth2CreatedEventTableNamesMap[provider.type];
    return this.oauth2Repositories[provider.type]
      .createQueryBuilder()
      .innerJoin(`${oauth2TableName}.User`, 'User')
      .innerJoin(
        'User.Respondents',
        'MeetingRespondent',
        'MeetingRespondent.MeetingID = :meetingID',
        { meetingID },
      )
      .leftJoin(
        `${oauth2TableName}.CreatedEvents`,
        createdEventTableName,
        `${createdEventTableName}.MeetingID IS NULL OR` +
          ` ${createdEventTableName}.MeetingID = :meetingID`,
        { meetingID },
      )
      .where(`${oauth2TableName}.LinkedCalendar`)
      .select([oauth2TableName, createdEventTableName])
      .getMany();
  }

  private async tryCreateOrUpdateEventsForMeetingForAllRespondents_provider(
    provider: IOAuth2Provider,
    meeting: Meeting,
  ) {
    const linkedRespondents = await this.getOAuth2LinkedRespondents(
      provider,
      meeting.ID,
    );
    const results = await Promise.allSettled(
      linkedRespondents.map((linkedRespondent) =>
        this.createOrUpdateEventForMeeting(
          provider,
          linkedRespondent,
          linkedRespondent.CreatedEvents.length > 0
            ? linkedRespondent.CreatedEvents[0]
            : null,
          meeting,
        ),
      ),
    );
    for (const result of results) {
      if (result.status === 'rejected') {
        this.logger.error(result.reason);
      }
    }
  }

  async tryCreateOrUpdateEventsForMeetingForAllRespondents(
    meeting: Meeting,
  ): Promise<PromiseSettledResult<void>[]> {
    if (
      meeting.ScheduledStartDateTime === null ||
      meeting.ScheduledEndDateTime === null
    ) {
      return;
    }
    const results = await Promise.allSettled(
      this.getSupportedProviders().map((provider) =>
        this.tryCreateOrUpdateEventsForMeetingForAllRespondents_provider(
          provider,
          meeting,
        ),
      ),
    );
    for (const result of results) {
      if (result.status === 'rejected') {
        this.logger.error(result.reason);
      }
    }
  }

  private async createOrUpdateEventForMeeting(
    provider: IOAuth2Provider,
    creds: AbstractOAuth2,
    existingEvent: AbstractOAuth2CalendarCreatedEvent,
    meeting: Meeting,
  ): Promise<void> {
    if (
      meeting.ScheduledStartDateTime === null ||
      meeting.ScheduledEndDateTime === null
    ) {
      return;
    }
    creds = await this.refreshCredsIfNecessary(provider, creds);
    return provider.createOrUpdateEventForMeeting(
      creds,
      existingEvent,
      meeting,
    );
  }

  private async tryCreateOrUpdateEventsForMeetingForSingleRespondent_provider(
    provider: IOAuth2Provider,
    userID: number,
    meeting: Meeting,
  ) {
    const oauth2TableName = oauth2TableNamesMap[provider.type];
    const createdEventTableName =
      oauth2CreatedEventTableNamesMap[provider.type];
    const creds = await this.oauth2Repositories[provider.type]
      .createQueryBuilder()
      .innerJoin(`${oauth2TableName}.User`, 'User')
      .leftJoin(
        `${oauth2TableName}.CreatedEvents`,
        createdEventTableName,
        `${createdEventTableName}.MeetingID IS NULL OR` +
          ` ${createdEventTableName}.MeetingID = :meetingID`,
        { meetingID: meeting.ID },
      )
      .where(`${oauth2TableName}.UserID = :userID`, { userID })
      .where(`${oauth2TableName}.LinkedCalendar`)
      .select([oauth2TableName, createdEventTableName])
      .getOne();
    if (!creds) {
      return;
    }
    try {
      await this.createOrUpdateEventForMeeting(
        provider,
        creds,
        creds.CreatedEvents.length > 0 ? creds.CreatedEvents[0] : null,
        meeting,
      );
    } catch (err: any) {
      this.logger.error(err);
    }
  }

  async tryCreateOrUpdateEventsForMeetingForSingleRespondent(
    userID: number,
    meeting: Meeting,
  ) {
    if (
      meeting.ScheduledStartDateTime === null ||
      meeting.ScheduledEndDateTime === null
    ) {
      return;
    }
    const results = await Promise.allSettled(
      this.getSupportedProviders().map((provider) =>
        this.tryCreateOrUpdateEventsForMeetingForSingleRespondent_provider(
          provider,
          userID,
          meeting,
        ),
      ),
    );
    for (const result of results) {
      if (result.status === 'rejected') {
        this.logger.error(result.reason);
      }
    }
  }

  private async tryDeleteEventsForMeeting_provider(
    provider: IOAuth2Provider,
    meetingID: number,
  ) {
    const oauth2TableName = oauth2TableNamesMap[provider.type];
    const createdEventTableName =
      oauth2CreatedEventTableNamesMap[provider.type];
    const linkedRespondents = await this.oauth2Repositories[provider.type]
      .createQueryBuilder()
      .innerJoin(
        `${oauth2TableName}.CreatedEvents`,
        createdEventTableName,
        `${createdEventTableName}.MeetingID = :meetingID`,
        { meetingID },
      )
      .where(`${oauth2TableName}.LinkedCalendar`)
      .select([oauth2TableName, createdEventTableName])
      .getMany();
    const results = await Promise.allSettled(
      linkedRespondents.map((linkedRespondent) =>
        provider.deleteEventForMeeting(
          linkedRespondent,
          linkedRespondent.CreatedEvents[0],
        ),
      ),
    );
    for (const result of results) {
      if (result.status === 'rejected') {
        this.logger.error(result.reason);
      }
    }
  }

  async tryDeleteEventsForMeetingForAllRespondents(meetingID: number) {
    const results = await Promise.allSettled(
      this.getSupportedProviders().map((provider) =>
        this.tryDeleteEventsForMeeting_provider(provider, meetingID),
      ),
    );
    for (const result of results) {
      if (result.status === 'rejected') {
        this.logger.error(result.reason);
      }
    }
  }

  private async tryDeleteEventsForMeetingForSingleRespondent_provider(
    provider: IOAuth2Provider,
    userID: number,
    meetingID: number,
  ) {
    const oauth2TableName = oauth2TableNamesMap[provider.type];
    const createdEventTableName =
      oauth2CreatedEventTableNamesMap[provider.type];
    const creds = await this.oauth2Repositories[provider.type]
      .createQueryBuilder()
      .innerJoin(
        `${oauth2TableName}.CreatedEvents`,
        createdEventTableName,
        `${createdEventTableName}.MeetingID = :meetingID`,
        { meetingID },
      )
      .where(`${oauth2TableName}.UserID = :userID`, { userID })
      .where(`${oauth2TableName}.LinkedCalendar`)
      .select([oauth2TableName, createdEventTableName])
      .getOne();
    if (!creds) {
      return;
    }
    try {
      await provider.deleteEventForMeeting(creds, creds.CreatedEvents[0]);
    } catch (err: any) {
      this.logger.error(err);
    }
  }

  async tryDeleteEventsForMeetingForSingleRespondent(
    userID: number,
    meetingID: number,
  ) {
    const results = await Promise.allSettled(
      this.getSupportedProviders().map((provider) =>
        this.tryDeleteEventsForMeetingForSingleRespondent_provider(
          provider,
          userID,
          meetingID,
        ),
      ),
    );
    for (const result of results) {
      if (result.status === 'rejected') {
        this.logger.error(result.reason);
      }
    }
  }
}
