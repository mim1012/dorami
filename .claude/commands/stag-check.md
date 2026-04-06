스테이징 서버 배포 상태를 확인한다.

GitHub Actions에서 develop 브랜치의 최근 CI/Deploy 상태를 확인:

```bash
cd D:/Project/dorami && gh run list --branch develop --limit 5 --json status,name,conclusion,databaseId,headSha,createdAt --jq '.[] | "\(.databaseId) \(.name): \(.status) \(.conclusion) sha=\(.headSha[:7]) \(.createdAt)"'
```

실패한 run이 있으면:

```bash
gh run view {RUN_ID} --log-failed 2>&1 | tail -30
```

결과를 간결하게 보고:

- ✅ success → "Staging 배포 성공 (sha=xxx)"
- ❌ failure → 실패 원인 + 해당 step 로그 요약
- 🔄 in_progress → "진행 중 (예상 완료: ~3-5분)"
