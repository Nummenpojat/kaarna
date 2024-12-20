
import { Entity, ManyToOne, OneToMany } from 'typeorm';
import { CustomJoinColumn } from '../custom-columns/custom-join-column';
import User from '../users/user.entity';
import AbstractOAuth2 from './abstract-oauth2.entity';
import ExternalGoogleCalendarEvents from './google-calendar-events.entity';
import ExternalGoogleCalendarCreatedEvent from './google-calendar-created-event.entity';

// See https://developers.google.com/identity/openid-connect/openid-connect
@Entity('ExternalGoogleOAuth2')
export default class ExternalGoogleOAuth2 extends AbstractOAuth2 {
  // !!!!!!!!!!!!!!
  // Workaround for https://github.com/typeorm/typeorm/issues/3952
  // TypeORM was creating a UNIQUE CONSTRAINT on the UserID column, which
  // is redundant because that already has a PRIMARY KEY.
  // So we use ManyToOne instead, even though it really should be OneToOne.
  // Also see https://github.com/typeorm/typeorm/blob/master/src/metadata-builder/RelationJoinColumnBuilder.ts
  // !!!!!!!!!!!!!!

  //@OneToOne(() => User, user => user.GoogleOAuth2, {onDelete: 'CASCADE'})
  @ManyToOne(() => User, (user) => user.ExternalGoogleOAuth2, {
    onDelete: 'CASCADE',
  })
  @CustomJoinColumn({ name: 'UserID' })
  User: User;

  @OneToMany(() => ExternalGoogleCalendarEvents, (event) => event.GoogleOAuth2)
  Events: ExternalGoogleCalendarEvents[];

  @OneToMany(
    () => ExternalGoogleCalendarCreatedEvent,
    (event) => event.GoogleOAuth2,
  )
  CreatedEvents: ExternalGoogleCalendarCreatedEvent[];
}
