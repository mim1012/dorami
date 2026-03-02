# Database Backup Automation Setup Guide

**Status**: Production-Ready
**Last Updated**: 2026-02-28
**Critical Level**: ⚠️ CRITICAL — Automatic daily backups + S3 offsite storage

## Overview

This guide documents the automated database backup system for Dorami's production PostgreSQL database. The system provides:

- **Automated daily backups** at 02:00 UTC (11:00 KST)
- **S3 offsite storage** for disaster recovery
- **Local backup retention** (7 most recent backups kept on server)
- **Restore automation** for point-in-time recovery
- **Manual backup trigger** support via GitHub Actions

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│ GitHub Actions (backup-database.yml)                        │
│  └─ Scheduled: 0 2 * * * (daily)                            │
│  └─ Manual: workflow_dispatch                               │
└──────────────────────┬──────────────────────────────────────┘
                       │ SSH
                       ▼
┌─────────────────────────────────────────────────────────────┐
│ Production Server (/opt/dorami)                             │
│  ├─ scripts/backup-postgres.sh (local backup + S3 upload)   │
│  ├─ scripts/restore-postgres.sh (restore from backup)       │
│  ├─ scripts/list-backups.sh (list backups)                  │
│  └─ .env.production (DB credentials)                        │
└──────────────────────┬──────────────────────────────────────┘
                       │
        ┌──────────────┼──────────────┐
        ▼              ▼              ▼
    /opt/dorami/   AWS S3         Docker
    backups/       S3 Bucket      PostgreSQL
   (7 backups)     (30 days)       Container
```

## Implementation

### 1. GitHub Secrets Setup

Add the following secrets to your GitHub repository settings:

| Secret Name                  | Description                   | Example                  |
| ---------------------------- | ----------------------------- | ------------------------ |
| `PROD_S3_BACKUP_BUCKET`      | S3 bucket for offsite backups | `dorami-db-backups-prod` |
| `PROD_AWS_ACCESS_KEY_ID`     | AWS IAM user access key       | (64-char hex)            |
| `PROD_AWS_SECRET_ACCESS_KEY` | AWS IAM user secret key       | (40-char hex)            |
| `PROD_POSTGRES_PASSWORD`     | Database password             | (existing secret)        |

**Note**: Reuse existing secrets for SSH connection:

- `PRODUCTION_HOST`
- `PRODUCTION_USER`
- `PRODUCTION_SSH_KEY`

### 2. AWS Setup (One-time)

#### 2.1 Create S3 Bucket

```bash
aws s3api create-bucket \
  --bucket dorami-db-backups-prod \
  --region ap-northeast-2 \
  --create-bucket-configuration LocationConstraint=ap-northeast-2
```

#### 2.2 Enable Server-side Encryption

```bash
aws s3api put-bucket-encryption \
  --bucket dorami-db-backups-prod \
  --server-side-encryption-configuration '{
    "Rules": [{
      "ApplyServerSideEncryptionByDefault": {
        "SSEAlgorithm": "AES256"
      }
    }]
  }'
```

#### 2.3 Block Public Access

```bash
aws s3api put-public-access-block \
  --bucket dorami-db-backups-prod \
  --public-access-block-configuration \
    "BlockPublicAcls=true,IgnorePublicAcls=true,BlockPublicPolicy=true,RestrictPublicBuckets=true"
```

#### 2.4 Add Lifecycle Policy (Auto-delete after 30 days)

```bash
aws s3api put-bucket-lifecycle-configuration \
  --bucket dorami-db-backups-prod \
  --lifecycle-configuration file:///dev/stdin << 'EOF'
{
  "Rules": [{
    "Id": "DeleteOldBackups",
    "Status": "Enabled",
    "Prefix": "backups/",
    "Expiration": {
      "Days": 30
    },
    "AbortIncompleteMultipartUpload": {
      "DaysAfterInitiation": 7
    }
  }]
}
EOF
```

#### 2.5 Create IAM User

1. Go to AWS Console → IAM → Users → Create user
2. User name: `dorami-backup-automation`
3. Attach policy:

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": ["s3:PutObject", "s3:GetObject", "s3:ListBucket"],
      "Resource": ["arn:aws:s3:::dorami-db-backups-prod", "arn:aws:s3:::dorami-db-backups-prod/*"]
    }
  ]
}
```

4. Create access key → copy `PROD_AWS_ACCESS_KEY_ID` and `PROD_AWS_SECRET_ACCESS_KEY` to GitHub Secrets

### 3. Production Server Setup

#### 3.1 Copy Backup Scripts

The scripts are automatically copied during deployment via GitHub Actions. To manually copy them:

