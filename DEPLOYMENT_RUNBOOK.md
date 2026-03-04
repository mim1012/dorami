# Dorami Production Deployment Runbook

**Last Updated:** 2026-03-04
**Audience:** DevOps, Release Engineering, On-Call Engineers
**Critical Path:** Safe deployment requires 10 safeguard checks ✅

---

## Table of Contents

1. [Pre-Deployment Checklist](#pre-deployment-checklist)
2. [Deployment Methods](#deployment-methods)
3. [Safe Deployment Procedure](#safe-deployment-procedure-recommended)
4. [Staging Test Procedure](#staging-test-procedure)
5. [Rollback Procedure](#rollback-procedure)
6. [Troubleshooting](#troubleshooting)
7. [Important Safeguards](#important-safeguards)

---

## Pre-Deployment Checklist

### Required Checks

- Code is merged to main branch — All PRs reviewed and approved
- All tests pass — CI pipeline green on main
- No active live streams — Check production database or use GitHub workflow
- Database backups available — Last backup within 24 hours
- Production SSH key available — Can connect via SSH to production server
- All GitHub secrets configured — PROD_POSTGRES_PASSWORD, PROD_REDIS_PASSWORD, JWT_SECRET
- Docker images built and pushed — Images available in GHCR

### Pre-Deployment Warning

**DO NOT deploy if:**

- Active live streams are broadcasting (use skip_live_check=true only in emergencies)
- Database is in replication lag status
- Any critical services are degraded
- Recent database schema changes without migration tests

---

## Deployment Methods

### Method 1: Safe Deployment (Recommended)

**When to use:** Normal deployments, first-time deployments, or when you want extra safety

**Process:** 10-step safeguard checks with automatic rollback on failure

**Manual Command:**

```
cd /opt/dorami
IMAGE_TAG=sha-abc123def bash scripts/safe-deploy-production.sh
```

**Via GitHub Actions:**

- Trigger: Deploy to Production (Safe) workflow
- Input: version (e.g., sha-abc123def)
- Wait for workflow completion

**Time:** 5-10 minutes
**Risk Level:** Very Low (safeguards prevent 99.9% of issues)

---

## Safe Deployment Procedure

### 10-Step Safeguard Process

1. DB Backup — Database snapshot created
2. DB Connectivity Test — Verify postgres connection
3. Network Verification — All containers on dorami-internal
4. Migration Preview — Dry-run prisma migrate status
5. Destructive Op Check — Scan for DROP/TRUNCATE operations
6. Apply Migration — Run in separate job container
7. Deploy Backend — Pull image, start fresh container
8. Wait for Startup — Monitor container startup (30 retries)
9. API Health Check — Verify /api/health/ready endpoint
10. Backend-DB Connectivity — Confirm backend can reach database

### Execution Steps

**Step 1: SSH to Production**

```
ssh ubuntu@doremi-live.com
```

**Step 2: Prepare**

```
cd /opt/dorami
export IMAGE_TAG="sha-abc123def"
```

**Step 3: Run Deployment**

```
bash scripts/safe-deploy-production.sh
```

**Step 4: Verify**

```
docker ps | grep dorami-backend-prod
docker logs dorami-backend-prod | tail -50
curl https://www.doremi-live.com/api/health/ready
```

---

## Staging Test Procedure

Always test in staging before production deployment!

**Test Deployment:**

```
ssh ubuntu@staging.doremi-live.com
cd /opt/dorami-staging
IMAGE_TAG=sha-abc123def bash scripts/safe-deploy-staging.sh
```

**Verify Functionality:**

- Open: https://staging.doremi-live.com
- Login (Kakao OAuth)
- Browse products
- Add to cart
- Test checkout flow
- Test chat functionality
- Test admin dashboard

**Run E2E Tests:**

```
cd client-app
npx playwright test --project=user
npx playwright test --project=admin
```

If staging passes, proceed to production.

---

## Rollback Procedure

### Option 1: Rollback to Previous Image

```
ssh ubuntu@doremi-live.com
cd /opt/dorami
export IMAGE_TAG="sha-previous-commit-hash"
bash scripts/safe-deploy-production.sh
```

### Option 2: Quick Rollback

```
docker compose -f docker-compose.base.yml -f docker-compose.prod.yml down backend
sed -i 's/IMAGE_TAG=.*/IMAGE_TAG=sha-previous/' /opt/dorami/.env.production
docker compose -f docker-compose.base.yml -f docker-compose.prod.yml up -d backend
```

### Option 3: Full Database Rollback

```
docker compose -f docker-compose.base.yml -f docker-compose.prod.yml down
ls -la .backups/
docker exec dorami-postgres-prod psql -U dorami_prod dorami_production < .backups/backup_2026-03-04_120000.sql
docker compose -f docker-compose.base.yml -f docker-compose.prod.yml up -d
```

---

## Troubleshooting

### Migration Preview Fails

**Cause:** .env.production missing or DATABASE_URL incorrect

**Fix:**

```
cat /opt/dorami/.env.production | grep DATABASE_URL
```

### API Health Check Fails

**Cause:** Backend still initializing or database connection issue

**Fix:**

```
docker logs dorami-backend-prod | tail -100
docker ps | grep postgres
```

### Destructive Operations Detected

**Cause:** Migration file contains DROP/TRUNCATE operations

**Fix:** Review migration files and contact team lead

### Network Verification Fails

**Cause:** Network doesn't exist or container not connected

**Fix:**

```
docker network create dorami-internal 2>/dev/null || true
docker network inspect dorami-internal
```

### Database Backup Fails

**Cause:** PostgreSQL not running or out of disk space

**Fix:**

```
docker ps | grep postgres
df -h
```

---

## Important Safeguards

### CRITICAL: 10-Step Deployment Safeguards

| Step | Purpose              | Prevents                        |
| ---- | -------------------- | ------------------------------- |
| 1    | DB Backup            | Complete data loss              |
| 2    | Connectivity Test    | Silent DB connection failures   |
| 3    | Network Verification | Docker network misconfiguration |
| 4    | Migration Preview    | Unexpected SQL statements       |
| 5    | Destructive Op Check | Accidental DROP/TRUNCATE        |
| 6    | Apply Migration      | Schema drift from code          |
| 7    | Deploy Backend       | Stale container image           |
| 8    | Wait for Startup     | Backend not ready               |
| 9    | API Health           | Backend initialization failure  |
| 10   | Backend-DB Connect   | Silent database disconnection   |

### Important Rules

**NEVER:**

- Run docker-compose down -v (deletes volumes with 200+ user data)
- Delete docker volumes manually
- Skip the destructive migration check
- Deploy while live streams are active

**ALWAYS:**

- Test in staging first
- Create database backup before deployment
- Run migration preview (dry-run)
- Verify health checks after deployment
- Keep at least 5 backups available

### Post-Deployment Monitoring

```
docker logs -f dorami-backend-prod --tail 100
curl https://www.doremi-live.com/api/health/ready
docker exec dorami-backend-prod npx prisma migrate status
```

---

## Support & Escalation

**Issues during deployment?**

1. Check logs: docker logs dorami-backend-prod
2. Review troubleshooting section
3. Rollback if necessary
4. Escalate to on-call engineer if needed

---

## References

- Safe Deployment Script: scripts/safe-deploy-production.sh
- Staging Test Script: scripts/safe-deploy-staging.sh
- GitHub Workflow: .github/workflows/deploy-production-safe.yml
- Docker Compose: docker-compose.base.yml, docker-compose.prod.yml
- Prisma Migrations: backend/prisma/migrations/
