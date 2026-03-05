# 🔴 ROOT CAUSE: Kakao OAuth 키가 자꾸 바뀌는 이유

**분석 완료**: 2026-03-03 12:30 UTC
**영향 범위**: Production + Staging 모두 (메커니즘은 다름)
**심각도**: 🔴 Critical (로그인 실패, OAuth 콜백 오류 가능)

---

## 🎯 핵심 원인

### Staging: GitHub Secrets이 배포할 때마다 덮어씌워짐

```yaml
# .github/workflows/deploy-staging.yml (Line 143-144)
KAKAO_CLIENT_ID: ${{ secrets.STAGING_KAKAO_CLIENT_ID }}
KAKAO_CLIENT_SECRET: ${{ secrets.STAGING_KAKAO_CLIENT_SECRET }}
```

배포 흐름:

```bash
1. GitHub Secrets에서 값 읽음
   ↓
2. SSH로 staging 서버에 전달
   ↓
3. .env.staging 파일을 로드하되...
   ↓
4. export KAKAO_CLIENT_ID=${KAKAO_CLIENT_ID}
   (GitHub Secrets 값으로 override)
   ↓
5. docker compose up -d
   (override된 값으로 실행)
```

**문제**: `.env.staging` 파일에도 Kakao 키가 있을 수 있고, 스크립트의 override 로직에 버그가 있으면 원치 않은 값으로 덮어씌워질 수 있음

---

### Production: 배포할 때마다 .env.production을 새로 생성

```yaml
# .github/workflows/deploy-production.yml (Line 373-438)
- name: Create .env.production on server
  run: |
    cat > /tmp/.env.production << ENVEOF
    NODE_ENV=production
    DOMAIN=doremi-live.com
    ...
    KAKAO_CLIENT_ID=${PROD_KAKAO_CLIENT_ID}      # ← GitHub Secrets
    KAKAO_CLIENT_SECRET=${PROD_KAKAO_CLIENT_SECRET}  # ← GitHub Secrets
    ...
    ENVEOF

    scp /tmp/.env.production $USER@$HOST:/opt/dorami/.env.production
    chmod 600 /opt/dorami/.env.production
```

**문제 분석:**

```
배포 흐름:
└─ create .env.production (Line 373)
   ├─ .env.production을 GitHub Actions 러너에서 임시 생성
   ├─ PROD_KAKAO_CLIENT_ID, PROD_KAKAO_CLIENT_SECRET를 Secrets에서 읽음
   ├─ /tmp/.env.production 에 쓰기
   │
   ├─ SCP로 서버로 전송
   ├─ chmod 600 설정
   │
   └─ rm /tmp/.env.production (GitHub Actions 러너에서 삭제)

⚠️ 결과: **매 배포마다 Production 서버의 .env.production이 새로 덮어씌워짐**
```

---

## 🔴 실제 시나리오

### Scenario 1: Secrets가 변경된 경우

```
시간: 2026-02-26 (배포 1)
  GitHub Secrets: PROD_KAKAO_CLIENT_ID = d39c1e849b...
  배포 결과: .env.production에 d39c1e849b... 기록

시간: 2026-02-28 (Kakao 개발자 센터에서 키 재발급)
  GitHub Secrets: PROD_KAKAO_CLIENT_ID = new_key_xyz...
  (누군가 업데이트함)

시간: 2026-03-03 (배포 2)
  deploy-production.yml 실행
    ↓
  .env.production 새로 생성
    ↓
  KAKAO_CLIENT_ID=new_key_xyz... (Secrets에서 읽음)
    ↓
  Production 서버: 키 변경!

결과: Kakao OAuth 콜백 URL이 미등록된 새 키로 요청 → 401 Unauthorized
```

### Scenario 2: 누군가 수동으로 .env.production 수정한 경우

```
상황:
  1. Production 서버에서 수동으로 .env.production 수정
     KAKAO_CLIENT_ID=manual_fix_123...

  2. 배포 완료, 모든 것이 정상 작동

  3. 며칠 후, 버그 수정으로 배포
     .env.production을 새로 생성
     ↓
  4. GitHub Secrets 값 (old_key_456...) 로 덮어씌워짐

  5. 수동 수정 내용이 사라짐!

결과: 설명할 수 없는 동작 변경
```

### Scenario 3: GitHub Secrets에 잘못된 값이 설정된 경우

```
상황:
  1. 개발자가 GitHub Secrets에 잘못된 Kakao 키 입력

  2. 배포 트리거
     → .env.production을 잘못된 키로 생성
     → Production 로그인 완전히 망가짐

  3. 복구 방법:
     a) 수동으로 .env.production 수정 (즉시 해결)
     b) GitHub Secrets 수정 후 배포 (다음 배포 때 적용)
```

