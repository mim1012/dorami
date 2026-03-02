# Live Commerce Fashion Platform → Dorami Integration Analysis

**Date**: 2026-02-28
**Status**: Pre-Integration Analysis
**Scope**: Identifying conflicts before porting components/designs

---

## Executive Summary

The **Live Commerce Fashion Platform** is a **Figma-generated design prototype** (Vite SPA, React 18, shadcn/ui, react-router). The **dorami project** is a **production live commerce MVP** (Next.js 16, React 19, custom components, App Router, real backend).

**Key Finding**: These projects have **fundamentally incompatible architectures** (SPA vs SSR/App Router). Integration requires **design extraction** (reusing visual components/styles), NOT codebase merging. The Fashion Platform's backend/routing code is not reusable.

**Estimated effort**: 2-4 weeks for visual design adoption (minimal backend work) vs. 2+ months for full feature integration with new backend APIs.

---

## 🚨 CRITICAL CONFLICTS (Blocking)

### 1. **React Version Mismatch: 18 vs 19**

- Fashion Platform: `react@18.3.1` (peerDependencies)
- dorami: `react@^19.0.0`
- **Issue**: React 19 has breaking changes; Fashion Platform components must be upgraded
- **Action**: Verify each imported component against React 19 compatibility before use

### 2. **Routing Architecture: SPA vs App Router**

- Fashion Platform: `react-router@7` (client-side SPA routing)
- dorami: Next.js 16 App Router (file-system SSR routing)
- **Issue**: All routing code is incompatible. Every `Link`, `NavLink`, `Outlet`, `useNavigate` must be rewritten
- **Action**: Extract visual components only; recreate page structure using dorami's App Router

### 3. **CSS Variable System Collision**

- Fashion Platform: shadcn/ui convention (`--background`, `--foreground`, `--primary`, `--card`, `--accent`, `--muted` using `oklch()` color space)
- dorami: Custom system (`--primary-black`, `--content-bg`, `--hot-pink`, using hex/rgb)
- **Issue**: Running both systems simultaneously breaks styling on all pages
- **Action**: Choose ONE variable system before migration. Recommended: **keep dorami's existing system** (production-tested), remap Fashion Platform components to use dorami tokens

---

## ⚠️ MEDIUM CONFLICTS (Require Decisions)

### 4. **Color Design Mismatch**

| System           | Primary Pink             | Accent               | Dark BG            |
| ---------------- | ------------------------ | -------------------- | ------------------ |
| Fashion Platform | `#FF4D8D` (warm)         | `#B084CC` (lavender) | oklch-based        |
| dorami           | `#FF007A` (electric/hot) | None                 | `#0A0A0A` (custom) |

