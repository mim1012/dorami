Sentry 에러 현황을 확인한다. $ARGUMENTS로 환경/기간/필터를 전달한다.

사용법:

- `/sentry-check` → prod, 24h, 전체
- `/sentry-check stag` → staging 환경
- `/sentry-check prod 7d` → 프로덕션 최근 7일
- `/sentry-check stag 24h ws` → staging WebSocket 에러만
- `/sentry-check prod 24h frontend` → 프론트엔드만

```python
import subprocess, sys, json, os

args = "${ARGUMENTS}".split()

# 인자 파싱
env = "prod"
period = "24h"
filter_mode = "all"
for a in args:
    if a in ("stag", "staging"): env = "stag"
    elif a in ("prod", "production"): env = "prod"
    elif a in ("24h", "7d", "30d"): period = a
    elif a == "ws": filter_mode = "ws"
    elif a == "backend": filter_mode = "backend"
    elif a == "frontend": filter_mode = "frontend"

# env vars
token = os.environ.get("SENTRY_AUTH_TOKEN") or ""
org = os.environ.get("SENTRY_ORG") or ""

# ~/.claude/.env fallback
if not token or not org:
    env_file = os.path.expanduser("~/.claude/.env")
    if os.path.exists(env_file):
        for line in open(env_file):
            line = line.strip()
            if line.startswith("SENTRY_AUTH_TOKEN=") and not token:
                token = line.split("=", 1)[1].strip('"').strip("'")
            if line.startswith("SENTRY_ORG=") and not org:
                org = line.split("=", 1)[1].strip('"').strip("'")

if not token or not org:
    print("❌ SENTRY_AUTH_TOKEN 또는 SENTRY_ORG 미설정")
    print()
    print("~/.claude/.env 에 추가하세요:")
    print("  SENTRY_AUTH_TOKEN=sntrys_xxxx")
    print("  SENTRY_ORG=your-org-slug")
    print()
    print("Sentry → Settings → Auth Tokens 에서 발급")
    print("필요 권한: org:read, project:read, issue:read")
    sys.exit(1)

# 프로젝트 슬러그
suffix = "staging" if env == "stag" else "production"
projects = {
    "backend": f"dorami-backend-{suffix}",
    "frontend": f"dorami-frontend-{suffix}",
}
if filter_mode == "backend":
    projects = {"backend": projects["backend"]}
elif filter_mode == "frontend":
    projects = {"frontend": projects["frontend"]}

env_label = "staging" if env == "stag" else "production"
print(f"=== Sentry 에러 현황 ({env_label} / {period}) ===")
print()

def fetch_issues(project, query="is:unresolved", sort="freq", limit=10):
    import urllib.parse
    params = urllib.parse.urlencode({
        "project": project,
        "statsPeriod": period,
        "limit": limit,
        "sort": sort,
        "query": query,
    })
    url = f"https://sentry.io/api/0/organizations/{org}/issues/?{params}"
    result = subprocess.run(
        ["curl", "-s", "-H", f"Authorization: Bearer {token}", url],
        capture_output=True, text=True
    )
    try:
        return json.loads(result.stdout)
    except:
        return []

def fmt_count(n):
    n = int(n)
    if n >= 1000: return f"{n//1000}k"
    return str(n)

severity_icon = lambda i: ["🔴","🟠","🟡","🟢","⚪"][min(i, 4)]

for label, project in projects.items():
    label_upper = "백엔드" if label == "backend" else "프론트엔드"
    print(f"[{label_upper} - {project}]")

    if filter_mode == "ws":
        issues = fetch_issues(project, query="is:unresolved tags[namespace]:streaming OR tags[namespace]:chat", limit=20)
    else:
        issues = fetch_issues(project, limit=10)

    if isinstance(issues, dict) and "detail" in issues:
        print(f"  ❌ API 오류: {issues['detail']}")
        print()
        continue

    if not issues:
        print("  ✅ 이슈 없음")
        print()
        continue

    total_events = sum(int(i.get("count", 0)) for i in issues)
    print(f"총 이슈: {len(issues)}개  이벤트: {total_events:,}건")
    print()

    if filter_mode == "ws":
        print("WebSocket 에러 (namespace/event 태그):")
        ws_tags = {}
        for issue in issues:
            tags = {t["key"]: t["value"] for t in issue.get("tags", [])}
            ns = tags.get("namespace", "unknown")
            ev = tags.get("event", "unknown")
            key = f"{ns}/{ev}"
            ws_tags[key] = ws_tags.get(key, 0) + int(issue.get("count", 0))
        for key, cnt in sorted(ws_tags.items(), key=lambda x: -x[1]):
            print(f"  {key:<30}: {fmt_count(cnt)}건")
    else:
        print("TOP 에러:")
        for i, issue in enumerate(issues[:7]):
            cnt = fmt_count(issue.get("count", 0))
            title = issue.get("title", "")[:60]
            is_new = issue.get("firstSeen", "") > issue.get("lastSeen", "X")[:10] + "X"
            new_label = " (신규)" if issue.get("isNew") else ""
            icon = severity_icon(i)
            print(f"  {icon} #{i+1}  [{cnt:>5}건] {title}{new_label}")

        new_issues = [i for i in issues if i.get("isNew")]
        if new_issues:
            print()
            print("신규 이슈 (처음 발생):")
            for issue in new_issues[:3]:
                url = f"https://sentry.io/organizations/{org}/issues/{issue['id']}/"
                print(f"  ⚡ {issue.get('title','')[:50]}")
                print(f"     {url}")

    print()

print("=== 완료 ===")
```

결과 해석 기준:

- 🔴 1위 에러 → 즉시 확인
- 신규(isNew) 이슈 → 배포 후 새로 발생한 에러일 가능성 높음
- WebSocket 에러 다수 → Redis 연결 또는 인증 문제 의심
- 이슈 URL 클릭 → Sentry 상세 스택트레이스 확인
