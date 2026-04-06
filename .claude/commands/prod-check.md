프로덕션 서버 상태를 한 번에 확인한다.

SSH로 접속해서 다음을 모두 확인:

1. Docker 컨테이너 상태 (healthy/unhealthy/restart)
2. CPU/MEM 리소스 사용량
3. 디스크 사용량
4. SRS 활성 스트림
5. 백엔드 Health 200 확인
6. 최근 2분 에러 로그

```bash
ssh -i "/d/Project/dorami/ssh/id_ed25519" ubuntu@15.165.66.23 "echo '=== DOCKER ===' && docker ps --format '{{.Names}} {{.Status}}' && echo '=== RESOURCES ===' && docker stats --no-stream --format '{{.Name}}: CPU={{.CPUPerc}} MEM={{.MemPerc}}' && echo '=== DISK ===' && df -h / --output=pcent | tail -1 && echo '=== SRS STREAMS ===' && curl -s http://localhost:8080/api/v1/streams 2>/dev/null | python3 -c 'import sys,json; d=json.load(sys.stdin); streams=d.get(\"streams\",[]); print(f\"Active: {len(streams)}\")' 2>/dev/null || echo 'SRS: no active streams' && echo '=== HEALTH ===' && curl -s -o /dev/null -w '%{http_code}' http://localhost:3001/api/health/ready && echo '' && echo '=== ERRORS (2min) ===' && docker logs backend-prod --since 2m 2>&1 | grep -i 'error\|exception\|fail' | tail -5 && echo '=== DONE ==='"
```

분석 기준:

- CPU > 70% → 🔴 경고
- Memory > 80% → 🔴 경고
- 컨테이너 unhealthy → 🔴 즉시 보고
- Health ≠ 200 → 🔴 즉시 보고
- 에러 다수 → ⚠️ 경고
- 정상이면 한 줄 요약만
