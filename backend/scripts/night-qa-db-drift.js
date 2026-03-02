#!/usr/bin/env node

/**
 * Night QA Stage 1: DB Drift & Migration Safety Analyzer
 *
 * Analyzes migration files for destructive operations:
 * - DROP TABLE/INDEX/COLUMN
 * - DELETE FROM
 * - ALTER TABLE ... SET NOT NULL (data loss risk)
 * - RENAME COLUMN (compatibility risk)
 *
 * Returns status: PASS | CONDITIONAL | FAIL
 */

const fs = require('fs');
const path = require('path');

const MIGRATIONS_DIR = path.join(__dirname, '../prisma/migrations');

function analyzeMigrations() {
  const results = {
    safe: [],
    conditional: [],
    destructive: [],
  };

  if (!fs.existsSync(MIGRATIONS_DIR)) {
    console.log('✅ No migrations directory found (fresh start)');
    return results;
  }

  const migrations = fs.readdirSync(MIGRATIONS_DIR)
    .filter(f => !f.startsWith('.') && fs.statSync(path.join(MIGRATIONS_DIR, f)).isDirectory())
    .sort();

  migrations.forEach(migration => {
    const sqlPath = path.join(MIGRATIONS_DIR, migration, 'migration.sql');

    if (!fs.existsSync(sqlPath)) {
      console.warn(`⚠️  No migration.sql in ${migration}`);
      return;
    }

    const content = fs.readFileSync(sqlPath, 'utf8');

    // Patterns for different risk levels
    const destructivePatterns = [
      /DROP\s+(TABLE|INDEX|COLUMN|CONSTRAINT)/gi,
      /DELETE\s+FROM/gi,
      /TRUNCATE/gi,
      /ALTER\s+COLUMN.*TYPE\s+/gi,  // Type changes are risky
    ];

    const conditionalPatterns = [
      /ALTER\s+COLUMN.*SET\s+NOT\s+NULL/gi,  // May fail if existing NULLs
      /RENAME\s+COLUMN/gi,
      /RENAME\s+TABLE/gi,
      /ALTER\s+TABLE.*DROP\s+CONSTRAINT/gi,
    ];

    const isDestructive = destructivePatterns.some(p => p.test(content));
    const isConditional = !isDestructive && conditionalPatterns.some(p => p.test(content));

    if (isDestructive) {
      results.destructive.push({
        name: migration,
        reason: 'Contains DROP, DELETE, TRUNCATE, or risky TYPE changes'
      });
    } else if (isConditional) {
      results.conditional.push({
        name: migration,
        reason: 'Contains ALTER NOT NULL or RENAME (may fail with existing data)'
      });
    } else {
      results.safe.push(migration);
    }
  });

  return results;
}

function determineStatus(results) {
  if (results.destructive.length > 0) {
    return 'FAIL';
  }
  if (results.conditional.length > 0) {
    return 'CONDITIONAL';
  }
  return 'PASS';
}

function main() {
  console.log('🔍 Analyzing database migrations for safety...\n');

  const results = analyzeMigrations();
  const status = determineStatus(results);

  console.log(`📊 Migration Analysis Results:`);
  console.log(`  ✅ Safe migrations: ${results.safe.length}`);
  console.log(`  ⚠️  Conditional migrations: ${results.conditional.length}`);
  console.log(`  ❌ Destructive migrations: ${results.destructive.length}`);
  console.log(`\n📋 Status: ${status}\n`);

  if (results.destructive.length > 0) {
    console.log('🔴 DESTRUCTIVE MIGRATIONS DETECTED (deployment blocked):');
    results.destructive.forEach(m => {
      console.log(`  - ${m.name}: ${m.reason}`);
    });
  }

  if (results.conditional.length > 0) {
    console.log('\n⚠️  CONDITIONAL MIGRATIONS (may need review):');
    results.conditional.forEach(m => {
      console.log(`  - ${m.name}: ${m.reason}`);
    });
  }

  // Output for GitHub Actions
  console.log(`\n::set-output name=status::${status}`);
  console.log(`::set-output name=safe::${results.safe.length}`);
  console.log(`::set-output name=conditional::${results.conditional.length}`);
  console.log(`::set-output name=destructive::${results.destructive.length}`);

  process.exit(results.destructive.length > 0 ? 1 : 0);
}

main();
