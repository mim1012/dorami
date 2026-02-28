#!/bin/bash
#
# Production Database Backup Script
# Backs up PostgreSQL database to local storage and uploads to S3
#
# Usage:
#   ./backup-postgres.sh
#
# Environment variables required:
#   POSTGRES_USER       - Database user (default: dorami_prod)
#   POSTGRES_PASSWORD   - Database password
#   POSTGRES_DB         - Database name (default: dorami_production)
#   S3_BUCKET           - S3 bucket name for offsite backups
#   AWS_ACCESS_KEY_ID   - AWS credentials
#   AWS_SECRET_ACCESS_KEY
#   AWS_DEFAULT_REGION  - AWS region (default: ap-northeast-2)
#
# Exit codes:
#   0 - Success
#   1 - Backup creation failed
#   2 - S3 upload failed
#   3 - Cleanup failed

set -euo pipefail

# ============================================================================
# Configuration
# ============================================================================

POSTGRES_USER="${POSTGRES_USER:-dorami_prod}"
POSTGRES_PASSWORD="${POSTGRES_PASSWORD}"
POSTGRES_DB="${POSTGRES_DB:-dorami_production}"
S3_BUCKET="${S3_BUCKET}"
AWS_DEFAULT_REGION="${AWS_DEFAULT_REGION:-ap-northeast-2}"

BACKUP_DIR="/opt/dorami/backups"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
BACKUP_FILENAME="db_backup_${TIMESTAMP}.sql.gz"
BACKUP_PATH="${BACKUP_DIR}/${BACKUP_FILENAME}"
BACKUP_CHECKSUM="${BACKUP_PATH}.sha256"

# Docker container names to try
CONTAINER_NAMES=("dorami-postgres-prod" "live-commerce-postgres")

# S3 paths
S3_YEAR=$(date +%Y)
S3_MONTH=$(date +%m)
S3_PREFIX="s3://${S3_BUCKET}/backups/${S3_YEAR}/${S3_MONTH}"
S3_PATH="${S3_PREFIX}/${BACKUP_FILENAME}"

# Retention policies
LOCAL_RETENTION=7  # Keep 7 local backups
S3_RETENTION_DAYS=30

# ============================================================================
# Functions
# ============================================================================

log_info() {
  echo "[$(date +'%Y-%m-%d %H:%M:%S')] [INFO] $*"
}

log_warn() {
  echo "[$(date +'%Y-%m-%d %H:%M:%S')] [WARN] $*" >&2
}

log_error() {
  echo "[$(date +'%Y-%m-%d %H:%M:%S')] [ERROR] $*" >&2
}

check_dependencies() {
  log_info "Checking dependencies..."

  # Check for docker
  if ! command -v docker &> /dev/null; then
    log_error "docker is not installed"
    return 1
  fi

  # Check for aws cli
  if ! command -v aws &> /dev/null; then
    log_error "aws CLI is not installed"
    return 1
  fi

  # Check for gzip
  if ! command -v gzip &> /dev/null; then
    log_error "gzip is not installed"
    return 1
  fi

  # Check for sha256sum
  if ! command -v sha256sum &> /dev/null; then
    log_error "sha256sum is not installed"
    return 1
  fi

  log_info "All dependencies available"
  return 0
}

validate_environment() {
  log_info "Validating environment variables..."

  if [ -z "${POSTGRES_PASSWORD}" ]; then
    log_error "POSTGRES_PASSWORD is not set"
    return 1
  fi

  if [ -z "${S3_BUCKET}" ]; then
    log_error "S3_BUCKET is not set"
    return 1
  fi

  log_info "Environment variables valid"
  return 0
}

find_postgres_container() {
  log_info "Finding PostgreSQL container..."

  for container_name in "${CONTAINER_NAMES[@]}"; do
    if docker ps --format '{{.Names}}' | grep -q "^${container_name}$"; then
      echo "${container_name}"
      return 0
    fi
  done

  log_error "No PostgreSQL container found (tried: ${CONTAINER_NAMES[*]})"
  return 1
}

