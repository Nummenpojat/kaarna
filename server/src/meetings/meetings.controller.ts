import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  ForbiddenException,
  Get,
  HttpCode,
  HttpException,
  HttpStatus,
  Ip,
  NotFoundException,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  Put,
  UnauthorizedException,
  UseGuards,
} from '@nestjs/common';
import ConfigService from '../config/config.service';
import { AuthUser, MaybeAuthUser } from '../auth/auth-user.decorator';
import JwtAuthGuard from '../auth/jwt-auth.guard';
import OptionalJwtAuthGuard from '../auth/optional-jwt-auth.guard';
import User from '../users/user.entity';
import CreateMeetingDto from './create-meeting.dto';
import MeetingResponse from './meeting-response';
import MeetingRespondent from './meeting-respondent.entity';
import Meeting from './meeting.entity';
import MeetingsService from './meetings.service';
import { NoSuchMeetingError, NoSuchRespondentError } from './meetings.utils';
import {
  ApiBadRequestResponse,
  ApiBearerAuth,
  ApiNotFoundResponse,
  ApiOperation,
  ApiTags,
  ApiForbiddenResponse,
} from '@nestjs/swagger';
import {
  BadRequestResponse,
  NotFoundResponse,
  ForbiddenResponse,
} from '../common-responses';
import {SECONDS_PER_HOUR, twoYearsFromNowDateString} from '../dates.utils';
import { assert } from '../misc.utils';
import RateLimiterService, {
  IRateLimiter,
} from '../rate-limiter/rate-limiter.service';
import PutRespondentDto from './put-respondent.dto';
import AddGuestRespondentDto from './add-guest-respondent.dto';
import EditMeetingDto from './edit-meeting.dto';
import ScheduleMeetingDto from './schedule-meeting.dto';
import type MeetingShortResponse from './meeting-short-response';
import { isBooleanStringTrue } from '../config/env.validation';

const modifyMeetingAuthzDoc =
  'If the meeting was created by a registed user, then ' +
  'the client must be logged in as that user.';

export function meetingToMeetingShortResponse(
  meeting: Meeting,
): MeetingShortResponse {
  const response: MeetingShortResponse = {
    meetingID: meeting.Slug,
    name: meeting.Name,
    about: meeting.About,
    timezone: meeting.Timezone,
    minStartHour: meeting.MinStartHour,
    maxEndHour: meeting.MaxEndHour,
    datesOnly: meeting.DatesOnly,
    allowGuests: meeting.AllowGuests,
    tentativeDates: meeting.TentativeDates,
  };
  if (meeting.ScheduledStartDateTime && meeting.ScheduledEndDateTime) {
    response.scheduledStartDateTime = meeting.ScheduledStartDateTime;
    response.scheduledEndDateTime = meeting.ScheduledEndDateTime;
  }
  return response;
}

function meetingToMeetingResponse(
  meeting: Meeting,
  callingUser: User | null,
): MeetingResponse {
  const response: MeetingResponse = {
    ...meetingToMeetingShortResponse(meeting),
    respondents: meeting.Respondents.map((respondent) => {
      const name = respondent.User?.Name ?? respondent.GuestName;
      assert(name, 'respondent name was not filled');
      return {
        respondentID: respondent.RespondentID,
        name,
        availabilities: respondent.Availabilities,
      };
    }),
  };
  if (callingUser) {
    for (const respondent of meeting.Respondents) {
      if (respondent.UserID === callingUser.ID) {
        response.selfRespondentID = respondent.RespondentID;
        break;
      }
    }
  }
  return response;
}

function meetingDtoToMeetingEntity(
  body: Partial<CreateMeetingDto>,
): Partial<Meeting> {
  const meeting: Partial<Meeting> = {};
  if (body.hasOwnProperty('name')) {
    meeting.Name = body.name;
  }
  if (body.hasOwnProperty('about')) {
    meeting.About = body.about;
  }
  if (body.hasOwnProperty('timezone')) {
    meeting.Timezone = body.timezone;
  }
  if (body.hasOwnProperty('minStartHour')) {
    meeting.MinStartHour = body.minStartHour;
  }
  if (body.hasOwnProperty('maxEndHour')) {
    meeting.MaxEndHour = body.maxEndHour;
  }
  if (body.hasOwnProperty('tentativeDates')) {
    meeting.TentativeDates = body.tentativeDates.sort();
  }
  if (body.hasOwnProperty('allowGuests')) {
    meeting.AllowGuests = body.allowGuests;
  }
  if (body.hasOwnProperty('datesOnly')) {
    meeting.DatesOnly = body.datesOnly;
  }
  return meeting;
}

