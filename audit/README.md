# Production Audit Toolkit

A set of Bash scripts that collect comprehensive environment, database, and
infrastructure data from the Dorami live-commerce platform and produce a
structured JSON + Markdown audit report.

Designed for pre-deployment verification across three environments:
**Local**, **Staging**, and **Production**.

---

## Quick Start

### 1. Run the full audit (Local environment)

```bash
# From the repo root
bash audit/04-generate-audit-report.sh
```

This runs scripts 01-03 in sequence, merges their output, and produces:

- `audit/AUDIT_REPORT.md` — human-readable Markdown summary (script output)
- `audit/audit-report-YYYYMMDD-HHMMSS.json` — complete machine-readable report
- `audit/output/PRODUCTION_AUDIT_REPORT.md` — detailed production audit report
- `audit/output/audit-summary.json` — structured summary for CI/CD integration

### 2. Review the report

```bash
cat audit/output/PRODUCTION_AUDIT_REPORT.md
```

### 3. Check the summary badge

```bash
python audit/_gen_report.py   # re-generates output/ from the latest JSON
```

---

## Running Individual Scripts

Each script outputs a self-contained JSON object to **stdout**.

```bash
# Git state, environment variables, Docker overview
bash audit/01-collect-git-env.sh

# Prisma migration status + DB schema introspection
bash audit/02-prisma-drift-check.sh

# Docker containers, ports, networks, volumes
bash audit/03-docker-port-network.sh
```

---

## Collecting Data from Remote Environments

### Staging

```bash
ssh ubuntu@staging.doremi-live.com \
  'cd /home/ubuntu/dorami && \
   bash audit/01-collect-git-env.sh     > /tmp/staging-config.json && \
   bash audit/02-prisma-drift-check.sh  > /tmp/staging-db-status.json && \
   bash audit/03-docker-port-network.sh > /tmp/staging-docker-network.json'

scp ubuntu@staging.doremi-live.com:/tmp/staging-*.json audit/output/
```

### Production

```bash
ssh ubuntu@doremi-live.com \
  'cd /home/ubuntu/dorami && \
   bash audit/01-collect-git-env.sh     > /tmp/production-config.json && \
   bash audit/02-prisma-drift-check.sh  > /tmp/production-db-status.json && \
   bash audit/03-docker-port-network.sh > /tmp/production-docker-network.json'

scp ubuntu@doremi-live.com:/tmp/production-*.json audit/output/
```

Then regenerate the report without re-running collection:

```bash
bash audit/04-generate-audit-report.sh --skip-collect
# or
python audit/_gen_report.py
```

---

## Directory Structure

```
audit/
├── 01-collect-git-env.sh          # Git, Env vars, Docker overview
├── 02-prisma-drift-check.sh       # Prisma migrations, DB schema analysis
├── 03-docker-port-network.sh      # Docker, Port, Network, Volume audit
├── 04-generate-audit-report.sh    # Orchestrates 01-03, produces JSON + MD
├── _gen_report.py                 # Python report renderer (output/ files)
├── output/
│   ├── local-config.json          # 01 output for local env
│   ├── staging-config.json        # 01 output for staging (optional)
│   ├── production-config.json     # 01 output for production (optional)
│   ├── local-db-status.json       # 02 output for local env
│   ├── staging-db-status.json     # 02 output for staging (optional)
│   ├── production-db-status.json  # 02 output for production (optional)
│   ├── local-docker-network.json  # 03 output for local env
│   ├── staging-docker-network.json
│   ├── production-docker-network.json
│   ├── PRODUCTION_AUDIT_REPORT.md # Final human-readable report
│   └── audit-summary.json         # Structured summary (CI/CD friendly)
└── README.md                      # This file
```

---

## Script Descriptions

### 01-collect-git-env.sh

Collects:

- Git commit hash, branch, remote branches, local branches
- Environment variables from `backend/.env` (sensitive values redacted)
- Docker version, compose version, running container list, volume list

Output key: `git`, `env_vars`, `docker`

### 02-prisma-drift-check.sh

Collects:

- Prisma migration status (`prisma migrate status`)
- Applied and pending migration names + count
- DB schema introspection: table count, index count, foreign key count, enum count
- Row counts for all user-facing tables
- Enum type definitions

Output key: `prisma`, `database`, `enum_details`

### 03-docker-port-network.sh

Collects:

- Per-container: status, health, CPU %, memory, restart count, uptime
- Port bindings (internal vs externally exposed)
- All Docker networks and their connected containers
- Named and anonymous volume list
- Last 50 log lines per container
- Security warnings (unexpected external port exposure)

Output key: `containers`, `networks`, `volumes`, `port_bindings`, `recent_logs`, `warnings`

### 04-generate-audit-report.sh

Orchestrates scripts 01-03, merges output into:

- A timestamped JSON file (`audit/audit-report-*.json`)
- A brief Markdown summary (`audit/AUDIT_REPORT.md`)

### \_gen_report.py

Reads the latest `audit-report-*.json` and produces the detailed:

