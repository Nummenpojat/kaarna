import { ApiProperty } from '@nestjs/swagger';

// Make sure to keep this in sync with oauth2-common.ts
export default class ServerInfoResponse {
  @ApiProperty()
  googleOAuth2IsSupported: boolean;

  @ApiProperty()
  nummaritiliOAuth2IsSupported: boolean;

  @ApiProperty()
  microsoftOAuth2IsSupported: boolean;

  @ApiProperty()
  googleCalendarIsSupported: boolean;

  @ApiProperty()
  nummaritiliCalendarIsSupported: boolean;

  @ApiProperty()
  microsoftCalendarIsSupported: boolean;

  @ApiProperty()
  guestAvailibiliyEnabled: boolean;

  @ApiProperty()
  publicCreationEnabled: boolean;
}
