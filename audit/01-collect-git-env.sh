#!/usr/bin/env bash
# audit/01-collect-git-env.sh
# Collects Git state, environment variables, and Docker info.
# Outputs a single JSON object to stdout.
# Compatible with: Linux, macOS, WSL, Git Bash on Windows.

# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

json_escape() {
  local s="$1"
  s="${s//\/\\}"
  s="${s//\"/\\\"}"
  s="${s//$'\n'/\n}"
  s="${s//$'\r'/\r}"
  s="${s//$'\t'/\t}"
  printf '%s' "$s"
}

jstr() { printf '"%s"' "$(json_escape "$1")"; }

redact_value() {
  local key="$1" val="$2"
  if echo "$key" | grep -qiE 'PASSWORD|SECRET|KEY|TOKEN|DSN|URL|SALT|PRIVATE|CREDENTIAL|AUTH|CERT|PEM'; then
    if echo "$val" | grep -qE '^[a-zA-Z][a-zA-Z0-9+.-]*://'; then
      echo "$val" | sed 's|://.*|://***REDACTED***|'
    else
      echo "***REDACTED***"
    fi
  else
    echo "$val"
  fi
}

# ---------------------------------------------------------------------------
# Timestamp & environment
# ---------------------------------------------------------------------------
TIMESTAMP=$(date -u +"%Y-%m-%dT%H:%M:%SZ" 2>/dev/null || date +"%Y-%m-%dT%H:%M:%SZ")

if [ -n "${APP_ENV:-}" ]; then
  ENVIRONMENT="$APP_ENV"
elif [ -n "${NODE_ENV:-}" ]; then
  ENVIRONMENT="$NODE_ENV"
elif [ -f /.dockerenv ]; then
  ENVIRONMENT="docker"
else
  ENVIRONMENT="local"
fi

# ---------------------------------------------------------------------------
# Git info
# ---------------------------------------------------------------------------
GIT_COMMIT=$(git rev-parse HEAD 2>/dev/null || echo "N/A")
GIT_BRANCH=$(git rev-parse --abbrev-ref HEAD 2>/dev/null || echo "N/A")
GIT_BRANCHES=$(git branch -a 2>/dev/null || echo "")

REMOTE_BRANCHES_JSON="["
LOCAL_BRANCHES_JSON="["
rb_first=1
lb_first=1

