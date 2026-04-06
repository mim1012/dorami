프로덕션 배포를 실행한다. $ARGUMENTS에 커밋 SHA(short 또는 full)를 전달한다.

순서:

1. 해당 SHA의 staging 배포가 성공했는지 확인
2. Full SHA 변환
3. Deploy to Production (Safe) 워크플로우 트리거
4. 완료까지 대기 후 결과 보고

```bash
# 1. staging 확인
cd D:/Project/dorami
gh run list --branch develop --limit 3 --json status,name,conclusion,headSha --jq '.[] | select(.name | contains("Deploy to Staging")) | "\(.conclusion) sha=\(.headSha[:7])"'

# 2. Full SHA
FULL_SHA=$(git rev-parse $ARGUMENTS)

# 3. 트리거
gh workflow run 241276367 -f version=sha-${FULL_SHA}

# 4. 대기 (90초 후 확인)
sleep 90
gh run list --workflow=241276367 --limit 1 --json status,conclusion --jq '.[] | "\(.status) \(.conclusion)"'
```

안전 장치:

- staging 배포 성공 확인 안 되면 경고 후 확인 요청
- 실패 시 로그 확인 후 원인 보고
