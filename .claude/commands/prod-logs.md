프로덕션 백엔드 로그를 확인한다. $ARGUMENTS에 시간 범위를 전달 (기본: 5m).

```bash
ssh -i "/d/Project/dorami/ssh/id_ed25519" ubuntu@15.165.66.23 "docker logs backend-prod --since ${ARGUMENTS:-5m} 2>&1 | tail -30"
```

특정 키워드 필터링 시:

```bash
ssh -i "/d/Project/dorami/ssh/id_ed25519" ubuntu@15.165.66.23 "docker logs backend-prod --since ${ARGUMENTS:-5m} 2>&1 | grep -i 'error\|warn\|fail\|400\|401\|403\|429\|500' | tail -20"
```

nginx 로그 확인:

```bash
ssh -i "/d/Project/dorami/ssh/id_ed25519" ubuntu@15.165.66.23 "docker logs dorami-nginx-prod --since ${ARGUMENTS:-5m} 2>&1 | grep -v ' 200 \| 304 ' | tail -20"
```
