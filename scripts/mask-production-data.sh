#!/bin/bash
# ================================================
# Production → Staging Data Masking Script
# ================================================
# Copies production database to staging with PII masked.
# Run from a machine that has access to both environments.
#
# Usage:
#   ./scripts/mask-production-data.sh
#
# Prerequisites:
#   - pg_dump / psql installed locally
#   - SSH access to production server (for pg_dump)
#   - Access to staging database
#   - .env.staging must be configured

set -euo pipefail

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"
DUMP_FILE="/tmp/dorami_prod_dump_$(date +%Y%m%d_%H%M%S).sql"
MASKED_FILE="/tmp/dorami_masked_dump_$(date +%Y%m%d_%H%M%S).sql"

# ─── Validate Environment ───────────────────────
if [ -z "${PROD_DB_URL:-}" ]; then
    echo -e "${RED}Error: PROD_DB_URL environment variable is required${NC}"
    echo "  export PROD_DB_URL='postgresql://user:pass@prod-host:5432/dorami'"
    exit 1
fi

if [ -z "${STAGING_DB_URL:-}" ]; then
    echo -e "${RED}Error: STAGING_DB_URL environment variable is required${NC}"
    echo "  export STAGING_DB_URL='postgresql://user:pass@staging-host:5432/dorami'"
    exit 1
fi

echo -e "${YELLOW}================================================${NC}"
echo -e "${YELLOW}  Production → Staging Data Migration (Masked)${NC}"
echo -e "${YELLOW}================================================${NC}"
echo ""
echo -e "${RED}WARNING: This will REPLACE all staging data!${NC}"
read -p "Continue? (y/N) " -n 1 -r
echo
if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    echo "Cancelled."
    exit 0
fi

# ─── Step 1: Dump Production DB ─────────────────
echo -e "${YELLOW}[1/4] Dumping production database...${NC}"
pg_dump "$PROD_DB_URL" \
    --no-owner \
    --no-privileges \
    --exclude-table='_prisma_migrations' \
    > "$DUMP_FILE"
echo -e "${GREEN}  Dump saved: $DUMP_FILE ($(du -h "$DUMP_FILE" | cut -f1))${NC}"

# ─── Step 2: Apply PII Masking ──────────────────
echo -e "${YELLOW}[2/4] Generating masking SQL...${NC}"

cat > "$MASKED_FILE" << 'MASK_SQL'
-- ================================================
-- PII Masking for Staging Environment
-- ================================================
-- Applied after restoring production dump to staging DB

BEGIN;

-- Users: mask personal info
UPDATE "User" SET
    email = CASE
        WHEN email IS NOT NULL THEN 'staging_user_' || id || '@masked.test'
        ELSE NULL
    END,
    "kakaoId" = 'masked_kakao_' || id,
    name = '테스트유저_' || id,
    "shippingAddress" = NULL
WHERE role != 'ADMIN';

-- Preserve admin accounts but mask kakaoId
UPDATE "User" SET
    "kakaoId" = 'masked_admin_kakao_' || id
WHERE role = 'ADMIN';

-- Orders: mask depositor names and shipping addresses
UPDATE "Order" SET
    "depositor_name" = '마스킹_' || SUBSTRING(id::text, 1, 4),
    "user_email" = 'masked_' || "user_id" || '@masked.test',
    "shipping_address" = '{"masked": true, "note": "Staging masked data"}'::jsonb;

-- OrderItems: keep product info (non-PII), no changes needed

-- Settlements: mask bank details
UPDATE "Settlement" SET
    "bank_name" = '테스트은행',
    "bank_account" = '0000-000-000000',
    "bank_holder" = '마스킹계좌'
WHERE "bank_account" IS NOT NULL;

-- NotificationSubscription: mask push endpoints
UPDATE "NotificationSubscription" SET
    endpoint = 'https://masked-push-endpoint.test/' || id,
    p256dh = 'masked_p256dh',
    auth = 'masked_auth';

-- AuditLog: mask IP addresses
UPDATE "AuditLog" SET
    "ipAddress" = '0.0.0.0'
WHERE "ipAddress" IS NOT NULL;

-- PointTransaction: keep amounts, mask descriptions with user info
UPDATE "PointTransaction" SET
    description = REGEXP_REPLACE(description, '[가-힣]{2,4}님', '마스킹님', 'g')
WHERE description IS NOT NULL;

COMMIT;

-- Verify masking
DO $$
DECLARE
    unmasked_count INTEGER;
BEGIN
    SELECT COUNT(*) INTO unmasked_count
    FROM "User"
    WHERE role != 'ADMIN'
      AND (email NOT LIKE '%@masked.test' OR "kakaoId" NOT LIKE 'masked_%');

    IF unmasked_count > 0 THEN
        RAISE EXCEPTION 'MASKING VERIFICATION FAILED: % users still have unmasked data', unmasked_count;
    END IF;

    RAISE NOTICE 'Masking verification passed.';
END $$;
MASK_SQL

echo -e "${GREEN}  Masking SQL generated: $MASKED_FILE${NC}"

# ─── Step 3: Restore to Staging ─────────────────
echo -e "${YELLOW}[3/4] Restoring dump to staging database...${NC}"

# Drop and recreate public schema
psql "$STAGING_DB_URL" -c "DROP SCHEMA public CASCADE; CREATE SCHEMA public;"

# Restore production dump
psql "$STAGING_DB_URL" < "$DUMP_FILE"
echo -e "${GREEN}  Dump restored to staging${NC}"

# ─── Step 4: Apply Masking ──────────────────────
echo -e "${YELLOW}[4/4] Applying PII masking...${NC}"
psql "$STAGING_DB_URL" < "$MASKED_FILE"
echo -e "${GREEN}  PII masking applied and verified${NC}"

# ─── Cleanup ────────────────────────────────────
echo -e "${YELLOW}Cleaning up temporary files...${NC}"
rm -f "$DUMP_FILE" "$MASKED_FILE"

echo ""
echo -e "${GREEN}================================================${NC}"
echo -e "${GREEN}  Migration complete!${NC}"
echo -e "${GREEN}================================================${NC}"
echo ""
echo "Masked fields:"
echo "  - User: email, kakaoId, name, shippingAddress"
echo "  - Order: depositor_name, user_email, shipping_address"
echo "  - Settlement: bank_name, bank_account, bank_holder"
echo "  - NotificationSubscription: endpoint, p256dh, auth"
echo "  - AuditLog: ipAddress"
echo "  - PointTransaction: descriptions with names"
