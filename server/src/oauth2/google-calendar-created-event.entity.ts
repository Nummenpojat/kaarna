import { Entity, ManyToOne } from 'typeorm';
import { CustomJoinColumn } from '../custom-columns/custom-join-column';
import MeetingRespondent from '../meetings/meeting-respondent.entity';
import AbstractOAuth2CalendarCreatedEvent from './abstract-oauth2-calendar-created-event.entity';
import ExternalGoogleOAuth2 from './google-oauth2.entity';

@Entity('ExternalGoogleCalendarCreatedEvent')
export default class ExternalGoogleCalendarCreatedEvent extends AbstractOAuth2CalendarCreatedEvent {
  @ManyToOne(
    () => MeetingRespondent,
    (respondent) => respondent.GoogleCalendarCreatedEvents,
    {
      onDelete: 'CASCADE',
    },
  )
  @CustomJoinColumn({ name: 'RespondentID' })
  MeetingRespondent: MeetingRespondent;

  @ManyToOne(
    () => ExternalGoogleOAuth2,
    (googleOAuth2) => googleOAuth2.CreatedEvents,
    {
      onDelete: 'CASCADE',
    },
  )
  @CustomJoinColumn({ name: 'UserID' })
  GoogleOAuth2: ExternalGoogleOAuth2;
}
