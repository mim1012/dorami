import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as crypto from 'crypto';

export interface ShippingAddress {
  fullName: string;
  address1: string;
  address2?: string;
  city: string;
  state: string; // 2-letter code: CA, NY, TX, etc.
  zip: string; // 12345 or 12345-6789
  phone: string; // (XXX) XXX-XXXX
}

@Injectable()
export class EncryptionService {
  private readonly logger = new Logger(EncryptionService.name);
  private readonly algorithm = 'aes-256-gcm';
  private readonly key: Buffer;
  private readonly legacyKeys: Buffer[];

  constructor(private configService: ConfigService) {
    const keyString = this.configService.get<string>('PROFILE_ENCRYPTION_KEY');
    if (keyString?.length !== 64) {
      throw new Error('PROFILE_ENCRYPTION_KEY must be a 64-character hex string (32 bytes)');
    }
    this.key = Buffer.from(keyString, 'hex');

    // Legacy keys for decrypting data encrypted with previous keys.
    // PROFILE_LEGACY_ENCRYPTION_KEYS is a comma-separated list of 64-char hex keys.
    const legacyKeysStr = this.configService.get<string>('PROFILE_LEGACY_ENCRYPTION_KEYS');
    this.legacyKeys = [];
    if (legacyKeysStr) {
      for (const lk of legacyKeysStr.split(',')) {
        const trimmed = lk.trim();
        if (trimmed.length === 64) {
          this.legacyKeys.push(Buffer.from(trimmed, 'hex'));
        }
      }
      if (this.legacyKeys.length > 0) {
        this.logger.log(
          `Loaded ${this.legacyKeys.length} legacy encryption key(s) for fallback decryption`,
        );
      }
    }
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
   * Decrypt shipping address with a specific key
   */
  private decryptWithKey(encrypted: string, key: Buffer): ShippingAddress {
    const [ivHex, authTagHex, ciphertext] = encrypted.split(':');
    if (!ivHex || !authTagHex || !ciphertext) {
      throw new Error('Invalid encrypted address format');
    }

    const iv = Buffer.from(ivHex, 'hex');
    const authTag = Buffer.from(authTagHex, 'hex');
    const decipher = crypto.createDecipheriv(this.algorithm, key, iv);
    decipher.setAuthTag(authTag);

    let plaintext = decipher.update(ciphertext, 'hex', 'utf8');
    plaintext += decipher.final('utf8');

    return JSON.parse(plaintext) as ShippingAddress;
  }

  /**
   * Decrypt shipping address string to object
   * Input format: iv:authTag:ciphertext
   */
  decryptAddress(encrypted: string): ShippingAddress {
    return this.decryptWithKey(encrypted, this.key);
  }

  /**
   * Safe decrypt - tries current key first, then falls back to legacy keys.
   * Returns null if all keys fail (corrupted data).
   * Used for operations that should not fail if address cannot be decrypted.
   */
  tryDecryptAddress(encrypted: string): ShippingAddress | null {
    // Try current key first
    try {
      return this.decryptWithKey(encrypted, this.key);
    } catch {
      // Current key failed, try legacy keys
    }

    // Try each legacy key
    for (let i = 0; i < this.legacyKeys.length; i++) {
      try {
        const result = this.decryptWithKey(encrypted, this.legacyKeys[i]);
        this.logger.warn(
          `Address decrypted with legacy key #${i + 1}. Consider running re-encryption migration.`,
        );
        return result;
      } catch {
        // This legacy key also failed, try next
      }
    }

    // Try parsing as plain JSON (unencrypted data from before encryption was added)
    try {
      const parsed = JSON.parse(encrypted);
      if (parsed && typeof parsed === 'object' && parsed.fullName) {
        this.logger.warn(
          'Address found as plain JSON (not encrypted). Consider running re-encryption migration.',
        );
        return parsed as ShippingAddress;
      }
    } catch {
      // Not JSON either
    }

    this.logger.warn('Failed to decrypt address with current key and all legacy keys');
    return null;
  }

  /**
   * Decrypt with any available key (current or legacy), returning the result
   * along with which key succeeded. Used by migration scripts.
   */
  tryDecryptWithKeyInfo(encrypted: string): { address: ShippingAddress; keyIndex: number } | null {
    // keyIndex: 0 = current key, 1..N = legacy keys, -1 = plain JSON
    try {
      const address = this.decryptWithKey(encrypted, this.key);
      return { address, keyIndex: 0 };
    } catch {
      // continue
    }

    for (let i = 0; i < this.legacyKeys.length; i++) {
      try {
        const address = this.decryptWithKey(encrypted, this.legacyKeys[i]);
        return { address, keyIndex: i + 1 };
      } catch {
        // continue
      }
    }

    try {
      const parsed = JSON.parse(encrypted);
      if (parsed && typeof parsed === 'object' && parsed.fullName) {
        return { address: parsed as ShippingAddress, keyIndex: -1 };
      }
    } catch {
      // not JSON
    }

    return null;
  }
}
