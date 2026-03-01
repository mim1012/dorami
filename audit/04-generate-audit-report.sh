#!/usr/bin/env bash
# =============================================================================
# 04-generate-audit-report.sh - Production Audit Toolkit: Final Report
# =============================================================================
# Runs scripts 01-03, validates JSON, merges into one report + Markdown.
# Requires: bash + node >= 12. No python3 dependency.
# =============================================================================

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
TIMESTAMP=$(date -u +"%Y-%m-%dT%H:%M:%SZ")
DATE_SLUG=$(date -u +"%Y%m%d-%H%M%S")
JSON_OUT="$SCRIPT_DIR/audit-report-${DATE_SLUG}.json"
MD_OUT="$SCRIPT_DIR/AUDIT_REPORT.md"

if [[ -t 2 ]]; then
  RED='\033[0;31m'; YELLOW='\033[1;33m'; GREEN='\033[0;32m'
  CYAN='\033[0;36m'; BOLD='\033[1m'; RESET='\033[0m'
else
  RED=''; YELLOW=''; GREEN=''; CYAN=''; BOLD=''; RESET=''
fi

log()  { printf "${CYAN}[audit]${RESET} %s\n" "$*" >&2; }
ok()   { printf "${GREEN}[  OK ]${RESET} %s\n" "$*" >&2; }
warn() { printf "${YELLOW}[ WARN]${RESET} %s\n" "$*" >&2; }
err()  { printf "${RED}[ERROR]${RESET} %s\n" "$*" >&2; }

# ---------------------------------------------------------------------------
# 1. Verify prerequisite scripts
# ---------------------------------------------------------------------------
for s in "$SCRIPT_DIR/01-collect-git-env.sh" \
         "$SCRIPT_DIR/02-prisma-drift-check.sh" \
         "$SCRIPT_DIR/03-docker-port-network.sh"; do
  if [[ ! -f "$s" ]]; then err "Missing: $s"; exit 1; fi
  chmod +x "$s"
done

# ---------------------------------------------------------------------------
# 2. Run each script and capture output
# ---------------------------------------------------------------------------
log "Running 01-collect-git-env.sh ..."
GIT_ENV_JSON=$(bash "$SCRIPT_DIR/01-collect-git-env.sh" 2>/dev/null) \
  && ok "01 done" \
  || { warn "01 failed"; GIT_ENV_JSON='{"error":"script 01 failed"}'; }

log "Running 02-prisma-drift-check.sh ..."
PRISMA_JSON=$(bash "$SCRIPT_DIR/02-prisma-drift-check.sh" 2>/dev/null) \
  && ok "02 done" \
  || { warn "02 failed"; PRISMA_JSON='{"error":"script 02 failed"}'; }

log "Running 03-docker-port-network.sh ..."
DOCKER_JSON=$(bash "$SCRIPT_DIR/03-docker-port-network.sh" 2>/dev/null) \
  && ok "03 done" \
  || { warn "03 failed"; DOCKER_JSON='{"error":"script 03 failed"}'; }

# ---------------------------------------------------------------------------
# 3. Write blobs to temp files, merge + validate via node
# ---------------------------------------------------------------------------
TMP1=$(mktemp "/tmp/audit01-XXXXXX.json" 2>/dev/null || echo "/tmp/audit01-$$.json")
TMP2=$(mktemp "/tmp/audit02-XXXXXX.json" 2>/dev/null || echo "/tmp/audit02-$$.json")
TMP3=$(mktemp "/tmp/audit03-XXXXXX.json" 2>/dev/null || echo "/tmp/audit03-$$.json")
printf '%s' "$GIT_ENV_JSON" > "$TMP1"
printf '%s' "$PRISMA_JSON"  > "$TMP2"
printf '%s' "$DOCKER_JSON"  > "$TMP3"

