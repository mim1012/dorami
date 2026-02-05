import {
  Controller,
  Post,
  UploadedFile,
  UseInterceptors,
  BadRequestException,
  UseGuards,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { diskStorage } from 'multer';
import { extname } from 'path';
import { randomUUID } from 'crypto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';

@Controller('upload')
@UseGuards(JwtAuthGuard)  // All upload endpoints require authentication
export class UploadController {
  @Post('image')
  @UseInterceptors(
    FileInterceptor('file', {
      storage: diskStorage({
        destination: './uploads',
        filename: (req, file, callback) => {
          // Use UUID for filename to prevent path traversal and collisions
          const uniqueName = `${randomUUID()}${extname(file.originalname).toLowerCase()}`;
          callback(null, uniqueName);
        },
      }),
      fileFilter: (req, file, callback) => {
        // Check MIME type
        if (!(/^image\/(jpg|jpeg|png|gif|webp)$/.exec(file.mimetype))) {
          callback(
            new BadRequestException('Only image files (jpg, jpeg, png, gif, webp) are allowed!'),
            false,
          ); return;
        }
        // Check file extension
        const allowedExtensions = ['.jpg', '.jpeg', '.png', '.gif', '.webp'];
        const ext = extname(file.originalname).toLowerCase();
        if (!allowedExtensions.includes(ext)) {
          callback(
            new BadRequestException('Invalid file extension'),
            false,
          ); return;
        }
        callback(null, true);
      },
      limits: {
        fileSize: 5 * 1024 * 1024, // 5MB
      },
    }),
  )
  uploadImage(
    @CurrentUser('userId') userId: string,
    @UploadedFile() file: Express.Multer.File,
  ) {
    if (!file) {
      throw new BadRequestException('No file uploaded');
    }

    // Return the URL that can be used to access the image
    const imageUrl = `/uploads/${file.filename}`;
    return {
      url: imageUrl,
      filename: file.filename,
      size: file.size,
      mimetype: file.mimetype,
      uploadedBy: userId,
      uploadedAt: new Date().toISOString(),
    };
  }
}
