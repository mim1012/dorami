/**
 * Shipping address backfill / re-encryption script.
 *
 * Supports both legacy `iv:tag:ciphertext` strings and current JSON envelope payloads.
 * The script classifies each row, reports dry-run counts, and optionally rewrites any
 * plain/legacy/stale rows into the current envelope format.
 *
 * Default scope is `users` for safety. Use `--scope=orders` or `--scope=both` explicitly
 * after validating dry-run output.
 *
 * Usage:
 *   # Dry-run users only (default)
 *   npx ts-node scripts/re-encrypt-addresses.ts
 *
 *   # Dry-run both users and orders
 *   npx ts-node scripts/re-encrypt-addresses.ts --scope=both
 *
 *   # Apply users backfill
 *   npx ts-node scripts/re-encrypt-addresses.ts --apply
 *
 *   # Apply orders only with smaller batches
 *   npx ts-node scripts/re-encrypt-addresses.ts --scope=orders --apply --batch-size=100
 *
 * Required env vars:
 *   DATABASE_URL                    - PostgreSQL connection string
 *   PROFILE_ENCRYPTION_KEY          - Current (target) encryption key (64-char hex)
 *
 * Optional env vars:
 *   PROFILE_LEGACY_ENCRYPTION_KEYS  - Comma-separated list of old keys to try
 *   PROFILE_ENCRYPTION_KEY_VERSION  - Current envelope keyVersion (default: pii-v1)
 */

import { Prisma, PrismaClient } from '@prisma/client';
import {
  analyzeAddressValue,
  encryptAddressEnvelope,
  type AddressBackfillAnalysis,
  type AddressBackfillStatus,
} from '../src/common/services/address-backfill.util';

const ALL_STATUSES: AddressBackfillStatus[] = [
  'empty',
  'plain-json',
  'current-envelope',
  'legacy-string-current-key',
  'legacy-string-legacy-key',
  'envelope-legacy-key',
  'envelope-stale-version',
  'decrypt-failed',
];

type Scope = 'users' | 'orders' | 'both';
type EntityType = 'users' | 'orders';

interface CliOptions {
  dryRun: boolean;
  scope: Scope;
  batchSize: number;
  sampleLimit: number;
}

interface StatsSummary {
  scanned: number;
  rewriteCandidates: number;
  rewritten: number;
  failed: number;
  statuses: Record<AddressBackfillStatus, number>;
  samples: string[];
}

function parseArgs(argv: string[]): CliOptions {
  let scope: Scope = 'users';
  let batchSize = 200;
  let sampleLimit = 20;

  for (const arg of argv) {
    if (arg.startsWith('--scope=')) {
      const value = arg.split('=')[1] as Scope | undefined;
      if (value === 'users' || value === 'orders' || value === 'both') {
        scope = value;
      } else {
        throw new Error(`Invalid --scope value: ${value}`);
      }
      continue;
    }

    if (arg.startsWith('--batch-size=')) {
      batchSize = parsePositiveInt(arg.split('=')[1], '--batch-size');
      continue;
    }

    if (arg.startsWith('--sample-limit=')) {
      sampleLimit = parsePositiveInt(arg.split('=')[1], '--sample-limit');
    }
  }

  return {
    dryRun: !argv.includes('--apply'),
    scope,
    batchSize,
    sampleLimit,
  };
}

function parsePositiveInt(raw: string | undefined, flagName: string): number {
  const value = Number(raw);
  if (!Number.isInteger(value) || value <= 0) {
    throw new Error(`${flagName} must be a positive integer`);
  }
  return value;
}

function parseRequiredHexKey(envName: string): Buffer {
  const value = process.env[envName];
  if (!value || value.length !== 64) {
    throw new Error(`${envName} must be a 64-character hex string`);
  }
  return Buffer.from(value, 'hex');
}

function parseLegacyKeys(): Buffer[] {
  const raw = process.env.PROFILE_LEGACY_ENCRYPTION_KEYS || '';
  return raw
    .split(',')
    .map((entry) => entry.trim())
    .filter(Boolean)
    .map((entry) => {
      if (entry.length !== 64) {
        throw new Error(
          `PROFILE_LEGACY_ENCRYPTION_KEYS contains a non-64-char value: ${entry.slice(0, 8)}...`,
        );
      }
      return Buffer.from(entry, 'hex');
    });
}

function createStatsSummary(): StatsSummary {
  return {
    scanned: 0,
    rewriteCandidates: 0,
    rewritten: 0,
    failed: 0,
    statuses: ALL_STATUSES.reduce(
      (acc, status) => {
        acc[status] = 0;
        return acc;
      },
      {} as Record<AddressBackfillStatus, number>,
    ),
    samples: [],
  };
}

function formatEntityLabel(entityType: EntityType, row: { id: string; label?: string | null }): string {
  const suffix = row.label ? ` (${row.label})` : '';
  return `${entityType}:${row.id}${suffix}`;
}

function pushSample(
  stats: StatsSummary,
  sampleLimit: number,
  entityType: EntityType,
  row: { id: string; label?: string | null },
  analysis: AddressBackfillAnalysis,
): void {
  if (stats.samples.length >= sampleLimit) {
    return;
  }

  stats.samples.push(
    `${formatEntityLabel(entityType, row)} -> ${analysis.status}` +
      (analysis.keyVersion ? ` [keyVersion=${analysis.keyVersion}]` : ''),
  );
}

