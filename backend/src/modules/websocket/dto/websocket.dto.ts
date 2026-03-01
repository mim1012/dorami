import { IsString, IsNotEmpty, IsOptional } from 'class-validator';

export class SendMessageDto {
  @IsString()
  @IsNotEmpty()
  streamId!: string;

  @IsString()
  @IsNotEmpty()
  message!: string;

  @IsString()
  @IsOptional()
  metadata?: string;
}

export class JoinRoomDto {
  @IsString()
  @IsNotEmpty()
  streamId!: string;
}

export class DeleteMessageDto {
  @IsString()
  @IsNotEmpty()
  messageId!: string;
}
