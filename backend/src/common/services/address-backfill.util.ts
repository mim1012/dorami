import * as crypto from 'crypto';
import type { ShippingAddress } from '@live-commerce/shared-types';

const ALGORITHM = 'aes-256-gcm';

export interface EncryptedAddressEnvelope {
  __encrypted: true;
  alg: 'aes-256-gcm';
  keyVersion: string;
  iv: string;
  tag: string;
  ciphertext: string;
}

interface LegacyEncryptedAddressParts {
  iv: string;
  tag: string;
  ciphertext: string;
}

interface ParsedEncryptedPayload {
  format: 'legacy-string' | 'envelope';
  keyVersion: string | null;
  parts: LegacyEncryptedAddressParts;
}

export interface AddressBackfillCryptoConfig {
  currentKey: Buffer;
  legacyKeys: Buffer[];
  currentKeyVersion: string;
}

export type AddressBackfillStatus =
  | 'empty'
  | 'plain-json'
  | 'current-envelope'
  | 'legacy-string-current-key'
  | 'legacy-string-legacy-key'
  | 'envelope-legacy-key'
  | 'envelope-stale-version'
  | 'decrypt-failed';

export interface AddressBackfillAnalysis {
  status: AddressBackfillStatus;
  shouldRewrite: boolean;
  address: ShippingAddress | null;
  format: 'plain' | 'legacy-string' | 'envelope' | 'unknown';
  keyVersion: string | null;
  keyIndex: number | null;
}

export function encryptAddressEnvelope(
  address: ShippingAddress,
  key: Buffer,
  keyVersion: string,
): EncryptedAddressEnvelope {
  const iv = crypto.randomBytes(16);
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv);

  const plaintext = JSON.stringify(address);
  let ciphertext = cipher.update(plaintext, 'utf8', 'hex');
  ciphertext += cipher.final('hex');
  const authTag = cipher.getAuthTag();

  return {
    __encrypted: true,
    alg: ALGORITHM,
    keyVersion,
    iv: iv.toString('hex'),
    tag: authTag.toString('hex'),
    ciphertext,
  };
}

export function analyzeAddressValue(
  value: unknown,
  cryptoConfig: AddressBackfillCryptoConfig,
): AddressBackfillAnalysis {
  if (value === null || value === undefined || isEmptyAddressValue(value)) {
    return {
      status: 'empty',
      shouldRewrite: false,
      address: null,
      format: 'unknown',
      keyVersion: null,
      keyIndex: null,
    };
  }

  const plainAddress = tryParsePlainAddress(value);
  if (plainAddress) {
    return {
      status: 'plain-json',
      shouldRewrite: true,
      address: plainAddress,
      format: 'plain',
      keyVersion: null,
      keyIndex: -1,
    };
  }

  const encryptedPayload = tryParseEncryptedPayload(value);
  if (!encryptedPayload) {
    return {
      status: 'decrypt-failed',
      shouldRewrite: false,
      address: null,
      format: 'unknown',
      keyVersion: null,
      keyIndex: null,
    };
  }

  const decrypted = tryDecryptEncryptedPayload(encryptedPayload, cryptoConfig);
  if (!decrypted) {
    return {
      status: 'decrypt-failed',
      shouldRewrite: false,
      address: null,
      format: encryptedPayload.format,
      keyVersion: encryptedPayload.keyVersion,
      keyIndex: null,
    };
  }

  if (encryptedPayload.format === 'envelope') {
    if (
      decrypted.keyIndex === 0 &&
      encryptedPayload.keyVersion === cryptoConfig.currentKeyVersion
    ) {
      return {
        status: 'current-envelope',
        shouldRewrite: false,
        address: decrypted.address,
        format: 'envelope',
        keyVersion: encryptedPayload.keyVersion,
        keyIndex: decrypted.keyIndex,
      };
    }

    return {
      status: decrypted.keyIndex === 0 ? 'envelope-stale-version' : 'envelope-legacy-key',
      shouldRewrite: true,
      address: decrypted.address,
      format: 'envelope',
      keyVersion: encryptedPayload.keyVersion,
      keyIndex: decrypted.keyIndex,
    };
  }

  return {
    status: decrypted.keyIndex === 0 ? 'legacy-string-current-key' : 'legacy-string-legacy-key',
    shouldRewrite: true,
    address: decrypted.address,
    format: 'legacy-string',
    keyVersion: encryptedPayload.keyVersion,
    keyIndex: decrypted.keyIndex,
  };
}

