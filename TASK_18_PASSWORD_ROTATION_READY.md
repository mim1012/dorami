# Task #18 — Staging Password Rotation — READY FOR MANUAL EXECUTION

**Status**: 🔄 PREPARED (Generated passwords, requires SSH execution)
**Date**: 2026-03-16
**Generated Passwords** (32-char base64):

```
POSTGRES_PASSWORD=xzJivdlu4RXX94QT9rSmmqbtCNiDXlLz+mMxFOLRv3E=
REDIS_PASSWORD=QGGsEDpjl/7K9WnK2VQDlhWj0L1cK9Dhq+QG04Mk9Z4=
```

## Prerequisites

- SSH access to staging server (54.180.94.30) as ubuntu user
- Authorized SSH key configured

## Step-by-Step Commands

### 1. Connect to Staging Server

```bash
# Option A: Using .doramirc shortcut
source .doramirc
staging-ssh

# Option B: Direct SSH
ssh -i ~/.ssh/id_rsa ubuntu@54.180.94.30
# (or use appropriate SSH key path)
```

### 2. Backup Current Configuration

```bash
sudo cp /opt/dorami/.env.staging /opt/dorami/.env.staging.bak.$(date +%Y%m%d_%H%M%S)
echo "✅ Backup created"
```

### 3. Update Password Variables

```bash
# Edit .env.staging
sudo nano /opt/dorami/.env.staging
```

Update these lines with the new passwords:

```bash
POSTGRES_PASSWORD=xzJivdlu4RXX94QT9rSmmqbtCNiDXlLz+mMxFOLRv3E=
REDIS_PASSWORD=QGGsEDpjl/7K9WnK2VQDlhWj0L1cK9Dhq+QG04Mk9Z4=
```

Save and exit (Ctrl+X, Y, Enter in nano)

### 4. Verify Changes

```bash
sudo grep -E "POSTGRES_PASSWORD|REDIS_PASSWORD" /opt/dorami/.env.staging
```

**Expected output:**

```
POSTGRES_PASSWORD=xzJivdlu4RXX94QT9rSmmqbtCNiDXlLz+mMxFOLRv3E=
REDIS_PASSWORD=QGGsEDpjl/7K9WnK2VQDlhWj0L1cK9Dhq+QG04Mk9Z4=
```

### 5. Restart Docker Services

```bash
cd /opt/dorami
sudo docker-compose down
sudo docker-compose up -d
```

Wait 10-15 seconds for services to start.

### 6. Verify Service Health

```bash
# Check running containers
sudo docker-compose ps

# Expected: All containers should be UP (not unhealthy)

# Health check
curl http://localhost/api/health
# Expected: {"data":null,"success":true,"timestamp":"..."}
```

### 7. Backend Logs Verification

```bash
# Check for any password-related errors
sudo docker-compose logs backend | tail -50 | grep -i "password\|redis\|postgres"
# Should show no errors, just connection messages
```

## Rollback (if needed)

If services fail to start:

```bash
# Restore from backup
sudo cp /opt/dorami/.env.staging.bak.* /opt/dorami/.env.staging

# Restart services
cd /opt/dorami
sudo docker-compose restart

# Verify health
curl http://localhost/api/health
```

## Security Notes

✅ These passwords are:

- Cryptographically strong (openssl rand -base64 32)
- 43 characters of entropy (base64 encoded)
- **NOT** stored in git
- **SHOULD** be stored in GitHub Secrets after deployment

⚠️ Important:

- `.env.staging` is in `.gitignore` (never committed)
- Update GitHub Secrets with new passwords for future deployments
- Keep these passwords secure (1Password, LastPass, etc.)

## Verification Checklist

After Task #18 completion:

- [ ] SSH access to staging confirmed
- [ ] `.env.staging` backup created with timestamp
- [ ] Both passwords (POSTGRES + REDIS) updated with new values
- [ ] `grep` verification shows correct new passwords
- [ ] `docker-compose down` completed cleanly
- [ ] `docker-compose up -d` all services started
- [ ] `docker-compose ps` shows all containers UP (not unhealthy)
- [ ] `curl http://localhost/api/health` returns 200 OK
- [ ] Backend logs show no password-related errors
- [ ] GitHub Secrets updated (for next deployment)

## Timeline

- Generated passwords: 2026-03-16 14:42:XX
- Ready for execution: 2026-03-16
- Status: Awaiting manual SSH execution by user