- `audit/output/PRODUCTION_AUDIT_REPORT.md` — full structured report
- `audit/output/audit-summary.json` — CI-friendly summary with badge

---

## Verification Checklist (10 items)

| #   | Check                | Description                                 |
| --- | -------------------- | ------------------------------------------- |
| 1   | Git integrity        | All environments on the same commit?        |
| 2   | Prisma up to date    | Zero pending migrations?                    |
| 3   | DB schema consistent | Table/index counts match across envs?       |
| 4   | Container health     | All containers in `healthy` state?          |
| 5   | Zero restarts        | Container restart_count == 0?               |
| 6   | Port isolation       | Internal-only ports not exposed externally? |
| 7   | Network isolation    | Services on dedicated named network?        |
| 8   | Named volumes        | No anonymous volumes (data persistence)?    |
| 9   | Env var completeness | Required vars present and not default?      |
| 10  | Resource usage       | CPU/memory within normal bounds?            |

---

## Requirements

| Tool                 | Required | Notes                                                |
| -------------------- | -------- | ---------------------------------------------------- |
| `bash`               | Yes      | >= 4.0 (Git Bash on Windows works)                   |
| `docker`             | Yes      | Containers must be running for most checks           |
| `npx` / `prisma`     | Yes      | Run from repo root with `node_modules` installed     |
| `python3` / `python` | Yes      | For `_gen_report.py` and script 04 merge step        |
| `node`               | Yes      | Used by `04-generate-audit-report.sh` for JSON merge |

---

## Environment Variable Detection

Scripts auto-detect configuration from `backend/.env` but respect overrides:

| Variable             | Default       | Description                        |
| -------------------- | ------------- | ---------------------------------- |
| `DATABASE_URL`       | Auto-detected | PostgreSQL connection string       |
| `POSTGRES_CONTAINER` | Auto-detected | Docker container name for postgres |

Container name auto-detection order (scripts 02 and 03):

1. `live-commerce-postgres`
2. `dorami-postgres`
3. `postgres`
4. `dorami_postgres_1`
5. `live-commerce_postgres_1`
6. Any running container whose image contains `postgres`

---

## CI/CD Integration

```yaml
# .github/workflows/pre-deploy-audit.yml
- name: Run Pre-deploy Audit
  run: |
    bash audit/04-generate-audit-report.sh
    python audit/_gen_report.py
  env:
    DATABASE_URL: ${{ secrets.DATABASE_URL }}

- name: Check Audit Status
  run: |
    STATUS=$(python -c "import json; d=json.load(open('audit/output/audit-summary.json')); print(d['overall_status'])")
    if [ "$STATUS" = "CRITICAL" ]; then
      echo "Audit failed with CRITICAL issues. Aborting deploy."
      exit 1
    fi

- name: Upload Audit Report
  uses: actions/upload-artifact@v4
  with:
    name: audit-report
    path: |
      audit/audit-report-*.json
      audit/output/PRODUCTION_AUDIT_REPORT.md
      audit/output/audit-summary.json
```

---

## Deployment Workflow

```
1. bash audit/04-generate-audit-report.sh
2. python audit/_gen_report.py
3. cat audit/output/PRODUCTION_AUDIT_REPORT.md
4. Review Final Verdict:
   - GREEN (DEPLOYMENT READY) -> proceed
   - YELLOW (WARNING)         -> review warnings, decide
   - RED (CRITICAL)           -> stop, fix issues first
5. Deploy
6. Re-run audit on Staging/Production post-deploy to verify
```

---

## Troubleshooting

**Docker not found / container not running**

```bash
docker ps                # verify Docker is running
npm run docker:up        # start services from repo root
```

**Prisma CLI not found**

```bash
npm install              # install dependencies
cd backend && npx prisma migrate status
```

**DATABASE_URL not detected**

```bash
# Create backend/.env with:
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/live_commerce
# Or export directly:
export DATABASE_URL=postgresql://...
```

**Permission denied on scripts**

```bash
chmod +x audit/*.sh
```

**SRS heartbeat warning (backend hostname)**

If you see: `SRS cannot reach backend via hostname 'backend'`

Check `infrastructure/docker/srs/srs.conf` — the heartbeat URL must use the
docker-compose service name (e.g., `http://live-commerce-backend:3001/...`).

**Anonymous volumes warning**

Anonymous volumes are created when `docker-compose up` runs without named
volume definitions. To fix, ensure `docker-compose.yml` declares named volumes
for all stateful services (postgres, redis). Then:

```bash
docker-compose down -v   # WARNING: destroys data
docker-compose up -d
```

---

## Reuse and Scheduling

Run monthly or before every significant deployment:

```bash
# Monthly audit cron (add to crontab or GitHub Actions schedule)
# 0 9 1 * * cd /home/ubuntu/dorami && bash audit/04-generate-audit-report.sh

# Track drift over time by keeping timestamped JSON files:
ls audit/audit-report-*.json
```

---

**Last updated**: 2026-03-01
**Maintained by**: Dorami production-audit-toolkit team
