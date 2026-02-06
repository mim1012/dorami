import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as crypto from 'crypto';

export interface ShippingAddress {
  fullName: string;
  address1: string;
  address2?: string;
  city: string;
  state: string;  // 2-letter code: CA, NY, TX, etc.
  zip: string;    // 12345 or 12345-6789
  phone: string;  // (XXX) XXX-XXXX
}

@Injectable()
export class EncryptionService {
  private readonly algorithm = 'aes-256-gcm';
  private readonly key: Buffer;

  constructor(private configService: ConfigService) {
    const keyString = this.configService.get<string>('PROFILE_ENCRYPTION_KEY');
    if (keyString?.length !== 64) {
      throw new Error('PROFILE_ENCRYPTION_KEY must be a 64-character hex string (32 bytes)');
    }
    this.key = Buffer.from(keyString, 'hex');
  }

  /**
   * Encrypt shipping address object to string
   * Returns: iv:authTag:ciphertext (all hex-encoded)
   */
  encryptAddress(address: ShippingAddress): string {
    const iv = crypto.randomBytes(16);
    const cipher = crypto.createCipheriv(this.algorithm, this.key, iv);

    const plaintext = JSON.stringify(address);
    let ciphertext = cipher.update(plaintext, 'utf8', 'hex');
    ciphertext += cipher.final('hex');
    const authTag = cipher.getAuthTag();

    return `${iv.toString('hex')}:${authTag.toString('hex')}:${ciphertext}`;
  }

  /**
   * Decrypt shipping address string to object
   * Input format: iv:authTag:ciphertext
   */
  decryptAddress(encrypted: string): ShippingAddress {
    const [ivHex, authTagHex, ciphertext] = encrypted.split(':');
    if (!ivHex || !authTagHex || !ciphertext) {
      throw new Error('Invalid encrypted address format');
    }

    const iv = Buffer.from(ivHex, 'hex');
    const authTag = Buffer.from(authTagHex, 'hex');
    const decipher = crypto.createDecipheriv(this.algorithm, this.key, iv);
    decipher.setAuthTag(authTag);

    let plaintext = decipher.update(ciphertext, 'hex', 'utf8');
    plaintext += decipher.final('utf8');

    return JSON.parse(plaintext) as ShippingAddress;
  }
}
