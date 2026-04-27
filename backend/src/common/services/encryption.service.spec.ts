import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { EncryptionService, ShippingAddress } from './encryption.service';

describe('EncryptionService', () => {
  let service: EncryptionService;
  const testEncryptionKey = 'a9aebb443b47d5348843dbe95f43c7a5c805c1e1c238e61844aee8044732c4c0'; // 64-char hex

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        EncryptionService,
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn((key: string) => {
              if (key === 'PROFILE_ENCRYPTION_KEY') {
                return testEncryptionKey;
              }
              return null;
            }),
          },
        },
      ],
    }).compile();

    service = module.get<EncryptionService>(EncryptionService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('encryptAddress', () => {
    it('should encrypt shipping address to versioned envelope object', () => {
      const address: ShippingAddress = {
        fullName: 'John Doe',
        address1: '123 Main St',
        address2: 'Apt 4B',
        city: 'Los Angeles',
        state: 'CA',
        zip: '90001',
      };

      const encrypted = service.encryptAddress(address);

      expect(encrypted).toMatchObject({
        __encrypted: true,
        alg: 'aes-256-gcm',
        keyVersion: 'pii-v1',
      });
      expect(encrypted.iv).toHaveLength(32); // 16 bytes = 32 hex chars
      expect(encrypted.tag).toHaveLength(32); // 16 bytes = 32 hex chars
      expect(encrypted.ciphertext.length).toBeGreaterThan(0);
    });

    it('should produce different ciphertext for same input (due to random IV)', () => {
      const address: ShippingAddress = {
        fullName: 'Jane Smith',
        address1: '456 Oak Ave',
        city: 'New York',
        state: 'NY',
        zip: '10001',
      };

      const encrypted1 = service.encryptAddress(address);
      const encrypted2 = service.encryptAddress(address);

      // Different IVs should produce different encrypted payloads
      expect(encrypted1).not.toEqual(encrypted2);
    });

    it('should handle address without optional address2 field', () => {
      const address: ShippingAddress = {
        fullName: 'Alice Johnson',
        address1: '789 Elm St',
        city: 'Chicago',
        state: 'IL',
        zip: '60601',
      };

      const encrypted = service.encryptAddress(address);

      expect(encrypted).toMatchObject({
        __encrypted: true,
        alg: 'aes-256-gcm',
      });
    });
  });

  describe('decryptAddress', () => {
    it('should decrypt address back to original object', () => {
      const originalAddress: ShippingAddress = {
        fullName: 'Bob Wilson',
        address1: '321 Pine Rd',
        address2: 'Suite 200',
        city: 'San Francisco',
        state: 'CA',
        zip: '94102-1234',
      };

      const encrypted = service.encryptAddress(originalAddress);
      const decrypted = service.decryptAddress(encrypted);

      expect(decrypted).toEqual(originalAddress);
    });

    it('should handle address without optional fields', () => {
      const originalAddress: ShippingAddress = {
        fullName: 'Carol Davis',
        address1: '555 Maple Dr',
        city: 'Seattle',
        state: 'WA',
        zip: '98101',
      };

      const encrypted = service.encryptAddress(originalAddress);
      const decrypted = service.decryptAddress(encrypted);

      expect(decrypted).toEqual(originalAddress);
      expect(decrypted.address2).toBeUndefined();
    });

    it('should throw error for invalid encrypted format (missing parts)', () => {
      const invalidEncrypted = 'invalid:format'; // Missing ciphertext

      expect(() => {
        service.decryptAddress(invalidEncrypted);
      }).toThrow('Invalid encrypted address format');
    });

    it('should throw error for invalid encrypted format (no colons)', () => {
      const invalidEncrypted = 'invalidencryptedstring';

      expect(() => {
        service.decryptAddress(invalidEncrypted);
      }).toThrow('Invalid encrypted address format');
    });

    it('should throw error for corrupted ciphertext', () => {
      const address: ShippingAddress = {
        fullName: 'Test User',
        address1: '123 Test St',
        city: 'Test City',
        state: 'TX',
        zip: '12345',
      };

      const encrypted = service.encryptAddress(address);
      const corruptedEncrypted = {
        ...encrypted,
        ciphertext: encrypted.ciphertext.slice(0, -4) + 'FFFF',
      };

      expect(() => {
        service.decryptAddress(corruptedEncrypted);
      }).toThrow();
    });
  });

  describe('encryption key validation', () => {
    it('should throw error if encryption key is missing', () => {
      const configService = {
        get: jest.fn(() => null),
      };

      expect(() => {
        new EncryptionService(configService as any);
      }).toThrow('PROFILE_ENCRYPTION_KEY must be a 64-character hex string (32 bytes)');
    });

    it('should throw error if encryption key is wrong length', () => {
      const configService = {
        get: jest.fn(() => 'tooshort'),
      };

      expect(() => {
        new EncryptionService(configService as any);
      }).toThrow('PROFILE_ENCRYPTION_KEY must be a 64-character hex string (32 bytes)');
    });

    it('should accept valid 64-character hex key', () => {
      const validKey = 'a'.repeat(64);
      const configService = {
        get: jest.fn((key: string) => {
          if (key === 'PROFILE_ENCRYPTION_KEY') {
            return validKey;
          }
          return null;
        }),
      };

      expect(() => {
        new EncryptionService(configService as any);
      }).not.toThrow();
    });
  });

  describe('legacy key fallback', () => {
    const currentKey = 'b'.repeat(64);
    const legacyKey = testEncryptionKey; // Use original test key as legacy
    let legacyService: EncryptionService;
    let currentService: EncryptionService;

    beforeEach(async () => {
      // Service with legacy key as the primary key (simulates old production)
      const legacyModule: TestingModule = await Test.createTestingModule({
        providers: [
          EncryptionService,
          {
            provide: ConfigService,
            useValue: {
              get: jest.fn((key: string) => {
                if (key === 'PROFILE_ENCRYPTION_KEY') {
                  return legacyKey;
                }
                return null;
              }),
            },
          },
        ],
      }).compile();
      legacyService = legacyModule.get<EncryptionService>(EncryptionService);

      // Service with new key + legacy key as fallback
      const currentModule: TestingModule = await Test.createTestingModule({
        providers: [
          EncryptionService,
          {
            provide: ConfigService,
            useValue: {
              get: jest.fn((key: string) => {
                if (key === 'PROFILE_ENCRYPTION_KEY') {
                  return currentKey;
                }
                if (key === 'PROFILE_LEGACY_ENCRYPTION_KEYS') {
                  return legacyKey;
                }
                return null;
              }),
            },
          },
        ],
      }).compile();
      currentService = currentModule.get<EncryptionService>(EncryptionService);
    });

    it('should decrypt data encrypted with legacy key using tryDecryptAddress', () => {
      const address: ShippingAddress = {
        fullName: 'Legacy User',
        address1: '100 Old St',
        city: 'Legacy City',
        state: 'CA',
        zip: '90001',
      };

      // Encrypt with legacy key
      const encrypted = legacyService.encryptAddress(address);

      // Decrypt with current service (should fall back to legacy key)
      const decrypted = currentService.tryDecryptAddress(encrypted);
      expect(decrypted).toEqual(address);
    });

    it('should return null when no key can decrypt', () => {
      // Service with completely different keys, no legacy
      const isolatedService = new EncryptionService({
        get: (key: string) => {
          if (key === 'PROFILE_ENCRYPTION_KEY') {
            return 'c'.repeat(64);
          }
          return null;
        },
      } as any);

      const address: ShippingAddress = {
        fullName: 'Test',
        address1: '1 St',
        city: 'City',
        state: 'CA',
        zip: '90001',
      };
      const encrypted = legacyService.encryptAddress(address);

      expect(isolatedService.tryDecryptAddress(encrypted)).toBeNull();
    });

    it('should decrypt plain JSON object addresses via tryDecryptAddress', () => {
      const address: ShippingAddress = {
        fullName: 'Plain Object User',
        address1: '201 Plain St',
        city: 'Plain City',
        state: 'WA',
        zip: '98052',
      };

      const decrypted = currentService.tryDecryptAddress(address as any);
      expect(decrypted).toEqual(address);
    });

    it('should return keyIndex info via tryDecryptWithKeyInfo', () => {
      const address: ShippingAddress = {
        fullName: 'Info User',
        address1: '300 Info St',
        city: 'Info City',
        state: 'TX',
        zip: '75001',
      };

      // Encrypted with current key -> keyIndex 0
      const encCurrent = currentService.encryptAddress(address);
      const infoCurrent = currentService.tryDecryptWithKeyInfo(encCurrent);
      expect(infoCurrent).not.toBeNull();
      expect(infoCurrent!.keyIndex).toBe(0);
      expect(infoCurrent!.address).toEqual(address);

      // Encrypted with legacy key -> keyIndex 1
      const encLegacy = legacyService.encryptAddress(address);
      const infoLegacy = currentService.tryDecryptWithKeyInfo(encLegacy);
      expect(infoLegacy).not.toBeNull();
      expect(infoLegacy!.keyIndex).toBe(1);
      expect(infoLegacy!.address).toEqual(address);

      // Plain JSON -> keyIndex -1
      const infoPlain = currentService.tryDecryptWithKeyInfo(JSON.stringify(address));
      expect(infoPlain).not.toBeNull();
      expect(infoPlain!.keyIndex).toBe(-1);
    });
  });

  describe('round-trip encryption', () => {
    it('should handle multiple round-trips correctly', () => {
      const address: ShippingAddress = {
        fullName: 'Multi Round',
        address1: '999 Test Blvd',
        city: 'Round Trip City',
        state: 'RT',
        zip: '99999',
      };

      // First round-trip
      const encrypted1 = service.encryptAddress(address);
      const decrypted1 = service.decryptAddress(encrypted1);
      expect(decrypted1).toEqual(address);

      // Second round-trip (re-encrypt decrypted data)
      const encrypted2 = service.encryptAddress(decrypted1);
      const decrypted2 = service.decryptAddress(encrypted2);
      expect(decrypted2).toEqual(address);

      // Encrypted payloads should be different (random IVs)
      expect(encrypted1).not.toEqual(encrypted2);
    });

    it('should handle special characters in address', () => {
      const address: ShippingAddress = {
        fullName: "O'Brien & Smith, Jr.",
        address1: '123 "Main" St.',
        address2: 'Apt #4B (Rear)',
        city: "St. Mary's",
        state: 'CA',
        zip: '90001-1234',
      };

      const encrypted = service.encryptAddress(address);
      const decrypted = service.decryptAddress(encrypted);

      expect(decrypted).toEqual(address);
      expect(decrypted.fullName).toContain("'");
      expect(decrypted.address1).toContain('"');
    });

    it('should handle unicode characters', () => {
      const address: ShippingAddress = {
        fullName: '김민지 (Kim MinJi)',
        address1: '123 Main St 🏠',
        city: 'Los Angeles',
        state: 'CA',
        zip: '90001',
      };

      const encrypted = service.encryptAddress(address);
      const decrypted = service.decryptAddress(encrypted);

      expect(decrypted).toEqual(address);
      expect(decrypted.fullName).toBe('김민지 (Kim MinJi)');
      expect(decrypted.address1).toContain('🏠');
    });
  });
});