while IFS= read -r line; do
  line="${line#"${line%%[![:space:]]*}"}"
  line="${line#\* }"
  [ -z "$line" ] && continue
  case "$line" in
    remotes/*)
      [ "$rb_first" = "1" ] && rb_first=0 || REMOTE_BRANCHES_JSON="${REMOTE_BRANCHES_JSON},"
      REMOTE_BRANCHES_JSON="${REMOTE_BRANCHES_JSON}$(jstr "$line")"
      ;;
    *)
      [ "$lb_first" = "1" ] && lb_first=0 || LOCAL_BRANCHES_JSON="${LOCAL_BRANCHES_JSON},"
      LOCAL_BRANCHES_JSON="${LOCAL_BRANCHES_JSON}$(jstr "$line")"
      ;;
  esac
done << BRANCHES_EOF
$GIT_BRANCHES
BRANCHES_EOF

REMOTE_BRANCHES_JSON="${REMOTE_BRANCHES_JSON}]"
LOCAL_BRANCHES_JSON="${LOCAL_BRANCHES_JSON}]"

GIT_JSON=$(printf '{"commit":%s,"branch":%s,"remote_branches":%s,"local_branches":%s}' \
  "$(jstr "$GIT_COMMIT")" "$(jstr "$GIT_BRANCH")" \
  "$REMOTE_BRANCHES_JSON" "$LOCAL_BRANCHES_JSON")

# ---------------------------------------------------------------------------
# Environment variables
# ---------------------------------------------------------------------------
ENV_JSON="{"
env_first=1

# From shell env
ENV_VARS=$(env 2>/dev/null || printenv 2>/dev/null || true)

while IFS='=' read -r key val; do
  [ -z "$key" ] && continue
  if echo "$key" | grep -qE '^(NODE_ENV|APP_ENV|PORT|DATABASE_URL|REDIS_URL|JWT_|KAKAO_|CORS_|CSRF_|PROFILE_|NEXT_|BACKEND_|MEDIA_|VAPID_|ADMIN_|S3_|AWS_|SMTP_|SENTRY_|LOG_)'; then
    rv=$(redact_value "$key" "$val")
    [ "$env_first" = "1" ] && env_first=0 || ENV_JSON="${ENV_JSON},"
    ENV_JSON="${ENV_JSON}$(jstr "$key"):$(jstr "$rv")"
  fi
done << ENV_EOF
$ENV_VARS
ENV_EOF

# From .env files
for env_file in .env .env.local .env.development .env.staging .env.production; do
  [ -f "$env_file" ] || continue
  env_content=$(cat "$env_file" 2>/dev/null || true)
  while IFS= read -r line; do
    case "$line" in \#*|'') continue ;; esac
    k="${line%%=*}"
    v="${line#*=}"
    k="${k#"${k%%[![:space:]]*}"}"
    [ -z "$k" ] && continue
    case "$ENV_JSON" in *"\"$k\":"*) continue ;; esac
    rv=$(redact_value "$k" "$v")
    [ "$env_first" = "1" ] && env_first=0 || ENV_JSON="${ENV_JSON},"
    ENV_JSON="${ENV_JSON}$(jstr "$k"):$(jstr "$rv")"
  done << ENVFILE_EOF
$env_content
ENVFILE_EOF
done

ENV_JSON="${ENV_JSON}}"

# ---------------------------------------------------------------------------
# Docker info
# ---------------------------------------------------------------------------
DOCKER_VERSION=$(docker version --format '{{.Server.Version}}' 2>/dev/null || echo "N/A")
COMPOSE_VERSION=$(docker compose version --short 2>/dev/null || \
                  docker-compose version --short 2>/dev/null || \
                  echo "N/A")

# Containers
CONTAINERS_JSON="["
c_first=1
PS_OUTPUT=$(docker ps --format '{{.ID}}|{{.Image}}|{{.Status}}|{{.Names}}|{{.Ports}}' 2>/dev/null || true)

if [ -n "$PS_OUTPUT" ]; then
  while IFS='|' read -r cid image status name ports; do
    [ -z "$cid" ] && continue
    [ "$c_first" = "1" ] && c_first=0 || CONTAINERS_JSON="${CONTAINERS_JSON},"
    CONTAINERS_JSON="${CONTAINERS_JSON}{\"id\":$(jstr "$cid"),\"image\":$(jstr "$image"),\"status\":$(jstr "$status"),\"name\":$(jstr "$name"),\"ports\":$(jstr "$ports")}"
  done << CONTAINERS_EOF
$PS_OUTPUT
CONTAINERS_EOF
fi
CONTAINERS_JSON="${CONTAINERS_JSON}]"

# Volumes
VOLUMES_JSON="["
v_first=1
VOL_OUTPUT=$(docker volume ls --format '{{.Name}}|{{.Driver}}' 2>/dev/null || true)

if [ -n "$VOL_OUTPUT" ]; then
  while IFS='|' read -r vname vdriver; do
    [ -z "$vname" ] && continue
    [ "$v_first" = "1" ] && v_first=0 || VOLUMES_JSON="${VOLUMES_JSON},"
    VOLUMES_JSON="${VOLUMES_JSON}{\"name\":$(jstr "$vname"),\"driver\":$(jstr "$vdriver")}"
  done << VOLUMES_EOF
$VOL_OUTPUT
VOLUMES_EOF
fi
VOLUMES_JSON="${VOLUMES_JSON}]"

DOCKER_JSON=$(printf '{"docker_version":%s,"compose_version":%s,"containers":%s,"volumes":%s}' \
  "$(jstr "$DOCKER_VERSION")" "$(jstr "$COMPOSE_VERSION")" \
  "$CONTAINERS_JSON" "$VOLUMES_JSON")

# ---------------------------------------------------------------------------
# Output
# ---------------------------------------------------------------------------
printf '{\n'
printf '  "timestamp": %s,\n' "$(jstr "$TIMESTAMP")"
printf '  "environment": %s,\n' "$(jstr "$ENVIRONMENT")"
printf '  "git": %s,\n' "$GIT_JSON"
printf '  "env_vars": %s,\n' "$ENV_JSON"
printf '  "docker": %s\n' "$DOCKER_JSON"
printf '}\n'
