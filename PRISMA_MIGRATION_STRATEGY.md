---
title: Prisma 마이그레이션 전략 및 브랜치 병합 가이드
date: 2026-03-01
status: Active
---

# Prisma 마이그레이션 전략 및 브랜치 병합 가이드

## 📋 Executive Summary

현재 상황:
- **브랜치**: main (4e1bebf) vs develop (3fd6edb) — **231 커밋 차이**
- **스키마**: develop에 3개 신규 마이그레이션 (Feb 28), uncommitted 변경사항 3개 필드
- **수정 파일**: 48개 파일 (schema.prisma 포함)
- **위험도**: 🟡 **중간** — 스키마 충돌 없으나 동기화 필수

---

## 🔍 Current State Analysis

### Branch Divergence

```
main (4e1bebf)
  └─ 231 commits behind develop
  └─ Latest schema migration: (main에는 없음 - develop과 diverged)

develop (3fd6edb) ←← HEAD
  └─ 3 new migrations: 20260228000000~20260228000002
  └─ Uncommitted: 3 JSONB fields in SystemConfig
  └─ 48 modified files
```

### Schema State by Branch

| 항목 | main | develop | staging |
|------|------|---------|---------|
| SystemConfig model | ✅ noticeText, noticeFontSize | ✅ + shippingMessages, noticeFontFamily | ❓ 미확인 |
| Latest migration date | Feb 25 | Feb 28 | ❓ 미확인 |
| Migration count | ~12 | 15 | ❓ 미확인 |
| Uncommitted changes | ❌ None | ✅ 3 JSONB fields | ❌ N/A |

### Uncommitted Changes Detail

```prisma
// backend/prisma/schema.prisma (WIP)
model SystemConfig {
  // ... existing fields ...

  // NEW FIELDS (uncommitted):
  homeFeaturedProducts Json? @map("home_featured_products")
  marketingCampaigns   Json? @map("marketing_campaigns")
  paymentProviders     Json? @map("payment_providers")
}
```

---

## 🎯 Migration Strategy (3-Phase Approach)

### Phase 1️⃣: Local Staging & Verification (TODAY)

**목표**: 현재 uncommitted 변경사항을 마이그레이션 + 커밋

**Step 1.1: Uncommitted 변경사항 확인**
```bash
# 변경사항 보기
git diff HEAD backend/prisma/schema.prisma

# 상태 확인
git status
```

**Step 1.2: 신규 마이그레이션 생성**
```bash
cd backend

# Prisma가 자동으로 마이그레이션 파일 생성 (신규 필드)
npx prisma migrate dev --name add_admin_cms_config_fields

# 생성 결과:
# backend/prisma/migrations/20260301XXXXXX_add_admin_cms_config_fields/migration.sql
```

**Step 1.3: 로컬 DB에 적용 (Docker 필요)**
```bash
# 1. Docker 실행 중인지 확인
npm run docker:logs

# 2. 마이그레이션 적용 (이미 위 명령어에서 자동 적용됨)
# npx prisma migrate deploy (if needed)

# 3. Prisma Client 생성
npx prisma generate

# 4. 타입 체크
npm run type-check:all

# 5. 백엔드 빌드 확인
npm run build:all
```

**Step 1.4: 커밋**
```bash
# 스테이징 (새 마이그레이션 파일 + schema.prisma)
git add backend/prisma/

# 커밋
git commit -m "feat(db): Add admin CMS configuration fields (home featured products, marketing campaigns, payment providers)"

# 푸시
git push origin develop
```

**결과**: ✅ develop 브랜치가 최신 마이그레이션 포함

---

### Phase 2️⃣: Staging 환경 동기화 (NEXT SESSION)

**목표**: staging 브랜치를 develop의 최신 스키마로 동기화

**상황**:
- staging은 production과 유사한 상태 유지 필요
- 근데 마이그레이션은 develop→staging으로 cherry-pick 또는 merge해야 함

**Step 2.1: Staging 브랜치 상태 확인**
```bash
git checkout staging
git log --oneline -5

# Staging의 마이그레이션 개수 확인
ls -la backend/prisma/migrations/ | wc -l
```

