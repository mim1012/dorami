#!/usr/bin/env bash
# audit/03-docker-port-network.sh
# Docker Container, Port, Network, Volume audit script
# Outputs structured JSON with security warnings
set -euo pipefail

TIMESTAMP=$(date -u +"%Y-%m-%dT%H:%M:%SZ")

# ─── Helpers ────────────────────────────────────────────────────────────────
command_exists() { command -v "$1" &>/dev/null; }

json_escape() {
  # Strip ANSI escape sequences, then escape for JSON
  local s="$1"
  # Remove ANSI color/control codes (ESC[...m patterns and other ESC sequences)
  s=$(printf '%s' "$s" | sed 's/\x1b\[[0-9;]*[a-zA-Z]//g; s/\x1b[^[]*//g')
  # Escape JSON special characters
  s="${s//\\/\\\\}"
  s="${s//\"/\\\"}"
  s="${s//$'\n'/\\n}"
  s="${s//$'\r'/\\r}"
  s="${s//$'\t'/\\t}"
  # Remove any remaining non-printable control chars (0x00-0x1f except escaped ones)
  s=$(printf '%s' "$s" | tr -d '\000-\010\013\014\016-\037')
  printf '%s' "$s"
}

# Determine if Docker is available
if ! command_exists docker; then
  cat <<EOF
{
  "timestamp": "${TIMESTAMP}",
  "error": "docker not found",
  "containers": [],
  "networks": [],
  "volumes": [],
  "port_bindings": [],
  "warnings": ["docker CLI not found on this host"]
}
EOF
  exit 0
fi

# ─── 1. Containers ──────────────────────────────────────────────────────────
collect_containers() {
  local entries=""
  local first=true

  # Get container names
  local names
  names=$(docker ps -a --format '{{.Names}}' 2>/dev/null) || names=""

  if [[ -z "$names" ]]; then
    echo "[]"
    return
  fi

  # Get stats snapshot (no-stream)
  local stats_json
  stats_json=$(docker stats --no-stream --format \
    '{"name":"{{.Name}}","cpu":"{{.CPUPerc}}","mem":"{{.MemUsage}}"}' 2>/dev/null) || stats_json=""

  while IFS= read -r cname; do
    [[ -z "$cname" ]] && continue

    # Basic info
    local status ports health restart_count image
    status=$(docker inspect --format '{{.State.Status}}' "$cname" 2>/dev/null) || status="unknown"
    ports=$(docker inspect --format '{{range $p,$b := .NetworkSettings.Ports}}{{$p}} {{end}}' "$cname" 2>/dev/null | tr ' ' '\n' | grep -v '^$' | sed 's|/.*||' | sort -u | tr '\n' ' ' | sed 's/ *$//') || ports=""
    health=$(docker inspect --format '{{if .State.Health}}{{.State.Health.Status}}{{else}}none{{end}}' "$cname" 2>/dev/null) || health="none"
    restart_count=$(docker inspect --format '{{.RestartCount}}' "$cname" 2>/dev/null) || restart_count=0
    image=$(docker inspect --format '{{.Config.Image}}' "$cname" 2>/dev/null) || image="unknown"
    started_at=$(docker inspect --format '{{.State.StartedAt}}' "$cname" 2>/dev/null) || started_at=""

    # Stats for this container
    local cpu_val="N/A" mem_val="N/A"
    if [[ -n "$stats_json" ]]; then
      cpu_val=$(echo "$stats_json" | grep "\"name\":\"$cname\"" | grep -o '"cpu":"[^"]*"' | cut -d'"' -f4) || cpu_val="N/A"
      mem_val=$(echo "$stats_json" | grep "\"name\":\"$cname\"" | grep -o '"mem":"[^"]*"' | cut -d'"' -f4) || mem_val="N/A"
    fi

    # Build ports JSON array
    local ports_arr="[]"
    if [[ -n "$ports" ]]; then
      local port_items=""
      local pfirst=true
      for p in $ports; do
        [[ -z "$p" ]] && continue
        if $pfirst; then
          port_items="\"$(json_escape "$p")\""
          pfirst=false
        else
          port_items="${port_items}, \"$(json_escape "$p")\""
        fi
      done
      [[ -n "$port_items" ]] && ports_arr="[$port_items]"
    fi

    local entry
    entry=$(cat <<ENTRY
    {
      "name": "$(json_escape "$cname")",
      "image": "$(json_escape "$image")",
      "status": "$(json_escape "$status")",
      "started_at": "$(json_escape "$started_at")",
      "ports": $ports_arr,
      "health": "$(json_escape "$health")",
      "cpu": "$(json_escape "${cpu_val:-N/A}")",
      "memory": "$(json_escape "${mem_val:-N/A}")",
      "restart_count": $restart_count
    }
ENTRY
)

    if $first; then
      entries="$entry"
      first=false
    else
      entries="${entries},
$entry"
    fi
  done <<< "$names"

  echo "[
$entries
  ]"
}

