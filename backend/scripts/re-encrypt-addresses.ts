/**
 * Re-encrypt shipping addresses migration script.
 *
 * Reads every user row that has a shippingAddress, tries to decrypt with:
 *   1. The current PROFILE_ENCRYPTION_KEY
 *   2. Each key listed in PROFILE_LEGACY_ENCRYPTION_KEYS (comma-separated)
 *   3. Plain JSON (unencrypted legacy data)
 *
 * If decryption succeeds with anything other than the current key (case 2 or 3),
 * the address is re-encrypted with the current key and saved back.
 *
 * Usage:
 *   # Dry run (default) - shows what would change without writing
 *   npx ts-node scripts/re-encrypt-addresses.ts
 *
 *   # Apply changes
 *   npx ts-node scripts/re-encrypt-addresses.ts --apply
 *
 * Required env vars:
 *   DATABASE_URL                    - PostgreSQL connection string
 *   PROFILE_ENCRYPTION_KEY          - Current (target) encryption key
 *   PROFILE_LEGACY_ENCRYPTION_KEYS  - Comma-separated list of old keys to try
 */

import { PrismaClient } from '@prisma/client';
import * as crypto from 'crypto';
import type { ShippingAddress } from '@live-commerce/shared-types';

const ALGORITHM = 'aes-256-gcm';

function decryptWithKey(encrypted: string, key: Buffer): ShippingAddress {
  const [ivHex, authTagHex, ciphertext] = encrypted.split(':');
  if (!ivHex || !authTagHex || !ciphertext) {
    throw new Error('Invalid encrypted address format');
  }

  const iv = Buffer.from(ivHex, 'hex');
  const authTag = Buffer.from(authTagHex, 'hex');
  const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
  decipher.setAuthTag(authTag);

  let plaintext = decipher.update(ciphertext, 'hex', 'utf8');
  plaintext += decipher.final('utf8');

  return JSON.parse(plaintext) as ShippingAddress;
}

function encryptWithKey(address: ShippingAddress, key: Buffer): string {
  const iv = crypto.randomBytes(16);
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv);

  const plaintext = JSON.stringify(address);
  let ciphertext = cipher.update(plaintext, 'utf8', 'hex');
  ciphertext += cipher.final('hex');
  const authTag = cipher.getAuthTag();

  return `${iv.toString('hex')}:${authTag.toString('hex')}:${ciphertext}`;
}

function tryDecryptAll(
  encrypted: string,
  currentKey: Buffer,
  legacyKeys: Buffer[],
): { address: ShippingAddress; source: string } | null {
  // Try current key
  try {
    const address = decryptWithKey(encrypted, currentKey);
    return { address, source: 'current' };
  } catch {
    // continue
  }

  // Try legacy keys
  for (let i = 0; i < legacyKeys.length; i++) {
    try {
      const address = decryptWithKey(encrypted, legacyKeys[i]);
      return { address, source: `legacy-${i + 1}` };
    } catch {
      // continue
    }
  }

  // Try plain JSON
  try {
    const parsed = JSON.parse(encrypted);
    if (parsed && typeof parsed === 'object' && parsed.fullName) {
      return { address: parsed as ShippingAddress, source: 'plain-json' };
    }
  } catch {
    // not JSON
  }

  return null;
}

async function main() {
  const dryRun = !process.argv.includes('--apply');

  console.log('='.repeat(60));
  console.log('  Shipping Address Re-encryption Migration');
  console.log(`  Mode: ${dryRun ? 'DRY RUN (no changes)' : 'APPLY (writing changes)'}`);
  console.log('='.repeat(60));

  // Validate keys
  const currentKeyStr = process.env.PROFILE_ENCRYPTION_KEY;
  if (!currentKeyStr || currentKeyStr.length !== 64) {
    console.error('ERROR: PROFILE_ENCRYPTION_KEY must be a 64-character hex string');
    process.exit(1);
  }
  const currentKey = Buffer.from(currentKeyStr, 'hex');

  const legacyKeysStr = process.env.PROFILE_LEGACY_ENCRYPTION_KEYS || '';
  const legacyKeys: Buffer[] = [];
  if (legacyKeysStr) {
    for (const lk of legacyKeysStr.split(',')) {
      const trimmed = lk.trim();
      if (trimmed.length === 64) {
        legacyKeys.push(Buffer.from(trimmed, 'hex'));
      } else if (trimmed.length > 0) {
        console.warn(`WARNING: Skipping invalid legacy key (length ${trimmed.length}): ${trimmed.substring(0, 8)}...`);
      }
    }
  }

  console.log(`\nCurrent key: ${currentKeyStr.substring(0, 8)}...${currentKeyStr.substring(56)}`);
  console.log(`Legacy keys: ${legacyKeys.length}`);

  if (legacyKeys.length === 0) {
    console.error('\nERROR: No legacy keys provided. Set PROFILE_LEGACY_ENCRYPTION_KEYS env var.');
    console.error('Example: PROFILE_LEGACY_ENCRYPTION_KEYS=4301084e...c4c0,0123456789...abcdef');
    process.exit(1);
  }

  const prisma = new PrismaClient();

  try {
    // Fetch all users with shipping addresses
    const users = await prisma.user.findMany({
      where: {
        shippingAddress: { not: null as unknown as undefined },
      },
      select: {
        id: true,
        name: true,
        shippingAddress: true,
      },
    });

    console.log(`\nTotal users with shippingAddress: ${users.length}`);

    let alreadyCurrent = 0;
    let reEncrypted = 0;
    let failed = 0;
    let skippedNull = 0;
    const failures: { userId: string; name: string; preview: string }[] = [];

    for (const user of users) {
      if (!user.shippingAddress) {
        skippedNull++;
        continue;
      }

      const encrypted = user.shippingAddress as string;
      const result = tryDecryptAll(encrypted, currentKey, legacyKeys);

      if (!result) {
        failed++;
        failures.push({
          userId: user.id,
          name: user.name,
          preview: encrypted.substring(0, 40) + '...',
        });
        continue;
      }

      if (result.source === 'current') {
        alreadyCurrent++;
        continue;
      }

      // Needs re-encryption
      console.log(
        `  [${result.source}] User ${user.id} (${user.name}): ${result.address.fullName}, ${result.address.city}`,
      );

      if (!dryRun) {
        const newEncrypted = encryptWithKey(result.address, currentKey);
        await prisma.user.update({
          where: { id: user.id },
          data: { shippingAddress: newEncrypted as unknown as undefined },
        });
      }
      reEncrypted++;
    }

    console.log('\n' + '='.repeat(60));
    console.log('  Results');
    console.log('='.repeat(60));
    console.log(`  Already using current key: ${alreadyCurrent}`);
    console.log(`  Re-encrypted (${dryRun ? 'would be' : 'done'}): ${reEncrypted}`);
    console.log(`  Failed (unrecoverable): ${failed}`);
    console.log(`  Skipped (null address): ${skippedNull}`);
    console.log(`  Total processed: ${users.length}`);

    if (failures.length > 0) {
      console.log('\n  Failed users:');
      for (const f of failures) {
        console.log(`    - ${f.userId} (${f.name}): ${f.preview}`);
      }
    }

    if (dryRun && reEncrypted > 0) {
      console.log(`\n  Run with --apply to write changes.`);
    }

    if (dryRun && reEncrypted === 0 && failed === 0) {
      console.log('\n  All addresses are already encrypted with the current key.');
    }
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((err) => {
  console.error('Migration failed:', err);
  process.exit(1);
});
