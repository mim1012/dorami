# Staging DB/Redis Password Rotation — Task #18

## Overview

Strengthen Staging environment database and Redis passwords from weak defaults to strong random values.

## Current Setup

- **Staging Server**: 54.180.94.30
- **Files to update**:
  - `.env.staging` (PostgreSQL and Redis password environment variables)
  - Docker Compose will restart services automatically

## Required Passwords

Generate strong passwords (minimum 32 characters):

```bash
# Generate PostgreSQL password
openssl rand -base64 32

# Generate Redis password
openssl rand -base64 32
```

## SSH Access

Use the `.doramirc` shortcut:

```bash
source .doramirc
staging-ssh
```

Or direct SSH:

```bash
ssh -i ~/.ssh/id_ed25519 ubuntu@54.180.94.30
```

## Steps to Complete Task #18

### 1. Connect to Staging Server

```bash
staging-ssh
```

### 2. Backup Current Configuration

```bash
sudo cp /opt/dorami/.env.staging /opt/dorami/.env.staging.bak.$(date +%Y%m%d_%H%M%S)
```

### 3. Update Password Variables

Edit `.env.staging`:

```bash
sudo nano /opt/dorami/.env.staging
```

Change these fields:

- `POSTGRES_PASSWORD=<NEW_STRONG_PASSWORD>` (minimum 32 chars)
- `REDIS_PASSWORD=<NEW_STRONG_PASSWORD>` (minimum 32 chars)

Example:

```
POSTGRES_PASSWORD=sxK9vPqL2mN8aB4cD6eF7gH1jK3lM5nO7pQ9rS2t
REDIS_PASSWORD=aMnOpQrStUvWxYz1a2bC3dE4fG5hI6jK7lM8nO9pQ
```

### 4. Verify Changes

```bash
sudo grep -E "POSTGRES_PASSWORD|REDIS_PASSWORD" /opt/dorami/.env.staging
```

### 5. Restart Services

```bash
cd /opt/dorami
sudo docker-compose down
sudo docker-compose up -d
```

### 6. Verify Service Health

```bash
sudo docker-compose ps
curl http://localhost/api/health
```

## Verification Checklist

- [ ] SSH access to staging server confirmed
- [ ] `.env.staging` backup created
- [ ] New PostgreSQL password (≥32 chars) set
- [ ] New Redis password (≥32 chars) set
- [ ] Docker services restarted successfully
- [ ] Health check passed (200 OK)
- [ ] Backend logs show no password-related errors
- [ ] Database queries working (test via admin panel)
- [ ] Redis operations working (cache/pub-sub functional)

## Rollback (if needed)

```bash
sudo cp /opt/dorami/.env.staging.bak.* /opt/dorami/.env.staging
sudo docker-compose restart
```

## Security Notes

- ✅ Use `openssl rand -base64 32` for cryptographically strong passwords
- ✅ Store new passwords securely (1Password, GitHub Secrets, LastPass)
- ✅ Never commit `.env.staging` to git
- ⚠️ This rotation does NOT automatically update PostgreSQL/Redis internal users
  - For production: SQL `ALTER USER` and `CONFIG SET requirepass` needed
  - For staging: Docker restart with new env vars is sufficient

---

**Status**: ⏳ Awaiting manual execution on staging server
**Next step after completion**: Update GitHub Secrets with new passwords if using CI/CD