# ─── 2. Recent Logs ─────────────────────────────────────────────────────────
collect_logs() {
  local entries=""
  local first=true
  local names
  names=$(docker ps --format '{{.Names}}' 2>/dev/null) || names=""

  while IFS= read -r cname; do
    [[ -z "$cname" ]] && continue
    local logs
    logs=$(docker logs "$cname" --tail 50 2>&1 | tail -20) || logs="unable to retrieve"
    local escaped_logs
    escaped_logs=$(json_escape "$logs")
    local entry="{\"container\": \"$(json_escape "$cname")\", \"tail_50\": \"${escaped_logs}\"}"

    if $first; then
      entries="$entry"
      first=false
    else
      entries="${entries}, $entry"
    fi
  done <<< "$names"

  [[ -z "$entries" ]] && echo "[]" || echo "[$entries]"
}

# ─── 3. Networks ────────────────────────────────────────────────────────────
collect_networks() {
  local entries=""
  local first=true
  local net_names
  net_names=$(docker network ls --format '{{.Name}}' 2>/dev/null) || net_names=""

  while IFS= read -r net; do
    [[ -z "$net" ]] && continue
    local driver scope
    driver=$(docker network inspect "$net" --format '{{.Driver}}' 2>/dev/null) || driver="unknown"
    scope=$(docker network inspect "$net" --format '{{.Scope}}' 2>/dev/null) || scope="unknown"

    # Containers in this network
    local cont_list
    cont_list=$(docker network inspect "$net" --format '{{range $k,$v := .Containers}}{{$v.Name}} {{end}}' 2>/dev/null | tr ' ' '\n' | grep -v '^$' | sort) || cont_list=""

    local cont_arr="[]"
    if [[ -n "$cont_list" ]]; then
      local citems=""
      local cfirst=true
      while IFS= read -r c; do
        [[ -z "$c" ]] && continue
        if $cfirst; then
          citems="\"$(json_escape "$c")\""
          cfirst=false
        else
          citems="${citems}, \"$(json_escape "$c")\""
        fi
      done <<< "$cont_list"
      [[ -n "$citems" ]] && cont_arr="[$citems]"
    fi

    local entry
    entry=$(cat <<ENTRY
    {
      "name": "$(json_escape "$net")",
      "driver": "$(json_escape "$driver")",
      "scope": "$(json_escape "$scope")",
      "containers": $cont_arr
    }
ENTRY
)
    if $first; then
      entries="$entry"
      first=false
    else
      entries="${entries},
$entry"
    fi
  done <<< "$net_names"

  [[ -z "$entries" ]] && echo "[]" || echo "[
$entries
  ]"
}

# ─── 4. Volumes ─────────────────────────────────────────────────────────────
collect_volumes() {
  local entries=""
  local first=true
  local vol_names
  vol_names=$(docker volume ls --format '{{.Name}}' 2>/dev/null) || vol_names=""

  while IFS= read -r vol; do
    [[ -z "$vol" ]] && continue
    local driver mountpoint
    driver=$(docker volume inspect "$vol" --format '{{.Driver}}' 2>/dev/null) || driver="unknown"
    mountpoint=$(docker volume inspect "$vol" --format '{{.Mountpoint}}' 2>/dev/null) || mountpoint="unknown"

    local entry
    entry=$(cat <<ENTRY
    {
      "name": "$(json_escape "$vol")",
      "driver": "$(json_escape "$driver")",
      "mountpoint": "$(json_escape "$mountpoint")"
    }
ENTRY
)
    if $first; then
      entries="$entry"
      first=false
    else
      entries="${entries},
$entry"
    fi
  done <<< "$vol_names"

  [[ -z "$entries" ]] && echo "[]" || echo "[
$entries
  ]"
}

