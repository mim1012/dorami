현재 main 브랜치를 staging + prod까지 한 번에 배포한다.

순서:

1. `npm run lint:all && npm run type-check:all && npm run test:backend` 로컬 검증
2. develop push
3. staging CI 완료 대기
4. prod deploy 트리거
5. prod 배포 완료 확인
6. prod health check

```bash
# 1. 로컬 검증
cd D:/Project/dorami
npm run lint:all && npm run type-check:all

# 2. 테스트
cd backend && npx jest --no-coverage && cd ..

# 3. develop push
git push origin main:develop

# 4. staging 대기 (~4분)
sleep 240
gh run list --branch develop --limit 1 --json status,conclusion,name --jq '.[] | select(.name | contains("Deploy to Staging")) | "\(.status) \(.conclusion)"'

# 5. prod deploy
FULL_SHA=$(git rev-parse HEAD)
gh workflow run 241276367 -f version=sha-${FULL_SHA}

# 6. prod 대기 (~2분) + health check
sleep 120
gh run list --workflow=241276367 --limit 1 --json status,conclusion --jq '.[] | "\(.status) \(.conclusion)"'
```

실패 시 각 단계에서 중단하고 원인 보고.