- **Decision needed**: Unify on single pink color and decide if lavender becomes secondary accent
- **Recommendation**: Keep `#FF007A` (dorami's brand). Evaluate `#B084CC` as optional accent

### 5. **Component Library Duplication**

Fashion Platform has **36 shadcn/ui components** that dorami is missing:

- Overlapping (Button, Card, Modal, Table, Select, Skeleton, Pagination)
- Unique (Accordion, Avatar, Badge, Calendar, Carousel, Chart, Command, Drawer, Form, etc.)

- **Decision needed**: Adopt shadcn/ui as dorami's standard component library?
- **Recommendation**: YES. Adopt shadcn/ui pattern (Radix UI + Tailwind classes), restyle to use dorami tokens. Migrate existing custom components gradually.

### 6. **Carousel/Slider Library**

- Fashion Platform: `embla-carousel`, `react-slick`, `slick-carousel` (THREE libraries -- redundant)
- dorami: Custom scroll-based components
- **Recommendation**: Standardize on `embla-carousel-react` only (modern, SSR-compatible)

### 7. **Animation Library**

- Fashion Platform: `motion@12.23.24` (Framer Motion successor, 40KB+ gzipped)
- dorami: Custom CSS-only animations
- **Recommendation**: Keep CSS-only for simple transitions. Adopt `motion` only for Fashion Platform's specific animations (evaluate case-by-case)

### 8. **API Specification Gap**

Fashion Platform assumes these APIs (DO NOT EXIST in dorami backend):

- `GET /api/live/current` — current live stream
- `GET /api/live/deals` — live exclusive deals
- `GET /api/live/upcoming` — scheduled streams
- `GET /api/products/popular` — popular/trending products
- `POST /api/products/{productId}/like` — wishlist
- `POST /api/live/notifications/{liveId}` — per-live notifications

**Important**: Fashion Platform UI is entirely **static/mock** -- no real API calls exist. It's a design prototype.

- **Decision needed**: Which Fashion Platform features require backend development? Which are out of MVP scope?

### 9. **Data Model Extensions**

Fashion Platform's `Product` includes fields dorami's schema lacks:

- `sizes`, `colors` (variants system)
- `rating`, `reviewCount` (review system)
- `livePrice` (separate from regular price)
- `soldCount` (sales metrics)
- `isLiked` (wishlist)
- `tags` (categorization)
- Multi-host support (`hostId`, `hostName`)

- **Decision needed**: Which new fields are in scope? Backend schema changes required.

---

## ✅ MINOR DIFFERENCES (Easy to Handle)

### 10. **Tailwind CSS Version Difference**

- Fashion Platform: `4.1.12`, dorami: `^4.0.0` (resolves to 4.1.18)
- **Status**: Compatible. Both use Tailwind v4 `@theme inline` syntax

### 11. **Icon Library**

- Fashion Platform: `lucide-react@0.487.0` only
- dorami: `lucide-react@^0.563.0` + `@heroicons/react@^2.2.0`
- **Recommendation**: Standardize on `lucide-react` (latest), remove `@heroicons`

### 12. **DnD Library**

- Fashion Platform: `react-dnd` (used for admin drag-reordering)
- dorami: `@dnd-kit` (already in use)
- **Recommendation**: Keep `@dnd-kit`, reimplement Fashion Platform's drag features with it

### 13. **Font System**

- Fashion Platform: No custom fonts (uses system defaults)
- dorami: Pretendard font (CDN loaded)
- **Status**: No conflict. dorami's Pretendard will apply

---

## 🔴 Edge Cases & Gotchas

1. **CSS variable collision**: Importing Fashion Platform's `theme.css` globally overrides dorami's body styles
2. **Radix UI z-index conflicts**: Both projects use `z-50` portals (dialogs will overlap)
3. **SSR hydration issues**: `motion` library features can cause hydration mismatches in Next.js
4. **Mobile constraint conflict**: Fashion Platform admin uses 240px fixed sidebar; dorami's mobile frame is 480px max (50% conflict)
5. **`window`/`document` at module scope**: Some Fashion Platform components may not be SSR-safe without `"use client"` directives

---

## 📋 Action Items & Decisions Needed

### PHASE 0: Clarify Scope (MUST DO FIRST)

- [ ] **Integration goal**: Visual design adoption only, or full feature merge with backend?
- [ ] **In-scope pages**: Which Fashion Platform pages are MVP targets? (MainPage? All 9 admin pages? User-facing only?)
- [ ] **Backend work**: Are new Fashion Platform APIs (deals, popular products, wishlist, etc.) in scope?
- [ ] **Admin page strategy**: Replace dorami's existing admin pages with Fashion Platform's designs, or supplement only?

### PHASE 1: Design System Unification

- [ ] **Settle primary pink**: `#FF007A` (dorami) or `#FF4D8D` (Fashion Platform)?
- [ ] **Decide on lavender**: Add `#B084CC` as secondary accent, or stick with monochromatic pink?
- [ ] **CSS variable strategy**: Adopt dorami's existing system, or migrate to shadcn/ui convention?
- [ ] **Document design tokens**: Create shared token file (colors, typography, spacing, shadows)

### PHASE 2: Component Library Strategy

- [ ] **Adopt shadcn/ui**: Add 36 missing components using Radix UI + Tailwind pattern
- [ ] **Add `cn()` utility**: Import Fashion Platform's `clsx` + `tailwind-merge` pattern
- [ ] **Remap component classes**: Convert shadcn CSS variable references to dorami tokens
- [ ] **React 19 compatibility audit**: Check each Radix package version for React 19 support

### PHASE 3: Visual Design Extraction

- [ ] **Port MainPage design**: Recreate Fashion Platform's homepage using dorami's App Router + TanStack Query
- [ ] **Port selected admin pages**: AnalyticsPage, HomeFeaturedProductsPage (new in dorami)
- [ ] **Verify mobile responsiveness**: Ensure 480px mobile constraint is respected
- [ ] **Test dark mode**: Verify Fashion Platform components work with dorami's dark mode palette

### PHASE 4: Backend Integration (If Approved)

- [ ] **Implement missing endpoints**: Popular products, live deals, upcoming lives, wishlist
- [ ] **Extend Product schema**: Add sizes, colors, ratings, tags, etc.
- [ ] **Write API tests**: Verify new endpoints with existing E2E test framework

### PHASE 5: Regression Testing

- [ ] **Run dorami's Playwright E2E tests**: Ensure existing features still pass
- [ ] **Test real API flows**: Live streaming, cart, checkout, chat, reservation, points
- [ ] **Performance audit**: Measure bundle size impact of new libraries
- [ ] **Mobile testing**: Test on 480px mobile frame constraint

---

## 📊 Comparison Matrix

| Aspect                | Fashion Platform          | dorami                | Decision                                |
| --------------------- | ------------------------- | --------------------- | --------------------------------------- |
| **Framework**         | Vite SPA                  | Next.js 16            | Use dorami's                            |
| **Router**            | react-router v7           | App Router            | Use dorami's                            |
| **React Version**     | 18.3.1                    | 19.x                  | Upgrade Fashion Platform components     |
| **CSS Variables**     | shadcn convention         | Custom system         | Adopt dorami's (remap Fashion Platform) |
| **Primary Pink**      | `#FF4D8D`                 | `#FF007A`             | Decide: unify on one                    |
| **Component Library** | shadcn/ui (36 components) | Custom (8 components) | Adopt shadcn/ui                         |
| **Icon Library**      | lucide-react              | lucide + heroicons    | Standardize on lucide-react             |
| **DnD Library**       | react-dnd                 | @dnd-kit              | Use dorami's                            |
| **Animation**         | motion + CSS              | CSS only              | Evaluate case-by-case                   |
| **Carousel**          | embla + react-slick       | Custom scroll         | Use embla-carousel                      |
| **API Status**        | Specification only        | Production            | Build Fashion Platform endpoints        |

---

## 🎯 Recommended Approach (If Proceeding)

### Strategy: "Design Extraction + Component Adoption"

1. **Keep dorami's architecture** (App Router, Next.js, backend APIs, real state management)
2. **Extract Fashion Platform's visual designs** (JSX structure, Tailwind classes, component patterns)
3. **Adopt shadcn/ui components** as dorami's standard component library
4. **Restyle Fashion Platform components** to use dorami's color tokens
5. **Connect new designs to real APIs** via TanStack Query (not mock data)
6. **Implement only new backend features** (Analytics, Featured Products management, optional: Wishlist, Popular products)

### Estimated Timeline (If Approved)

| Phase     | Work                                    | Estimate                        |
| --------- | --------------------------------------- | ------------------------------- |
| 0         | Clarify scope, design decisions         | 1-2 days                        |
| 1         | Design system unification               | 2-3 days                        |
| 2         | Component library setup, React 19 audit | 3-5 days                        |
| 3         | MainPage + selected admin pages         | 1-2 weeks                       |
| 4         | Backend endpoints (if approved)         | 1-2 weeks                       |
| 5         | Testing + regression verification       | 3-5 days                        |
| **Total** |                                         | **2-4 weeks** (MVP design only) |

If full backend feature integration (wishlist, ratings, sizing, etc.) is required: **add 2-3 weeks**.

---

## ❌ What NOT to Do

- ❌ Merge routing code from Fashion Platform (incompatible with App Router)
- ❌ Import Fashion Platform's `theme.css` globally (breaks dorami styles)
- ❌ Use three carousel libraries simultaneously (use embla-carousel only)
- ❌ Migrate Fashion Platform's state management code (use dorami's Zustand + TanStack Query)
- ❌ Replace dorami's existing functional admin pages with Fashion Platform's static mockups (supplement only)
- ❌ Add `motion` library without evaluating bundle size impact first

---

## References

- Fashion Platform location: `C:\Users\PC_1M\Documents\카카오톡 받은 파일\Live Commerce Fashion Platform`
- dorami CLAUDE.md: `D:\Project\dorami\CLAUDE.md`
- dorami research doc: `docs/research.md`
- dorami Playwright tests: `backend/test/` + `client-app/e2e/`

---

**Next Step**: Schedule alignment meeting to make decisions on scope (Phase 0). Clarify which items are MVP vs. future roadmap.
