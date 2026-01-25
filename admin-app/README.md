# Admin Dashboard - Live Commerce Platform

관리자 대시보드 애플리케이션 (Next.js 16 + React 19)

## Tech Stack

- **Framework**: Next.js 16.1.0 with Turbopack
- **React**: 19.0.0
- **Language**: TypeScript 5.7+ (strict mode)
- **Styling**: Tailwind CSS 4.0
- **State Management**: Zustand 5.0
- **Server State**: TanStack Query v5
- **Forms**: React Hook Form + Zod
- **Real-time**: Socket.IO Client 4.8
- **Admin Tools**: React Datepicker, ExcelJS

## Getting Started

### Prerequisites

- Node.js 20+
- npm 10+

### Installation

```bash
# Install dependencies (from project root)
npm install

# Copy environment variables
cp .env.example .env.local
```

### Development

```bash
# Run development server (port 3002)
npm run dev

# Type checking
npm run type-check

# Build for production
npm run build
```

## Environment Variables

Copy `.env.example` to `.env.local` and configure:

- `NEXT_PUBLIC_API_URL`: Backend API endpoint (default: http://localhost:3001)
- `NEXT_PUBLIC_WS_URL`: WebSocket endpoint (default: ws://localhost:3001)

## Project Structure

```
admin-app/
├── src/
│   ├── app/              # App Router pages
│   ├── components/       # Reusable components
│   ├── features/         # Feature-based modules
│   ├── lib/              # Utilities and helpers
│   └── types/            # TypeScript type definitions
├── public/               # Static assets
└── package.json
```

## Design System

### Colors
- Hot Pink: `#FF007A` (Primary accent)
- Primary Black: `#121212` (Background)
- Content BG: `#1E1E1E` (Cards, panels)
- Primary Text: `#FFFFFF`
- Secondary Text: `#A0A0A0`
- Success: `#34C759`
- Error: `#FF3B30`

### Typography
- Font: Pretendard (via CDN)
- Display: 28px / Bold
- H1: 22px / Bold
- H2: 18px / SemiBold
- Body: 16px / Regular
- Caption: 14px / Medium

## Development Guidelines

- Use TypeScript strict mode
- Follow feature-based organization
- Co-locate tests with source files
- Use `/lib` for utilities (not `/utils`)
- Components in PascalCase
- Functions/variables in camelCase

## Port Configuration

- Admin App: `3002`
- Client App: `3000`
- Backend API: `3001`
