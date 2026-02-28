#!/bin/bash
#
# List Database Backups from S3 and Local Storage
#
# Usage:
#   ./list-backups.sh [local|s3|all]
#
# Environment variables:
#   S3_BUCKET           - S3 bucket name (required for s3/all)
#   AWS_DEFAULT_REGION  - AWS region (default: ap-northeast-2)

set -euo pipefail

# Configuration
S3_BUCKET="${S3_BUCKET}"
AWS_DEFAULT_REGION="${AWS_DEFAULT_REGION:-ap-northeast-2}"
BACKUP_DIR="/opt/dorami/backups"

# Defaults
SHOW_LOCAL="${1:-all}"
SHOW_S3="${1:-all}"

if [ "${1:-}" = "local" ]; then
  SHOW_S3="no"
elif [ "${1:-}" = "s3" ]; then
  SHOW_LOCAL="no"
elif [ "${1:-}" = "all" ] || [ -z "${1:-}" ]; then
  SHOW_LOCAL="yes"
  SHOW_S3="yes"
else
  echo "Usage: $0 [local|s3|all]"
  exit 1
fi

# ============================================================================
# Functions
# ============================================================================

log_error() {
  echo "[ERROR] $*" >&2
}

list_local_backups() {
  echo ""
  echo "========== LOCAL BACKUPS =========="

  if [ ! -d "${BACKUP_DIR}" ]; then
    echo "Backup directory not found: ${BACKUP_DIR}"
    return 1
  fi

  local count=$(find "${BACKUP_DIR}" -maxdepth 1 -name "db_backup_*.sql.gz" -type f | wc -l)

  if [ "${count}" -eq 0 ]; then
    echo "No local backups found"
    return 0
  fi

  echo "Found ${count} local backup(s):"
  echo ""

  find "${BACKUP_DIR}" -maxdepth 1 -name "db_backup_*.sql.gz" -type f -exec ls -lh {} \; \
    | awk '{
      size = $5;
      file = $NF;
      name = substr(file, index(file, "db_backup"));
      printf "  %-40s %6s  %s\n", name, size, $6" "$7" "$8
    }' \
    | sort -k3 -r

  echo ""
  return 0
}

list_s3_backups() {
  if [ -z "${S3_BUCKET}" ]; then
    log_error "S3_BUCKET not set (cannot list S3 backups)"
    return 1
  fi

  echo ""
  echo "========== S3 BACKUPS =========="

  if ! command -v aws &> /dev/null; then
    log_error "AWS CLI not found"
    return 1
  fi

  # Check if bucket exists and is accessible
  if ! aws s3 ls "s3://${S3_BUCKET}/backups/" \
    --region "${AWS_DEFAULT_REGION}" > /dev/null 2>&1; then
    log_error "Cannot access S3 bucket: ${S3_BUCKET}"
    echo "Ensure AWS credentials are configured and bucket exists."
    return 1
  fi

  # List all backups organized by month
  local tmpfile=$(mktemp)
  trap "rm -f ${tmpfile}" RETURN

  aws s3 ls "s3://${S3_BUCKET}/backups/" \
    --recursive \
    --region "${AWS_DEFAULT_REGION}" \
    --human-readable \
    | grep "\.sql\.gz$" | grep -v "\.sha256$" > "${tmpfile}" || true

  local count=$(wc -l < "${tmpfile}")

  if [ "${count}" -eq 0 ]; then
    echo "No S3 backups found"
    return 0
  fi

  echo "Found ${count} S3 backup(s):"
  echo ""

  awk '{
    # Extract date from filename (YYYYMMDD)
    match($NF, /db_backup_([0-9]{8})_[0-9]{6}/, arr)
    date = arr[1]

    # Format: YYYY-MM-DD
    if (date != "") {
      year = substr(date, 1, 4)
      month = substr(date, 5, 2)
      day = substr(date, 7, 2)
      formatted_date = year"-"month"-"day
    } else {
      formatted_date = "unknown"
    }

    # Print in readable format
    printf "  %-40s %8s  %s\n", $NF, $4, formatted_date
  }' "${tmpfile}" | sort -k3 -r

  echo ""
  echo "S3 path: s3://${S3_BUCKET}/backups/"
  echo ""

  return 0
}

# ============================================================================
# Main
# ============================================================================

main() {
  [ "${SHOW_LOCAL}" = "yes" ] && list_local_backups
  [ "${SHOW_S3}" = "yes" ] && list_s3_backups

  return 0
}

main "$@"
