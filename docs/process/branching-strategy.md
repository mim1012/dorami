# Git 브랜치 전략

**프로젝트**: Dorami Live Commerce

---

## 브랜치 구조

```
main ─────────────────────────────────────── 프로덕션 배포
 │
 └── develop ─────────────────────────────── 개발 통합 (Staging 자동 배포)
      │
      ├── feature/기능명 ─────────────────── 기능 개발
      ├── fix/이슈설명 ───────────────────── 버그 수정
      └── hotfix/긴급수정 ────────────────── 프로덕션 긴급 패치
```

## 브랜치별 역할

### `main`

- **프로덕션 배포** 전용 브랜치
- `develop`에서 PR을 통해서만 병합
- 직접 커밋 금지
- 태그(`v1.0.0`)를 통한 릴리즈 관리

### `develop`

- **개발 통합** 브랜치
- Staging 서버에 자동 배포 (`deploy-staging.yml`)
- 모든 feature/fix 브랜치의 병합 대상
- CI 파이프라인 자동 실행

### `feature/*`

- 새로운 기능 개발 시 `develop`에서 분기
- 네이밍: `feature/기능-설명` (예: `feature/ui-redesign-eunimarket-inspired`)
- 완료 후 `develop`으로 PR 생성

### `fix/*`

- 버그 수정 시 `develop`에서 분기
- 네이밍: `fix/이슈-설명` (예: `fix/pr3-coderabbit-review-fixes`)
- 완료 후 `develop`으로 PR 생성

### `hotfix/*`

- 프로덕션 긴급 수정 시 `main`에서 분기
- 수정 후 `main`과 `develop` 양쪽에 병합

## 워크플로우

### 일반 기능 개발

```bash
# 1. develop에서 feature 브랜치 생성
git checkout develop
git pull origin develop
git checkout -b feature/새기능

# 2. 개발 및 커밋
git add .
git commit -m "feat(scope): 기능 설명"

# 3. develop으로 PR 생성
git push -u origin feature/새기능
# GitHub에서 PR 생성 → 코드 리뷰 → Merge
```

### Staging → Production 배포

```bash
# 1. develop 브랜치가 Staging에서 검증 완료 후
# 2. develop → main PR 생성
# 3. 코드 리뷰 & 승인
# 4. Merge 후 릴리즈 태그 생성
git tag -a v1.x.x -m "Release v1.x.x"
git push origin v1.x.x
```

### 긴급 수정 (Hotfix)

```bash
# 1. main에서 hotfix 브랜치 생성
git checkout main
git checkout -b hotfix/긴급수정

# 2. 수정 후 main으로 PR → Merge
# 3. develop에도 병합
git checkout develop
git merge hotfix/긴급수정
```

## 커밋 메시지 컨벤션

```
<type>(<scope>): <description>

type:
  feat     - 새로운 기능
  fix      - 버그 수정
  docs     - 문서 수정
  style    - 코드 포맷팅 (기능 변경 없음)
  refactor - 리팩토링
  test     - 테스트 추가/수정
  chore    - 빌드/설정 변경

scope (선택):
  client, backend, shared, infra, admin
```

## PR 규칙

1. **제목**: 커밋 컨벤션과 동일한 형식
2. **리뷰어**: 최소 1명 승인 필요
3. **CI 통과**: 모든 체크가 통과해야 Merge 가능
4. **Squash Merge** 사용 권장 (깔끔한 히스토리 유지)

## 관련 문서

- [CI/CD 파이프라인](../deployment/ci-cd-pipeline.md)
- [Staging 배포 가이드](../deployment/staging.md)
- [Production 배포 가이드](../deployment/production.md)