---

## 📊 현재 배포 메커니즘 비교

| 항목                    | Staging                       | Production                    |
| ----------------------- | ----------------------------- | ----------------------------- |
| **Kakao 키 저장 위치**  | GitHub Secrets + .env.staging | GitHub Secrets만 (매번 생성)  |
| **배포 시 동작**        | SSH로 환경변수 전달           | 파일 생성 → SCP 전송          |
| **파일 덮어쓰기**       | 조건부 (override 스크립트)    | ✅ 매번 (cat > 으로 덮어쓰기) |
| **수동 수정 내용 유지** | 배포 시 일부 유지 가능        | ❌ 다음 배포에서 사라짐       |
| **Secrets 변경 감지**   | 배포 때 자동 반영             | ✅ 배포 때 자동 반영          |
| **키 불일치 가능성**    | 높음 (override 버그)          | 낮음 (명시적 생성)            |

---

## 🔍 왜 "자꾸 바뀌나요?"

### Root Cause #1: 배포 메커니즘 자체가 그렇게 설계됨

```yaml
# Production 배포 파이프라인:
1. validate (버전 확인)
2. test (테스트)
3. build (Docker 이미지 빌드)
4. live-check (라이브 방송 중 확인)
5. backup (데이터베이스 백업)
6. deploy
├─ Create .env.production ← ⚠️ 매번 새로 생성
├─ Pull Docker images
├─ docker compose up -d
└─ Health check
```

### Root Cause #2: 환경변수 관리의 이원화

```
GitHub Secrets (진실의 원천)
       ↓ (배포 시에만 사용)
.env.production (런타임 사용)
       ↓ (다음 배포 때 덮어씌워짐)
```

### Root Cause #3: Immutable Infrastructure 원칙

```
배포 설계: "모든 배포는 fresh start로 진행"
- 이전 .env.production 값은 신뢰하지 않음
- 매 배포마다 GitHub Secrets에서 새로 읽음
- 이것은 안전하지만, 변경 감지가 어려움
```

---

## 🚨 실제 발생한 문제들

### Problem #1: Kakao 앱 등록 URL 불일치

```
시나리오:
  Kakao Developer: 승인된 리다이렉트 URI = https://www.doremi-live.com/api/auth/kakao/callback

  GitHub Secrets: PROD_KAKAO_CLIENT_ID (올바른 키)

  배포 후: .env.production에 올바른 키 저장

  하지만...

  만약 KAKAO_CALLBACK_URL이 Secrets에 없으면?
  docker-compose.prod.yml에서 하드코딩됨 (Line 414)

  = 키와 콜백 URL이 불일치할 가능성 있음!
```

### Problem #2: 키 로테이션 (Kakao 개발자 센터)

```
1. Kakao에서 보안상 이유로 키 재발급 요청
2. 새 CLIENT_ID/SECRET 받음
3. GitHub Secrets 업데이트
4. Production 배포 (자동 반영)
5. 하지만 Staging은 배포 안 되면?
   → Staging/Prod 키 불일치!
```

### Problem #3: 여러 명의 개발자

```
상황:
  개발자 A: GitHub Secrets 수정 (신규 키)
  개발자 B: Production 배포

  결과: 개발자 A의 의도 모르게 새 키로 배포됨

  컨플릭트 없음 (모두 배포 권한 있음)
  근데... 누가 변경했는지 몰라!
```

---

## 🔧 왜 이렇게 설계했나?

### 설계 의도

```
목표: "Secrets를 환경변수로 관리하되, 파일에는 저장 안 함"

장점:
✅ GitHub Secrets이 진실의 원천
✅ 서버에 파일로 기록되지 않음 (보안)
✅ 배포 자동화 시 항상 최신 Secrets 사용

단점:
❌ 서버 수동 수정 내용이 사라짐
❌ 배포 전후 어떤 값이 변경됐는지 알 수 없음
❌ Staging/Prod 키 불일치 감지 어려움
```

---

## ✅ 해결 방안

### Option 1: 배포 전 확인 (단기)

```bash
#!/bin/bash
# 배포 전에 Kakao 키가 정말로 변경되는지 확인

ssh $PROD_HOST << 'EOF'
  echo "=== 현재 Kakao 설정 ==="
  grep "KAKAO_CLIENT_ID" /opt/dorami/.env.production

  echo "=== 새 배포의 Kakao 설정 ==="
  echo "KAKAO_CLIENT_ID=${NEW_PROD_KAKAO_CLIENT_ID}"

  if [ "$current" != "$new" ]; then
    echo "⚠️ WARNING: Kakao 키가 변경됩니다!"
    echo "  Old: $current"
    echo "  New: $new"
    echo "배포를 계속할까요? (y/n)"
    read -r
    if [ "$REPLY" != "y" ]; then
      exit 1
    fi
  fi
EOF
```