log "Merging into $JSON_OUT ..."
node -e "
var fs=require('fs');
var args=process.argv;
function sr(p,l){try{return JSON.parse(fs.readFileSync(p,'utf8'));}catch(e){process.stderr.write('[WARN] '+l+': '+e.message+'\n');return{error:e.message};}}
var r={report_meta:{generated_at:args[5],generator:'audit/04-generate-audit-report.sh',repo_root:args[6],scripts_run:['01-collect-git-env.sh','02-prisma-drift-check.sh','03-docker-port-network.sh']},git_env:sr(args[2],'01'),prisma_drift:sr(args[3],'02'),docker_network:sr(args[4],'03')};
fs.writeFileSync(args[7],JSON.stringify(r,null,2));
" dummy "$TMP1" "$TMP2" "$TMP3" "$TIMESTAMP" "$REPO_ROOT" "$JSON_OUT"

ok "JSON report written: $JSON_OUT"
rm -f "$TMP1" "$TMP2" "$TMP3"

# ---------------------------------------------------------------------------
# 4. Extract values for Markdown via node
# ---------------------------------------------------------------------------
EXTRACTED=$(node -e "
var fs=require('fs');
var d=JSON.parse(fs.readFileSync(process.argv[2],'utf8'));
var ge=d.git_env||{};
var pd=d.prisma_drift||{};
var dn=d.docker_network||{};
function g(o){var a=Array.prototype.slice.call(arguments,1);var x=o;for(var i=0;i<a.length;i++){if(x==null||typeof x!='object')return 'N/A';x=x[a[i]];}return x==null?'N/A':String(x);}
function len(o){var a=Array.prototype.slice.call(arguments,1);var x=o;for(var i=0;i<a.length;i++){if(x==null||typeof x!='object')return 'N/A';x=x[a[i]];}return Array.isArray(x)?String(x.length):'N/A';}
var pend=((pd.prisma||{}).pending_migrations||[]).filter(function(x){return x&&x.trim();}).length;
var out=[
  g(ge,'git','branch'),g(ge,'git','commit'),
  g(pd,'prisma','status'),g(pd,'prisma','migration_count'),String(pend),
  g(pd,'database','tables'),g(pd,'database','indexes'),g(pd,'database','foreign_keys'),g(pd,'database','enum_types'),
  g(pd,'database','table_data','users'),g(pd,'database','table_data','products'),
  g(pd,'database','table_data','orders'),g(pd,'database','table_data','live_streams'),g(pd,'database','table_data','carts'),
  len(dn,'containers'),len(dn,'networks'),len(dn,'volumes'),len(dn,'security_warnings')
].join('\n');
process.stdout.write(out+'\n');
" dummy "$JSON_OUT" 2>/dev/null)

_EXT_TMP=$(mktemp "/tmp/audit-ext-XXXXXX.txt" 2>/dev/null || echo "/tmp/audit-ext-$$.txt")
printf '%s\n' "$EXTRACTED" > "$_EXT_TMP"
{ IFS= read -r GIT_BRANCH; IFS= read -r GIT_COMMIT; IFS= read -r PRI_STATUS
  IFS= read -r PRI_COUNT;  IFS= read -r PRI_PENDING
  IFS= read -r DB_TABLES;  IFS= read -r DB_INDEXES; IFS= read -r DB_FK; IFS= read -r DB_ENUMS
  IFS= read -r ROW_USERS;  IFS= read -r ROW_PRODUCTS; IFS= read -r ROW_ORDERS
  IFS= read -r ROW_STREAMS; IFS= read -r ROW_CARTS
  IFS= read -r DOCKER_CONTAINERS; IFS= read -r DOCKER_NETWORKS
  IFS= read -r DOCKER_VOLUMES; IFS= read -r DOCKER_WARNINGS
} < "$_EXT_TMP"
rm -f "$_EXT_TMP"

# ---------------------------------------------------------------------------
# 5. Write Markdown report
# ---------------------------------------------------------------------------
log "Writing Markdown summary to $MD_OUT ..."
{
printf '%s\n\n' '# Production Audit Report'
printf '**Generated:** %s  \n' "$TIMESTAMP"
printf '**Repo:** %s  \n' "$REPO_ROOT"
printf '**JSON:** `%s`\n\n' "$(basename "$JSON_OUT")"
printf '%s\n\n' '---'
printf '%s\n\n' '## 1. Git & Environment'
printf '%s\n' '| Field | Value |' '|-------|-------|'
printf '| Branch | `%s` |\n' "$GIT_BRANCH"
printf '| Commit | `%s` |\n\n' "$GIT_COMMIT"
printf '%s\n\n' '---'
printf '%s\n\n' '## 2. Prisma Migration Status'
printf '%s\n' '| Field | Value |' '|-------|-------|'
printf '| Status | %s |\n| Applied | %s |\n| Pending | %s |\n\n' "$PRI_STATUS" "$PRI_COUNT" "$PRI_PENDING"
printf '%s\n\n' '### Database Schema'
printf '%s\n' '| Metric | Count |' '|--------|-------|'
printf '| Tables | %s |\n| Indexes | %s |\n| FK | %s |\n| Enums | %s |\n\n' "$DB_TABLES" "$DB_INDEXES" "$DB_FK" "$DB_ENUMS"
printf '%s\n\n' '### Key Table Row Counts'
printf '%s\n' '| Table | Rows |' '|-------|------|'
printf '| users | %s |\n| products | %s |\n| orders | %s |\n| live_streams | %s |\n| carts | %s |\n\n' \
  "$ROW_USERS" "$ROW_PRODUCTS" "$ROW_ORDERS" "$ROW_STREAMS" "$ROW_CARTS"
printf '%s\n\n' '---'
printf '%s\n\n' '## 3. Docker / Network / Ports'
printf '%s\n' '| Metric | Count |' '|--------|-------|'
printf '| Containers | %s |\n| Networks | %s |\n| Volumes | %s |\n| Security Warnings | %s |\n\n' \
  "$DOCKER_CONTAINERS" "$DOCKER_NETWORKS" "$DOCKER_VOLUMES" "$DOCKER_WARNINGS"
printf '%s\n\n' '---'
printf '%s\n\n' '## Full JSON Report'
printf 'See `%s` for machine-readable data.\n' "$(basename "$JSON_OUT")"
} > "$MD_OUT"
ok "Markdown report written: $MD_OUT"

# ---------------------------------------------------------------------------
# 6. Print summary to stdout
# ---------------------------------------------------------------------------
printf '\n%s========================================%s\n' "$BOLD" "$RESET"
printf '%s  Production Audit Complete%s\n' "$BOLD" "$RESET"
printf '%s========================================%s\n' "$BOLD" "$RESET"
printf '  Timestamp  : %s\n' "$TIMESTAMP"
printf '  JSON report: %s\n' "$JSON_OUT"
printf '  MD report  : %s\n\n' "$MD_OUT"
printf '%s--- Git ---%s\n' "$BOLD" "$RESET"
printf '  Branch : %s\n  Commit : %s\n\n' "$GIT_BRANCH" "$GIT_COMMIT"
printf '%s--- Prisma ---%s\n' "$BOLD" "$RESET"
printf '  Status : %s\n  Applied: %s migrations\n  Pending: %s\n\n' "$PRI_STATUS" "$PRI_COUNT" "$PRI_PENDING"
printf '%s--- Database ---%s\n' "$BOLD" "$RESET"
printf '  Tables:%s Indexes:%s FK:%s Enums:%s\n' "$DB_TABLES" "$DB_INDEXES" "$DB_FK" "$DB_ENUMS"
printf '  users=%s products=%s orders=%s streams=%s carts=%s\n\n' \
  "$ROW_USERS" "$ROW_PRODUCTS" "$ROW_ORDERS" "$ROW_STREAMS" "$ROW_CARTS"
printf '%s--- Docker ---%s\n' "$BOLD" "$RESET"
printf '  Containers:%s Networks:%s Volumes:%s\n' "$DOCKER_CONTAINERS" "$DOCKER_NETWORKS" "$DOCKER_VOLUMES"
if [[ "$DOCKER_WARNINGS" != "0" && "$DOCKER_WARNINGS" != "N/A" ]]; then
  printf "${YELLOW}  Security warnings: %s${RESET}\n" "$DOCKER_WARNINGS"
fi
printf '\n'
