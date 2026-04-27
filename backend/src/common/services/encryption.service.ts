import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as crypto from 'crypto';
import type { ShippingAddress } from '@live-commerce/shared-types';
export type { ShippingAddress } from '@live-commerce/shared-types';

export interface EncryptedAddressEnvelope {
  __encrypted: true;
  alg: 'aes-256-gcm';
  keyVersion: string;
  iv: string;
  tag: string;
  ciphertext: string;
}

@Injectable()
export class EncryptionService {
  private readonly logger = new Logger(EncryptionService.name);
  private readonly algorithm = 'aes-256-gcm' as const;
  private readonly keyVersion: string;
  private readonly key: Buffer | null;
  private readonly legacyKeys: Buffer[];

  constructor(private configService: ConfigService) {
    this.keyVersion = this.configService.get<string>('PROFILE_ENCRYPTION_KEY_VERSION') ?? 'pii-v1';

    const keyString = this.configService.get<string>('PROFILE_ENCRYPTION_KEY');
    if (!keyString || keyString.length !== 64) {
      throw new Error('PROFILE_ENCRYPTION_KEY must be a 64-character hex string (32 bytes)');
    }
    this.key = Buffer.from(keyString, 'hex');

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

  encryptAddress(address: ShippingAddress): EncryptedAddressEnvelope {
    if (!this.key) {
      throw new Error('PROFILE_ENCRYPTION_KEY is required to encrypt shipping addresses');
    }

    const iv = crypto.randomBytes(16);
    const cipher = crypto.createCipheriv(this.algorithm, this.key, iv);

    const plaintext = JSON.stringify(address);
    let ciphertext = cipher.update(plaintext, 'utf8', 'hex');
    ciphertext += cipher.final('hex');
    const authTag = cipher.getAuthTag();

    return {
      __encrypted: true,
      alg: this.algorithm,
      keyVersion: this.keyVersion,
      iv: iv.toString('hex'),
      tag: authTag.toString('hex'),
      ciphertext,
    };
  }

  decryptAddress(encrypted: string | EncryptedAddressEnvelope): ShippingAddress {
    const decrypted = this.tryDecryptAddress(encrypted);
    if (!decrypted) {
      throw new Error('Invalid encrypted address format');
    }
    return decrypted;
  }

  tryDecryptAddress(value: unknown): ShippingAddress | null {
    if (value === null || value === undefined) {
      return null;
    }

    const plainAddress = this.tryParsePlainAddress(value);
    if (plainAddress) {
      return plainAddress;
    }

    const encryptedPayload = this.tryParseEncryptedPayload(value);
    if (!encryptedPayload) {
      this.logger.warn('Failed to parse shipping address payload');
      return null;
    }

    const decrypted = this.tryDecryptEncryptedPayload(encryptedPayload, false);
    return decrypted && !('address' in decrypted) ? decrypted : null;
  }

  normalizeAddressValue(value: unknown): ShippingAddress | null {
    return this.tryDecryptAddress(value);
  }

  tryDecryptWithKeyInfo(
    value: unknown,
  ): { address: ShippingAddress; keyIndex: number; keyVersion?: string | null } | null {
    const plainAddress = this.tryParsePlainAddress(value);
    if (plainAddress) {
      return { address: plainAddress, keyIndex: -1, keyVersion: null };
    }

    const encryptedPayload = this.tryParseEncryptedPayload(value);
    if (!encryptedPayload) {
      return null;
    }

    const decrypted = this.tryDecryptEncryptedPayload(encryptedPayload, true);
    return decrypted && 'address' in decrypted ? decrypted : null;
  }

  private decryptWithKey(encrypted: LegacyEncryptedAddressParts, key: Buffer): ShippingAddress {
    const iv = Buffer.from(encrypted.iv, 'hex');
    const authTag = Buffer.from(encrypted.tag, 'hex');
    const decipher = crypto.createDecipheriv(this.algorithm, key, iv);
    decipher.setAuthTag(authTag);

    let plaintext = decipher.update(encrypted.ciphertext, 'hex', 'utf8');
    plaintext += decipher.final('utf8');

    return JSON.parse(plaintext) as ShippingAddress;
  }

  private tryDecryptEncryptedPayload(
    encryptedPayload: ParsedEncryptedPayload,
    withKeyInfo = false,
  ): ShippingAddress | { address: ShippingAddress; keyIndex: number; keyVersion?: string | null } | null {
    if (this.key) {
      try {
        const address = this.decryptWithKey(encryptedPayload.parts, this.key);
        return withKeyInfo
          ? {
              address,
              keyIndex: 0,
              keyVersion: encryptedPayload.keyVersion,
            }
          : address;
      } catch {
        // continue
      }
    }

    for (let i = 0; i < this.legacyKeys.length; i++) {
      try {
        const address = this.decryptWithKey(encryptedPayload.parts, this.legacyKeys[i]);
        if (!withKeyInfo) {
          this.logger.warn(
            `Address decrypted with legacy key #${i + 1}. Consider running re-encryption migration.`,
          );
          return address;
        }
        return {
          address,
          keyIndex: i + 1,
          keyVersion: encryptedPayload.keyVersion,
        };
      } catch {
        // continue
      }
    }

    this.logger.warn('Failed to decrypt address with current key and all legacy keys');
    return null;
  }

  private tryParsePlainAddress(value: unknown): ShippingAddress | null {
    if (typeof value === 'string') {
      try {
        const parsed = JSON.parse(value);
        return this.tryParsePlainAddress(parsed);
      } catch {
        return null;
      }
    }

    if (!this.isRecord(value) || this.isEncryptedEnvelope(value)) {
      return null;
    }

    const fullName = this.toText(value.fullName) || this.toText(value.name);
    const address1 = this.toText(value.address1) || this.toText(value.street);
    const address2 = this.toText(value.address2);
    const city = this.toText(value.city) || this.toText(value.town);
    const state = this.toText(value.state) || this.toText(value.region);
    const zip = this.toText(value.zip) || this.toText(value.zipCode) || this.toText(value.postalCode);

    if (!fullName && !address1 && !address2 && !city && !state && !zip) {
      return null;
    }

    return {
      fullName,
      address1,
      ...(address2 ? { address2 } : {}),
      city,
      state,
      zip,
    } as ShippingAddress;
  }

  private tryParseEncryptedPayload(value: unknown): ParsedEncryptedPayload | null {
    if (typeof value === 'string') {
      const trimmed = value.trim();
      if (!trimmed) {
        return null;
      }

      if (trimmed.startsWith('{')) {
        try {
          return this.tryParseEncryptedPayload(JSON.parse(trimmed));
        } catch {
          return null;
        }
      }

      const [iv, tag, ciphertext] = trimmed.split(':');
      if (iv && tag && ciphertext) {
        return {
          parts: { iv, tag, ciphertext },
          keyVersion: null,
        };
      }

      return null;
    }

    if (!this.isEncryptedEnvelope(value)) {
      return null;
    }

    return {
      parts: {
        iv: value.iv,
        tag: value.tag,
        ciphertext: value.ciphertext,
      },
      keyVersion: value.keyVersion,
    };
  }

  private isEncryptedEnvelope(value: unknown): value is EncryptedAddressEnvelope {
    return (
      this.isRecord(value) &&
      value.__encrypted === true &&
      value.alg === this.algorithm &&
      typeof value.keyVersion === 'string' &&
      typeof value.iv === 'string' &&
      typeof value.tag === 'string' &&
      typeof value.ciphertext === 'string'
    );
  }

  private isRecord(value: unknown): value is Record<string, unknown> {
    return typeof value === 'object' && value !== null && !Array.isArray(value);
  }

  private toText(entry: unknown): string {
    return typeof entry === 'string' ? entry.trim() : '';
  }
}

interface LegacyEncryptedAddressParts {
  iv: string;
  tag: string;
  ciphertext: string;
}

interface ParsedEncryptedPayload {
  parts: LegacyEncryptedAddressParts;
  keyVersion: string | null;
}
