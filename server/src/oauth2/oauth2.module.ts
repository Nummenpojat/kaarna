import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import CustomJwtModule from '../custom-jwt/custom-jwt.module';
import MeetingsModule from '../meetings/meetings.module';
import UsersModule from '../users/users.module';
import GoogleOAuth2 from './nummaritili-oauth2.entity';
import { Oauth2Controller } from './oauth2.controller';
import OAuth2Service from './oauth2.service';
import NummariGoogleCalendarEvents from './nummaritili-google-calendar-events.entity';
import NummariGoogleCalendarCreatedEvent from './nummaritili-google-calendar-created-event.entity';
import MicrosoftOAuth2 from './microsoft-oauth2.entity';
import MicrosoftCalendarEvents from './microsoft-calendar-events.entity';
import MicrosoftCalendarCreatedEvent from './microsoft-calendar-created-event.entity';
import CacherModule from '../cacher/cacher.module';
import ExternalGoogleOAuth2 from './google-oauth2.entity';
import ExternalGoogleCalendarCreatedEvent from './google-calendar-created-event.entity';
import ExternalGoogleCalendarEvents from './google-calendar-events.entity';

@Module({
  imports: [
    UsersModule,
    MeetingsModule,
    CustomJwtModule,
    CacherModule,
    TypeOrmModule.forFeature([
      GoogleOAuth2,
      NummariGoogleCalendarEvents,
      NummariGoogleCalendarCreatedEvent,
      ExternalGoogleOAuth2,
      ExternalGoogleCalendarEvents,
      ExternalGoogleCalendarCreatedEvent,
      MicrosoftOAuth2,
      MicrosoftCalendarEvents,
      MicrosoftCalendarCreatedEvent,
    ]),
  ],
  providers: [OAuth2Service],
  exports: [OAuth2Service],
  controllers: [Oauth2Controller],
})
export default class OAuth2Module {}
