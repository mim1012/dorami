import { IsString, IsNotEmpty, IsOptional, IsDateString, IsInt, Min } from 'class-validator';
import { Transform } from 'class-transformer';

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

export class GenerateKeyDto {
  @IsString()
  @IsOptional()
  title?: string = 'Live Stream';
}

export class StreamStatusDto {
  status: string;
  viewerCount: number;
  startedAt?: Date;
  title: string;
}

export class StreamHistoryQueryDto {
  @IsOptional()
  @Transform(({ value }) => parseInt(value, 10))
  @IsInt()
  @Min(1)
  page?: number = 1;

  @IsOptional()
  @Transform(({ value }) => parseInt(value, 10))
  @IsInt()
  @Min(1)
  limit?: number = 20;

  @IsOptional()
  @IsString()
  userId?: string;

  @IsOptional()
  @IsString()
  dateFrom?: string;

  @IsOptional()
  @IsString()
  dateTo?: string;
}

export class StreamHistoryItemDto {
  id: string;
  streamKey: string;
  title: string;
  userId: string;
  userName: string;
  startedAt: Date | null;
  endedAt: Date | null;
  totalDuration: number | null;
  peakViewers: number;
  status: string;
}

export class StreamHistoryResponseDto {
  streams: StreamHistoryItemDto[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export class StreamingSessionResponseDto {
  id: string;
  userId: string;
  streamKey: string;
  title: string;
  status: string;
  rtmpUrl: string;
  hlsUrl: string;
  viewerCount?: number;
  peakViewers?: number;
  startedAt?: Date;
  endedAt?: Date;
  totalDuration?: number;
  expiresAt: Date;
  createdAt: Date;
}
