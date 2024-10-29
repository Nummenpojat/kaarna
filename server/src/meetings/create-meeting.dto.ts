import { ApiProperty } from '@nestjs/swagger';
import {
  IsString,
  IsNotEmpty,
  MaxLength,
  ArrayNotEmpty,
  ArrayMaxSize,
  IsOptional,
  IsInt,
  Min,
  Max,
  IsBoolean,
} from 'class-validator';
import IsOnlyDateString from './date-string-validator.decorator';
import IsTzDatabaseTimezone from './timezone-validator.decorator';

// Do not use default initializers on any fields because the EditMeetingDto
// extends this class

export default class CreateMeetingDto {
  @ApiProperty({ example: 'Some meeting' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(128)
  name: string;

  @ApiProperty({ example: 'Some meeting description' })
  @IsOptional()
  @IsString()
  @MaxLength(5000)
  about?: string;

  @ApiProperty({
    description: 'Allow or deny guests ability to sign up to this event',
    example: true,
  })
  @IsBoolean()
  allowGuests: boolean;

  @ApiProperty({
    description: "The client's timezone (IANA tz database format)",
    example: 'America/Toronto',
  })
  @IsTzDatabaseTimezone()
  timezone: string;

  @ApiProperty({
    description:
      "The earliest time, in the client's timezone, at which the meeting may start (24h clock).",
    example: 10,
  })
  @IsInt()
  @Min(0)
  @Max(23)
  minStartHour: number;

  @ApiProperty({
    description:
      "The latest time, in the client's timezone, at which the meeting may end (24h clock).",
    example: 13,
  })
  @IsInt()
  @Min(0)
  @Max(23)
  maxEndHour: number;

  @ApiProperty({ example: ['2022-10-23', '2022-10-24'] })
  @ArrayNotEmpty()
  @ArrayMaxSize(100)
  @IsOnlyDateString({ each: true })
  tentativeDates: string[];
}