function tentativeDatesAreOutOfRange(tentativeDates: string[]): boolean {
  const maxDate = tentativeDates.reduce((a, b) => (a > b ? a : b));
  const twoYearsFromNow = twoYearsFromNowDateString();
  return maxDate > twoYearsFromNow;
}

function convertMeetingServiceError(err: Error): Error {
  if (err instanceof NoSuchMeetingError) {
    return new NotFoundException(err.message);
  } else if (err instanceof NoSuchRespondentError) {
    return new NotFoundException(err.message);
  }
  return err;
}

@ApiTags('meetings')
@Controller('meetings')
export class MeetingsController {
  private meetingCreationRateLimiter: IRateLimiter | undefined;
  private disablePublicCreation: boolean;
  private disableGuests: boolean;

  constructor(
    private meetingsService: MeetingsService,
    configService: ConfigService,
    rateLimiterService: RateLimiterService,
  ) {
    this.disablePublicCreation = isBooleanStringTrue(
      configService.get('DISABLE_PUBLIC_CREATION'),
    );
    this.disableGuests = isBooleanStringTrue(
      configService.get('DISABLE_GUESTS'),
    );
    const meetingCreationLimit = configService.get(
      'HOURLY_MEETING_CREATION_LIMIT_PER_IP',
    );
    if (meetingCreationLimit !== 0) {
      this.meetingCreationRateLimiter = rateLimiterService.factory(
        SECONDS_PER_HOUR,
        meetingCreationLimit,
      );
    }
  }

  private async checkIfRespondentExistsAndClientIsAllowedToModifyThem(
    respondentID: number,
    maybeUser: User | null,
  ): Promise<MeetingRespondent> {
    const existingRespondent = await this.meetingsService.getRespondent(
      respondentID,
    );
    if (!existingRespondent) {
      throw new NoSuchRespondentError();
    }
    if (existingRespondent.UserID) {
      const errorMessage =
        'You must be logged in as this user to modify their availabilities';
      if (!maybeUser) {
        throw new UnauthorizedException(errorMessage);
      } else if (maybeUser.ID !== existingRespondent.UserID) {
        throw new ForbiddenException(errorMessage);
      }
    }
    return existingRespondent;
  }

  private async checkIfMeetingAllowsGuestResponding(meetingSlug: string) {
    const meeting = await this.meetingsService.getMeetingOrThrow(meetingSlug);
    if (!meeting) {
      throw new NotFoundException();
    }
    if (!meeting.AllowGuests) {
      throw new UnauthorizedException(
        'Vieraiden ilmoittautuminen ei ole käytössä tällä tapahtumalla',
      );
    }
    return meeting;
  }

  private async checkIfMeetingExistsAndClientIsAllowedToModifyIt(
    meetingSlug: string,
    maybeUser: User | null,
    allowIfCreatedByGuest = false,
  ) {
    const meeting = await this.meetingsService.getMeetingWithRespondentsBySlug(
      meetingSlug,
    );
    if (!meeting) {
      throw new NotFoundException();
    }
    if (allowIfCreatedByGuest && !meeting.CreatorID) {
      return meeting;
    }
    if (!maybeUser) {
      throw new UnauthorizedException(
        'Sinun täytyy olla kirjautuneena muokkausta varten',
      );
    }
    if (meeting.CreatorID && maybeUser.ID !== meeting.CreatorID) {
      throw new ForbiddenException('Ei oikeutta muokata.');
    }
    return meeting;
  }

