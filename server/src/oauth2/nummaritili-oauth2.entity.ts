import { Entity, ManyToOne, OneToMany } from 'typeorm';
import { CustomJoinColumn } from '../custom-columns/custom-join-column';
import User from '../users/user.entity';
import AbstractOAuth2 from './abstract-oauth2.entity';
import NummariGoogleCalendarCreatedEvent from './nummaritili-google-calendar-created-event.entity';
import NummariGoogleCalendarEvents from './nummaritili-google-calendar-events.entity';

// See https://developers.google.com/identity/openid-connect/openid-connect
@Entity('GoogleOAuth2')
export default class GoogleOAuth2 extends AbstractOAuth2 {
  // !!!!!!!!!!!!!!
  // Workaround for https://github.com/typeorm/typeorm/issues/3952
  // TypeORM was creating a UNIQUE CONSTRAINT on the UserID column, which
  // is redundant because that already has a PRIMARY KEY.
  // So we use ManyToOne instead, even though it really should be OneToOne.
  // Also see https://github.com/typeorm/typeorm/blob/master/src/metadata-builder/RelationJoinColumnBuilder.ts
  // !!!!!!!!!!!!!!

  //@OneToOne(() => User, user => user.GoogleOAuth2, {onDelete: 'CASCADE'})
  @ManyToOne(() => User, (user) => user.GoogleOAuth2, { onDelete: 'CASCADE' })
  @CustomJoinColumn({ name: 'UserID' })
  User: User;

  @OneToMany(() => NummariGoogleCalendarEvents, (event) => event.GoogleOAuth2)
  Events: NummariGoogleCalendarEvents[];

  @OneToMany(
    () => NummariGoogleCalendarCreatedEvent,
    (event) => event.GoogleOAuth2,
  )
  CreatedEvents: NummariGoogleCalendarCreatedEvent[];
}
