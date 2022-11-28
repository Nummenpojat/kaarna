import { Injectable } from '@nestjs/common';
import { ModuleRef } from '@nestjs/core';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { DateTime } from 'luxon';
import { EnvironmentVariables } from '../env.validation';
import MailService from '../mail/mail.service';
import OAuth2Service from '../oauth2/oauth2.service';
import { DeepPartial, Repository } from 'typeorm';
import MeetingRespondent from './meeting-respondent.entity';
import Meeting from './meeting.entity';

// TODO: delete meetings from DB after their max. tentative date or scheduled date (cron job)

export class NoSuchMeetingError extends Error {}

function formatScheduledTimeRange(startDateTime: string, endDateTime: string, tz: string): string {
  // remove space so that e.g. "8:00 AM" becomes "8:00AM"
  const start = DateTime.fromISO(startDateTime).setZone(tz)
    .toLocaleString(DateTime.TIME_SIMPLE).replace(' ', '');
  const end = DateTime.fromISO(endDateTime).setZone(tz)
    .toLocaleString(DateTime.TIME_SIMPLE).replace(' ', '');
  const tzShort = DateTime.fromISO(startDateTime).setZone(tz).offsetNameShort;
  return `${start} to ${end} ${tzShort}`;
}

@Injectable()
export default class MeetingsService {
  private oauth2Service: OAuth2Service;
  private readonly publicURL: string;

  constructor(
    @InjectRepository(Meeting) private meetingsRepository: Repository<Meeting>,
    @InjectRepository(MeetingRespondent) private respondentsRepository: Repository<MeetingRespondent>,
    private readonly mailService: MailService,
    private moduleRef: ModuleRef,
    configService: ConfigService<EnvironmentVariables, true>,
  ) {
    this.publicURL = configService.get('PUBLIC_URL', {infer: true});
  }

  onModuleInit() {
    // circular dependency
    this.oauth2Service = this.moduleRef.get(OAuth2Service, {strict: false});
  }

  async createMeeting(meeting: DeepPartial<Meeting>): Promise<Meeting> {
    return this.meetingsRepository.save(meeting);
  }

  async getMeetingOrThrow(meetingID: number): Promise<Meeting> {
    const meeting = await this.meetingsRepository.findOneBy({ID: meetingID});
    if (!meeting) {
      throw new NoSuchMeetingError();
    }
    return meeting;
  }

  getMeetingWithRespondents(meetingID: number): Promise<Meeting | null> {
    return this.meetingsRepository
      .createQueryBuilder()
      .leftJoin('Meeting.Respondents', 'MeetingRespondent')
      .leftJoin('MeetingRespondent.User', 'User')
      .select(['Meeting', 'MeetingRespondent', 'User.ID', 'User.Name'])
      .where('Meeting.ID = :meetingID', {meetingID})
      .getOne();
  }

  private getRespondentsWithNotificationsEnabled(meetingID: number): Promise<MeetingRespondent[]> {
    return this.respondentsRepository
      .createQueryBuilder()
      .leftJoin('MeetingRespondent.User', 'User')
      .select(['MeetingRespondent.GuestName', 'MeetingRespondent.GuestEmail', 'User.Name', 'User.Email'])
      .where('MeetingRespondent.GuestEmail IS NOT NULL OR User.IsSubscribedToNotifications')
      .getMany();
  }

  private async updateMeetingDB(meetingID: number, meetingInfo: DeepPartial<Meeting>): Promise<Meeting> {
    // TODO: wrap in transaction
    await this.meetingsRepository.update(meetingID, meetingInfo);
    return this.getMeetingWithRespondents(meetingID);
  }

  async editMeeting(oldMeeting: Meeting, partialUpdate: DeepPartial<Meeting>): Promise<Meeting> {
    const newMeeting = await this.updateMeetingDB(oldMeeting.ID, partialUpdate);
    if (
      newMeeting.ScheduledStartDateTime !== null
      && newMeeting.ScheduledEndDateTime !== null
      && (
        oldMeeting.Name !== newMeeting.Name
        || oldMeeting.About !== newMeeting.About
      )
    ) {
      // Update respondents' external calendars
      // Do not await the Promise so that we don't block the caller
      this.oauth2Service.google_tryCreateOrUpdateEventsForMeeting(newMeeting);
    }
    return newMeeting;
  }

  private createScheduledNotificationEmailBody(meeting: Meeting, name: string): string {
    const scheduledTimeRange = formatScheduledTimeRange(meeting.ScheduledStartDateTime, meeting.ScheduledEndDateTime, meeting.Timezone);
    return (
      `Hello ${name},\n` +
      '\n' +
      `${meeting.Name} has been scheduled:\n` +
      '\n' +
      `${scheduledTimeRange}\n` +
      '\n' +
      `View details here: ${this.publicURL}/m/${meeting.ID}\n` +
      '\n' +
      '-- \n' +
      `CabbageMeet | ${this.publicURL}`
    );
  }

