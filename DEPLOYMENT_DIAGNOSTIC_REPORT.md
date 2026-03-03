# Staging Deployment Diagnostic Report (2026-03-03)

## Current Status

- **Deployment Runs**: 408-420 (13 consecutive failures)
- **Failure Point**: Deploy to Staging stage
- **Failure Duration**: ~12 seconds (indicates very early failure)
- **Last Successful Deploy**: Unknown (needs verification)

## Root Cause Analysis

### Failure Timeline

```
SSH Setup (75 lines of code)
  ├─ Key validation (raw PEM or base64)
  ├─ ssh-keyscan to known_hosts
  └─ ??? → FAILURE at 12 seconds
```

The 12-second duration suggests failure happens in one of:

1. **SSH key setup/validation** (Setup SSH step)
2. **SSH connection itself** (first ssh command)
3. **First command after SSH connection** (initial pwd/whoami)

## Key Questions & Diagnostic Steps

### 1. **Are GitHub Secrets Configured?**

Required secrets for deployment:

- `STAGING_SSH_KEY` — Private SSH key (PEM or base64)
- `STAGING_HOST` — Server hostname/IP
- `STAGING_USER` — SSH username
- `STAGING_KAKAO_CLIENT_ID` — Kakao OAuth ID
- `STAGING_KAKAO_CLIENT_SECRET` — Kakao OAuth secret
- `STAGING_ADMIN_EMAILS` — Admin email list (optional, comma-separated)

**Action**: Verify all secrets exist in GitHub Settings → Environments → staging

### 2. **Is the SSH Key Valid?**

The Setup SSH step performs validation:

```bash
# Check if PEM is valid
ssh-keygen -y -f ~/.ssh/id_rsa > /dev/null 2>&1

# If not, try base64 decode
printf '%s' "$SSH_KEY" | tr -d ' \r\n' | base64 -d > ~/.ssh/id_rsa
```

**Issue**: If both fail, the script exits with:

```
ERROR: SSH key invalid. len={length} has_begin={count}
```

**Action**: Manually trigger `Staging SSH Diagnostic Test` workflow to see exact error

### 3. **Can SSH Connect to Staging Host?**

The first SSH command after setup is basic file listing.

**Possible Issues**:

- Host unreachable (network/firewall)
- SSH port not open (default 22)
- SSH key not authorized on server
- Server disk full (causes strange SSH errors)
- Server is down/rebooting

**Action**: Trigger diagnostic workflow to test connectivity

### 4. **Missing Environment Variables?**

The deployment script expects:

```
GITHUB_REF_NAME = "develop" (from GitHub)
STAGING_URL_VAR = var.STAGING_URL (from GitHub environment)
IMAGE_TAG = sha-{40-char-hex} (from build job)
GHCR_TOKEN = GitHub token (automatically provided)
```

**Action**: Verify `vars.STAGING_URL` exists in GitHub environment

## Diagnostic Workflow

A new diagnostic workflow exists: `.github/workflows/staging-ssh-test.yml`

**How to Use**:

1. Go to GitHub Actions
2. Select "Staging SSH Diagnostic Test" workflow
3. Click "Run workflow" → trigger on develop branch
4. View output for:
   - SSH connection status
   - Docker version/status
   - /opt/dorami directory existence
   - Current user/permissions

## Deploy-Staging Script Structure

```
┌─ Setup SSH (validate key, add to known_hosts)
│
├─ Validate image tag format (must be sha-{40hex})
│
└─ Deploy via SSH (heredoc, set -ex):
    ├─ Check pwd/whoami
    ├─ CD to /opt/dorami
    ├─ Git fetch/reset
    ├─ Check for docker-compose changes
    ├─ Verify image commit parity
    ├─ Docker login to GHCR
    ├─ Load .env.staging + deployment vars
    ├─ Docker compose pull
    ├─ Verify image immutability
    ├─ Setup uploads directory
    ├─ Setup SSL certificate
    ├─ Stop old containers
    ├─ Start new containers
    ├─ Health checks (15 attempts)
    └─ Report success
```

## Environment Configuration

### Local .env.staging (checked in, has defaults)

