import subprocess, json, os, sys

token = ""
org = ""
env_file = os.path.expanduser("~/.claude/.env")
if os.path.exists(env_file):
    for line in open(env_file):
        line = line.strip()
        if line.startswith("SENTRY_AUTH_TOKEN=") and not token:
            token = line.split("=", 1)[1].strip('"').strip("'")
        if line.startswith("SENTRY_ORG=") and not org:
            org = line.split("=", 1)[1].strip('"').strip("'")

print(f"token: {'OK' if token else 'MISSING'}, org: {org}")

suffix = "staging"
projects = {
    "backend": f"dorami-backend-{suffix}",
    "frontend": f"dorami-frontend-{suffix}",
}

def fetch_issues(project, limit=10):
    import urllib.request
    import urllib.parse
    params = urllib.parse.urlencode({
        "statsPeriod": "24h",
        "limit": limit,
        "sort": "freq",
        "query": "is:unresolved",
    })
    url = f"https://sentry.io/api/0/projects/{org}/{project}/issues/?{params}"
    req = urllib.request.Request(url, headers={"Authorization": f"Bearer {token}"})
    try:
        with urllib.request.urlopen(req, timeout=15) as resp:
            return json.loads(resp.read())
    except Exception as e:
        return {"error": str(e)}

print(f"\n=== Sentry 에러 현황 (staging / 24h) ===\n")

for label, project in projects.items():
    label_kr = "백엔드" if label == "backend" else "프론트엔드"
    print(f"[{label_kr} - {project}]")
    issues = fetch_issues(project)

    if isinstance(issues, dict):
        print(f"  ❌ API 오류: {issues}")
        print()
        continue

    if not issues:
        print("  ✅ 이슈 없음")
        print()
        continue

    total = sum(int(i.get("count", 0)) for i in issues)
    print(f"  총 이슈: {len(issues)}개  이벤트: {total:,}건")
    icons = ["🔴","🟠","🟡","🟢","⚪","⚪","⚪"]
    for i, issue in enumerate(issues[:7]):
        cnt = int(issue.get("count", 0))
        cnt_s = f"{cnt//1000}k" if cnt >= 1000 else str(cnt)
        title = issue.get("title", "")[:65]
        new = " (신규)" if issue.get("isNew") else ""
        print(f"  {icons[i]} [{cnt_s:>5}건] {title}{new}")

    new_issues = [i for i in issues if i.get("isNew")]
    if new_issues:
        print()
        print("  신규 이슈:")
        for issue in new_issues[:3]:
            print(f"  ⚡ {issue.get('title','')[:60]}")
            print(f"     https://{org}.sentry.io/issues/{issue['id']}/")
    print()

print("=== 완료 ===")
