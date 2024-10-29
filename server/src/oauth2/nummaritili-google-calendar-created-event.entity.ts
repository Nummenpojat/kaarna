import { Entity, ManyToOne } from 'typeorm';
import { CustomJoinColumn } from '../custom-columns/custom-join-column';
import MeetingRespondent from '../meetings/meeting-respondent.entity';
import AbstractOAuth2CalendarCreatedEvent from './abstract-oauth2-calendar-created-event.entity';
import GoogleOAuth2 from './nummaritili-oauth2.entity';

@Entity('GoogleCalendarCreatedEvent')
export default class NummariGoogleCalendarCreatedEvent extends AbstractOAuth2CalendarCreatedEvent {
  @ManyToOne(
    () => MeetingRespondent,
    (respondent) => respondent.GoogleCalendarCreatedEvents,
    {
      onDelete: 'CASCADE',
    },
  )
  @CustomJoinColumn({ name: 'RespondentID' })
  MeetingRespondent: MeetingRespondent;

  @ManyToOne(() => GoogleOAuth2, (googleOAuth2) => googleOAuth2.CreatedEvents, {
    onDelete: 'CASCADE',
  })
  @CustomJoinColumn({ name: 'UserID' })
  GoogleOAuth2: GoogleOAuth2;
}
