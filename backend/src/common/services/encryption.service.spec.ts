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
    it('should encrypt shipping address to string format', () => {
      const address: ShippingAddress = {
        fullName: 'John Doe',
        address1: '123 Main St',
        address2: 'Apt 4B',
        city: 'Los Angeles',
        state: 'CA',
        zip: '90001',
        phone: '(310) 555-0123',
      };

      const encrypted = service.encryptAddress(address);

      // Should return string in format: iv:authTag:ciphertext
      expect(typeof encrypted).toBe('string');
      expect(encrypted.split(':').length).toBe(3);

      const [iv, authTag, ciphertext] = encrypted.split(':');
      expect(iv).toHaveLength(32); // 16 bytes = 32 hex chars
      expect(authTag).toHaveLength(32); // 16 bytes = 32 hex chars
      expect(ciphertext.length).toBeGreaterThan(0);
    });

    it('should produce different ciphertext for same input (due to random IV)', () => {
      const address: ShippingAddress = {
        fullName: 'Jane Smith',
        address1: '456 Oak Ave',
        city: 'New York',
        state: 'NY',
        zip: '10001',
        phone: '(212) 555-9999',
      };

      const encrypted1 = service.encryptAddress(address);
      const encrypted2 = service.encryptAddress(address);

      // Different IVs should produce different encrypted strings
      expect(encrypted1).not.toBe(encrypted2);
    });

    it('should handle address without optional address2 field', () => {
      const address: ShippingAddress = {
        fullName: 'Alice Johnson',
        address1: '789 Elm St',
        city: 'Chicago',
        state: 'IL',
        zip: '60601',
        phone: '(312) 555-7777',
      };

      const encrypted = service.encryptAddress(address);

      expect(typeof encrypted).toBe('string');
      expect(encrypted.split(':').length).toBe(3);
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
        phone: '(415) 555-4444',
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
        phone: '(206) 555-3333',
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
        phone: '(123) 456-7890',
      };

      const encrypted = service.encryptAddress(address);
      const [iv, authTag, ciphertext] = encrypted.split(':');

      // Corrupt the ciphertext
      const corruptedCiphertext = ciphertext.slice(0, -4) + 'FFFF';
      const corruptedEncrypted = `${iv}:${authTag}:${corruptedCiphertext}`;

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
        get: jest.fn(() => validKey),
      };

      expect(() => {
        new EncryptionService(configService as any);
      }).not.toThrow();
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
        phone: '(999) 999-9999',
      };

      // First round-trip
      const encrypted1 = service.encryptAddress(address);
      const decrypted1 = service.decryptAddress(encrypted1);
      expect(decrypted1).toEqual(address);

      // Second round-trip (re-encrypt decrypted data)
      const encrypted2 = service.encryptAddress(decrypted1);
      const decrypted2 = service.decryptAddress(encrypted2);
      expect(decrypted2).toEqual(address);

      // Encrypted strings should be different (random IVs)
      expect(encrypted1).not.toBe(encrypted2);
    });

    it('should handle special characters in address', () => {
      const address: ShippingAddress = {
        fullName: "O'Brien & Smith, Jr.",
        address1: '123 "Main" St.',
        address2: 'Apt #4B (Rear)',
        city: "St. Mary's",
        state: 'CA',
        zip: '90001-1234',
        phone: '(310) 555-0123',
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
        phone: '(310) 555-0123',
      };

      const encrypted = service.encryptAddress(address);
      const decrypted = service.decryptAddress(encrypted);

      expect(decrypted).toEqual(address);
      expect(decrypted.fullName).toBe('김민지 (Kim MinJi)');
      expect(decrypted.address1).toContain('🏠');
    });
  });
});
