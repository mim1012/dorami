import { IsString, IsEnum, IsBoolean, IsOptional, IsNotEmpty } from 'class-validator';

export enum ReStreamPlatformDto {
  YOUTUBE = 'YOUTUBE',
  INSTAGRAM = 'INSTAGRAM',
  TIKTOK = 'TIKTOK',
  CUSTOM = 'CUSTOM',
}

export class CreateReStreamTargetDto {
  @IsEnum(ReStreamPlatformDto)
  platform: ReStreamPlatformDto;

  @IsString()
  @IsNotEmpty()
  name: string;

  @IsString()
  @IsNotEmpty()
  rtmpUrl: string;

  @IsString()
  @IsNotEmpty()
  streamKey: string;

  @IsBoolean()
  @IsOptional()
  enabled?: boolean;
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
  rtmpUrl?: string;

  @IsString()
  @IsOptional()
  streamKey?: string;

  @IsBoolean()
  @IsOptional()
  enabled?: boolean;
}