**Step 2.2: Develop에서 마이그레이션 가져오기**

**Option A**: Merge develop into staging (권장)
```bash
git checkout staging
git merge develop --no-ff \
  -m "merge: Sync schema migrations from develop to staging"

# 충돌 확인 (있으면 해결)
git status
```

**Option B**: Cherry-pick specific migrations (신중함 필요)
```bash
# develop에서 마이그레이션 커밋만 선택적으로 cherry-pick
git cherry-pick <commit-hash-of-20260301-migration>
```

**Step 2.3: Staging DB에 마이그레이션 적용**

Staging 서버에 SSH 접속:
```bash
ssh -i dorami-staging.pem ubuntu@staging.doremi-live.com

# 도커 컨테이너에서 마이그레이션 실행
docker exec dorami-backend-1 npx prisma migrate deploy

# 성공 확인
docker exec dorami-backend-1 npx prisma db execute --stdin <<EOF
SELECT column_name FROM information_schema.columns
WHERE table_name='system_config' AND column_name LIKE '%featured%';
EOF
```

**Step 2.4: 푸시**
```bash
git push origin staging
```

**결과**: ✅ staging도 최신 스키마 동기화

---

### Phase 3️⃣: Main 브랜치 업데이트 (RELEASE READY)

**목표**: develop → main으로 공식 PR 생성 & 병합

**⚠️ 주의**: 이 단계는 production 배포 준비 단계입니다.

**Step 3.1: PR 생성 (GitHub)**
```bash
# develop → main으로 PR 열기
gh pr create \
  --base main \
  --head develop \
  --title "chore: Merge 3-week develop changes — admin redesign, E2E tests, streaming soak test" \
  --body "

## 주요 변경사항
- ✅ Admin UI 완전 재설계 (15페이지)
- ✅ 스트리밍 soak test 인프라 (200 CCU)
- ✅ E2E 테스트 자동화
- ✅ 데이터베이스 스키마 확장 (3개 마이그레이션)

## Database Migrations
1. 20260228000000: livestream description 추가
2. 20260228000001: order_item product_id index 추가
3. 20260228000002: Admin UI config sections (Featured Products, Marketing, Payments)
4. 20260301XXXXXX: CMS configuration fields

## 마이그레이션 전략
- ✅ Staging에서 사전 검증됨
- ✅ Docker IF NOT EXISTS 사용 (멱등성)
- ✅ Rollback 방법: migration.sql 역순 실행

## 테스트 결과
- ✅ Type checking: PASS
- ✅ ESLint: PASS
- ✅ E2E (Playwright): PASS
- ✅ Docker build: PASS
"
```

**Step 3.2: CI 통과 확인**
```bash
# GitHub Actions 확인
gh workflow view ci
gh run list -L 1
```

**Step 3.3: PR 검토 & 승인**
- Code review 완료
- 마이그레이션 테스트 완료
- E2E 테스트 통과

**Step 3.4: 병합**
```bash
# Squash merge (커밋 히스토리 정리) 또는 Regular merge (히스토리 보존)
gh pr merge --squash
# 또는
gh pr merge --merge
```

**결과**: ✅ main에 최신 코드 + 마이그레이션 반영

---

## 🚨 Conflict Resolution Guide

### 시나리오 1: Schema Conflict on Merge

**증상**: `merge develop into staging` 시 schema.prisma 충돌

```
<<<<<<< HEAD (staging)
model SystemConfig {
  noticeText String?
  // ... staging-specific fields
}
=======
model SystemConfig {
  noticeText String?
  shippingMessages Json?
  // ... develop-specific fields
}
>>>>>>> develop
```

**해결**:
```bash
# 1. 충돌 파일 열기
git diff backend/prisma/schema.prisma

# 2. 더 최신 버전(develop)을 선택
git checkout --theirs backend/prisma/schema.prisma

# 3. staging-only 필드가 있으면 수동 병합
# (예: staging에만 있는 특수 필드는 유지)

# 4. 충돌 해결 표시
git add backend/prisma/schema.prisma

# 5. 병합 완료
git commit -m "merge: resolve schema.prisma conflicts (keep develop version)"
```

