import * as crypto from 'crypto';
import type { ShippingAddress } from '@live-commerce/shared-types';
import {
  analyzeAddressValue,
  encryptAddressEnvelope,
  type EncryptedAddressEnvelope,
} from './address-backfill.util';

const ALGORITHM = 'aes-256-gcm';

function encryptLegacyString(address: ShippingAddress, key: Buffer): string {
  const iv = crypto.randomBytes(16);
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv);

  const plaintext = JSON.stringify(address);
  let ciphertext = cipher.update(plaintext, 'utf8', 'hex');
  ciphertext += cipher.final('hex');
  const authTag = cipher.getAuthTag();

  return `${iv.toString('hex')}:${authTag.toString('hex')}:${ciphertext}`;
}

describe('address-backfill.util', () => {
  const currentKey = Buffer.from('11'.repeat(32), 'hex');
  const legacyKey = Buffer.from('22'.repeat(32), 'hex');
  const currentKeyVersion = 'pii-v1';
  const sampleAddress: ShippingAddress = {
    fullName: 'Hermes Stage',
    address1: '123 Encryption Ave',
    address2: 'Suite 42',
    city: 'Los Angeles',
    state: 'CA',
    zip: '90001',
  };

  it('classifies plain address objects as rewrite candidates', () => {
    const result = analyzeAddressValue(sampleAddress, {
      currentKey,
      legacyKeys: [legacyKey],
      currentKeyVersion,
    });

    expect(result.status).toBe('plain-json');
    expect(result.shouldRewrite).toBe(true);
    expect(result.address).toEqual(sampleAddress);
  });

  it('keeps current envelope payloads as-is', () => {
    const envelope = encryptAddressEnvelope(sampleAddress, currentKey, currentKeyVersion);

    const result = analyzeAddressValue(envelope, {
      currentKey,
      legacyKeys: [legacyKey],
      currentKeyVersion,
    });

    expect(result.status).toBe('current-envelope');
    expect(result.shouldRewrite).toBe(false);
    expect(result.address).toEqual(sampleAddress);
  });

  it('marks legacy string payloads encrypted with the current key for rewrite', () => {
    const legacyString = encryptLegacyString(sampleAddress, currentKey);

    const result = analyzeAddressValue(legacyString, {
      currentKey,
      legacyKeys: [legacyKey],
      currentKeyVersion,
    });

    expect(result.status).toBe('legacy-string-current-key');
    expect(result.shouldRewrite).toBe(true);
    expect(result.address).toEqual(sampleAddress);
  });

  it('marks envelope payloads decrypted by a legacy key for rewrite', () => {
    const legacyEnvelope = encryptAddressEnvelope(sampleAddress, legacyKey, 'pii-old');

    const result = analyzeAddressValue(legacyEnvelope, {
      currentKey,
      legacyKeys: [legacyKey],
      currentKeyVersion,
    });

    expect(result.status).toBe('envelope-legacy-key');
    expect(result.shouldRewrite).toBe(true);
    expect(result.address).toEqual(sampleAddress);
  });

  it('marks current-key envelopes with stale keyVersion for rewrite', () => {
    const staleEnvelope: EncryptedAddressEnvelope = encryptAddressEnvelope(
      sampleAddress,
      currentKey,
      'pii-old',
    );

    const result = analyzeAddressValue(staleEnvelope, {
      currentKey,
      legacyKeys: [legacyKey],
      currentKeyVersion,
    });

    expect(result.status).toBe('envelope-stale-version');
    expect(result.shouldRewrite).toBe(true);
    expect(result.address).toEqual(sampleAddress);
  });

  it('treats empty address objects as empty instead of failures', () => {
    const result = analyzeAddressValue(
      {},
      {
        currentKey,
        legacyKeys: [legacyKey],
        currentKeyVersion,
      },
    );

    expect(result.status).toBe('empty');
    expect(result.shouldRewrite).toBe(false);
    expect(result.address).toBeNull();
  });

  it('reports undecryptable payloads as failures', () => {
    const result = analyzeAddressValue('not-json-and-not-encrypted', {
      currentKey,
      legacyKeys: [legacyKey],
      currentKeyVersion,
    });

    expect(result.status).toBe('decrypt-failed');
    expect(result.shouldRewrite).toBe(false);
    expect(result.address).toBeNull();
  });
});
