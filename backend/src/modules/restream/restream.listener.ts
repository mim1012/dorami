import { Injectable, Logger } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { ReStreamService } from './restream.service';
import { PrismaService } from '../../common/prisma/prisma.service';

@Injectable()
export class ReStreamListener {
  private readonly logger = new Logger(ReStreamListener.name);

  constructor(
    private readonly restreamService: ReStreamService,
    private readonly prisma: PrismaService,
  ) {}

  @OnEvent('stream:started')
  async handleStreamStarted(payload: { streamId: string; streamKey: string }) {
    this.logger.log(
      `Stream started event received (streamId: ${payload.streamId}). Starting restreaming...`,
    );

    try {
      // Get the userId from the live stream
      const liveStream = await this.prisma.liveStream.findUnique({
        where: { id: payload.streamId },
        select: { userId: true },
      });

      if (!liveStream) {
        this.logger.warn(`Live stream not found: ${payload.streamId}`);
        return;
      }

      await this.restreamService.startRestreaming(
        payload.streamId,
        payload.streamKey,
        liveStream.userId,
      );
    } catch (error) {
      this.logger.error(`Failed to start restreaming: ${error.message}`, error.stack);
    }
  }

  @OnEvent('stream:ended')
  async handleStreamEnded(payload: { streamId: string; streamKey: string }) {
    this.logger.log(
      `Stream ended event received (streamId: ${payload.streamId}). Stopping restreaming...`,
    );

    try {
      await this.restreamService.stopRestreaming(payload.streamId);
    } catch (error) {
      this.logger.error(`Failed to stop restreaming: ${error.message}`, error.stack);
    }
  }
}
