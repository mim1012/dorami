#!/bin/bash
#
# PostgreSQL Database Restore Script
# Restores database from local backup or S3
#
# Usage:
#   ./restore-postgres.sh [backup-file-or-s3-path]
#
# Examples:
#   ./restore-postgres.sh /opt/dorami/backups/db_backup_20260228_110000.sql.gz
#   ./restore-postgres.sh s3://dorami-db-backups-prod/backups/2026/02/db_backup_20260228_110000.sql.gz
#   ./restore-postgres.sh latest  # Restore most recent local backup
#
# Environment variables:
#   POSTGRES_USER       - Database user (default: dorami_prod)
#   POSTGRES_PASSWORD   - Database password
#   POSTGRES_DB         - Database name (default: dorami_production)
#   AWS_DEFAULT_REGION  - AWS region (default: ap-northeast-2)
#   SKIP_APP_STOP       - Skip stopping app containers (default: false)
#   DRY_RUN             - Show what would be restored without actually restoring (default: false)
#
# Exit codes:
#   0 - Success
#   1 - Configuration/validation error
#   2 - Backup file not found or download failed
#   3 - Restore operation failed
#   4 - Post-restore verification failed

set -euo pipefail

# ============================================================================
# Configuration
# ============================================================================

POSTGRES_USER="${POSTGRES_USER:-dorami_prod}"
POSTGRES_PASSWORD="${POSTGRES_PASSWORD}"
POSTGRES_DB="${POSTGRES_DB:-dorami_production}"
AWS_DEFAULT_REGION="${AWS_DEFAULT_REGION:-ap-northeast-2}"
SKIP_APP_STOP="${SKIP_APP_STOP:-false}"
DRY_RUN="${DRY_RUN:-false}"

BACKUP_LOCATION="${1:-latest}"
BACKUP_DIR="/opt/dorami/backups"
WORK_DIR="/tmp/restore-backup-$$"
RESTORE_FILE=""

# Docker container names
POSTGRES_CONTAINER_NAMES=("dorami-postgres-prod" "live-commerce-postgres")
APP_CONTAINERS=("dorami-backend-prod" "dorami-frontend-prod")

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

cleanup() {
  log_info "Cleaning up temporary files..."
  rm -rf "${WORK_DIR}"
}

trap cleanup EXIT

check_dependencies() {
  log_info "Checking dependencies..."

  for cmd in docker aws gzip gunzip sha256sum psql; do
    if ! command -v "${cmd}" &> /dev/null; then
      log_error "${cmd} is not installed"
      return 1
    fi
  done

  log_info "All dependencies available"
  return 0
}

validate_environment() {
  log_info "Validating environment..."

  if [ -z "${POSTGRES_PASSWORD}" ]; then
    log_error "POSTGRES_PASSWORD is not set"
    return 1
  fi

  return 0
}

find_postgres_container() {
  log_info "Finding PostgreSQL container..."

  for container_name in "${POSTGRES_CONTAINER_NAMES[@]}"; do
    if docker ps --format '{{.Names}}' | grep -q "^${container_name}$"; then
      echo "${container_name}"
      return 0
    fi
  done

  log_error "No PostgreSQL container found"
  return 1
}

