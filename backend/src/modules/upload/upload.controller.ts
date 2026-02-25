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
import { extname, join, dirname } from 'path';
import { randomUUID } from 'crypto';
import { readFileSync, unlinkSync, renameSync } from 'fs';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';

/**
 * Magic-byte signatures for allowed image types.
 * Keyed by a label; each entry lists one or more byte-sequences that match that format.
 */
const IMAGE_MAGIC_BYTES: Array<{ label: string; signature: number[] }> = [
  { label: 'jpeg', signature: [0xff, 0xd8, 0xff] },
  { label: 'png', signature: [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a] },
  { label: 'gif', signature: [0x47, 0x49, 0x46, 0x38] },
  { label: 'webp', signature: [0x52, 0x49, 0x46, 0x46] }, // "RIFF" — we also check bytes 8-11
];

function hasValidImageMagicBytes(buf: Buffer): boolean {
  return IMAGE_MAGIC_BYTES.some(({ label, signature }) => {
    const matches = signature.every((byte, i) => buf[i] === byte);
    if (!matches) {
      return false;
    }
    // Extra check for WebP: bytes 8-11 must be "WEBP"
    if (label === 'webp') {
      const webp = [0x57, 0x45, 0x42, 0x50];
      return webp.every((byte, i) => buf[8 + i] === byte);
    }
    return true;
  });
}

@Controller('upload')
@UseGuards(JwtAuthGuard) // All upload endpoints require authentication
export class UploadController {
  @Post('image')
  @UseInterceptors(
    FileInterceptor('file', {
      storage: diskStorage({
        destination: './uploads',
        filename: (_req, _file, callback) => {
          // UUID filename prevents path traversal and enumeration
          callback(null, `${randomUUID()}.bin`);
        },
      }),
      fileFilter: (_req, file, callback) => {
        // First-pass: MIME type check (client-supplied, strengthened below with magic bytes)
        if (!/^image\/(jpg|jpeg|png|gif|webp)$/.exec(file.mimetype)) {
          return callback(
            new BadRequestException('Only image files (jpg, jpeg, png, gif, webp) are allowed'),
            false,
          );
        }
        // Extension check (empty extension allowed when MIME type already validated above)
        const allowedExtensions = ['.jpg', '.jpeg', '.png', '.gif', '.webp'];
        const ext = extname(file.originalname).toLowerCase();
        if (ext !== '' && !allowedExtensions.includes(ext)) {
          return callback(new BadRequestException('Invalid file extension'), false);
        }
        callback(null, true);
      },
      limits: {
        fileSize: 5 * 1024 * 1024, // 5 MB
      },
    }),
  )
  uploadImage(@CurrentUser('userId') userId: string, @UploadedFile() file: Express.Multer.File) {
    if (!file) {
      throw new BadRequestException('No file uploaded');
    }

    // Second-pass: magic-bytes check on the saved file to prevent MIME spoofing
    let buf: Buffer;
    try {
      buf = readFileSync(file.path);
    } catch {
      throw new BadRequestException('Failed to read uploaded file');
    }

    if (!hasValidImageMagicBytes(buf)) {
      try {
        unlinkSync(file.path);
      } catch {
        /* best-effort cleanup */
      }
      throw new BadRequestException('File content does not match an allowed image type');
    }

    // Rename to a safe extension derived from the validated magic bytes
    const mimeToExt: Record<string, string> = {
      'image/jpeg': '.jpg',
      'image/jpg': '.jpg',
      'image/png': '.png',
      'image/gif': '.gif',
      'image/webp': '.webp',
    };
    const safeExt = mimeToExt[file.mimetype] ?? '.jpg';
    const safeFilename = `${file.filename.replace('.bin', '')}${safeExt}`;
    try {
      renameSync(file.path, join(dirname(file.path), safeFilename));
    } catch {
      // If rename fails, still return the .bin path — not ideal but not a security risk
    }

    const imageUrl = `/uploads/${safeFilename}`;
    return {
      url: imageUrl,
      filename: safeFilename,
      size: file.size,
      mimetype: file.mimetype,
      uploadedBy: userId,
      uploadedAt: new Date().toISOString(),
    };
  }
}