  @ApiOperation({
    summary: 'Create a meeting',
    description:
      'Create a new meeting. If the client is authenticated when executing this request,' +
      " they will be registered as the meeting's creator. Otherwise, the meeting will" +
      ' have no creator.',
    operationId: 'createMeeting',
  })
  @ApiBadRequestResponse({ type: BadRequestResponse })
  @Post()
  @UseGuards(OptionalJwtAuthGuard)
  async createMeeting(
    @Ip() ip: string,
    @Body() body: CreateMeetingDto,
    @MaybeAuthUser() maybeUser: User | null,
  ): Promise<MeetingResponse> {
    if (
      this.meetingCreationRateLimiter &&
      !(await this.meetingCreationRateLimiter.tryAddRequestIfWithinLimits(ip))
    ) {
      throw new HttpException(
        'Too many requests',
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }
    if (this.disablePublicCreation) {
      const errorMessage =
        'Sinun täytyy kirjautua sisään tapahtuman luomista varten';
      if (!maybeUser) {
        throw new UnauthorizedException(errorMessage);
      }
    }
    const partialMeeting = meetingDtoToMeetingEntity(body);
    if (maybeUser) {
      partialMeeting.CreatorID = maybeUser.ID;
    }
    partialMeeting.About ??= '';
    const meeting = await this.meetingsService.createMeeting(partialMeeting);
    // Normally we would do a left join to get the respondents
    // Since we just created the meeting, this field will be undefined
    meeting.Respondents = [];
    return meetingToMeetingResponse(meeting, maybeUser);
  }

  @ApiOperation({
    summary: 'Get a meeting',
    description: 'Retrieve the information about a meeting.',
    operationId: 'getMeeting',
  })
  @ApiBadRequestResponse({ type: BadRequestResponse })
  @ApiNotFoundResponse({ type: NotFoundResponse })
  @Get(':id')
  @UseGuards(OptionalJwtAuthGuard)
  async getMeeting(
    @Param('id') meetingSlug: string,
    @MaybeAuthUser() maybeUser: User | null,
  ): Promise<MeetingResponse> {
    const meeting = await this.meetingsService.getMeetingWithRespondentsBySlug(
      meetingSlug,
    );
    if (!meeting) {
      throw new NotFoundException();
    }
    return meetingToMeetingResponse(meeting, maybeUser);
  }

  @ApiOperation({
    summary: 'Edit a meeting',
    description: 'Edit a meeting. ' + modifyMeetingAuthzDoc,
    operationId: 'editMeeting',
  })
  @ApiBadRequestResponse({ type: BadRequestResponse })
  @ApiNotFoundResponse({ type: NotFoundResponse })
  @ApiForbiddenResponse({ type: ForbiddenResponse })
  @Patch(':id')
  @UseGuards(OptionalJwtAuthGuard)
  async editMeeting(
    @Param('id') meetingSlug: string,
    @Body() body: EditMeetingDto,
    @MaybeAuthUser() maybeUser: User | null,
  ): Promise<MeetingResponse> {
    const meeting = await this.checkIfMeetingExistsAndClientIsAllowedToModifyIt(
      meetingSlug,
      maybeUser,
    );
    const partialUpdate = meetingDtoToMeetingEntity(body);
    if (Object.keys(partialUpdate).length === 0) {
      throw new BadRequestException('At least one property must be specified');
    }
    await this.meetingsService.editMeeting(meeting, partialUpdate);
    return meetingToMeetingResponse(meeting, maybeUser);
  }

  @ApiOperation({
    summary: 'Schedule a meeting',
    description: 'Schedule a meeting. ' + modifyMeetingAuthzDoc,
    operationId: 'scheduleMeeting',
  })
  @ApiBadRequestResponse({ type: BadRequestResponse })
  @ApiNotFoundResponse({ type: NotFoundResponse })
  @ApiForbiddenResponse({ type: ForbiddenResponse })
  @Put(':id/schedule')
  @UseGuards(OptionalJwtAuthGuard)
  async scheduleMeeting(
    @Param('id') meetingSlug: string,
    @Body() body: ScheduleMeetingDto,
    @MaybeAuthUser() maybeUser: User | null,
  ): Promise<MeetingResponse> {
    const meeting = await this.checkIfMeetingExistsAndClientIsAllowedToModifyIt(
      meetingSlug,
      maybeUser,
      true,
    );
    if (body.endDateTime <= body.startDateTime && !meeting.DatesOnly) {
      throw new BadRequestException('end time must be greater than start time');
    }
    await this.meetingsService.scheduleMeeting(
      maybeUser,
      meeting,
      body.startDateTime,
      body.endDateTime,
    );
    return meetingToMeetingResponse(meeting, maybeUser);
  }

  @ApiOperation({
    summary: 'Unschedule a meeting',
    description: 'Unschedule a meeting. ' + modifyMeetingAuthzDoc,
    operationId: 'unscheduleMeeting',
  })
  @ApiNotFoundResponse({ type: NotFoundResponse })
  @ApiForbiddenResponse({ type: ForbiddenResponse })
  @Delete(':id/schedule')
  @UseGuards(OptionalJwtAuthGuard)
  async unscheduleMeeting(
    @Param('id') meetingSlug: string,
    @MaybeAuthUser() maybeUser: User | null,
  ): Promise<MeetingResponse> {
    const meeting = await this.checkIfMeetingExistsAndClientIsAllowedToModifyIt(
      meetingSlug,
      maybeUser,
      true,
    );
    await this.meetingsService.unscheduleMeeting(meeting);
    return meetingToMeetingResponse(meeting, maybeUser);
  }

  @ApiOperation({
    summary: 'Delete a meeting',
    description: 'Delete a meeting. ' + modifyMeetingAuthzDoc,
    operationId: 'deleteMeeting',
  })
  @ApiNotFoundResponse({ type: NotFoundResponse })
  @ApiForbiddenResponse({ type: ForbiddenResponse })
  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @UseGuards(OptionalJwtAuthGuard)
  async deleteMeeting(
    @Param('id') meetingSlug: string,
    @MaybeAuthUser() maybeUser: User | null,
  ): Promise<void> {
    await this.checkIfMeetingExistsAndClientIsAllowedToModifyIt(
      meetingSlug,
      maybeUser,
    );
    await this.meetingsService.deleteMeeting(meetingSlug);
  }

  @ApiOperation({
    summary: 'Add guest availabilities',
    description: 'Add the meeting availabilities for a guest user.',
    operationId: 'addGuestRespondent',
  })
  @Post(':id/respondents/guest')
  async addGuestRespondent(
    @Param('id') meetingSlug: string,
    @Body() body: AddGuestRespondentDto,
  ): Promise<MeetingResponse> {
    await this.checkIfMeetingAllowsGuestResponding(meetingSlug);
    try {
      const updatedMeeting = await this.meetingsService.addRespondent({
        meetingSlug,
        availabilities: body.availabilities,
        dayAvailabilities: body.dayAvailabilities,
        guestName: body.name,
        guestEmail: body.email,
      });
      return meetingToMeetingResponse(updatedMeeting, null);
    } catch (err) {
      throw convertMeetingServiceError(err as Error);
    }
  }

  @ApiOperation({
    summary: 'Add or update own availabilities',
    description:
      'Add or update the meeting availabilities of the user who is currently logged in.',
    operationId: 'putSelfRespondent',
  })
  @ApiForbiddenResponse({ type: ForbiddenResponse })
  @ApiBearerAuth()
  @Put(':id/respondents/me')
  @UseGuards(JwtAuthGuard)
  async putSelfRespondent(
    @Param('id') meetingSlug: string,
    @AuthUser() user: User,
    @Body() body: PutRespondentDto,
  ): Promise<MeetingResponse> {
    try {
      const updatedMeeting = await this.meetingsService.addOrUpdateRespondent(
        meetingSlug,
        user,
        body.availabilities,
        body.dayAvailabilities,
      );
      return meetingToMeetingResponse(updatedMeeting, user);
    } catch (err) {
      throw convertMeetingServiceError(err as Error);
    }
  }

  @ApiOperation({
    summary: 'Update availabilities',
    description:
      'Update the meeting availabilities of an existing respondent.<br><br>' +
      'If the respondent is a registered user, then the client must be logged in as that user.',
    operationId: 'updateAvailabilities',
  })
  @ApiForbiddenResponse({ type: ForbiddenResponse })
  @Put(':id/respondents/:respondentID')
  @UseGuards(OptionalJwtAuthGuard)
  async updateRespondent(
    @Param('id') meetingSlug: string,
    @Param('respondentID', ParseIntPipe) respondentID: number,
    @MaybeAuthUser() maybeUser: User | null,
    @Body() body: PutRespondentDto,
  ): Promise<MeetingResponse> {
    try {
      await this.checkIfRespondentExistsAndClientIsAllowedToModifyThem(
        respondentID,
        maybeUser,
      );
      const updatedMeeting = await this.meetingsService.updateRespondent(
        respondentID,
        meetingSlug,
        body.availabilities,
        body.dayAvailabilities,
      );
      return meetingToMeetingResponse(updatedMeeting, maybeUser);
    } catch (err) {
      throw convertMeetingServiceError(err as Error);
    }
  }

  @ApiOperation({
    summary: 'Delete a respondent',
    description:
      'Remove a respondent from a meeting.<br><br>' +
      'If the respondent is a registered user, then the client must be logged in as that user.',
    operationId: 'deleteRespondent',
  })
  @Delete(':id/respondents/:respondentID')
  @UseGuards(OptionalJwtAuthGuard)
  async deleteRespondent(
    @Param('id') meetingSlug: string,
    @Param('respondentID', ParseIntPipe) respondentID: number,
    @MaybeAuthUser() maybeUser: User | null,
  ): Promise<MeetingResponse> {
    try {
      const respondent =
        await this.checkIfRespondentExistsAndClientIsAllowedToModifyThem(
          respondentID,
          maybeUser,
        );
      const updatedMeeting = await this.meetingsService.deleteRespondent(
        respondent,
      );
      return meetingToMeetingResponse(updatedMeeting, maybeUser);
    } catch (err) {
      throw convertMeetingServiceError(err as Error);
    }
  }
}