### 시나리오 2: Migration File Conflicts

**증상**: 두 브랜치에서 같은 migration 파일 생성

```
두 브랜치 모두:
20260301000000_add_config_fields/migration.sql
```

**해결**:
```bash
# 1. 파일 내용 비교
diff <(git show main:backend/prisma/migrations/20260301000000_add_config_fields/migration.sql) \
     <(git show develop:backend/prisma/migrations/20260301000000_add_config_fields/migration.sql)

# 2-1. 내용이 동일하면
git rm backend/prisma/migrations/20260301000000_add_config_fields/
git add backend/prisma/

# 2-2. 내용이 다르면 (충돌)
# - 더 포괄적인 버전을 선택
# - 또는 두 파일의 내용을 통합
# - 새로운 migration 파일 생성
cd backend
npx prisma migrate resolve --rolled-back 20260301000000_add_config_fields
npx prisma migrate dev --name fix_conflicting_migrations
```

### 시나리오 3: Database State Mismatch

**증상**: 로컬 DB와 스키마 정의가 맞지 않음

```bash
# 확인
npx prisma migrate status

# 출력 예:
# Pending migrations:
#   20260228000001
#   20260228000002
```

**해결**:
```bash
# Option 1: 마이그레이션 적용
npx prisma migrate deploy

# Option 2: 개발 환경에서 리셋 (데이터 손실 주의!)
npx prisma migrate reset  # 로컬 개발 DB만 사용!

# Option 3: Staging/Production (매우 신중함!)
# SSH → docker exec dorami-backend-1 npx prisma migrate deploy
```

---

## 🔄 Git Workflow for Smooth Merges

### Pre-Merge Checklist

```bash
# 1️⃣ 모든 로컬 변경사항 커밋
git status
# Nothing to commit, working tree clean ✓

# 2️⃣ 최신 브랜치 상태 확인
git fetch origin

# 3️⃣ 타겟 브랜치 최신 상태로 업데이트
git checkout main
git pull origin main

# 4️⃣ 현재 브랜치(develop)도 최신으로
git checkout develop
git pull origin develop

# 5️⃣ 마이그레이션 적용 (충돌 발생 전에)
npx prisma generate
npm run type-check:all
npm run build:all
```

### Merge Strategy

**Option A**: Simple Merge (권장 for staging→main)
```bash
git checkout main
git merge develop --no-ff
# Merge commit 생성 → 히스토리 보존
```

**Option B**: Squash Merge (권장 for develop→main on release)
```bash
git checkout main
git merge develop --squash
git commit -m "feat: Major release — admin redesign, streaming soak test, schema v2"
# 모든 커밋을 하나로 압축 → 깔끔한 히스토리
```

**Option C**: Rebase + Fast-Forward (권장 for feature→develop)
```bash
git checkout develop
git rebase main
git checkout main
git merge develop --ff
# 선형 히스토리 유지
```

---

## 📊 Migration State Matrix

| 환경 | 마이그레이션 수 | 최신 날짜 | Status | Action |
|------|---------|---------|--------|--------|
| **main** | 12 | Feb 25 | ⚠️ Behind | 곧 merge 예정 |
| **develop** | 15 | Feb 28 | ✅ Latest | ← 현재 여기 |
| **staging** | ❓ | ❓ | 🔄 Sync 필요 | Phase 2에서 수행 |
| **local (dev)** | 15 | Feb 28 | ✅ Latest | ✓ 동기화됨 |

---

## 🛡️ Rollback Procedures

### Scenario 1: Migration Failed on Staging

**증상**: `npx prisma migrate deploy` 실패

```bash
# 1️⃣ 상태 확인
ssh ubuntu@staging.doremi-live.com
docker exec dorami-backend-1 npx prisma migrate status

# 2️⃣ 마지막 마이그레이션 기록
docker exec dorami-backend-1 npx prisma migrate resolve --rolled-back <migration-name>

# 3️⃣ 이전 커밋으로 복구
git revert <failed-commit-hash>
git push origin staging
```

### Scenario 2: Schema Mismatch Post-Merge

**증상**: merge 후 타입 에러 또는 런타임 에러

