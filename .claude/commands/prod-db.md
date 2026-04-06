프로덕션 DB에 SQL을 실행한다. $ARGUMENTS에 SQL 쿼리를 전달한다.

**주의: 프로덕션 DB = `live_commerce_production`**

```bash
ssh -i "/d/Project/dorami/ssh/id_ed25519" ubuntu@15.165.66.23 "docker exec dorami-postgres-1 psql -U postgres -d live_commerce_production -c \"$ARGUMENTS\""
```

자주 쓰는 쿼리:

- 유저 수: `SELECT count(*) FROM users;`
- LIVE 스트림: `SELECT id, status, stream_key FROM live_streams WHERE status = 'LIVE';`
- 최근 주문: `SELECT id, status, total, created_at FROM orders ORDER BY created_at DESC LIMIT 10;`
- 유저 역할 변경: `UPDATE users SET role = 'ADMIN' WHERE email = 'xxx';`

⚠️ DELETE/DROP/TRUNCATE 실행 전 반드시 사용자 확인
