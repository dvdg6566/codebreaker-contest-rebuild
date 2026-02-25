# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
bun dev          # Start dev server with HMR (http://localhost:5173)
bun run build    # Production build
bun start        # Run production server
bun run typecheck # Type generation + TypeScript check
```

## Architecture

This is a React Router 7 application with server-side rendering enabled.

**Tech Stack:**
- React 19 + React Router 7 (SSR mode)
- TailwindCSS 4 (via Vite plugin)
- TypeScript with strict mode
- Vite for bundling
- shadcn/ui components (Radix UI primitives)
- TanStack Table for data tables
- Lucide React for icons

**Key Files:**
- `app/routes.ts` - Route configuration (uses programmatic routing, not file-based)
- `app/root.tsx` - Root layout with HTML shell and error boundary
- `app/routes/layout.tsx` - App layout with sidebar
- `react-router.config.ts` - SSR/SPA toggle (`ssr: true` by default)

**Path Alias:** `~/*` maps to `./app/*`

**Route Types:** React Router generates types in `.react-router/types/`. Route modules import types from `./+types/<route-name>` for type-safe loaders, actions, and meta functions.

## Project Structure

```
app/
├── components/
│   ├── layout/           # Layout components (AppSidebar, AppLayout, Breadcrumbs)
│   ├── ui/               # shadcn/ui base components
│   └── admin/            # Admin-specific components
├── hooks/                # Custom React hooks
├── lib/                  # Utility functions (cn, etc.)
└── routes/               # Route components
    └── admin/            # Admin route pages
```

## Design System

**Visual Style:** Modern minimal aesthetic (Timeco-inspired)

### Color Palette
- **Primary Accent:** Emerald `#10B981` (green/mint for active states, CTAs)
- **Secondary:** Violet `#8B5CF6` (avatar backgrounds)
- **Background:** Gray-50 `#F9FAFB` (page backgrounds)
- **Surface:** White `#FFFFFF` (cards/content areas)
- **Text Primary:** Gray-900 `#111827`
- **Text Secondary:** Gray-500 `#6B7280`
- **Border:** Gray-200 `#E5E7EB`

### Status Colors
- **Active/Success:** Green `#10B981` bg `#D1FAE5`
- **Inactive:** Gray `#6B7280` bg `#F3F4F6`
- **Warning/Partial:** Amber `#F59E0B` bg `#FEF3C7`
- **Error:** Red `#EF4444` bg `#FEE2E2`

### Component Patterns
- Border radius: `rounded-lg` to `rounded-xl` (8-12px)
- Shadows: Subtle `shadow-sm` for cards
- Whitespace: Generous padding (p-4 to p-6)
- Collapsible sidebar with icons + text
- Data tables with sorting, filtering, pagination
- Avatars with purple gradient fallback initials
- Status badges with colored backgrounds

### UI Components
All UI components are in `app/components/ui/` and follow shadcn/ui patterns:
- `button.tsx` - Button with variants (default, destructive, outline, secondary, ghost, link)
- `badge.tsx` - Badge with variants including success, warning, inactive
- `card.tsx` - Card with header, content, footer sections
- `data-table.tsx` - TanStack Table wrapper with search, pagination
- `sidebar.tsx` - Collapsible sidebar navigation
- `avatar.tsx` - Avatar with image and fallback initials
- `status-badge.tsx` - Status indicator (active, inactive, pending, error)
- `score-badge.tsx` - Contest score verdicts (AC, WA, TLE, etc.)
- `user-avatar.tsx` - User avatar with optional name/email display

## AWS WebSocket Infrastructure

Real-time notifications use AWS API Gateway WebSocket with Step Functions for parallel broadcasting.

### Components
- **DynamoDB Table** (`{judgeName}-websocket`): Stores active connections
  - `connectionId` (PK), `username`, `accountRole` ('admin'|'member'), `expiryTime` (TTL)
  - **GSI**: `accountRoleUsernameIndex` (PK: `accountRole`, SK: `username`) for efficient queries
- **websocket-connections Lambda**: Handles $connect/$disconnect/message routes, manages DynamoDB
- **websocket-invoke Lambda**: Posts messages to batched connectionIds via API Gateway
- **websocket Step Function** (`{judgeName}-websocket`): Parallel executor for websocket-invoke

### Broadcast Functions (websocket-broadcast.server.ts)
- `announce()`: Scan all connections, notify everyone
- `postClarification()`: Query GSI for `accountRole='admin'`, notify admins
- `answerClarification(role, username)`: Query GSI for specific user, notify them

### Broadcast Flow
1. Query/Scan DynamoDB for connectionIds
2. Batch into groups of 100
3. Start Step Function with array: `[{notificationType, connectionIds}, ...]`
4. Step Function invokes websocket-invoke Lambda for each batch (up to 1000 concurrent)

### Environment Variables
- `AWS_REGION`: ap-southeast-1
- `JUDGE_NAME`: e.g., codebreakercontest01
- `AWS_ACCOUNT_ID`: 927878278795

### IAM Permissions Required
- `dynamodb:Scan` on `{judgeName}-websocket` table
- `dynamodb:Query` on `{judgeName}-websocket/index/accountRoleUsernameIndex`
- `states:StartExecution` on `arn:aws:states:{region}:{account}:stateMachine:{judgeName}-websocket`
