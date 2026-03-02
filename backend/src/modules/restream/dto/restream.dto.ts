import { IsString, IsEnum, IsBoolean, IsOptional, IsNotEmpty, Matches } from 'class-validator';

export enum ReStreamPlatformDto {
  YOUTUBE = 'YOUTUBE',
  INSTAGRAM = 'INSTAGRAM',
  TIKTOK = 'TIKTOK',
  CUSTOM = 'CUSTOM',
}

export class CreateReStreamTargetDto {
  @IsEnum(ReStreamPlatformDto)
  platform!: ReStreamPlatformDto;

  @IsString()
  @IsNotEmpty()
  name!: string;

  @IsString()
  @IsNotEmpty()
  @Matches(/^rtmps?:\/\/[a-zA-Z0-9._-]+(:\d+)?\//, {
    message: 'rtmpUrl must be a valid RTMP URL (e.g., rtmp://host/app/)',
  })
  rtmpUrl!: string;

  @IsString()
  @IsNotEmpty()
  streamKey!: string;

  @IsBoolean()
  @IsOptional()
  enabled?: boolean;

  @IsBoolean()
  @IsOptional()
  muteAudio?: boolean;
}

export class UpdateReStreamTargetDto {
  @IsEnum(ReStreamPlatformDto)
  @IsOptional()
  platform?: ReStreamPlatformDto;

  @IsString()
  @IsOptional()
  name?: string;

  @IsString()
  @IsOptional()
  @Matches(/^rtmps?:\/\/[a-zA-Z0-9._-]+(:\d+)?\//, {
    message: 'rtmpUrl must be a valid RTMP URL (e.g., rtmp://host/app/)',
  })
  rtmpUrl?: string;

  @IsString()
  @IsOptional()
  streamKey?: string;

  @IsBoolean()
  @IsOptional()
  enabled?: boolean;

  @IsBoolean()
  @IsOptional()
  muteAudio?: boolean;
}
