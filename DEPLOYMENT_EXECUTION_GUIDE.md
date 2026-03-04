# Production Deployment Execution Guide

## 🎯 Current Status

- ✅ All 7 CRITICAL hotfixes verified
- ✅ All deployment blockers FIXED (commit 633c9a8)
- ✅ Production verified (139 active users)
- ✅ Pre-deployment checks prepared
- ⏳ **AWAITING**: Actual deployment execution

---

## ⚠️ CRITICAL RISK ASSESSMENT

**Production Impact**:

- **Active Users**: 139 (confirmed via SSH)
- **Downtime Window**: ~2-3 minutes during deployment
- **Data at Risk**: `live_commerce_production` database (protected with backups)
- **Rollback Time**: 2 minutes to previous snapshot

**High-Risk Migrations** (pre-checks prepared):

- Migration `20260301100001_add_cart_unique_constraint` — may fail if duplicate active carts
- Migration `20260302100002_add_quantity_check_constraints` — may fail if negative quantities

---

## 🚀 DEPLOYMENT EXECUTION OPTIONS

### Option A: Automatic Deployment (via GitHub Release)

**Step 1**: Merge `develop` to `main`

```bash
git checkout main
git pull origin main
git merge develop
git push origin main
```

**Step 2**: Create a GitHub Release

```bash
# Via GitHub UI: https://github.com/your-repo/releases/new
# Tag: v1.0.1 (follow semantic versioning)
# Title: "Production Deployment — 7 CRITICAL Hotfixes"
# Body: Copy from DEPLOYMENT_READINESS_REPORT.md
# Publish Release
```

**Result**: GitHub Actions automatically triggers `deploy-production` workflow

- Takes ~15-20 minutes total
- Builds images → SCPs to production → Runs migrations → Health checks

---

### Option B: Manual Workflow Dispatch (via GitHub Actions UI)

**Step 1**: Go to GitHub Actions

```
https://github.com/your-repo/actions/workflows/deploy-production.yml
```

**Step 2**: Click "Run workflow"

- **Branch**: main
- **Version**: v1.0.1 (or leave default)
- **Skip tests**: false (ALWAYS run tests)
- **Rollback**: false (normal deployment, not rollback)

**Step 3**: Click "Run workflow" button

**Result**: Manual deployment starts immediately (~15-20 minutes)

---

## 📋 PRE-DEPLOYMENT FINAL CHECKS

**BEFORE executing deployment, verify:**

### Check 1: Latest Commits

```bash
git log --oneline | head -3
# Must show: 633c9a8 and 1d849f4
```

### Check 2: Environment Variables in Workflow

```bash
grep -E "REDIS_HOST|REDIS_PORT|SRS_API_URL" .github/workflows/deploy-production.yml
# Must show all three variables present
```

### Check 3: Production Database Data Integrity

```bash
# On production server (doremi-live.com)
# Run pre-deployment SQL checks
psql -h localhost -U postgres -d live_commerce_production << 'EOF'
-- Check for duplicate active carts
SELECT COUNT(*) FROM "User" u
WHERE (SELECT COUNT(*) FROM "Cart" c
       WHERE c.userId = u.id AND c.status = 'ACTIVE') > 1;
-- Result should be: 0

-- Check for negative quantities
SELECT COUNT(*) FROM "Product" WHERE quantity < 0;
-- Result should be: 0

SELECT COUNT(*) FROM "CartItem" WHERE quantity <= 0;
-- Result should be: 0
EOF
```

### Check 4: Services Ready

```bash
# Verify backend can start with new env vars
docker-compose -f docker-compose.prod.yml config | grep -E "REDIS_HOST|SRS_API_URL"
# Should show the variables
```

---

## 🔄 DEPLOYMENT PROCESS (What Will Happen)

**Phase 1: Pre-Deployment (1 min)**

- Docker images built for backend + frontend
- `.env.production` created with all required variables (including REDIS_HOST, REDIS_PORT, SRS_API_URL)
- Configuration files prepared

**Phase 2: Deployment (1-2 min)**

- Connect to production server via SSH
- SCP `.env.production` to server
- Update `docker-compose.prod.yml`
- Execute: `docker compose pull && docker compose up -d`
- All containers restart with new configuration

**Phase 3: Post-Deployment (1 min)**

- Run database migrations (2 HIGH-RISK)
  - Migration 20260301100001: Add cart unique constraint
  - Migration 20260302100002: Add quantity check constraints
- Health checks:
  - `GET /api/health/live` (backend liveness)
  - `GET /api/health/ready` (database + Redis connectivity)
  - WebSocket connection verification
- Smoke tests via Playwright E2E