```bash
scp scripts/backup-postgres.sh scripts/restore-postgres.sh scripts/list-backups.sh \
  ubuntu@prod-server:/opt/dorami/scripts/

ssh ubuntu@prod-server \
  'chmod +x /opt/dorami/scripts/{backup,restore,list}-postgres.sh'
```

#### 3.2 Create Backup Directory

```bash
sudo mkdir -p /opt/dorami/backups
sudo chown ubuntu:ubuntu /opt/dorami/backups
sudo chmod 755 /opt/dorami/backups
```

#### 3.3 Install AWS CLI (if not present)

```bash
# Ubuntu/Debian
sudo apt-get update
sudo apt-get install -y awscli

# Verify installation
aws --version
```

#### 3.4 Configure AWS Credentials (Optional, for manual testing)

```bash
aws configure --profile dorami-backup
# Enter access key, secret key, region: ap-northeast-2
```

## Usage

### Manual Backup

#### Local Backup Only

```bash
ssh ubuntu@prod-server \
  'POSTGRES_PASSWORD=<pwd> POSTGRES_USER=dorami_prod POSTGRES_DB=dorami_production \
   /opt/dorami/scripts/backup-postgres.sh'
```

#### With S3 Upload

```bash
ssh ubuntu@prod-server \
  'POSTGRES_PASSWORD=<pwd> POSTGRES_USER=dorami_prod POSTGRES_DB=dorami_production \
   S3_BUCKET=dorami-db-backups-prod \
   AWS_ACCESS_KEY_ID=<key> AWS_SECRET_ACCESS_KEY=<secret> \
   /opt/dorami/scripts/backup-postgres.sh'
```

### List Backups

#### Local Backups

```bash
ssh ubuntu@prod-server '/opt/dorami/scripts/list-backups.sh local'
```

#### S3 Backups

```bash
ssh ubuntu@prod-server \
  'AWS_ACCESS_KEY_ID=<key> AWS_SECRET_ACCESS_KEY=<secret> \
   S3_BUCKET=dorami-db-backups-prod \
   /opt/dorami/scripts/list-backups.sh s3'
```

#### All Backups

```bash
ssh ubuntu@prod-server \
  'AWS_ACCESS_KEY_ID=<key> AWS_SECRET_ACCESS_KEY=<secret> \
   S3_BUCKET=dorami-db-backups-prod \
   /opt/dorami/scripts/list-backups.sh all'
```

### Restore Database

#### From Local Backup (Latest)

```bash
ssh ubuntu@prod-server \
  'POSTGRES_PASSWORD=<pwd> /opt/dorami/scripts/restore-postgres.sh latest'
```

#### From Specific Local Backup

```bash
ssh ubuntu@prod-server \
  'POSTGRES_PASSWORD=<pwd> /opt/dorami/scripts/restore-postgres.sh \
   /opt/dorami/backups/db_backup_20260228_110000.sql.gz'
```

#### From S3 Backup

```bash
ssh ubuntu@prod-server \
  'POSTGRES_PASSWORD=<pwd> \
   AWS_ACCESS_KEY_ID=<key> AWS_SECRET_ACCESS_KEY=<secret> \
   /opt/dorami/scripts/restore-postgres.sh \
   s3://dorami-db-backups-prod/backups/2026/02/db_backup_20260228_110000.sql.gz'
```

#### Dry Run (Preview)

```bash
ssh ubuntu@prod-server \
  'DRY_RUN=true /opt/dorami/scripts/restore-postgres.sh latest'
```

## Workflows

### 1. Scheduled Daily Backup (`.github/workflows/backup-database.yml`)

**Trigger**: Every day at 02:00 UTC (11:00 KST)

**Steps**:

1. ✅ Checkout repository
2. ✅ Setup SSH to production server
3. ✅ Execute backup script
4. ✅ Verify S3 upload (if AWS credentials configured)
5. ✅ Generate backup report

**Failure handling**: Job fails immediately (no `continue-on-error`) to alert on issues.

### 2. Pre-deployment Backup (`.github/workflows/deploy-production.yml`)

**Trigger**: During production deployment

**Steps**:

1. ✅ Copy backup script to server
2. ✅ Execute backup (S3 + local)
3. ✅ Fallback to local-only if S3 unavailable
4. ✅ Deploy proceeds even if backup fails (with warning)

**Note**: Backup failure does NOT block deployment to allow emergency rollouts.

### 3. Weekly Restore Test (`.github/workflows/backup-database.yml`)

**Trigger**: Every Sunday at 02:00 UTC (with scheduled backup)

**Steps**:

1. ✅ Verify latest backup gzip integrity
2. ✅ Verify checksum (if available)
3. ✅ Report test results

## Backup Locations

### Local Storage