function tryDecryptEncryptedPayload(
  encryptedPayload: ParsedEncryptedPayload,
  cryptoConfig: AddressBackfillCryptoConfig,
): { address: ShippingAddress; keyIndex: number } | null {
  try {
    return {
      address: decryptWithKey(encryptedPayload.parts, cryptoConfig.currentKey),
      keyIndex: 0,
    };
  } catch {
    // continue
  }

  for (let i = 0; i < cryptoConfig.legacyKeys.length; i++) {
    try {
      return {
        address: decryptWithKey(encryptedPayload.parts, cryptoConfig.legacyKeys[i]),
        keyIndex: i + 1,
      };
    } catch {
      // continue
    }
  }

  return null;
}

function decryptWithKey(encrypted: LegacyEncryptedAddressParts, key: Buffer): ShippingAddress {
  const iv = Buffer.from(encrypted.iv, 'hex');
  const authTag = Buffer.from(encrypted.tag, 'hex');
  const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
  decipher.setAuthTag(authTag);

  let plaintext = decipher.update(encrypted.ciphertext, 'hex', 'utf8');
  plaintext += decipher.final('utf8');

  return JSON.parse(plaintext) as ShippingAddress;
}

function tryParsePlainAddress(value: unknown): ShippingAddress | null {
  if (typeof value === 'string') {
    try {
      const parsed = JSON.parse(value);
      return tryParsePlainAddress(parsed);
    } catch {
      return null;
    }
  }

  if (!isRecord(value) || isEncryptedEnvelope(value)) {
    return null;
  }

  const fullName = toText(value.fullName) || toText(value.name);
  const address1 = toText(value.address1) || toText(value.street);
  const address2 = toText(value.address2);
  const city = toText(value.city) || toText(value.town);
  const state = toText(value.state) || toText(value.region);
  const zip = toText(value.zip) || toText(value.zipCode) || toText(value.postalCode);

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

function tryParseEncryptedPayload(value: unknown): ParsedEncryptedPayload | null {
  if (typeof value === 'string') {
    const trimmed = value.trim();
    if (!trimmed) {
      return null;
    }

    if (trimmed.startsWith('{')) {
      try {
        return tryParseEncryptedPayload(JSON.parse(trimmed));
      } catch {
        return null;
      }
    }

    const [iv, tag, ciphertext] = trimmed.split(':');
    if (iv && tag && ciphertext) {
      return {
        format: 'legacy-string',
        keyVersion: null,
        parts: { iv, tag, ciphertext },
      };
    }

    return null;
  }

  if (!isEncryptedEnvelope(value)) {
    return null;
  }

  return {
    format: 'envelope',
    keyVersion: value.keyVersion,
    parts: {
      iv: value.iv,
      tag: value.tag,
      ciphertext: value.ciphertext,
    },
  };
}

function isEncryptedEnvelope(value: unknown): value is EncryptedAddressEnvelope {
  return (
    isRecord(value) &&
    value.__encrypted === true &&
    value.alg === ALGORITHM &&
    typeof value.keyVersion === 'string' &&
    typeof value.iv === 'string' &&
    typeof value.tag === 'string' &&
    typeof value.ciphertext === 'string'
  );
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isEmptyAddressValue(value: unknown): boolean {
  if (typeof value === 'string') {
    const trimmed = value.trim();
    if (!trimmed) {
      return true;
    }

    if (trimmed.startsWith('{')) {
      try {
        return isEmptyAddressValue(JSON.parse(trimmed));
      } catch {
        return false;
      }
    }

    return false;
  }

  if (!isRecord(value) || isEncryptedEnvelope(value)) {
    return false;
  }

  return [
    value.fullName,
    value.name,
    value.address1,
    value.street,
    value.address2,
    value.city,
    value.town,
    value.state,
    value.region,
    value.zip,
    value.zipCode,
    value.postalCode,
  ].every((entry) => toText(entry) === '');
}

function toText(value: unknown): string {
  return typeof value === 'string' ? value.trim() : '';
}