create_backup() {
  local container_name="${1}"

  log_info "Creating backup from container: ${container_name}"

  mkdir -p "${BACKUP_DIR}"

  # Determine the actual DB credentials based on container
  local actual_user="${POSTGRES_USER}"
  local actual_db="${POSTGRES_DB}"

  if [ "${container_name}" = "live-commerce-postgres" ]; then
    actual_user="postgres"
    actual_db="live_commerce_production"
    log_info "Using legacy container credentials: user=${actual_user}, db=${actual_db}"
  fi

  # Create backup via pg_dump
  if ! docker exec "${container_name}" \
    pg_dump -U "${actual_user}" "${actual_db}" \
    | gzip > "${BACKUP_PATH}"; then
    log_error "pg_dump failed"
    return 1
  fi

  log_info "Backup created: ${BACKUP_PATH} ($(du -h "${BACKUP_PATH}" | cut -f1))"

  # Create checksum for integrity verification
  if sha256sum "${BACKUP_PATH}" > "${BACKUP_CHECKSUM}"; then
    log_info "Checksum created: $(cat "${BACKUP_CHECKSUM}" | awk '{print $1}')"
  else
    log_warn "Failed to create checksum"
  fi

  return 0
}

upload_to_s3() {
  log_info "Uploading backup to S3: ${S3_PATH}"

  if ! aws s3 cp "${BACKUP_PATH}" "${S3_PATH}" \
    --sse AES256 \
    --metadata "created=$(date -u +'%Y-%m-%dT%H:%M:%SZ'),hostname=$(hostname)" \
    --region "${AWS_DEFAULT_REGION}"; then
    log_error "S3 upload failed"
    return 1
  fi

  log_info "S3 upload successful"

  # Optionally upload checksum
  if [ -f "${BACKUP_CHECKSUM}" ]; then
    aws s3 cp "${BACKUP_CHECKSUM}" "${S3_PREFIX}/$(basename "${BACKUP_CHECKSUM}")" \
      --sse AES256 \
      --region "${AWS_DEFAULT_REGION}" || log_warn "Failed to upload checksum to S3"
  fi

  return 0
}

cleanup_local_backups() {
  log_info "Cleaning up local backups (keeping last ${LOCAL_RETENTION})..."

  # Find and remove old backups, keeping only the most recent ones
  local backup_count=$(find "${BACKUP_DIR}" -maxdepth 1 -name "db_backup_*.sql.gz" -type f | wc -l)

  if [ "${backup_count}" -gt "${LOCAL_RETENTION}" ]; then
    local to_remove=$((backup_count - LOCAL_RETENTION))
    log_info "Removing ${to_remove} old backup(s)"

    find "${BACKUP_DIR}" -maxdepth 1 -name "db_backup_*.sql.gz" -type f \
      -printf '%T@ %p\n' \
      | sort -n \
      | head -n "${to_remove}" \
      | cut -d' ' -f2- \
      | xargs -r rm -v

    log_info "Local cleanup complete"
  else
    log_info "No cleanup needed (${backup_count} backups, limit is ${LOCAL_RETENTION})"
  fi

  return 0
}

# ============================================================================
# Main
# ============================================================================

main() {
  log_info "========== Database Backup Started =========="

  # Pre-flight checks
  if ! check_dependencies; then
    log_error "Dependency check failed"
    exit 1
  fi

  if ! validate_environment; then
    log_error "Environment validation failed"
    exit 1
  fi

  # Find postgres container
  if ! POSTGRES_CONTAINER=$(find_postgres_container); then
    log_error "PostgreSQL container not found"
    exit 1
  fi

  # Create backup
  if ! create_backup "${POSTGRES_CONTAINER}"; then
    log_error "Backup creation failed"
    exit 1
  fi

  # Upload to S3
  if ! upload_to_s3; then
    log_error "S3 upload failed"
    exit 2
  fi

  # Cleanup old local backups
  if ! cleanup_local_backups; then
    log_error "Local cleanup failed (backups may still exist)"
    exit 3
  fi

  log_info "========== Backup Completed Successfully =========="
  log_info "Local: ${BACKUP_PATH}"
  log_info "S3: ${S3_PATH}"

  return 0
}

# Run main function
main "$@"