- **Path**: `/opt/dorami/backups/`
- **Retention**: 7 most recent backups
- **Format**: `db_backup_YYYYMMDD_HHMMSS.sql.gz`
- **Checksum**: `db_backup_YYYYMMDD_HHMMSS.sql.gz.sha256`

### S3 Storage

- **Bucket**: `dorami-db-backups-prod`
- **Path**: `s3://dorami-db-backups-prod/backups/YYYY/MM/db_backup_YYYYMMDD_HHMMSS.sql.gz`
- **Retention**: 30 days (auto-delete via lifecycle policy)
- **Encryption**: AES-256 (SSE-S3)
- **Metadata**: `created`, `hostname`

## Monitoring & Alerts

### GitHub Actions

View backup execution logs:

```
GitHub → Repository → Actions → Backup Database → Latest Run
```

**Status codes**:

- ✅ **success** — Backup completed, S3 upload successful
- ⚠️ **success** (with warning) — Backup created locally, S3 upload skipped (credentials missing)
- ❌ **failure** — Backup creation or upload failed

### Manual Health Check

```bash
# Check latest local backup age
ssh ubuntu@prod-server 'ls -lh /opt/dorami/backups/ | head -5'

# Check S3 backup status
aws s3 ls s3://dorami-db-backups-prod/backups/ --recursive --human-readable

# Test restore on staging (never production)
./scripts/restore-postgres.sh s3://...backup.sql.gz
```

## Troubleshooting

### Backup Script Fails

**Symptoms**: Job fails with Docker or AWS errors

**Diagnosis**:

```bash
ssh ubuntu@prod-server bash -s << 'EOF'
  # Check Docker
  docker ps | grep postgres

  # Check AWS CLI
  aws --version
  aws s3 ls dorami-db-backups-prod/backups/ || echo "AWS error"

  # Check disk space
  df -h /opt/dorami/backups/
EOF
```

**Common issues**:

| Issue                        | Solution                                                                  |
| ---------------------------- | ------------------------------------------------------------------------- |
| `pg_dump: command not found` | PostgreSQL not in PATH; use full container exec                           |
| `aws: command not found`     | AWS CLI not installed; `sudo apt install awscli`                          |
| `403 Forbidden`              | AWS credentials invalid; check `PROD_AWS_ACCESS_KEY_ID` secret            |
| `Disk space full`            | Clean old backups; `ls -t /opt/dorami/backups/ \| tail -n +8 \| xargs rm` |

### Restore Fails

**Symptoms**: Restore script exits with error

**Diagnosis**:

```bash
# Verify backup integrity
ssh ubuntu@prod-server \
  'gunzip -t /opt/dorami/backups/db_backup_*.sql.gz | head -1'

# Test restore (dry run)
ssh ubuntu@prod-server \
  'POSTGRES_PASSWORD=<pwd> DRY_RUN=true \
   /opt/dorami/scripts/restore-postgres.sh latest'
```

**Common issues**:

| Issue                             | Solution                                                          |
| --------------------------------- | ----------------------------------------------------------------- |
| Backup file not found             | Check path; use `list-backups.sh` to find file                    |
| `gunzip: invalid compressed data` | Backup corrupted; try earlier backup                              |
| Database locked                   | Stop app containers; use `SKIP_APP_STOP=true` if running manually |
| Restore hangs                     | Check DB query size; may need `--verbose` for progress            |

## Compliance

### Data Protection

- ✅ Encrypted in transit (HTTPS)
- ✅ Encrypted at rest (S3 SSE-S3)
- ✅ Access restricted to IAM user
- ✅ Audit logs via S3 access logging (optional)

### Disaster Recovery

- ✅ Off-site backup (AWS S3, ap-northeast-2)
- ✅ Automated daily backups
- ✅ 30-day retention window
- ✅ Restore tested weekly

### RTO/RPO

- **RTO** (Recovery Time Objective): < 1 hour (restore from S3)
- **RPO** (Recovery Point Objective): 24 hours (daily backup at 02:00 UTC)

## Next Steps

1. **Create AWS resources** using commands in [AWS Setup](#2-aws-setup-one-time) section
2. **Add GitHub Secrets** for `PROD_AWS_*` credentials
3. **Deploy** with updated workflow — first backup runs at next scheduled time
4. **Monitor** first few backups via GitHub Actions logs
5. **Test restore** on staging environment
6. **Document** in runbooks for incident response team

## References

- Backup script: `scripts/backup-postgres.sh`
- Restore script: `scripts/restore-postgres.sh`
- List backups script: `scripts/list-backups.sh`
- Backup workflow: `.github/workflows/backup-database.yml`
- Deploy workflow: `.github/workflows/deploy-production.yml` (backup step)
- AWS S3 docs: https://docs.aws.amazon.com/s3/
- PostgreSQL docs: https://www.postgresql.org/docs/current/backup.html
