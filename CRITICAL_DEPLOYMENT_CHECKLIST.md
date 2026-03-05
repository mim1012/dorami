# ⚠️ Critical Deployment Checklist for Dorami

## Scenario A: Missing Database Migrations 🔴

**Symptom**: All API endpoints return 500 with "table does not exist"

**Root Cause**:

- Fresh staging DB created (container restart)
- `prisma migrate deploy` not executed
- OR migrations executed but connection not reset

**Fix**:

```bash
# 1. Run migrations explicitly
docker exec dorami-backend-1 npx prisma migrate deploy --schema prisma/schema.prisma

# 2. Verify all tables exist
docker exec dorami-postgres-1 psql -U dorami -d live_commerce -c '\dt'

# 3. Restart backend to reset connection pool
docker restart dorami-backend-1

# 4. Test endpoints
curl https://www.doremi-live.com/api/products/popular
```

## Scenario B: Database Name Mismatch 🔴

**Staging**: `live_commerce`
**Production**: `live_commerce_production` (or different)

**Must Verify Before Deploy**:

```bash
# Check env vars
grep POSTGRES_DB .env.staging
grep POSTGRES_DB .env.production

# Verify actual DB name
docker exec dorami-postgres-1 psql -U dorami -l | grep commerce
```

## Critical Deploy Steps (in order)

1. ✅ Git branch synced with origin
2. ✅ All TypeScript/ESLint checks pass
3. ✅ Docker containers stop gracefully
4. ✅ Environment variables loaded correctly
5. ✅ **Prisma migrations applied** (most critical!)
6. ✅ Backend container restarts
7. ✅ Database connection pool reset
8. ✅ Health checks pass
9. ✅ API endpoints respond (not 500)

## Deploy Script Safety

Always use:

```bash
git fetch origin develop && git reset --hard origin/develop
```

Never use:

```bash
git pull origin develop  # Can fail with divergent branches
```