# ─── 5. Port Bindings ───────────────────────────────────────────────────────
collect_port_bindings() {
  local entries=""
  local first=true

  local port_tool=""
  if command_exists ss; then
    port_tool="ss"
  elif command_exists netstat; then
    port_tool="netstat"
  fi

  if [[ -z "$port_tool" ]]; then
    echo "[{\"error\": \"neither ss nor netstat found\"}]"
    return
  fi

  local raw_ports=""
  if [[ "$port_tool" == "ss" ]]; then
    raw_ports=$(ss -tulpn 2>/dev/null | awk 'NR>1 {print $1, $5}') || raw_ports=""
  else
    raw_ports=$(netstat -tulpn 2>/dev/null | awk 'NR>2 {print $1, $4}') || raw_ports=""
  fi

  # Ports to flag if externally bound in production
  local sensitive_ports=("5432" "6379" "27017" "3306")

  declare -A seen_ports

  while IFS= read -r line; do
    [[ -z "$line" ]] && continue
    local proto addr
    proto=$(echo "$line" | awk '{print $1}')
    addr=$(echo "$line" | awk '{print $2}')

    local port ip exposure
    port=$(echo "$addr" | rev | cut -d: -f1 | rev)
    ip=$(echo "$addr" | rev | cut -d: -f2- | rev)

    # Deduplicate
    [[ -n "${seen_ports[$port]+set}" ]] && continue
    seen_ports[$port]=1

    # Determine exposure
    if [[ "$ip" == "0.0.0.0" || "$ip" == "::" || "$ip" == "*" ]]; then
      exposure="external"
    elif [[ "$ip" == "127.0.0.1" || "$ip" == "::1" ]]; then
      exposure="loopback"
    else
      exposure="internal"
    fi

    local entry
    entry=$(cat <<ENTRY
    {
      "port": "$(json_escape "$port")",
      "protocol": "$(json_escape "${proto%%[0-9]*}")",
      "local_address": "$(json_escape "$addr")",
      "status": "LISTEN",
      "exposure": "$(json_escape "$exposure")"
    }
ENTRY
)
    if $first; then
      entries="$entry"
      first=false
    else
      entries="${entries},
$entry"
    fi
  done <<< "$raw_ports"

  [[ -z "$entries" ]] && echo "[]" || echo "[
$entries
  ]"
}

# ─── 6. Warnings ────────────────────────────────────────────────────────────
collect_warnings() {
  local warnings=""
  local wfirst=true

  add_warning() {
    local msg="$1"
    if $wfirst; then
      warnings="\"$(json_escape "$msg")\""
      wfirst=false
    else
      warnings="${warnings}, \"$(json_escape "$msg")\""
    fi
  }

  # Check for externally exposed sensitive ports
  local sensitive_ports=("5432" "6379" "27017" "3306" "1521")
  local exposed_check=""
  if command_exists ss; then
    exposed_check=$(ss -tulpn 2>/dev/null | grep -E "0\.0\.0\.0:|:::" ) || exposed_check=""
  elif command_exists netstat; then
    exposed_check=$(netstat -tulpn 2>/dev/null | grep -E "0\.0\.0\.0:|:::") || exposed_check=""
  fi

  for sp in "${sensitive_ports[@]}"; do
    if echo "$exposed_check" | grep -qE ":${sp}\b"; then
      add_warning "SECURITY: Port ${sp} appears externally bound (0.0.0.0 or ::) — verify firewall rules in production"
    fi
  done

  # Check containers with restart_count > 0
  local names
  names=$(docker ps -a --format '{{.Names}}' 2>/dev/null) || names=""
  while IFS= read -r cname; do
    [[ -z "$cname" ]] && continue
    local rc
    rc=$(docker inspect --format '{{.RestartCount}}' "$cname" 2>/dev/null) || rc=0
    if [[ "$rc" -gt 0 ]]; then
      add_warning "Container '$cname' has restarted $rc time(s) — check logs for root cause"
    fi
  done <<< "$names"

  # Check unhealthy containers
  while IFS= read -r cname; do
    [[ -z "$cname" ]] && continue
    local hs
    hs=$(docker inspect --format '{{if .State.Health}}{{.State.Health.Status}}{{end}}' "$cname" 2>/dev/null) || hs=""
    if [[ "$hs" == "unhealthy" ]]; then
      add_warning "Container '$cname' health status is UNHEALTHY"
    fi
  done <<< "$names"

  # Check for containers not on expected network
  local expected_network="live-commerce-network"
  local net_exists
  net_exists=$(docker network ls --format '{{.Name}}' 2>/dev/null | grep -c "^${expected_network}$") || net_exists=0
  if [[ "$net_exists" -eq 0 ]]; then
    add_warning "Expected network '${expected_network}' not found — containers may be on default bridge network"
  fi

  echo "[$warnings]"
}

# ─── Main ───────────────────────────────────────────────────────────────────
main() {
  local containers networks volumes port_bindings warnings recent_logs

  containers=$(collect_containers)
  networks=$(collect_networks)
  volumes=$(collect_volumes)
  port_bindings=$(collect_port_bindings)
  warnings=$(collect_warnings)
  recent_logs=$(collect_logs)

  cat <<OUTPUT
{
  "timestamp": "${TIMESTAMP}",
  "containers": ${containers},
  "networks": ${networks},
  "volumes": ${volumes},
  "port_bindings": ${port_bindings},
  "recent_logs": ${recent_logs},
  "warnings": ${warnings}
}
OUTPUT
}

main