function printSummary(entityType: EntityType, stats: StatsSummary): void {
  console.log(`\n[${entityType}] summary`);
  console.log(`  scanned: ${stats.scanned}`);
  console.log(`  rewrite candidates: ${stats.rewriteCandidates}`);
  console.log(`  rewritten: ${stats.rewritten}`);
  console.log(`  failures: ${stats.failed}`);

  for (const status of ALL_STATUSES) {
    console.log(`  ${status}: ${stats.statuses[status]}`);
  }

  if (stats.samples.length > 0) {
    console.log(`  samples:`);
    for (const sample of stats.samples) {
      console.log(`    - ${sample}`);
    }
  }
}

async function processUsers(
  prisma: PrismaClient,
  stats: StatsSummary,
  options: CliOptions,
  currentKey: Buffer,
  legacyKeys: Buffer[],
  currentKeyVersion: string,
): Promise<void> {
  let cursor: string | undefined;

  for (;;) {
    const users = await prisma.user.findMany({
      where: {
        shippingAddress: { not: null as unknown as undefined },
      },
      select: {
        id: true,
        name: true,
        shippingAddress: true,
      },
      orderBy: { id: 'asc' },
      take: options.batchSize,
      ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
    });

    if (users.length === 0) {
      return;
    }

    for (const user of users) {
      const analysis = analyzeAddressValue(user.shippingAddress, {
        currentKey,
        legacyKeys,
        currentKeyVersion,
      });

      stats.scanned += 1;
      stats.statuses[analysis.status] += 1;

      if (analysis.status === 'decrypt-failed') {
        stats.failed += 1;
      }

      if (!analysis.shouldRewrite || !analysis.address) {
        continue;
      }

      stats.rewriteCandidates += 1;
      pushSample(stats, options.sampleLimit, 'users', { id: user.id, label: user.name }, analysis);

      if (options.dryRun) {
        continue;
      }

      await prisma.user.update({
        where: { id: user.id },
        data: {
          shippingAddress: encryptAddressEnvelope(
            analysis.address,
            currentKey,
            currentKeyVersion,
          ) as Prisma.InputJsonValue,
        },
      });
      stats.rewritten += 1;
    }

    cursor = users[users.length - 1].id;
  }
}

async function processOrders(
  prisma: PrismaClient,
  stats: StatsSummary,
  options: CliOptions,
  currentKey: Buffer,
  legacyKeys: Buffer[],
  currentKeyVersion: string,
): Promise<void> {
  let cursor: string | undefined;

  for (;;) {
    const orders = await prisma.order.findMany({
      select: {
        id: true,
        userEmail: true,
        shippingAddress: true,
      },
      orderBy: { id: 'asc' },
      take: options.batchSize,
      ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
    });

    if (orders.length === 0) {
      return;
    }

    for (const order of orders) {
      const analysis = analyzeAddressValue(order.shippingAddress, {
        currentKey,
        legacyKeys,
        currentKeyVersion,
      });

      stats.scanned += 1;
      stats.statuses[analysis.status] += 1;

      if (analysis.status === 'decrypt-failed') {
        stats.failed += 1;
      }

      if (!analysis.shouldRewrite || !analysis.address) {
        continue;
      }

      stats.rewriteCandidates += 1;
      pushSample(stats, options.sampleLimit, 'orders', { id: order.id, label: order.userEmail }, analysis);

      if (options.dryRun) {
        continue;
      }

      await prisma.order.update({
        where: { id: order.id },
        data: {
          shippingAddress: encryptAddressEnvelope(
            analysis.address,
            currentKey,
            currentKeyVersion,
          ) as Prisma.InputJsonValue,
        },
      });
      stats.rewritten += 1;
    }

    cursor = orders[orders.length - 1].id;
  }
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  const currentKey = parseRequiredHexKey('PROFILE_ENCRYPTION_KEY');
  const legacyKeys = parseLegacyKeys();
  const currentKeyVersion = process.env.PROFILE_ENCRYPTION_KEY_VERSION || 'pii-v1';
  const prisma = new PrismaClient();

  console.log('='.repeat(72));
  console.log('Shipping Address Backfill / Re-encryption');
  console.log(`Mode: ${options.dryRun ? 'DRY RUN' : 'APPLY'}`);
  console.log(`Scope: ${options.scope}`);
  console.log(`Batch size: ${options.batchSize}`);
  console.log(`Sample limit: ${options.sampleLimit}`);
  console.log(`Current key version: ${currentKeyVersion}`);
  console.log(`Legacy keys loaded: ${legacyKeys.length}`);
  console.log('='.repeat(72));

  if (legacyKeys.length === 0) {
    console.log('WARNING: PROFILE_LEGACY_ENCRYPTION_KEYS is empty; legacy-encrypted rows will fail to decrypt.');
  }

  const userStats = createStatsSummary();
  const orderStats = createStatsSummary();

  try {
    if (options.scope === 'users' || options.scope === 'both') {
      await processUsers(prisma, userStats, options, currentKey, legacyKeys, currentKeyVersion);
      printSummary('users', userStats);
    }

    if (options.scope === 'orders' || options.scope === 'both') {
      await processOrders(prisma, orderStats, options, currentKey, legacyKeys, currentKeyVersion);
      printSummary('orders', orderStats);
    }
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((error) => {
  console.error('Backfill script failed:', error);
  process.exit(1);
});