resolve_backup_file() {
  local location="${1}"

  log_info "Resolving backup location: ${location}"

  # Case 1: "latest" - find most recent local backup
  if [ "${location}" = "latest" ]; then
    local latest=$(find "${BACKUP_DIR}" -maxdepth 1 -name "db_backup_*.sql.gz" -type f \
      -printf '%T@ %p\n' 2>/dev/null | sort -n | tail -1 | cut -d' ' -f2-)

    if [ -z "${latest}" ]; then
      log_error "No local backups found in ${BACKUP_DIR}"
      return 1
    fi

    RESTORE_FILE="${latest}"
    log_info "Using latest local backup: ${RESTORE_FILE}"
    return 0
  fi

  # Case 2: Local file path
  if [[ "${location}" =~ ^/ ]] && [ -f "${location}" ]; then
    RESTORE_FILE="${location}"
    log_info "Using local backup: ${RESTORE_FILE}"
    return 0
  fi

  # Case 3: S3 path
  if [[ "${location}" =~ ^s3:// ]]; then
    log_info "Downloading backup from S3: ${location}"
    mkdir -p "${WORK_DIR}"

    local filename=$(basename "${location}")
    local download_path="${WORK_DIR}/${filename}"

    if ! aws s3 cp "${location}" "${download_path}" \
      --region "${AWS_DEFAULT_REGION}" \
      --no-progress; then
      log_error "Failed to download from S3: ${location}"
      return 2
    fi

    RESTORE_FILE="${download_path}"
    log_info "Downloaded to: ${RESTORE_FILE}"
    return 0
  fi

  # Case 4: Relative/filename (search in BACKUP_DIR)
  if [ -f "${BACKUP_DIR}/${location}" ]; then
    RESTORE_FILE="${BACKUP_DIR}/${location}"
    log_info "Using backup: ${RESTORE_FILE}"
    return 0
  fi

  log_error "Backup file not found: ${location}"
  return 2
}

verify_backup_integrity() {
  local backup_file="${1}"

  log_info "Verifying backup integrity..."

  # Check if file is valid gzip
  if ! gunzip -t "${backup_file}" 2>/dev/null; then
    log_error "Backup file is not valid gzip: ${backup_file}"
    return 1
  fi

  # Check if checksum file exists
  local checksum_file="${backup_file}.sha256"
  if [ -f "${checksum_file}" ]; then
    log_info "Verifying checksum..."
    if ! sha256sum -c "${checksum_file}" > /dev/null; then
      log_error "Checksum verification failed"
      return 1
    fi
    log_info "Checksum verified ✓"
  else
    log_warn "No checksum file found (skipping checksum verification)"
  fi

  return 0
}

stop_app_containers() {
  if [ "${SKIP_APP_STOP}" = "true" ]; then
    log_warn "Skipping app container stop (SKIP_APP_STOP=true)"
    return 0
  fi

  log_info "Stopping app containers to prevent DB locks..."

  for container in "${APP_CONTAINERS[@]}"; do
    if docker ps --format '{{.Names}}' | grep -q "^${container}$"; then
      log_info "Stopping ${container}..."
      docker stop "${container}" || log_warn "Failed to stop ${container}"
    fi
  done

  sleep 3  # Wait for containers to fully stop
  return 0
}

start_app_containers() {
  log_info "Starting app containers..."

  for container in "${APP_CONTAINERS[@]}"; do
    if docker ps -a --format '{{.Names}}' | grep -q "^${container}$"; then
      log_info "Starting ${container}..."
      docker start "${container}" || log_warn "Failed to start ${container}"
    fi
  done

  sleep 5  # Wait for containers to start
  return 0
}

get_db_credentials() {
  local container_name="${1}"

  # For legacy container, use different credentials
  if [ "${container_name}" = "live-commerce-postgres" ]; then
    echo "postgres:live_commerce_production"
  else
    # Try to read from .env.production
    if [ -f /opt/dorami/.env.production ]; then
      local user=$(grep '^POSTGRES_USER=' /opt/dorami/.env.production | cut -d= -f2 || echo "${POSTGRES_USER}")
      local db=$(grep '^POSTGRES_DB=' /opt/dorami/.env.production | cut -d= -f2 || echo "${POSTGRES_DB}")
      echo "${user}:${db}"
    else
      echo "${POSTGRES_USER}:${POSTGRES_DB}"
    fi
  fi
}

restore_database() {
  local backup_file="${1}"
  local container_name="${2}"

  log_info "Restoring database from: ${backup_file}"
  log_info "Target container: ${container_name}"

  # Get actual credentials
  local creds=$(get_db_credentials "${container_name}")
  local actual_user="${creds%:*}"
  local actual_db="${creds#*:}"

  log_info "Using credentials: user=${actual_user}, db=${actual_db}"

  if [ "${DRY_RUN}" = "true" ]; then
    log_info "[DRY RUN] Would restore database with:"
    log_info "[DRY RUN]   zcat ${backup_file} | docker exec -i ${container_name} psql -U ${actual_user} -d ${actual_db}"
    return 0
  fi

  # Decompress and pipe to psql
  log_info "Starting restore operation..."
  if ! zcat "${backup_file}" \
    | docker exec -i "${container_name}" \
      psql -U "${actual_user}" -d "${actual_db}" -v ON_ERROR_STOP=on; then
    log_error "Restore operation failed"
    return 3
  fi

  log_info "Restore completed successfully"
  return 0
}

verify_restore() {
  local container_name="${1}"

  log_info "Verifying restore..."

  if [ "${DRY_RUN}" = "true" ]; then
    log_info "[DRY RUN] Would verify restore with connectivity test"
    return 0
  fi

  local creds=$(get_db_credentials "${container_name}")
  local actual_user="${creds%:*}"
  local actual_db="${creds#*:}"

  # Try a simple query
  if docker exec "${container_name}" \
    psql -U "${actual_user}" -d "${actual_db}" -c "SELECT 1;" > /dev/null 2>&1; then
    log_info "Database connectivity verified ✓"
    return 0
  else
    log_error "Database connectivity test failed"
    return 4
  fi
}

# ============================================================================
# Main
# ============================================================================

main() {
  log_info "========== Database Restore Started =========="
  log_info "Restore location: ${BACKUP_LOCATION}"
  [ "${DRY_RUN}" = "true" ] && log_warn "DRY RUN MODE - no changes will be made"

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

  # Resolve backup file
  if ! resolve_backup_file "${BACKUP_LOCATION}"; then
    log_error "Failed to resolve backup file"
    exit 2
  fi

  # Verify backup integrity
  if ! verify_backup_integrity "${RESTORE_FILE}"; then
    log_error "Backup integrity check failed"
    exit 2
  fi

  # Stop app containers
  if ! stop_app_containers; then
    log_error "Failed to stop app containers"
    exit 1
  fi

  # Restore database
  if ! restore_database "${RESTORE_FILE}" "${POSTGRES_CONTAINER}"; then
    log_error "Restore operation failed"
    start_app_containers  # Try to recover
    exit 3
  fi

  # Verify restore
  if ! verify_restore "${POSTGRES_CONTAINER}"; then
    log_error "Post-restore verification failed"
    start_app_containers  # Try to recover
    exit 4
  fi

  # Start app containers
  if ! start_app_containers; then
    log_error "Failed to start app containers"
    exit 1
  fi

  log_info "========== Restore Completed Successfully =========="

  return 0
}

# Run main function
main "$@"
