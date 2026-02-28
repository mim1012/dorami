# Dorami 디자인 시스템 분석 보고서

**작성일**: 2026-02-28
**분석자**: Designer Agent
**대상**: Fashion Platform → Dorami 메인페이지 디자인 시스템 통합

---

## 목차

1. [현재 Dorami 디자인 시스템](#1-현재-dorami-디자인-시스템)
2. [색상 팔레트](#2-색상-팔레트)
3. [타이포그래피 스케일](#3-타이포그래피-스케일)
4. [Spacing 시스템](#4-spacing-시스템)
5. [Border Radius & Shadow](#5-border-radius--shadow)
6. [4개 섹션 컴포넌트 구조](#6-4개-섹션-컴포넌트-구조)
7. [Tailwind CSS 매핑](#7-tailwind-css-매핑)
8. [반응형 브레이크포인트](#8-반응형-브레이크포인트)
9. [Fashion Platform vs Dorami 차이점](#9-fashion-platform-vs-dorami-차이점)
10. [신규 컴포넌트 정의](#10-신규-컴포넌트-정의)
11. [Migration 전략](#11-migration-전략)

---

## 1. 현재 Dorami 디자인 시스템

### 1.1 기술 스택

| 항목          | 현재 Dorami             | Fashion Platform    |
| ------------- | ----------------------- | ------------------- |
| 프레임워크    | Next.js 16 + React 19   | Vite + React 18     |
| 스타일링      | Tailwind CSS 4.0        | Tailwind CSS 4.1    |
| UI 라이브러리 | 자체 구현 (custom)      | Radix UI 46개 + MUI |
| 아이콘        | Lucide React 0.563      | Lucide React        |
| 폰트          | Pretendard Variable     | 미지정 (시스템)     |
| 모드          | Light + Dark (CSS vars) | Light only          |

### 1.2 현재 메인페이지 섹션 현황

```
현재 app/page.tsx 구현 상태:
├── Hero 헤더 (브랜드 로고 + 검색바) ✅
├── LiveCountdownBanner (카운트다운 배너) ✅
├── SocialProof (팔로워/시청자 통계) ✅
├── 예정된 라이브 (UpcomingLiveCard) ✅
├── Weekly Pick 배너 (정적 gradient 카드) ✅
└── 지난 추천 상품 (ProductCard, 2열 그리드) ✅

미구현 섹션:
├── 방송특가 (Live Exclusive Deals) ❌
├── 라이브 인기상품 Popular Products ❌
└── 라이브 Hero Banner (현재 라이브 전용) ❌
```

---

## 2. 색상 팔레트

### 2.1 Dorami 현재 색상 시스템

#### Primary Colors (CSS Variables)

```css
/* Hot Pink 계열 - 메인 브랜드 색상 */
--hot-pink: #ff007a /* 주요 CTA, 가격, 강조 */ --hot-pink-secondary: #ff6b35 /* 그라디언트 보조색 */
  --hot-pink-dark: #cc0062 /* hover/active 상태 */ /* Purple 계열 - 보조 브랜드 색상 */
  /* (CSS var 없음, 인라인으로 사용) */ #7928ca /* 그라디언트 보조 */ #ff4500
  /* 오렌지-레드 (그라디언트 중간) */;
```

#### Light Mode (`:root`)

```css
--primary-black: #ffffff /* 배경 (light mode에서 흰색) */ --content-bg: #f8f9fa
  /* 콘텐츠 영역 배경 */ --primary-text: #212529 /* 본문 텍스트 */ --secondary-text: #6c757d
  /* 보조 텍스트, 플레이스홀더 */ --border-color: #dee2e6 /* 구분선, 테두리 */ --card-bg: #ffffff
  /* 카드 배경 */ /* 상태 색상 */ --success: #16a34a --error: #dc2626 --warning: #ea580c
  --info: #0284c7 /* 시맨틱 배경 */ --success-bg: #f0fdf4 --error-bg: #fef2f2 --warning-bg: #fff7ed
  --info-bg: #eff6ff;
```

#### Dark Mode (`.dark`)

```css
--primary-black: #0a0a0a /* 최고 어두운 배경 */ --content-bg: #1a1a1a /* 콘텐츠 영역 */
  --primary-text: #ffffff /* 흰색 텍스트 */ --secondary-text: #a0a0a0 /* 회색 보조 텍스트 */
  --border-color: #2a2a2a /* 어두운 구분선 */ --card-bg: #1a1a1a /* 카드 배경 */
  /* 상태 색상 (iOS native 계열) */ --success: #34c759 --error: #ff3b30 --warning: #ff9500
  --info: #5ac8fa;
```

### 2.2 패션 플랫폼 → Dorami 색상 매핑

Fashion Platform에서 확인된 주요 색상 패턴과 Dorami 매핑:

```
Fashion Platform → Dorami
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
라이브 강조색    → #FF007A (hot-pink)
CTA 버튼        → gradient: hot-pink → #7928CA
할인 뱃지       → #DC2626 (error)
신상품 뱃지     → #FF007A (hot-pink) via pink-600
베스트셀러 뱃지 → #7928CA (purple)
LIVE 뱃지       → #FF3B30 (iOS red)
카운트다운      → hot-pink + #7928CA gradient
배경 (dark)     → #0A0A0A, #1A1A1A
카드 테두리     → #2A2A2A (dark), #DEE2E6 (light)
```

### 2.3 신규 추가 권장 색상

메인페이지 4개 섹션 구현을 위해 추가할 색상:

```css
/* globals.css :root 추가 */
--live-red: #ff3b30 /* LIVE 뱃지 전용 (현재 인라인으로 사용 중) */ --purple-accent: #7928ca
  /* 보조 브랜드 (현재 인라인 #7928CA) */ --orange-accent: #ff4500
  /* 그라디언트 중간 (현재 인라인) */ --countdown-bg: rgba(255, 0, 122, 0.1) /* 카운트다운 배경 */
  --live-gradient: linear-gradient(135deg, #ff007a 0%, #7928ca 50%, #ff4500 100%);
```

---

## 3. 타이포그래피 스케일

### 3.1 현재 Dorami 타이포그래피

**폰트**: Pretendard Variable (CDN via jsdelivr)
**Fallback**: `-apple-system, BlinkMacSystemFont, 'system-ui', sans-serif`

코드에서 확인된 실제 사용 클래스:

```
클래스명             크기/스타일          사용 위치
──────────────────────────────────────────────────────
text-[10px]         10px               브랜드 서브타이틀, 뱃지
text-xs             12px               보조 정보, 메타데이터
text-sm             14px               본문, 버튼, 보조 텍스트
text-base / text-body 16px             기본 본문
text-lg             18px               가격 강조
text-xl             20px               섹션 헤더
text-2xl            24px               Hero 서브헤드
text-3xl            30px               브랜드 로고명
text-5xl            48px               카운트다운 숫자

font-medium         500                기본 강조
font-semibold       600                버튼, 레이블
font-bold           700                헤더, 카드 제목
font-black          900                브랜드, Hero, 가격
```

### 3.2 타이포그래피 스케일 정의

메인페이지 섹션별 권장 타이포그래피:

```
목적                     클래스                    비고
─────────────────────────────────────────────────────────
브랜드명 (Doremi)        text-3xl font-black        로고
섹션 제목                text-xl font-black         예: "예정된 라이브"
Hero 서브헤드            text-2xl font-black        메인 슬로건
카드 제목                text-sm font-bold           line-clamp-2
상품명                   text-sm font-bold
가격 (메인)              text-lg font-black text-hot-pink
가격 (취소선)            text-xs text-secondary-text line-through
할인율                   text-sm font-black text-error
뱃지 텍스트              text-[10px] font-bold uppercase
카운트다운 숫자           text-5xl font-bold tracking-wider
보조 텍스트              text-sm text-secondary-text
타임스탬프               text-xs text-white/80 font-mono
```

### 3.3 Font Weight 가이드라인

```
font-medium (500)  → 일반 UI 텍스트, 네비게이션
font-semibold (600) → 버튼, 레이블, 태그
font-bold (700)    → 카드 제목, 섹션 부제목
font-black (900)   → 브랜드, 가격, Hero 카피, 섹션 헤더
```

---

## 4. Spacing 시스템

### 4.1 기본 단위

**기본 단위**: 8px (`--spacing-unit: 8px`)
**Tailwind 기준**: 1 unit = 4px → spacing-2 = 8px

```
토큰        값      Tailwind 클래스   사용 예
────────────────────────────────────────────
4px         1px×4   p-1             최소 내부 여백
8px         2px×4   p-2 / gap-2     뱃지 내부
12px        3px×4   p-3 / gap-3     카드 내부 (소형)
14px               p-3.5           카드 정보 영역
16px        4px×4   p-4 / gap-4     기본 페이지 여백, 섹션 내부
20px        5px×4   p-5
24px        6px×4   p-6 / gap-6     배너 내부 패딩
28px        7px×4   p-7             Weekly Pick 배너
32px        8px×4   p-8             대형 섹션 패딩
```

### 4.2 컴포넌트별 Spacing

```
컴포넌트                   내부 패딩          갭
─────────────────────────────────────────────────
페이지 좌우 여백           px-4 (16px)
섹션 간격 (mb)             mb-6, mb-8
카드 정보 영역             p-3.5 (14px)
배너 내부                  p-6 (24px), p-7 (28px)
뱃지                       px-2.5 py-0.5
버튼 (sm)                  px-3 py-1.5
버튼 (md)                  px-4 py-2
버튼 (lg)                  px-6 py-3
카드 그리드 갭             gap-3.5
카드 수평 스크롤 갭        gap-4
섹션 헤더 아이템 갭        gap-2.5
```

### 4.3 레이아웃 구조

```
┌──────────────────────────────────────────┐
│  max-width: 480px (PC에서 모바일 프레임)   │
│  centered, border 좌우                    │
│                                          │
│  ← px-4 padding →                        │
│                                          │
│  [섹션 A]           mb-6~8               │
│  [섹션 B]           mb-6~8               │
│  [섹션 C]           mb-6~8               │
│                                          │
│  pb-bottom-nav (하단 네비게이션 여백)      │
└──────────────────────────────────────────┘
```

---

## 5. Border Radius & Shadow

### 5.1 Border Radius

```css
--radius-card: 12px /* rounded-[12px] — 카드, 패널 */ --radius-button: 8px
  /* rounded-button — 버튼 */ --radius-small: 4px /* rounded-small — 뱃지, 작은 요소 */
  --radius-input: 8px /* rounded-[8px] — 입력 필드 */ /* 코드에서 실제 사용 */ rounded-full
  /* 원형 — 버튼(pill), 아바타, 뱃지 */ rounded-2xl (16px) /* 카드 (large variant) */ rounded-3xl
  (24px) /* 대형 배너, Hero 섹션 */ rounded-[12px] /* 기본 카드, 비디오 영역 */ rounded-[8px]
  /* 버튼, 입력 필드 */ rounded-full /* pill 버튼, 카운트 뱃지 */;
```

### 5.2 Shadow

```css
--shadow-card: 0 2px 8px rgba(0, 0, 0, 0.08) /* 기본 카드 */ --shadow-card-hover: 0 8px 24px
  rgba(0, 0, 0, 0.12) /* 호버 카드 */ 0 4px 12px rgba(0, 0, 0, 0.12)
  /* Tailwind: shadow-card-hover */ --shadow-floating: 0 4px 12px rgba(0, 0, 0, 0.1) /* 플로팅 UI */
  --shadow-hot-pink: 0 0 20px rgba(255, 0, 122, 0.3) /* 핑크 강조 그림자 */;
```

### 5.3 Animation 토큰

```css
/* 현재 정의된 애니메이션 */
animate-pulse-live      /* LIVE 뱃지 깜빡임 (2s) */
animate-slide-up-toast  /* 토스트 슬라이드업 (0.3s ease-out) */
animate-slide-up-sheet  /* 바텀 시트 (0.35s cubic-bezier) */
animate-cart-toast-in   /* 카트 토스트 인 (0.4s cubic-bezier) */
animate-cart-toast-out  /* 카트 토스트 아웃 (0.3s ease-in) */
animate-hero-glow       /* 히어로 핑크 글로우 (4s) */
animate-bounce-in       /* 바운스 등장 (0.6s) */
animate-stagger-fade    /* 순차적 페이드인 (0.5s, delay 조절) */
animate-shimmer         /* 로딩 shimmer (1.5s) */
animate-gradient        /* 그라디언트 배경 이동 (8s) */
animate-slide-in-left   /* 왼쪽에서 슬라이드 (0.4s) */
animate-fade-in-backdrop /* 백드롭 페이드인 (0.2s) */
```

---

## 6. 4개 섹션 컴포넌트 구조

### 6.1 라이브 배너 (Live Hero Banner)

**목적**: 현재 진행 중인 라이브 스트림 대표 배너

#### ASCII Mockup

```
┌────────────────────────────────────────┐
│ ████████████████████████████████████ │  ← aspect-video (16:9)
│ ██  🔴 LIVE NOW              👥 1,234 ██│  ← 오버레이
│ ██                                  ██│
│ ██  셀러A의 봄 신상품 페스티벌       ██│  ← 라이브 제목
│ ██  호스트: 셀러A                    ██│
│ ██                                  ██│
│ ██      [  입장하기  →  ]           ██│  ← CTA 버튼
│ ████████████████████████████████████ │
└────────────────────────────────────────┘

라이브 없을 때:
┌────────────────────────────────────────┐
│  gradient-hot-pink 배경               │
│  다음 라이브                           │
│  02:33:45  ← 카운트다운 5xl font-bold │
│  라이브 시작까지                       │
│  [  알림 받기  ]                      │
└────────────────────────────────────────┘
```

#### 컴포넌트 구조

```tsx
// 파일: client-app/src/components/home/LiveHeroBanner.tsx
// 현재 LiveCountdownBanner.tsx가 부분 구현 (카운트다운만)
// 신규 구현 필요: 실제 라이브 정보 표시

interface LiveHeroBannerProps {
  stream?: {
    id: string;
    streamKey: string;
    title: string;
    viewerCount: number;
    thumbnailUrl: string | null;
    startedAt: string;
    host: { id: string; name: string };
  };
  nextLive?: {
    title: string;
    scheduledAt: string;
    streamId: string;
  };
  onLiveClick: (streamKey: string) => void;
}

// 상태 분기:
// 1. stream 있음 → 풀스크린 라이브 배너 (비디오 썸네일 + 오버레이)
// 2. stream 없고 nextLive 있음 → 카운트다운 배너 (gradient)
// 3. 둘 다 없음 → null 또는 프로모션 배너
```

#### CSS 클래스 매핑

```
영역                  클래스
────────────────────────────────────────────────────
래퍼                  relative w-full aspect-video rounded-3xl overflow-hidden
배경 이미지           absolute inset-0 object-cover
그라디언트 오버레이   absolute inset-0 bg-gradient-to-t from-black/80 via-black/30 to-transparent
LIVE 뱃지             flex items-center gap-1.5 bg-[#FF3B30] text-white text-xs px-3 py-1.5 rounded-full font-bold
시청자수              bg-black/50 backdrop-blur-sm px-3 py-1.5 rounded-full text-xs
라이브 제목           text-2xl font-black text-white
호스트                text-sm text-white/80
CTA 버튼              bg-hot-pink text-white px-8 py-4 rounded-full font-bold
```

---

### 6.2 방송특가 (Live Exclusive Deals)

**목적**: 현재 LIVE 스트림에 연결된 상품 수평 스크롤

#### ASCII Mockup

```
방송특가 🔴 LIVE                        더보기 →
──────────────────────────────────────────────
┌──────────┐ ┌──────────┐ ┌──────────┐
│ [이미지]  │ │ [이미지]  │ │ [이미지]  │  ← aspect-[3/4]
│          │ │          │ │          │
│ NEW      │ │ -30%     │ │          │
└──────────┘ └──────────┘ └──────────┘
│ 스프링 블라우스     │
│ ~~50,000원~~       │
│ 30% 35,000원       │
└────────────────────┘
  ↑↑↑↑ 수평 스크롤 (snap-x)
```

#### 컴포넌트 구조

```tsx
// 파일: client-app/src/components/home/LiveExclusiveDeals.tsx
// 신규 구현 필요

interface LiveExclusiveDealsProps {
  products: LiveDealProduct[];
  streamTitle: string;
  isLoading?: boolean;
}

interface LiveDealProduct {
  id: string;
  name: string;
  price: number;
  originalPrice?: number;
  imageUrl: string;
  discountRate?: number;
  isNew?: boolean;
}

// 섹션 헤더 패턴:
// <div className="w-1.5 h-7 rounded-full bg-gradient-to-b from-hot-pink to-[#7928CA]" />
// <h2>방송특가</h2>
// <span className="bg-[#FF3B30] text-white px-2 py-0.5 rounded-full text-[10px] font-bold">LIVE</span>

// 라이브 없을 때: 섹션 전체 숨김 (return null)
// 로딩: Skeleton 3개
```

#### CSS 클래스 매핑

```
영역                  클래스
────────────────────────────────────────────────────
섹션 컨테이너         px-4 mb-8
섹션 헤더             flex items-center justify-between mb-4
헤더 좌측             flex items-center gap-2.5
수직 바               w-1.5 h-7 rounded-full bg-gradient-to-b from-hot-pink to-[#7928CA]
섹션 타이틀           text-xl font-black
LIVE 뱃지             px-2.5 py-1 text-xs font-bold bg-[#FF3B30] text-white rounded-full
스크롤 컨테이너       flex gap-4 overflow-x-auto scrollbar-none pb-2 -mx-4 px-4 snap-x snap-mandatory
상품 카드 래퍼        min-w-[160px] max-w-[180px] snap-start flex-shrink-0
상품 카드             rounded-2xl overflow-hidden bg-card-bg border border-border-color
이미지 영역           relative aspect-[3/4] bg-content-bg overflow-hidden
정보 영역             p-3
상품명                text-xs font-bold line-clamp-2 text-primary-text
원가                  text-[10px] text-secondary-text line-through
가격                  text-sm font-black text-hot-pink
```

---

### 6.3 곧 시작하는 라이브 (Upcoming Lives)

**목적**: 예정 라이브 슬라이더 (카운트다운 포함)

#### ASCII Mockup

```
예정된 라이브  [3]
──────────────────────────────────────────────
┌──────────────────────────┐ ┌──────────────────────────┐
│ [썸네일 이미지]            │ │ [썸네일 이미지]            │
│                    00:12:34│ │                    26:00:00│  ← 카운트다운
│                            │ │                            │
│ 셀러A의 봄 신상품 페스티벌  │ │ 셀러B의 여름 런칭           │
│ 📅 오늘 18:00              │ │ 📅 내일 14:00              │
└──────────────────────────┘ └──────────────────────────┘
  ↑ min-w-[280px] snap-start    수평 스크롤

예정 라이브 없을 때:
┌────────────────────────────────────────┐
│  빈 상태 UI                            │
│  아이콘 + "예정된 라이브가 없습니다"    │
│  [알림 신청하기]                        │
└────────────────────────────────────────┘
```

#### 컴포넌트 구조

```tsx
// 파일: client-app/src/components/home/UpcomingLiveCard.tsx (기존)
// 현재 구현 완료, 일부 확장 필요

// 현재 UpcomingLiveCard Props:
interface UpcomingLiveCardProps {
  id: string;
  title: string;
  scheduledTime: Date;
  thumbnailUrl: string;
  isLive?: boolean;
  onClick?: () => void;
  size?: 'normal' | 'small';
}

// 추가 필요한 Props (MAINPAGE_CONCEPTS.md 기반):
// host?: { id: string; name: string }
// description?: string

// 섹션 컴포넌트:
// client-app/src/components/home/UpcomingLivesSection.tsx (신규)
interface UpcomingLivesSectionProps {
  lives: UpcomingLive[];
  isLoading?: boolean;
}
```

#### CSS 클래스 매핑 (기존 컴포넌트 확인)

```
영역                   클래스 (현재 구현)
────────────────────────────────────────────────────
카드 래퍼              group cursor-pointer rounded-2xl overflow-hidden bg-card-bg border border-border-color
                       transition-all duration-300 hover:shadow-card-hover hover:-translate-y-1
                       hover:border-hot-pink/40 active:scale-[0.98]
이미지 영역            relative aspect-[16/10] bg-primary-black overflow-hidden
그라디언트 오버레이    absolute inset-0 bg-gradient-to-t from-black/70 via-black/20 to-transparent
LIVE 뱃지              bg-[#FF3B30] text-white text-xs px-3 py-1.5 rounded-full font-bold
카운트다운             bg-black/50 backdrop-blur-sm text-white text-xs px-3 py-1.5 rounded-full font-mono
제목                   text-white font-bold text-sm line-clamp-1 drop-shadow-lg
시간                   text-white/80 text-xs
```

---

### 6.4 라이브 인기상품 (Popular Products)

**목적**: 전체 판매순 베스트셀러 2열 그리드

#### ASCII Mockup

```
라이브 인기상품  🏆                      더보기 →
──────────────────────────────────────────────
┌─────────────────────────────────────────┐
│ [대형 이미지 - 첫 번째 상품 (2열 전체)] │  ← grid col-span-2
│ -30%                                    │
└─────────────────────────────────────────┘
┌──────────────┐ ┌──────────────┐
│ [이미지]     │ │ [이미지]     │  ← 나머지 2열 그리드
│ NEW          │ │ BEST         │
└──────────────┘ └──────────────┘
 스프링 코트       데님 팬츠
 ~~80,000원~~      59,000원
 30% 56,000원      59,000원

               [더 보기]
```

#### 컴포넌트 구조

```tsx
// 파일: client-app/src/components/home/PopularProductsSection.tsx (신규)
// 기존 ProductCard.tsx 재사용

interface PopularProductsSectionProps {
  products: PopularProduct[];
  isLoading?: boolean;
  onViewMore?: () => void;
}

interface PopularProduct {
  id: string;
  name: string;
  price: number;
  originalPrice?: number;
  imageUrl: string;
  discountRate?: number;
  isNew?: boolean;
  soldCount?: number; // 신규: 판매수 표시용
  rank?: number; // 신규: 순위 뱃지용
}

// 레이아웃: 기존 "지난 추천 상품"과 동일한 grid 패턴 사용
// - 첫 번째: grid-column: 1 / -1 (전체 너비)
// - 나머지: 2열 그리드
```

#### CSS 클래스 매핑

```
영역                  클래스
────────────────────────────────────────────────────
섹션 컨테이너         px-4 mb-8
수직 바               w-1.5 h-7 rounded-full bg-gradient-to-b from-[#7928CA] to-[#FF4500]
섹션 타이틀           text-xl font-black
배지 (판매순)         px-2.5 py-1 text-xs font-bold bg-[#7928CA]/15 text-[#7928CA]
                      rounded-full border border-[#7928CA]/20
그리드                grid grid-cols-2 gap-3.5
첫번째 상품           [grid-column: 1 / -1] (인라인 style)
더보기 버튼           text-sm text-secondary-text hover:text-hot-pink transition-colors font-semibold
순위 뱃지 (선택)      absolute top-2.5 right-2.5 w-7 h-7 rounded-full bg-black/60
                      text-white text-xs font-black flex items-center justify-center
```

---

## 7. Tailwind CSS 매핑

### 7.1 CSS 변수 → Tailwind 클래스 대응표

Tailwind CSS 4.0 `@theme inline` 블록 정의 기준:

```
CSS 변수               Tailwind 클래스             사용 예
─────────────────────────────────────────────────────────────────
--color-hot-pink       bg-hot-pink / text-hot-pink   CTA, 가격, 강조
--color-hot-pink-dark  bg-hot-pink-dark              hover 상태
--color-primary-black  bg-primary-black              페이지 배경
--color-content-bg     bg-content-bg                 섹션 배경
--color-card-bg        bg-card-bg                    카드 배경
--color-primary-text   text-primary-text             본문
--color-secondary-text text-secondary-text           보조 정보
--color-border-color   border-border-color           구분선
--color-error          text-error / bg-error         에러, 할인율
--shadow-hot-pink      shadow-hot-pink               핑크 그림자
--radius-card          rounded-card (12px)           카드
--radius-button        rounded-button (8px)          버튼
--spacing-bottom-nav   pb-bottom-nav                 하단 여백
```

### 7.2 신규 Tailwind 유틸리티 (globals.css 추가)

```css
/* @theme inline 블록에 추가 권장 */
@theme inline {
  /* 기존 정의들 ... */

  /* 신규 추가 */
  --color-live-red: #ff3b30; /* LIVE 뱃지 */
  --color-purple-accent: #7928ca; /* 보조 브랜드 */
  --color-orange-accent: #ff4500; /* 그라디언트 3번째 */
}
```

### 7.3 공통 컴포넌트 클래스 패턴

```css
/* 섹션 헤더 수직 바 */
.section-bar-pink {
  @apply w-1.5 h-7 rounded-full bg-gradient-to-b from-hot-pink to-[#7928CA];
}
.section-bar-purple {
  @apply w-1.5 h-7 rounded-full bg-gradient-to-b from-[#7928CA] to-[#FF4500];
}

/* 섹션 헤더 텍스트 */
.section-title {
  @apply text-xl font-black;
}

/* 섹션 카운트 뱃지 */
.count-badge-pink {
  @apply px-2.5 py-1 text-xs font-bold bg-hot-pink/15 text-hot-pink rounded-full border border-hot-pink/20;
}

/* 상품 카드 기본 */
.product-card {
  @apply group cursor-pointer rounded-2xl overflow-hidden bg-card-bg border border-border-color
         shadow-card transition-all duration-300 hover:shadow-card-hover hover:-translate-y-1
         hover:border-hot-pink/40 active:scale-[0.98];
}

/* 수평 스크롤 컨테이너 */
.horizontal-scroll {
  @apply flex gap-4 overflow-x-auto scrollbar-none pb-2 -mx-4 px-4 snap-x snap-mandatory;
}
```

---

## 8. 반응형 브레이크포인트

### 8.1 현재 Dorami 전략 (Mobile-First PWA)

```
모바일 기본        max-width: 480px (사실상 모든 사용자)
PC (lg: 1024px+)  #main-content { max-width: 480px; margin: auto; }
                  → PC에서도 모바일 레이아웃 유지 (앱 프레임)

예외:
- .admin-layout    → max-width 해제 (관리자 페이지)
- .live-fullscreen → max-width 해제 (라이브 전용)
```

### 8.2 Tailwind 브레이크포인트 사용 가이드

```
sm (640px)   → 거의 사용 안 함 (480px 프레임 이내)
md (768px)   → 거의 사용 안 함
lg (1024px)  → admin, live 페이지에서만
xl (1280px)  → admin 대시보드 내부

메인페이지: 모든 레이아웃을 모바일(~480px) 기준으로 설계
```

### 8.3 Image 최적화 sizes

```tsx
// 현재 사용 패턴:
sizes = '(max-width: 768px) 50vw, 33vw'; // ProductCard
sizes = '(max-width: 768px) 100vw, 50vw'; // UpcomingLiveCard

// 480px 프레임 기준 권장:
sizes = '240px'; // 2열 그리드 (480px / 2 - gap)
sizes = '480px'; // 전체 너비 카드
sizes = '280px'; // 수평 스크롤 카드
```

---

## 9. Fashion Platform vs Dorami 차이점

### 9.1 색상 시스템 비교

```
항목                 Fashion Platform        Dorami
────────────────────────────────────────────────────
테마                 Light only              Light + Dark (CSS vars)
기본 배경색          흰색 (#FFFFFF)           CSS var (light: #F8F9FA, dark: #1A1A1A)
브랜드 강조색        미지정 (컴포넌트 내부)   Hot Pink (#FF007A) + 그라디언트
상태 색상            Tailwind 기본            커스텀 CSS var (iOS 스타일 dark)
카드 배경            흰색                    CSS var (테마 따름)
```

### 9.2 컴포넌트 구조 차이

```
Fashion Platform                Dorami
─────────────────────────────────────────────────
Radix UI (Dialog, Sheet 등)    자체 Modal, ConfirmDialog
MUI 테이블, 차트               자체 Table, 직접 SVG
react-router Link              Next.js Link
useState + props               Zustand + TanStack Query
Vite HMR                       Next.js Fast Refresh
```

### 9.3 변경이 필요한 부분

| 항목     | Fashion Platform        | Dorami 적용 방법                                                        |
| -------- | ----------------------- | ----------------------------------------------------------------------- |
| API 경로 | `/api/live/current`     | `/api/streaming/active`                                                 |
| 인기상품 | `/api/products/popular` | `/api/products/featured?sort=popular` 또는 신규 `/api/products/popular` |
| 방송특가 | `/api/live/deals`       | `/api/products/live-deals` (신규 구현 필요)                             |
| 라우팅   | `react-router` navigate | `useRouter()` from next/navigation                                      |
| 이미지   | `<img>`                 | `next/image` Image 컴포넌트                                             |
| 상태관리 | 설계만 있음             | Zustand + TanStack Query (이미 구현)                                    |
| 알림     | 미구현                  | `useNotifications()` 훅 (이미 구현)                                     |
| 다크모드 | 미지원                  | ThemeProvider + CSS vars (이미 구현)                                    |

### 9.4 기존 코드 재활용 가능 항목

| 컴포넌트                  | 재활용 가능 여부 | 변경 사항                  |
| ------------------------- | ---------------- | -------------------------- |
| `UpcomingLiveCard.tsx`    | ✅ 그대로 사용   | host 정보 Props 추가 가능  |
| `ProductCard.tsx`         | ✅ 그대로 사용   | 없음                       |
| `LiveCountdownBanner.tsx` | ⚠️ 확장 필요     | 실제 라이브 정보 표시 추가 |
| `Button.tsx`              | ✅ 그대로 사용   | 없음                       |
| `SearchBar.tsx`           | ✅ 그대로 사용   | 없음                       |
| `Footer.tsx`              | ✅ 그대로 사용   | 없음                       |
| `BottomTabBar.tsx`        | ✅ 그대로 사용   | 없음                       |

---

## 10. 신규 컴포넌트 정의

### 10.1 필요한 신규 컴포넌트 목록

```
컴포넌트 파일                              우선순위   설명
──────────────────────────────────────────────────────────────────
src/components/home/LiveHeroBanner.tsx    1 (최고)  라이브 히어로 배너
src/components/home/LiveExclusiveDeals.tsx 1 (최고)  방송특가 섹션
src/components/home/PopularProductsSection.tsx 2 (높음) 인기상품 섹션
src/components/home/LiveDealProductCard.tsx 2 (높음)  방송특가 카드 (compact)
src/components/home/SectionHeader.tsx     3 (중간)   공통 섹션 헤더
src/lib/hooks/queries/useMainPageData.ts  1 (최고)  TanStack Query 훅
```

### 10.2 SectionHeader 공통 컴포넌트

```tsx
// src/components/home/SectionHeader.tsx
interface SectionHeaderProps {
  title: string;
  count?: number;
  badge?: { label: string; color: 'pink' | 'purple' | 'red' | 'orange' };
  barColor?: 'pink-purple' | 'purple-orange';
  onViewMore?: () => void;
  viewMoreLabel?: string;
}

// 사용 예:
// <SectionHeader title="방송특가" badge={{ label: 'LIVE', color: 'red' }} barColor="pink-purple" />
// <SectionHeader title="라이브 인기상품" count={8} barColor="purple-orange" onViewMore={...} />
// <SectionHeader title="예정된 라이브" count={upcomingLives.length} barColor="pink-purple" />
```

### 10.3 useMainPageData 훅

```typescript
// src/lib/hooks/queries/useMainPageData.ts
import { useQuery } from '@tanstack/react-query';

export function useMainPageData() {
  const activeLive = useQuery({
    queryKey: ['streaming', 'active'],
    queryFn: () => fetch('/api/streaming/active').then((r) => r.json()),
    refetchInterval: 30_000, // 30초마다 갱신
  });

  const upcomingLives = useQuery({
    queryKey: ['streaming', 'upcoming'],
    queryFn: () => fetch('/api/streaming/upcoming?limit=4').then((r) => r.json()),
    refetchInterval: 60_000, // 1분마다 갱신
  });

  const liveDeals = useQuery({
    queryKey: ['products', 'live-deals'],
    queryFn: () => fetch('/api/products/live-deals').then((r) => r.json()),
    enabled: !!activeLive.data?.items?.length, // 라이브 있을 때만
    refetchInterval: 30_000,
  });

  const popularProducts = useQuery({
    queryKey: ['products', 'popular'],
    queryFn: () => fetch('/api/products/popular?limit=8').then((r) => r.json()),
    staleTime: 5 * 60_000, // 5분 캐시
  });

  return { activeLive, upcomingLives, liveDeals, popularProducts };
}
```

---

## 11. Migration 전략

### 11.1 우선순위 기반 구현 순서

#### Phase 1: 데이터 레이어 (백엔드 + API) — 1주

```
1. GET /api/products/live-deals   → 현재 라이브 상품 조회
2. GET /api/products/popular      → 판매순 인기상품 조회
3. GET /api/streaming/active      → 응답에 viewerCount, host 추가
4. GET /api/streaming/upcoming    → 응답에 description, host 추가
```

#### Phase 2: 신규 컴포넌트 구현 — 1-2주

```
1. SectionHeader.tsx              → 공통 섹션 헤더
2. LiveHeroBanner.tsx             → 라이브 배너 (실제 스트림 데이터 표시)
3. LiveDealProductCard.tsx        → 방송특가 전용 카드 (compact)
4. LiveExclusiveDeals.tsx         → 방송특가 섹션
5. PopularProductsSection.tsx     → 인기상품 섹션
6. useMainPageData.ts             → 통합 데이터 훅
```

#### Phase 3: 메인페이지 리팩토링 — 3-5일

```
1. app/page.tsx 업데이트
   - useMainPageData() 훅으로 데이터 통합
   - 섹션 순서: Hero → LiveBanner → LiveDeals → UpcomingLives → PopularProducts
   - 기존 "Weekly Pick" 배너 유지 (또는 제거 결정)
   - 기존 "지난 추천 상품" → "라이브 인기상품"으로 대체
```

### 11.2 페이지 레이아웃 최종 순서

```
┌────────────────────────────────┐
│  헤더 (로고 + 검색 + 알림)      │  ← 기존 유지
└────────────────────────────────┘

┌────────────────────────────────┐
│  라이브 히어로 배너             │  ← LiveHeroBanner (신규)
│  (현재 라이브 또는 카운트다운)  │    현재 LiveCountdownBanner 대체
└────────────────────────────────┘

┌────────────────────────────────┐
│  SocialProof                   │  ← 기존 유지
└────────────────────────────────┘

┌────────────────────────────────┐
│  방송특가 (Live Exclusive)     │  ← LiveExclusiveDeals (신규)
│  (라이브 없으면 숨김)           │
└────────────────────────────────┘

┌────────────────────────────────┐
│  곧 시작하는 라이브             │  ← 기존 UpcomingLives 유지
│  (수평 스크롤)                 │
└────────────────────────────────┘

┌────────────────────────────────┐
│  Weekly Pick 배너              │  ← 기존 유지 (선택 사항)
└────────────────────────────────┘

┌────────────────────────────────┐
│  라이브 인기상품                │  ← PopularProductsSection (신규)
│  (2열 그리드, 8개)              │    기존 "지난 추천 상품" 대체
└────────────────────────────────┘

┌────────────────────────────────┐
│  PushNotificationBanner        │  ← 기존 유지
└────────────────────────────────┘

┌────────────────────────────────┐
│  Footer + BottomTabBar         │  ← 기존 유지
└────────────────────────────────┘
```

### 11.3 기존 코드와의 병합 규칙

```
규칙 1: 기존 컴포넌트 파괴 금지
  → 기존 ProductCard, UpcomingLiveCard, Button 등은 그대로 유지
  → 신규 컴포넌트는 별도 파일로 추가

규칙 2: CSS Variables 우선
  → 모든 색상은 CSS 변수 또는 Tailwind @theme 클래스 사용
  → 인라인 #7928CA 등은 CSS var로 교체 (--purple-accent)

규칙 3: TanStack Query 통합
  → 모든 API 호출은 useMainPageData() 훅으로 통합
  → 기존 useEffect + fetch 패턴은 점진적으로 교체

규칙 4: 다크모드 보장
  → 모든 신규 컴포넌트는 CSS var 색상 사용 (다크모드 자동 지원)
  → 하드코딩 색상 사용 시 dark: prefix 클래스 추가

규칙 5: 에러/로딩/빈 상태 필수
  → 각 섹션은 반드시 3가지 상태 UI 구현
  → Skeleton (animate-shimmer 활용)
  → 빈 상태 (EmptyState 컴포넌트 또는 인라인)
  → 에러 상태 (retry 버튼 포함)
```

### 11.4 Radix UI / Material UI 도입 결정

Fashion Platform의 Radix UI + MUI는 **도입하지 않는 것을 권장**:

```
이유:
1. Dorami는 이미 자체 UI 컴포넌트 체계 구축 완료
   (Button, Input, Modal, Table, Card, Skeleton 등)
2. 번들 사이즈 증가 위험
   - Radix UI 전체: ~50KB gzip 추가
   - MUI: ~100KB gzip 추가
3. React 19 호환성 검증 필요 (Radix UI, MUI의 React 19 지원 확인 필요)
4. 중복 컴포넌트 충돌 가능성
   (e.g., 자체 Button vs Radix Button)

대안: 필요 시 개별 Radix 패키지만 선택적 설치
  - @radix-ui/react-dialog: Modal 교체 시
  - @radix-ui/react-select: Select 교체 시
  → 전체 세트 복사 X, 필요한 것만 점진적 추가
```

---

## 요약

### 핵심 디자인 원칙

1. **Hot Pink 중심**: `#FF007A`이 모든 강조의 시작점
2. **그라디언트 브랜딩**: `hot-pink → #7928CA → #FF4500` 3색 그라디언트
3. **Dark Mode 지원**: CSS 변수로 자동 전환
4. **모바일 퍼스트**: 480px 프레임, 터치 최적화
5. **Pretendard 폰트**: font-black(900)으로 강한 인상
6. **애니메이션**: 섬세한 hover, stagger-fade, pulse 효과

### 4개 섹션 구현 요약

| 섹션            | 파일                         | 상태        | API                            |
| --------------- | ---------------------------- | ----------- | ------------------------------ |
| 라이브 배너     | `LiveHeroBanner.tsx`         | 신규 구현   | `GET /api/streaming/active`    |
| 방송특가        | `LiveExclusiveDeals.tsx`     | 신규 구현   | `GET /api/products/live-deals` |
| 곧 시작 라이브  | `UpcomingLiveCard.tsx`       | 기존 + 확장 | `GET /api/streaming/upcoming`  |
| 라이브 인기상품 | `PopularProductsSection.tsx` | 신규 구현   | `GET /api/products/popular`    |

---

**분석 완료**: 2026-02-28
**다음 단계**: executor 에이전트에 의한 컴포넌트 구현
