# Dorami Live Commerce — 문서 인덱스

> 프로젝트의 모든 문서를 카테고리별로 정리한 중앙 인덱스입니다.

---

## Getting Started

온보딩 및 개발 환경 설정에 필요한 문서입니다.

| 문서                                                                             | 설명                                |
| -------------------------------------------------------------------------------- | ----------------------------------- |
| [environment-setup.md](getting-started/environment-setup.md)                     | 개발 환경 설정 (Node, Docker, .env) |
| [codebase-overview.md](getting-started/codebase-overview.md)                     | 코드베이스 구조 개요                |
| [frontend-backend-separation.md](getting-started/frontend-backend-separation.md) | 프론트/백엔드 작업 분리 가이드      |

## Architecture

시스템 설계 및 기술 아키텍처 문서입니다.

| 문서                                                              | 설명                              |
| ----------------------------------------------------------------- | --------------------------------- |
| [api-reference.md](architecture/api-reference.md)                 | REST API 레퍼런스                 |
| [database-schema.md](architecture/database-schema.md)             | 데이터베이스 스키마 (Prisma)      |
| [live-streaming-system.md](architecture/live-streaming-system.md) | 라이브 스트리밍 시스템 가이드     |
| [live-screen-analysis.md](architecture/live-screen-analysis.md)   | 라이브 화면 분석 및 지연시간 개선 |

## Guides

기능별 구현 가이드입니다.

| 문서                                                  | 설명                                    |
| ----------------------------------------------------- | --------------------------------------- |
| [kakao-share.md](guides/kakao-share.md)               | 카카오 공유하기 기능 가이드             |
| [push-notifications.md](guides/push-notifications.md) | 푸시 알림 구현 가이드                   |
| [ngrok-deployment.md](guides/ngrok-deployment.md)     | ngrok 터널링 배포 가이드                |
| [kakao-auth/](guides/kakao-auth/README.md)            | 카카오 OAuth 인증 구현 (하위 문서 포함) |

## Deployment

배포 및 인프라 관련 문서입니다.

| 문서                                                            | 설명                                     |
| --------------------------------------------------------------- | ---------------------------------------- |
| [overview.md](deployment/overview.md)                           | 배포 전체 개요                           |
| [staging.md](deployment/staging.md)                             | Staging 환경 배포 가이드                 |
| [production.md](deployment/production.md)                       | Production 환경 배포 가이드              |
| [aws-infrastructure.md](deployment/aws-infrastructure.md)       | AWS 인프라 구성 가이드                   |
| [ci-cd-pipeline.md](deployment/ci-cd-pipeline.md)               | CI/CD 파이프라인 (GitHub Actions)        |
| [staging-testing-guide.md](deployment/staging-testing-guide.md) | Staging 테스트 및 Production 분리 가이드 |

## Process

개발 프로세스 및 팀 규칙 문서입니다.

| 문서                                                       | 설명                |
| ---------------------------------------------------------- | ------------------- |
| [branching-strategy.md](process/branching-strategy.md)     | Git 브랜치 전략     |
| [testing-strategy.md](process/testing-strategy.md)         | 환경별 테스트 전략  |
| [mvp-launch-checklist.md](process/mvp-launch-checklist.md) | MVP 런칭 체크리스트 |

## Spec

제품 기획 및 디자인 관련 문서입니다.

| 문서                                                    | 설명                                |
| ------------------------------------------------------- | ----------------------------------- |
| [product-requirements.md](spec/product-requirements.md) | PRD (제품 요구사항 정의서)          |
| [design-system.md](spec/design-system.md)               | 디자인 철학 및 원칙                 |
| [ui-ux-specification.md](spec/ui-ux-specification.md)   | UI/UX 사양서                        |
| [frontend-tech-stack.md](spec/frontend-tech-stack.md)   | 프론트엔드 기술 스택 및 구현 가이드 |

## Reports

프로젝트 진행 과정에서 생성된 리포트 아카이브입니다.

| 카테고리                                                     | 설명                                               |
| ------------------------------------------------------------ | -------------------------------------------------- |
| [code-review/](reports/README.md#code-review)                | 코드 리뷰 리포트 (v1–v4, Deep Analysis, Changelog) |
| [implementation/](reports/README.md#implementation)          | 구현 상태, 검증, Phase 2-3 완료, 계획, TODO 분석   |
| [testing/](reports/README.md#testing)                        | E2E 테스트, Featured Product API 테스트            |
| [ui-improvement-report.md](reports/ui-improvement-report.md) | UI 개선 리포트                                     |

## Assets

비주얼 에셋 (스크린샷, 와이어프레임, 레퍼런스 UI)입니다.

| 폴더                                            | 설명                    |
| ----------------------------------------------- | ----------------------- |
| [screenshots/v1/](assets/screenshots/v1/)       | 초기 스크린샷           |
| [screenshots/v2/](assets/screenshots/v2/)       | v2 리디자인 스크린샷    |
| [screenshots/final/](assets/screenshots/final/) | 최종 스크린샷           |
| [wireframes/](assets/wireframes/)               | Excalidraw 와이어프레임 |
| [reference-ui/](assets/reference-ui/)           | 레퍼런스 UI 이미지      |