**Phase 4: Verification (ongoing)**

- Monitor logs for errors: `docker logs -f dorami-backend-prod`
- Verify real users connect (WebSocket, chat, shopping)
- Watch database transaction counts

---

## 🔙 ROLLBACK PROCEDURE (If Needed)

**Automatic Rollback** (if health checks fail):

```bash
# GitHub Actions will attempt automatic rollback
# This happens automatically if post-deployment verification fails
```

**Manual Rollback** (if issues detected):

```bash
# SSH to production
ssh -i dorami-production-key.pem ubuntu@doremi-live.com

# Restore previous state
cd /opt/dorami/deployment
docker-compose -f docker-compose.prod.yml down
# Restore from backup
psql -h localhost -U postgres < /opt/dorami/backups/latest.sql
docker-compose -f docker-compose.prod.yml up -d

# Takes ~2 minutes total
```

---

## ✅ POST-DEPLOYMENT VALIDATION

**Immediate (1-5 min after deployment)**:

```bash
# Check backend is running
curl -s https://www.doremi-live.com/api/health/live | jq .

# Check database connected
curl -s https://www.doremi-live.com/api/health/ready | jq .

# Check frontend loads
curl -s -I https://www.doremi-live.com | head -5
```

**User-Facing (5-10 min)**:

- Load homepage: https://www.doremi-live.com
- Check WebSocket connects (DevTools → Network → WS)
- Try adding product to cart
- Check chat in livestream (if stream exists)
- Admin panel: https://www.doremi-live.com/admin

**Monitoring (30 min)**:

```bash
# Monitor backend logs
docker logs -f dorami-backend-prod | grep -i error

# Monitor Redis connection
docker exec dorami-redis-prod redis-cli -a $REDIS_PASSWORD ping
# Should return: PONG

# Monitor database
docker exec dorami-postgres-prod psql -U postgres -d live_commerce_production -c \
  "SELECT COUNT(*) FROM \"User\";"
# Should show: 139+
```

---

## 📊 Deployment Timeline

| Phase                 | Duration      | Details                                 |
| --------------------- | ------------- | --------------------------------------- |
| **Build Images**      | 3-5 min       | Docker builds backend + frontend images |
| **Push to Registry**  | 2 min         | Push to GitHub Container Registry       |
| **Deploy to Server**  | 1-2 min       | SSH, SCP config, docker-compose up      |
| **Run Migrations**    | 2-5 min       | Apply database schema changes           |
| **Health Checks**     | 1 min         | Verify liveness + readiness endpoints   |
| **E2E Smoke Tests**   | 3-5 min       | Run Playwright verification tests       |
| **Total**             | **12-18 min** | End-to-end deployment window            |
| **Expected Downtime** | **2-3 min**   | During docker restart phase             |

---

## 🎯 GO/NO-GO DECISION CRITERIA

**PROCEED WITH DEPLOYMENT IF**:

- ✅ All 7 hotfixes verified in commits
- ✅ Both blockers fixed (REDIS_HOST, SRS_API_URL)
- ✅ No data integrity issues (duplicate carts, negative quantities)
- ✅ Production database backups confirmed
- ✅ Rollback procedure tested
- ✅ Team available for 30-min post-deployment monitoring

**DO NOT DEPLOY IF**:

- ❌ Pre-deployment SQL checks fail
- ❌ Health endpoints not responding
- ❌ Migrations have not been tested locally
- ❌ No one available for monitoring
- ❌ Production server showing high load

---

## 🚨 ESCALATION CONTACTS

| Issue                      | Action                                             |
| -------------------------- | -------------------------------------------------- |
| **Deployment fails**       | Check GitHub Actions logs, trigger rollback        |
| **Migration fails**        | Rollback + investigate database schema             |
| **Users report issues**    | Monitor logs, check WebSocket/database connections |
| **Downtime exceeds 5 min** | Trigger manual rollback immediately                |

---

## 📝 Final Checklist

- [ ] Read DEPLOYMENT_READINESS_REPORT.md
- [ ] Verify commits 633c9a8 and 1d849f4 exist
- [ ] Confirm environment variables in workflow
- [ ] Run pre-deployment SQL data integrity checks
- [ ] Notify team of deployment window
- [ ] Ensure rollback procedure is ready
- [ ] Select deployment method (Option A or B)
- [ ] Execute deployment
- [ ] Monitor post-deployment validation (30 min)
- [ ] Celebrate successful deployment! 🎉

---

**Status**: All preparation complete. Ready for user authorization to execute.

**Next Action**: Choose Option A (Release) or Option B (Workflow Dispatch) and execute.