```bash
# 1️⃣ 마이그레이션 상태 확인
npx prisma migrate status

# 2️⃣ Prisma Client 재생성
npx prisma generate

# 3️⃣ 타입 체크
npm run type-check:all

# 4️⃣ 필요시 리셋 (로컬만!)
npm run docker:down
npm run docker:up
npx prisma migrate deploy
npx prisma db seed
```

### Scenario 3: Rollback Entire Merge

**증상**: 전체 병합 취소 필요

```bash
# 1️⃣ 병합 취소
git reset --hard origin/main  # main 기준으로 리셋

# 또는
git revert -m 1 <merge-commit-hash>

# 2️⃣ 강제 푸시 (팀 동의 필수!)
git push origin main --force

# ⚠️ 주의: --force는 다른 개발자의 작업을 덮을 수 있음
```

---

## 📋 Step-by-Step Execution Plan

### Today (2026-03-01)

```
[ ] Phase 1: Local Staging
  [ ] 1.1: Uncommitted changes 확인
  [ ] 1.2: 신규 마이그레이션 생성 (npx prisma migrate dev)
  [ ] 1.3: 로컬 DB에 적용 + type-check + build
  [ ] 1.4: git commit + git push origin develop

[ ] Update Obsidian: 05. Todo & 작업현황.md
  [ ] Phase 1 완료 표시
  [ ] Phase 2 예정일 기재
```

### Tomorrow or Next Release

```
[ ] Phase 2: Staging 동기화
  [ ] 2.1: staging 브랜치 상태 확인
  [ ] 2.2: git merge develop (또는 cherry-pick)
  [ ] 2.3: SSH → Staging DB 마이그레이션 적용
  [ ] 2.4: git push origin staging

[ ] Phase 3: Main 병합 (Release)
  [ ] 3.1: GitHub PR 생성 (develop → main)
  [ ] 3.2: CI 통과 확인
  [ ] 3.3: Code review + approval
  [ ] 3.4: PR 병합

[ ] Update Obsidian: 모든 문서 동기화
```

---

## ✅ Validation Checklist

### Pre-Merge Validation

- [ ] Type checking: `npm run type-check:all` ✅ PASS
- [ ] ESLint: `npm run lint:all` ✅ PASS
- [ ] Build: `npm run build:all` ✅ PASS
- [ ] Migrations: `npx prisma migrate status` shows ✅ "All migrations are applied"
- [ ] Database: `npx prisma db execute --stdin <<EOF ... EOF` returns expected columns
- [ ] Prisma Client: `npx prisma generate` completes without error
- [ ] Tests: `npm run test:backend` ✅ PASS (if applicable)
- [ ] E2E: `npx playwright test --project=user` ✅ PASS (if applicable)

### Post-Merge Validation

- [ ] Main branch builds: GitHub Actions CI ✅ PASS
- [ ] Staging deployment: All services healthy
- [ ] Production readiness: No pending hotfixes

---

## 🔗 Related Documentation

- **Schema definition**: `backend/prisma/schema.prisma`
- **Migration log**: `backend/prisma/migrations/migration_lock.toml`
- **Prisma config**: `backend/prisma.config.ts`
- **Production deployment**: `infrastructure/aws-cdk/`
- **Obsidian notes**: `05. Todo & 작업현황.md`, `06. Decisions (ADR).md`

---

## 📞 Support & Troubleshooting

### Common Issues

| 문제 | 원인 | 해결책 |
|------|------|--------|
| "column X does not exist" on migration | Stale Prisma Client | `npx prisma generate` |
| Merge conflict in schema.prisma | Parallel schema changes | "Conflict Resolution" 섹션 참고 |
| Docker DB not responding | Container 문제 | `npm run docker:logs` → `docker restart dorami-postgres-1` |
| Migration timeout | Large dataset | Production에서는 시간대 선택 필요 |
| "Migration is already applied" error | Duplicate migration state | `npx prisma migrate resolve --rolled-back` |

---

**Last updated**: 2026-03-01
**Next review**: After Phase 1 completion
**Status**: 🔄 ACTIVE — Execute Phase 1 today
