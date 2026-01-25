import { IsString, IsNotEmpty, IsOptional, IsDateString } from 'class-validator';

export enum StreamingStatus {
  PENDING = 'PENDING',
  LIVE = 'LIVE',
  OFFLINE = 'OFFLINE',
}

export class StartStreamDto {
  @IsDateString()
  @IsNotEmpty()
  expiresAt: string; // ISO 8601 format

  @IsString()
  @IsOptional()
  description?: string;
}

export class StreamingSessionResponseDto {
  id: string;
  userId: string;
  streamKey: string;
  status: string;
  rtmpUrl: string;
  hlsUrl: string;
  startedAt?: Date;
  endedAt?: Date;
  expiresAt: Date;
  createdAt: Date;
}
