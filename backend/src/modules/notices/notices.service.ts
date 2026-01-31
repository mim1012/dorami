import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../common/prisma/prisma.service';
import { CreateNoticeDto } from './dto/create-notice.dto';
import { UpdateNoticeDto } from './dto/update-notice.dto';

@Injectable()
export class NoticesService {
    constructor(private readonly prisma: PrismaService) { }

    async create(createNoticeDto: CreateNoticeDto) {
        return this.prisma.notice.create({
            data: createNoticeDto,
        });
    }

    async findAllAdmin() {
        return this.prisma.notice.findMany({
            orderBy: { createdAt: 'desc' },
        });
    }

    async findAllActive() {
        return this.prisma.notice.findMany({
            where: { isActive: true },
            orderBy: { createdAt: 'desc' },
        });
    }

    async findOne(id: string) {
        return this.prisma.notice.findUnique({
            where: { id },
        });
    }

    async update(id: string, updateNoticeDto: UpdateNoticeDto) {
        return this.prisma.notice.update({
            where: { id },
            data: updateNoticeDto,
        });
    }

    async remove(id: string) {
        return this.prisma.notice.delete({
            where: { id },
        });
    }

    /**
     * Get current notice from SystemConfig (simple text box)
     */
    async getCurrentNotice() {
        const config = await this.prisma.systemConfig.findFirst({
            where: { id: 'system' },
        });

        if (!config) {
            return {
                text: null,
                fontSize: 14,
                fontFamily: 'Pretendard',
            };
        }

        return {
            text: config.noticeText,
            fontSize: config.noticeFontSize,
            fontFamily: config.noticeFontFamily,
        };
    }
}