- IMAGE_TAG: `latest` (overridden by deployment)
- ADMIN_EMAILS: `admin@dorami.shop` (may need update for dad041566@gmail.com)
- KAKAO*CLIENT_ID/SECRET: `staging*\*` (overridden by secrets)

### Deployment Overrides (from secrets)

- IMAGE_TAG: `sha-{GITHUB_SHA}` (immutable)
- KAKAO_CLIENT_ID: `${{ secrets.STAGING_KAKAO_CLIENT_ID }}`
- KAKAO_CLIENT_SECRET: `${{ secrets.STAGING_KAKAO_CLIENT_SECRET }}`
- ADMIN_EMAILS: `${{ secrets.STAGING_ADMIN_EMAILS }}`

## Recommended Next Steps

### Immediate (Debug Phase)

1. ✅ Trigger `Staging SSH Diagnostic Test` workflow manually
   - View full output in GitHub Actions
   - Confirm SSH works and Docker is running

2. ✅ Check GitHub Secrets (`Settings → Environments → staging`)
   - Verify all 5 secrets exist
   - SSH_KEY format (should start with "-----BEGIN" or be base64)

3. ✅ Verify vars.STAGING_URL exists
   - Check GitHub Settings → Environments → staging → Variables

### Secondary (If SSH works)

4. ✅ Check staging server directly:

   ```bash
   ssh user@host "cd /opt/dorami && ls -la"
   ssh user@host "docker ps -a | grep dorami"
   ```

5. ✅ Verify docker-compose.yml files on server:
   - `/opt/dorami/docker-compose.base.yml`
   - `/opt/dorami/docker-compose.staging.yml`
   - Check for External Volume declarations

### Tertiary (If SSH works, Docker works)

6. ✅ Manually trigger a test deployment:
   ```bash
   # From staging server
   cd /opt/dorami
   git fetch origin develop
   git reset --hard origin/develop
   docker compose -f docker-compose.base.yml -f docker-compose.staging.yml pull
   docker compose -f docker-compose.base.yml -f docker-compose.staging.yml up -d
   ```

## Known Issues Fixed in Latest Commits

| Commit  | Issue                                            | Fix                                        |
| ------- | ------------------------------------------------ | ------------------------------------------ |
| ddbfbad | docker image inspect fails with `set -e`         | Add `2>/dev/null \|\| echo "unknown"`      |
| 25837c4 | SSL cert renewal forces renewal                  | Check expiry first, only renew if <30 days |
| b1c951e | No commit parity checking                        | Add warning if image commit ≠ code commit  |
| b9dcbfc | Go template `{{.Id}}` interpolation breaks       | Remove non-essential image logging         |
| 62d0a17 | Variables expand prematurely in unquoted heredoc | Quote delimiter: `<< 'ENDSSH'`             |
| 62d0a17 | docker compose pull timeout on network issues    | Add `\|\| true` fallback                   |

## Admin Email Configuration

**Current**: `ADMIN_EMAILS=admin@dorami.shop`
**Requested**: Add `dad041566@gmail.com`

**In .env.staging** (L70):

```bash
ADMIN_EMAILS=admin@dorami.shop
```

**Should be updated to**:

```bash
ADMIN_EMAILS=admin@dorami.shop,dad041566@gmail.com
```

Or set via GitHub Secret: `STAGING_ADMIN_EMAILS`

## Summary Table

| Item                   | Status        | Notes                                |
| ---------------------- | ------------- | ------------------------------------ |
| GitHub Secrets         | ⚠️ Unverified | Need to check manually               |
| SSH Key Format         | ⚠️ Unverified | Could be PEM or base64               |
| Staging Host Reachable | ⚠️ Unverified | Use diagnostic workflow              |
| Docker Running         | ⚠️ Unverified | Use diagnostic workflow              |
| /opt/dorami exists     | ⚠️ Unverified | Use diagnostic workflow              |
| Admin Email            | ❌ Outdated   | Should include dad041566@gmail.com   |
| Workflow Config        | ✅ Fixed      | All recent commits addressing issues |

---

**Next Action**: Manually trigger `Staging SSH Diagnostic Test` workflow and share output.