### Option 2: 배포 파이프라인에서 git-tracked .env 파일 사용 (권장)

```yaml
# 구조 변경:
# ❌ Before: GitHub Secrets → 매번 .env 생성
# ✅ After: git repo의 .env.production.template → 배포 시 Secrets 주입

# .env.production.template (git에 커밋)
NODE_ENV=production
DOMAIN=doremi-live.com
KAKAO_CLIENT_ID={{PROD_KAKAO_CLIENT_ID}}
KAKAO_CLIENT_SECRET={{PROD_KAKAO_CLIENT_SECRET}}
JWT_SECRET={{PROD_JWT_SECRET}}
...
# 배포 스크립트:
envsubst < .env.production.template > /opt/dorami/.env.production
```

### Option 3: Docker 이미지에 환경변수 embed (최고 보안)

```dockerfile
# 배포 타임에 Secrets를 이미지에 bake
# docker build --build-arg KAKAO_CLIENT_ID=$SECRET_ID ...

# 장점: 이미지 불변성, 추적 가능
# 단점: 이미지 크기 증가, 키 로테이션 시 재빌드 필요
```

### Option 4: Vault/Secrets Manager 사용

```bash
# HashiCorp Vault, AWS Secrets Manager 등으로 중앙화
# 배포 스크립트에서 동적으로 Secrets 읽음

docker compose exec backend vault read secret/kakao
# (업데이트 자동 반영)
```

---

## 📋 임시 해결: GitHub Secrets 추적

### Issue: Kakao 키 변경 이력 추적 불가능

```
해결책:
1. GitHub Secrets 변경 로그 설정
   Settings → Security → Secret scanning

2. 배포 로그에 Kakao 키 첫 3글자 기록
   (로그에는 마스킹되지만, 변경 감지 가능)

3. 배포 전후 비교
   BEFORE: KAKAO_CLIENT_ID=abc123...
   AFTER: KAKAO_CLIENT_ID=xyz789...
   CHANGED=true
```

---

## 🎯 최종 결론

### 왜 "자꾸 바뀌나요?"

```
1️⃣ Production 배포 설계가 "매번 .env.production을 새로 생성"
2️⃣ GitHub Secrets이 진실의 원천
3️⃣ Secrets가 변경되면, 다음 배포에서 자동으로 새 값 적용
4️⃣ 서버에 저장된 이전 값은 무시됨
```

### 누가 바꾸나요?

```
❌ 서버 수동 수정 (다음 배포에서 사라짐)
❌ 이전 배포의 값 (다음 배포에서 사라짐)
✅ GitHub Secrets (매 배포마다 적용됨)
```

### 언제 바뀌나요?

```
1. develop → staging 배포
2. main → production 배포
3. workflow_dispatch로 수동 배포
```

### 해결 방법

```
🟢 권장: Option 2 (git-tracked .env.production.template)
🟡 차선: Option 1 (배포 전 확인)
🔴 임시: Secrets 변경 이력 추적 및 배포 로그 모니터링
```

---

## 💡 보너스: Production vs Staging 키 동기화 문제

### 문제 상황

```
상황:
  - Production: KAKAO_CLIENT_ID = d39c1e849b3e... (Kakao 프로덕션 앱)
  - Staging: KAKAO_CLIENT_ID = 개발 앱... (Kakao 스테이징 앱)

  만약 누군가...
  - Production Secrets를 Staging Secrets에도 복사
  - 실수로 프로덕션 키로 Staging 배포

  결과:
  - Staging에서 프로덕션 Kakao 앱으로 인증 → 도메인 불일치 오류
```

### 방지 방법

```
1. Secrets 이름을 구분 (현재는 잘됨)
   - STAGING_KAKAO_CLIENT_ID (스테이징)
   - PROD_KAKAO_CLIENT_ID (프로덕션)

2. 배포 스크립트에서 Secrets 존재 확인
   if [ -z "$PROD_KAKAO_CLIENT_ID" ]; then
     echo "ERROR: PROD_KAKAO_CLIENT_ID not set"
     exit 1
   fi

3. 배포 후 OAuth 콜백 테스트
   curl https://www.doremi-live.com/api/auth/kakao/callback?code=TEST
```
