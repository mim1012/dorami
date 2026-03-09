# 🔐 Dorami SSH & Docker Image 비교 가이드

## 🚀 빠른 시작

### 1️⃣ 한 줄 명령어로 이미지 비교

```bash
bash scripts/check-image-versions.sh
```

### 2️⃣ Alias 설정 (선택)

프로젝트 루트에서:

```bash
source .doramirc
```

그 후 간단한 명령어 사용 가능:

```bash
check-images       # Production ↔ Staging 이미지 비교
prod-ssh           # Production SSH 접속
staging-ssh        # Staging SSH 접속
prod-images        # Production 실행 중인 이미지 확인
staging-images     # Staging 실행 중인 이미지 확인
```

---

## 📋 서버 정보

| 환경                    | IP             | 사용자   | SSH 키                             |
| ----------------------- | -------------- | -------- | ---------------------------------- |
| **Production (본서버)** | `15.165.66.23` | `ubuntu` | `D:/Project/dorami/ssh/id_ed25519` |
| **Staging (테스트)**    | `54.180.94.30` | `ubuntu` | `D:/Project/dorami/ssh/id_ed25519` |

---

## 🛠️ 수동 SSH 명령어

### Production 접속

```bash
ssh -i D:/Project/dorami/ssh/id_ed25519 ubuntu@15.165.66.23
```

### Staging 접속

```bash
ssh -i D:/Project/dorami/ssh/id_ed25519 ubuntu@54.180.94.30
```

---

## 📦 Docker 명령어 (서버에서 실행)

### 실행 중인 컨테이너 확인

```bash
docker ps --format "table {{.Image}}\t{{.ID}}\t{{.Status}}"
```

### 이미지 세부 정보

```bash
docker images ghcr.io/mim1012/dorami-*
```

### 백엔드 로그 보기

```bash
docker compose -f docker-compose.prod.yml logs -f backend
```

### 헬스 체크

```bash
curl http://localhost:3001/api/health/live
```

---

## 🎯 자동 이미지 비교 스크립트

### 작동 원리

1. Production 서버에 SSH 접속
2. 실행 중인 Docker 이미지 목록 조회
3. Staging 서버에 SSH 접속
4. 실행 중인 Docker 이미지 목록 조회
5. Backend/Frontend 이미지 태그 비교
6. 결과 출력 (✅ 일치 / ❌ 불일치)

### 종료 코드

- **0**: 이미지 완벽 일치 ✅
- **1**: 이미지 불일치 ⚠️

### 커스텀 SSH 키 사용

```bash
bash scripts/check-image-versions.sh "/path/to/custom/key"
```

---

## 📊 최근 이미지 비교 결과 (2026-03-06)

| 환경           | Backend           | Frontend          | 상태             |
| -------------- | ----------------- | ----------------- | ---------------- |
| **Production** | `sha-d5fe335b...` | `sha-2189522b...` | ⚠️ Frontend 낡음 |
| **Staging**    | `sha-d5fe335b...` | `sha-d5fe335b...` | ✅ 최신          |

### 액션 아이템

- ⚠️ Production Frontend가 Staging보다 구버전입니다
- 다음 배포 때 `sha-d5fe335b...` Frontend로 업데이트 필요

---

## 🔄 매일 체크하기

### Windows (PowerShell)

```powershell
# 매일 아침 자동 실행
$trigger = New-JobTrigger -Daily -At "9:00 AM"
Register-ScheduledJob -Trigger $trigger -ScriptBlock { cd D:\Project\dorami; bash scripts/check-image-versions.sh } -Name DoramiImageCheck
```

### macOS/Linux (Cron)

```bash
# 매일 오전 9시 실행
0 9 * * * cd D:/Project/dorami && bash scripts/check-image-versions.sh
```

---

## 💡 팁

### SSH 키 암호 입력 생략

SSH 에이전트 사용:

```bash
# 한 번만 실행
ssh-add D:/Project/dorami/ssh/id_ed25519

# 이제 암호 입력 없이 접속 가능
ssh ubuntu@15.165.66.23
```

### .bashrc/.zshrc에 alias 자동 로드

```bash
# 파일 끝에 추가
if [ -f "~/Project/dorami/.doramirc" ]; then
  source "~/Project/dorami/.doramirc"
fi
```

---

## ❓ 자주 묻는 질문

### Q1: SSH 연결이 안 되어요

**A:** SSH 키 경로 확인

```bash
ls -la D:/Project/dorami/ssh/id_ed25519
```

### Q2: Permission denied (publickey)

**A:** 대안:

1. SSH 키 권한 확인: `chmod 600 ~/.ssh/id_ed25519`
2. SSH 에이전트 사용: `ssh-add ~/.ssh/id_ed25519`
3. 관리자에게 최신 SSH 키 요청

### Q3: 스크립트 실행 권한이 없어요 (Windows)

**A:** PowerShell에서 실행:

```powershell
bash -c "bash ./scripts/check-image-versions.sh"
```

### Q4: 스크립트가 느려요

**A:** SSH 연결 속도 확인:

```bash
ssh -i D:/Project/dorami/ssh/id_ed25519 ubuntu@15.165.66.23 "echo 'OK'"
```

---

## 📞 문제 해결

### 스크립트 디버그 모드

```bash
bash -x scripts/check-image-versions.sh
```

### SSH 상세 로그

```bash
ssh -v -i D:/Project/dorami/ssh/id_ed25519 ubuntu@15.165.66.23
```

---

**마지막 업데이트**: 2026-03-06
**작성자**: Claude Code SSH Helper