  async scheduleMeeting(oldMeeting: Meeting, startDateTime: string, endDateTime: string): Promise<Meeting> {
    // Update database
    const updatedInfo: DeepPartial<Meeting> = {
      ScheduledStartDateTime: startDateTime,
      ScheduledEndDateTime: endDateTime,
      WasScheduledAtLeastOnce: true,
    };
    const newMeeting = await this.updateMeetingDB(oldMeeting.ID, updatedInfo);
    // Send email notifications
    if (!oldMeeting.WasScheduledAtLeastOnce) {
      const respondentsToBeNotified = await this.getRespondentsWithNotificationsEnabled(newMeeting.ID);
      for (const respondent of respondentsToBeNotified) {
        const recipient = respondent.GuestEmail || respondent.User.Email;
        const name = respondent.GuestName || respondent.User.Name;
        // Do not await the Promise so that we don't block the caller
        this.mailService.sendNowOrLater({
          recipient,
          subject: `${newMeeting.Name} has been scheduled`,
          body: this.createScheduledNotificationEmailBody(newMeeting, name),
        });
      }
    }
    // Update respondents' external calendars
    // Do not await the Promise so that we don't block the caller
    this.oauth2Service.google_tryCreateOrUpdateEventsForMeeting(newMeeting);
    return newMeeting;
  }

  async unscheduleMeeting(meetingID: number): Promise<Meeting> {
    const updatedInfo: DeepPartial<Meeting> = {
      ScheduledStartDateTime: null,
      ScheduledEndDateTime: null,
    };
    const meeting = await this.updateMeetingDB(meetingID, updatedInfo);
    // Update respondents' external calendars
    // Do not await the Promise so that we don't block the caller
    this.oauth2Service.google_tryDeleteEventsForMeeting(meetingID);
    return meeting;
  }

  async deleteMeeting(meetingID: number): Promise<void> {
    // This meeting needs to be deleted from all of the respondents' Google calendars.
    // We need to wait until this runs to completion or else the row in
    // the GoogleCalendarCreatedEvents table might be deleted prematurely
    // (due to cascading deletions).
    // Unfortunately this might take a long time, but since deleting a meeting is a
    // relatively infrequent operation, it should be acceptable. The use of
    // Promise.allSettled() in the OAuth2Service should hopefully speed things up.
    //
    // Alternative solution: use a tombstoned row
    await this.oauth2Service.google_tryDeleteEventsForMeeting(meetingID);
    await this.meetingsRepository.delete(meetingID);
  }

  async getRespondent(respondentID: number): Promise<MeetingRespondent | null>;
  async getRespondent(meetingID: number, userID: number): Promise<MeetingRespondent | null>;
  async getRespondent(respondentIDOrMeetingID: number, userID?: number): Promise<MeetingRespondent | null> {
    if (userID === undefined) {
      return this.respondentsRepository.findOneBy({RespondentID: respondentIDOrMeetingID});
    }
    return this.respondentsRepository.findOneBy({MeetingID: respondentIDOrMeetingID, UserID: userID});
  }

  async addRespondent(meetingID: number, availabilities: string[], userID: number): Promise<MeetingRespondent>;
  async addRespondent(meetingID: number, availabilities: string[], guestName: string, guestEmail?: string): Promise<MeetingRespondent>;
  async addRespondent(meetingID: number, availabilities: string[], userIDOrGuestName: number | string, guestEmail?: string): Promise<MeetingRespondent> {
    const respondent: DeepPartial<MeetingRespondent> = {
      MeetingID: meetingID,
      Availabilities: JSON.stringify(availabilities),
    };
    if (typeof userIDOrGuestName === 'number') {
      respondent.UserID = userIDOrGuestName;
    } else {
      respondent.GuestName = userIDOrGuestName;
      respondent.GuestEmail = guestEmail || null;
    }
    return this.respondentsRepository.save(respondent);
  }

  async updateRespondent(respondentID: number, availabilities: string[]): Promise<MeetingRespondent | null> {
    // TODO: wrap in transaction
    await this.respondentsRepository.update(
      respondentID,
      {Availabilities: JSON.stringify(availabilities)},
    );
    return this.respondentsRepository.findOneBy({RespondentID: respondentID});
  }

  async addOrUpdateRespondent(meetingID: number, userID: number, availabilities: string[]): Promise<Meeting> {
    const existingRespondent = await this.getRespondent(meetingID, userID);
    if (existingRespondent) {
      await this.updateRespondent(existingRespondent.RespondentID, availabilities);
    } else {
      await this.addRespondent(meetingID, availabilities, userID);
    }
    const updatedMeeting = await this.getMeetingWithRespondents(meetingID);
    // Update respondent's external calendars
    // Do not await the Promise so that we don't block the caller
    this.oauth2Service.google_tryCreateOrUpdateEventForMeeting(userID, updatedMeeting);
    return updatedMeeting;
  }

  async deleteRespondent(respondent: MeetingRespondent): Promise<Meeting> {
    if (respondent.UserID !== null) {
      // We need to wait until this runs to completion or else the row in
      // the GoogleCalendarCreatedEvents table might be deleted prematurely
      // (due to cascading deletions).
      await this.oauth2Service.google_tryDeleteEventForMeeting(respondent.UserID, respondent.MeetingID);
    }
    await this.respondentsRepository.delete(respondent.RespondentID);
    // TODO: wrap in transaction
    return this.getMeetingWithRespondents(respondent.MeetingID);
  }

  getMeetingsCreatedBy(userID: number): Promise<Meeting[]> {
    // TODO: support cursor-based pagination
    return this.meetingsRepository
      .createQueryBuilder()
      .select(['Meeting'])
      .where('CreatorID = :userID', {userID})
      .limit(100)
      .getMany();
  }

  async getMeetingsRespondedToBy(userID: number): Promise<Meeting[]> {
    // TODO: support cursor-based pagination
    return await this.meetingsRepository
      .createQueryBuilder()
      .innerJoin('Meeting.Respondents', 'MeetingRespondent')
      .select(['Meeting'])
      .where('MeetingRespondent.UserID = :userID', {userID})
      .limit(100)
      .getMany();
  }
}
