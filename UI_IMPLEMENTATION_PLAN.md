# SettleGrid Visual Overhaul — Implementation Plan

**Current score: 8.2/10 | Target: 10/10**
**Codebase: Next.js 15, Tailwind CSS v4, shadcn/ui, Recharts, Outfit font**
**Existing tests: ~2,037 (110 files) — ALL must pass after every change**

---

## Table of Contents

- [Phase 1: Foundation (Dependencies + Design Tokens)](#phase-1-foundation)
- [Phase 2: Dashboard Enhancement](#phase-2-dashboard-enhancement)
- [Phase 3: Marketing Page Polish](#phase-3-marketing-page-polish)
- [Phase 4: Dark Mode](#phase-4-dark-mode)
- [Phase 5: Advanced Interactions](#phase-5-advanced-interactions)
- [Phase 6: Uncovered Pages & Research Gaps](#phase-6-uncovered-pages--research-gaps)

---

## Phase 1: Foundation

**Goal:** Install dependencies, expand design tokens, add shadcn components that later phases depend on.

### Step 1.1 — Install framer-motion and next-themes

**File:** `apps/web/package.json`
**Complexity:** 1
**Impact:** Enables animations (Phase 3, 5) and dark mode (Phase 4)

```bash
cd apps/web && npm install framer-motion next-themes
```

Dependencies added:
- `framer-motion` (~30KB gzipped, used for scroll reveal, number counting, page transitions)
- `next-themes` (~2KB, handles system/dark/light preference with zero flash)

No code changes needed yet — these are consumed in later steps.

### Step 1.2 — Expand CSS design tokens for theming

**File:** `apps/web/src/app/globals.css`
**Complexity:** 2
**Impact:** Centralizes all color/spacing values, enables dark mode in Phase 4

Replace the entire file with:

```css
@import "tailwindcss";

@theme {
  /* ---- Brand ---- */
  --color-brand: #10B981;
  --color-brand-dark: #059669;
  --color-brand-light: #34D399;
  --color-brand-text: #047857;
  --color-emerald-light: #D1FAE5;

  /* ---- Neutrals ---- */
  --color-indigo: #1A1F3A;
  --color-indigo-light: #2A2F4A;
  --color-cloud: #F8FAFB;

  /* ---- Chart palette (6 colors for Recharts) ---- */
  --color-chart-1: #10B981;  /* emerald — primary metric */
  --color-chart-2: #0EA5E9;  /* sky — secondary metric */
  --color-chart-3: #F59E0B;  /* amber — warning / third metric */
  --color-chart-4: #EF4444;  /* red — error / negative */
  --color-chart-5: #8B5CF6;  /* violet — auxiliary */
  --color-chart-6: #6B7280;  /* gray — neutral / previous period */

  /* ---- Semantic (light mode defaults) ---- */
  --color-surface: #FFFFFF;
  --color-surface-secondary: #F8FAFB;
  --color-border: #E5E7EB;
  --color-border-hover: rgba(16, 185, 129, 0.4);
  --color-text-primary: #1A1F3A;
  --color-text-secondary: #6B7280;
  --color-text-muted: #9CA3AF;

  /* ---- Typography ---- */
  --font-sans: 'Outfit', system-ui, sans-serif;

  /* ---- Shadows ---- */
  --shadow-card: 0 1px 3px 0 rgba(0, 0, 0, 0.06), 0 1px 2px -1px rgba(0, 0, 0, 0.06);
  --shadow-card-hover: 0 4px 12px -2px rgba(0, 0, 0, 0.08), 0 2px 4px -2px rgba(0, 0, 0, 0.04);

  /* ---- Radius ---- */
  --radius-sm: 0.375rem;
  --radius-md: 0.5rem;
  --radius-lg: 0.75rem;
  --radius-xl: 1rem;
}
```

**What changed:** Added chart palette (6 colors), semantic surface/border/text tokens, shadow tokens, and radius tokens. All existing `text-indigo`, `bg-brand`, `bg-cloud`, etc. continue to work because the original token names are preserved.

### Step 1.3 — Add shadcn Skeleton component

**File:** `apps/web/src/components/ui/skeleton.tsx` (NEW)
**Complexity:** 1
**Impact:** Proper loading states for dashboard (Phase 2)

```tsx
import { cn } from '@/lib/utils'

function Skeleton({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn('animate-pulse rounded-md bg-gray-200', className)}
      {...props}
    />
  )
}

export { Skeleton }
```

### Step 1.4 — Add shadcn Tooltip component

**File:** `apps/web/src/components/ui/tooltip.tsx` (NEW)
**Complexity:** 2
**Impact:** Replaces CSS-only hover tooltips on charts with accessible, positioned tooltips

```bash
cd apps/web && npm install @radix-ui/react-tooltip
```

```tsx
'use client'

import * as React from 'react'
import * as TooltipPrimitive from '@radix-ui/react-tooltip'
import { cn } from '@/lib/utils'

const TooltipProvider = TooltipPrimitive.Provider

const Tooltip = TooltipPrimitive.Root

const TooltipTrigger = TooltipPrimitive.Trigger

const TooltipContent = React.forwardRef<
  React.ComponentRef<typeof TooltipPrimitive.Content>,
  React.ComponentPropsWithoutRef<typeof TooltipPrimitive.Content>
>(({ className, sideOffset = 4, ...props }, ref) => (
  <TooltipPrimitive.Portal>
    <TooltipPrimitive.Content
      ref={ref}
      sideOffset={sideOffset}
      className={cn(
        'z-50 overflow-hidden rounded-md bg-indigo px-3 py-1.5 text-xs text-white shadow-md',
        'animate-in fade-in-0 zoom-in-95 data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=closed]:zoom-out-95',
        'data-[side=bottom]:slide-in-from-top-2 data-[side=left]:slide-in-from-right-2 data-[side=right]:slide-in-from-left-2 data-[side=top]:slide-in-from-bottom-2',
        className
      )}
      {...props}
    />
  </TooltipPrimitive.Portal>
))
TooltipContent.displayName = TooltipPrimitive.Content.displayName

export { Tooltip, TooltipTrigger, TooltipContent, TooltipProvider }
```

### Step 1.5 — Add shadcn DropdownMenu component

**File:** `apps/web/src/components/ui/dropdown-menu.tsx` (NEW)
**Complexity:** 2
**Impact:** Used for theme toggle (Phase 4), period selector (Phase 2), and user menu

```bash
cd apps/web && npm install @radix-ui/react-dropdown-menu
```

```tsx
'use client'

import * as React from 'react'
import * as DropdownMenuPrimitive from '@radix-ui/react-dropdown-menu'
import { cn } from '@/lib/utils'

const DropdownMenu = DropdownMenuPrimitive.Root
const DropdownMenuTrigger = DropdownMenuPrimitive.Trigger
const DropdownMenuGroup = DropdownMenuPrimitive.Group

const DropdownMenuContent = React.forwardRef<
  React.ComponentRef<typeof DropdownMenuPrimitive.Content>,
  React.ComponentPropsWithoutRef<typeof DropdownMenuPrimitive.Content>
>(({ className, sideOffset = 4, ...props }, ref) => (
  <DropdownMenuPrimitive.Portal>
    <DropdownMenuPrimitive.Content
      ref={ref}
      sideOffset={sideOffset}
      className={cn(
        'z-50 min-w-[8rem] overflow-hidden rounded-md border border-gray-200 bg-white p-1 shadow-md',
        'data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95',
        className
      )}
      {...props}
    />
  </DropdownMenuPrimitive.Portal>
))
DropdownMenuContent.displayName = DropdownMenuPrimitive.Content.displayName

const DropdownMenuItem = React.forwardRef<
  React.ComponentRef<typeof DropdownMenuPrimitive.Item>,
  React.ComponentPropsWithoutRef<typeof DropdownMenuPrimitive.Item> & { inset?: boolean }
>(({ className, inset, ...props }, ref) => (
  <DropdownMenuPrimitive.Item
    ref={ref}
    className={cn(
      'relative flex cursor-default select-none items-center rounded-sm px-2 py-1.5 text-sm outline-none transition-colors focus:bg-gray-100 focus:text-indigo data-[disabled]:pointer-events-none data-[disabled]:opacity-50',
      inset && 'pl-8',
      className
    )}
    {...props}
  />
))
DropdownMenuItem.displayName = DropdownMenuPrimitive.Item.displayName

const DropdownMenuSeparator = React.forwardRef<
  React.ComponentRef<typeof DropdownMenuPrimitive.Separator>,
  React.ComponentPropsWithoutRef<typeof DropdownMenuPrimitive.Separator>
>(({ className, ...props }, ref) => (
  <DropdownMenuPrimitive.Separator
    ref={ref}
    className={cn('-mx-1 my-1 h-px bg-gray-200', className)}
    {...props}
  />
))
DropdownMenuSeparator.displayName = DropdownMenuPrimitive.Separator.displayName

export {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuGroup,
}
```

### Step 1.6 — Add shadcn Tabs component

**File:** `apps/web/src/components/ui/tabs.tsx` (NEW)
**Complexity:** 2
**Impact:** Tab-based section organization for analytics page (Phase 2)

```bash
cd apps/web && npm install @radix-ui/react-tabs
```

```tsx
'use client'

import * as React from 'react'
import * as TabsPrimitive from '@radix-ui/react-tabs'
import { cn } from '@/lib/utils'

const Tabs = TabsPrimitive.Root

const TabsList = React.forwardRef<
  React.ComponentRef<typeof TabsPrimitive.List>,
  React.ComponentPropsWithoutRef<typeof TabsPrimitive.List>
>(({ className, ...props }, ref) => (
  <TabsPrimitive.List
    ref={ref}
    className={cn(
      'inline-flex h-10 items-center justify-center rounded-md bg-gray-100 p-1 text-gray-500',
      className
    )}
    {...props}
  />
))
TabsList.displayName = TabsPrimitive.List.displayName

const TabsTrigger = React.forwardRef<
  React.ComponentRef<typeof TabsPrimitive.Trigger>,
  React.ComponentPropsWithoutRef<typeof TabsPrimitive.Trigger>
>(({ className, ...props }, ref) => (
  <TabsPrimitive.Trigger
    ref={ref}
    className={cn(
      'inline-flex items-center justify-center whitespace-nowrap rounded-sm px-3 py-1.5 text-sm font-medium ring-offset-white transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 data-[state=active]:bg-white data-[state=active]:text-indigo data-[state=active]:shadow-sm',
      className
    )}
    {...props}
  />
))
TabsTrigger.displayName = TabsPrimitive.Trigger.displayName

const TabsContent = React.forwardRef<
  React.ComponentRef<typeof TabsPrimitive.Content>,
  React.ComponentPropsWithoutRef<typeof TabsPrimitive.Content>
>(({ className, ...props }, ref) => (
  <TabsPrimitive.Content
    ref={ref}
    className={cn(
      'mt-2 ring-offset-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2',
      className
    )}
    {...props}
  />
))
TabsContent.displayName = TabsPrimitive.Content.displayName

export { Tabs, TabsList, TabsTrigger, TabsContent }
```

### Step 1.7 — Add shadcn Dialog component

**File:** `apps/web/src/components/ui/dialog.tsx` (NEW)
**Complexity:** 2
**Impact:** Modal dialogs for command palette (Phase 5) and confirmation prompts

```bash
cd apps/web && npm install @radix-ui/react-dialog
```

```tsx
'use client'

import * as React from 'react'
import * as DialogPrimitive from '@radix-ui/react-dialog'
import { cn } from '@/lib/utils'

const Dialog = DialogPrimitive.Root
const DialogTrigger = DialogPrimitive.Trigger
const DialogClose = DialogPrimitive.Close

const DialogPortal = DialogPrimitive.Portal

const DialogOverlay = React.forwardRef<
  React.ComponentRef<typeof DialogPrimitive.Overlay>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Overlay>
>(({ className, ...props }, ref) => (
  <DialogPrimitive.Overlay
    ref={ref}
    className={cn(
      'fixed inset-0 z-50 bg-black/50 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0',
      className
    )}
    {...props}
  />
))
DialogOverlay.displayName = DialogPrimitive.Overlay.displayName

const DialogContent = React.forwardRef<
  React.ComponentRef<typeof DialogPrimitive.Content>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Content>
>(({ className, children, ...props }, ref) => (
  <DialogPortal>
    <DialogOverlay />
    <DialogPrimitive.Content
      ref={ref}
      className={cn(
        'fixed left-[50%] top-[50%] z-50 grid w-full max-w-lg translate-x-[-50%] translate-y-[-50%] gap-4 border border-gray-200 bg-white p-6 shadow-lg duration-200 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95 data-[state=closed]:slide-out-to-left-1/2 data-[state=closed]:slide-out-to-top-[48%] data-[state=open]:slide-in-from-left-1/2 data-[state=open]:slide-in-from-top-[48%] sm:rounded-lg',
        className
      )}
      {...props}
    >
      {children}
    </DialogPrimitive.Content>
  </DialogPortal>
))
DialogContent.displayName = DialogPrimitive.Content.displayName

const DialogHeader = ({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) => (
  <div className={cn('flex flex-col space-y-1.5 text-center sm:text-left', className)} {...props} />
)

const DialogTitle = React.forwardRef<
  React.ComponentRef<typeof DialogPrimitive.Title>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Title>
>(({ className, ...props }, ref) => (
  <DialogPrimitive.Title
    ref={ref}
    className={cn('text-lg font-semibold leading-none tracking-tight', className)}
    {...props}
  />
))
DialogTitle.displayName = DialogPrimitive.Title.displayName

const DialogDescription = React.forwardRef<
  React.ComponentRef<typeof DialogPrimitive.Description>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Description>
>(({ className, ...props }, ref) => (
  <DialogPrimitive.Description
    ref={ref}
    className={cn('text-sm text-gray-500', className)}
    {...props}
  />
))
DialogDescription.displayName = DialogPrimitive.Description.displayName

export {
  Dialog,
  DialogPortal,
  DialogOverlay,
  DialogClose,
  DialogTrigger,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
}
```

### Step 1.8 — Install all Radix dependencies in one command

**Complexity:** 1
**Impact:** Ensures all Phase 1 deps are in place

Run this single command to install everything at once:

```bash
cd /Users/lex/settlegrid/apps/web && npm install framer-motion next-themes @radix-ui/react-tooltip @radix-ui/react-dropdown-menu @radix-ui/react-tabs @radix-ui/react-dialog cmdk
```

This adds 7 packages. `cmdk` is for the command palette in Phase 5 — install now to avoid a second install pass.

---

## Phase 2: Dashboard Enhancement

**Goal:** Replace CSS bar charts with Recharts, upgrade StatCard, add skeleton loading, add breadcrumbs.

### Step 2.1 — Create shared StatCard component with trend support

**File:** `apps/web/src/components/ui/stat-card.tsx` (NEW)
**Complexity:** 3
**Impact:** Consistent KPI cards across all 11 dashboard pages with trend arrows and optional sparklines

Currently, StatCard is duplicated in 5+ page files as a local function. Extract it into a shared component and add trend support.

```tsx
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { cn } from '@/lib/utils'

interface StatCardProps {
  title: string
  value: string
  subtitle?: string
  /** Percentage change: positive = up (green), negative = down (red), 0 or undefined = no arrow */
  trend?: number
  /** 'danger' makes the value red regardless of trend */
  variant?: 'default' | 'danger'
}

export function StatCard({ title, value, subtitle, trend, variant }: StatCardProps) {
  const showTrend = trend !== undefined && trend !== 0

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-medium text-gray-500">{title}</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="flex items-baseline gap-2">
          <span className={cn(
            'text-3xl font-bold',
            variant === 'danger' ? 'text-red-600' : 'text-indigo'
          )}>
            {value}
          </span>
          {showTrend && (
            <span className={cn(
              'inline-flex items-center text-xs font-medium',
              trend > 0 ? 'text-green-600' : 'text-red-600'
            )}>
              <svg
                className={cn('w-3 h-3 mr-0.5', trend < 0 && 'rotate-180')}
                fill="none"
                viewBox="0 0 24 24"
                strokeWidth={2.5}
                stroke="currentColor"
              >
                <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 15.75l7.5-7.5 7.5 7.5" />
              </svg>
              {Math.abs(trend).toFixed(1)}%
            </span>
          )}
        </div>
        {subtitle && <p className="text-xs text-gray-500 mt-1">{subtitle}</p>}
      </CardContent>
    </Card>
  )
}
```

**Migration:** In each dashboard page that defines a local `StatCard`, replace the local definition with:
```tsx
import { StatCard } from '@/components/ui/stat-card'
```

Pages to update:
- `apps/web/src/app/(dashboard)/dashboard/page.tsx` — remove lines 28-40, add import
- `apps/web/src/app/(dashboard)/dashboard/analytics/page.tsx` — remove lines 42-54, add import
- `apps/web/src/app/(dashboard)/dashboard/health/page.tsx` — remove lines 42-54, add import
- `apps/web/src/app/(dashboard)/dashboard/fraud/page.tsx` — remove lines 23-35, add import (note: fraud's StatCard has `variant` prop, already handled)
- `apps/web/src/app/(dashboard)/dashboard/referrals/page.tsx` — remove local StatCard, add import

### Step 2.2 — Create Recharts AreaChart wrapper for revenue/invocation trends

**File:** `apps/web/src/components/charts/area-chart.tsx` (NEW)
**Complexity:** 3
**Impact:** Replaces CSS bar charts with smooth gradient-filled area charts with period comparison

```tsx
'use client'

import {
  AreaChart as RechartsAreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts'

interface AreaChartProps {
  data: Array<Record<string, string | number>>
  xKey: string
  yKey: string
  /** Optional second series for previous period comparison (dashed) */
  yKeyPrevious?: string
  height?: number
  color?: string
  formatValue?: (value: number) => string
  formatXAxis?: (value: string) => string
}

export function AreaChart({
  data,
  xKey,
  yKey,
  yKeyPrevious,
  height = 200,
  color = 'var(--color-chart-1)',
  formatValue = (v) => String(v),
  formatXAxis = (v) => v,
}: AreaChartProps) {
  if (!data || data.length === 0) {
    return (
      <div className="flex items-center justify-center text-gray-400 text-sm" style={{ height }}>
        No data available
      </div>
    )
  }

  return (
    <ResponsiveContainer width="100%" height={height}>
      <RechartsAreaChart data={data} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
        <defs>
          <linearGradient id={`gradient-${yKey}`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor={color} stopOpacity={0.2} />
            <stop offset="95%" stopColor={color} stopOpacity={0} />
          </linearGradient>
        </defs>
        <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" vertical={false} />
        <XAxis
          dataKey={xKey}
          axisLine={false}
          tickLine={false}
          tick={{ fontSize: 11, fill: '#9CA3AF' }}
          tickFormatter={formatXAxis}
        />
        <YAxis
          axisLine={false}
          tickLine={false}
          tick={{ fontSize: 11, fill: '#9CA3AF' }}
          tickFormatter={(v) => formatValue(v as number)}
        />
        <Tooltip
          contentStyle={{
            backgroundColor: '#1A1F3A',
            border: 'none',
            borderRadius: '8px',
            color: '#fff',
            fontSize: '12px',
            padding: '8px 12px',
          }}
          formatter={(value: number) => [formatValue(value), '']}
          labelFormatter={formatXAxis}
        />
        {yKeyPrevious && (
          <Area
            type="monotone"
            dataKey={yKeyPrevious}
            stroke="var(--color-chart-6)"
            strokeWidth={1.5}
            strokeDasharray="4 4"
            fill="none"
            dot={false}
          />
        )}
        <Area
          type="monotone"
          dataKey={yKey}
          stroke={color}
          strokeWidth={2}
          fill={`url(#gradient-${yKey})`}
          dot={false}
          activeDot={{ r: 4, strokeWidth: 0, fill: color }}
        />
      </RechartsAreaChart>
    </ResponsiveContainer>
  )
}
```

### Step 2.3 — Create Recharts BarChart wrapper

**File:** `apps/web/src/components/charts/bar-chart.tsx` (NEW)
**Complexity:** 2
**Impact:** Rounded-corner bar charts for invocation hourly view and method breakdown

```tsx
'use client'

import {
  BarChart as RechartsBarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts'

interface BarChartProps {
  data: Array<Record<string, string | number>>
  xKey: string
  yKey: string
  height?: number
  color?: string
  formatValue?: (value: number) => string
  formatXAxis?: (value: string) => string
}

export function BarChart({
  data,
  xKey,
  yKey,
  height = 200,
  color = 'var(--color-chart-1)',
  formatValue = (v) => String(v),
  formatXAxis = (v) => v,
}: BarChartProps) {
  if (!data || data.length === 0) {
    return (
      <div className="flex items-center justify-center text-gray-400 text-sm" style={{ height }}>
        No data available
      </div>
    )
  }

  return (
    <ResponsiveContainer width="100%" height={height}>
      <RechartsBarChart data={data} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" vertical={false} />
        <XAxis
          dataKey={xKey}
          axisLine={false}
          tickLine={false}
          tick={{ fontSize: 11, fill: '#9CA3AF' }}
          tickFormatter={formatXAxis}
        />
        <YAxis
          axisLine={false}
          tickLine={false}
          tick={{ fontSize: 11, fill: '#9CA3AF' }}
          tickFormatter={(v) => formatValue(v as number)}
        />
        <Tooltip
          contentStyle={{
            backgroundColor: '#1A1F3A',
            border: 'none',
            borderRadius: '8px',
            color: '#fff',
            fontSize: '12px',
            padding: '8px 12px',
          }}
          formatter={(value: number) => [formatValue(value), '']}
          labelFormatter={formatXAxis}
        />
        <Bar
          dataKey={yKey}
          fill={color}
          radius={[4, 4, 0, 0]}
          maxBarSize={40}
        />
      </RechartsBarChart>
    </ResponsiveContainer>
  )
}
```

### Step 2.4 — Replace CSS bar charts on dashboard overview page

**File:** `apps/web/src/app/(dashboard)/dashboard/page.tsx`
**Complexity:** 3
**Impact:** Two charts (Invocations 24h + Revenue Trend 30d) upgrade from CSS divs to Recharts

**Change 1:** Add imports at top of file:
```tsx
import { StatCard } from '@/components/ui/stat-card'
import { BarChart } from '@/components/charts/bar-chart'
import { AreaChart } from '@/components/charts/area-chart'
```

**Change 2:** Remove local `StatCard` function definition (lines 28-40).

**Change 3:** Replace the Invocations chart block (the `<Card>` at approximately lines 164-191) with:

```tsx
<Card>
  <CardHeader>
    <CardTitle className="text-lg">Invocations (Last 24 Hours)</CardTitle>
  </CardHeader>
  <CardContent>
    {stats?.recentInvocations && stats.recentInvocations.length > 0 ? (
      <BarChart
        data={stats.recentInvocations.map((point, i) => ({
          hour: point.hour || String(i),
          count: point.count,
        }))}
        xKey="hour"
        yKey="count"
        height={200}
        formatXAxis={(v) => {
          const h = parseInt(v, 10)
          return isNaN(h) ? v : `${h}:00`
        }}
      />
    ) : (
      <p className="text-gray-500 text-sm">No invocations yet. Publish a tool to get started.</p>
    )}
  </CardContent>
</Card>
```

**Change 4:** Replace the Revenue Trend chart block (approximately lines 194-218) with:

```tsx
{analytics?.revenueTrend && analytics.revenueTrend.length > 0 && (
  <Card>
    <CardHeader>
      <CardTitle className="text-lg">Revenue Trend (Last 30 Days)</CardTitle>
    </CardHeader>
    <CardContent>
      <AreaChart
        data={analytics.revenueTrend.map((day) => ({
          date: day.date,
          revenue: day.revenueCents,
        }))}
        xKey="date"
        yKey="revenue"
        height={220}
        formatValue={(v) =>
          new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(v / 100)
        }
        formatXAxis={(v) =>
          new Date(v).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
        }
      />
    </CardContent>
  </Card>
)}
```

### Step 2.5 — Replace CSS bar charts on analytics page

**File:** `apps/web/src/app/(dashboard)/dashboard/analytics/page.tsx`
**Complexity:** 3
**Impact:** Two charts (Invocations + Cost) upgrade to Recharts

**Change 1:** Add imports:
```tsx
import { StatCard } from '@/components/ui/stat-card'
import { BarChart } from '@/components/charts/bar-chart'
import { AreaChart } from '@/components/charts/area-chart'
```

**Change 2:** Remove local `StatCard` function definition (lines 42-54).

**Change 3:** Replace the Daily Usage Card (approximately lines 199-254) — the two stacked CSS bar sections — with a single card using two Recharts:

```tsx
<Card>
  <CardHeader>
    <CardTitle className="text-lg">Daily Usage</CardTitle>
    <CardDescription>Invocations and cost per day over the selected period.</CardDescription>
  </CardHeader>
  <CardContent>
    {dailyData.length > 0 ? (
      <div className="space-y-6">
        <div>
          <p className="text-xs font-medium text-gray-500 mb-2">Invocations</p>
          <BarChart
            data={dailyData}
            xKey="date"
            yKey="invocations"
            height={160}
            formatXAxis={(v) =>
              new Date(v).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
            }
          />
        </div>
        <div>
          <p className="text-xs font-medium text-gray-500 mb-2">Cost</p>
          <AreaChart
            data={dailyData}
            xKey="date"
            yKey="costCents"
            height={160}
            color="var(--color-chart-2)"
            formatValue={(v) => formatCents(v)}
            formatXAxis={(v) =>
              new Date(v).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
            }
          />
        </div>
      </div>
    ) : (
      <p className="text-gray-500 text-sm">No usage data for the selected period.</p>
    )}
  </CardContent>
</Card>
```

### Step 2.6 — Create Breadcrumbs component

**File:** `apps/web/src/components/ui/breadcrumbs.tsx` (NEW)
**Complexity:** 2
**Impact:** Navigation context for all dashboard pages

```tsx
import Link from 'next/link'

interface BreadcrumbItem {
  label: string
  href?: string
}

interface BreadcrumbsProps {
  items: BreadcrumbItem[]
}

export function Breadcrumbs({ items }: BreadcrumbsProps) {
  return (
    <nav aria-label="Breadcrumb" className="mb-4">
      <ol className="flex items-center gap-1.5 text-sm text-gray-500">
        {items.map((item, i) => (
          <li key={i} className="flex items-center gap-1.5">
            {i > 0 && (
              <svg className="w-3.5 h-3.5 text-gray-400" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" />
              </svg>
            )}
            {item.href ? (
              <Link href={item.href} className="hover:text-indigo transition-colors">
                {item.label}
              </Link>
            ) : (
              <span className="font-medium text-indigo">{item.label}</span>
            )}
          </li>
        ))}
      </ol>
    </nav>
  )
}
```

**Usage in each dashboard page:** Add above the `<h1>` in every dashboard sub-page. Example for analytics:

```tsx
<Breadcrumbs items={[
  { label: 'Dashboard', href: '/dashboard' },
  { label: 'Analytics' },
]} />
```

Pages to add breadcrumbs to:
- `analytics/page.tsx` — `[{ label: 'Dashboard', href: '/dashboard' }, { label: 'Analytics' }]`
- `health/page.tsx` — `[..., { label: 'Health' }]`
- `tools/page.tsx` — `[..., { label: 'Tools' }]`
- `payouts/page.tsx` — `[..., { label: 'Payouts' }]`
- `referrals/page.tsx` — `[..., { label: 'Referrals' }]`
- `fraud/page.tsx` — `[..., { label: 'Fraud Detection' }]`
- `reputation/page.tsx` — `[..., { label: 'Reputation' }]`
- `webhooks/page.tsx` — `[..., { label: 'Webhooks' }]`
- `audit-log/page.tsx` — `[..., { label: 'Audit Log' }]`
- `settings/page.tsx` — `[..., { label: 'Settings' }]`

Do NOT add breadcrumbs to `/dashboard` (overview) or `/consumer` — they are top-level.

### Step 2.7 — Upgrade skeleton loading states

**File:** Multiple dashboard pages
**Complexity:** 2
**Impact:** Loading states use proper Skeleton component instead of raw `animate-pulse` divs

Replace the loading skeleton pattern across dashboard pages. Current pattern (example from `dashboard/page.tsx` lines 77-89):

```tsx
// OLD
<Card key={i}>
  <CardContent className="p-6">
    <div className="h-4 bg-gray-200 rounded animate-pulse mb-2 w-20" />
    <div className="h-8 bg-gray-200 rounded animate-pulse w-32" />
  </CardContent>
</Card>
```

New pattern using Skeleton:

```tsx
// NEW
import { Skeleton } from '@/components/ui/skeleton'

<Card key={i}>
  <CardContent className="p-6">
    <Skeleton className="h-4 w-20 mb-2" />
    <Skeleton className="h-8 w-32" />
  </CardContent>
</Card>
```

Apply this to:
- `dashboard/page.tsx` (loading block ~lines 74-89)
- `dashboard/analytics/page.tsx` (loading block ~lines 124-143)
- `dashboard/health/page.tsx` (loading block ~lines 147-166)
- `dashboard/fraud/page.tsx` (loading block ~lines 133-152)
- `dashboard/payouts/page.tsx` (loading block ~lines 84-90)
- `dashboard/webhooks/page.tsx` (loading block ~lines 196-205)
- `dashboard/audit-log/page.tsx` (loading block ~lines 181-189)
- `consumer/page.tsx` (loading block ~lines 199-209)

### Step 2.8 — Improve empty states with illustrations and CTAs

**File:** Multiple dashboard pages
**Complexity:** 2
**Impact:** Empty states are clear and actionable instead of plain text

Create a shared empty state component:

**File:** `apps/web/src/components/ui/empty-state.tsx` (NEW)

```tsx
import Link from 'next/link'
import { Button } from '@/components/ui/button'

interface EmptyStateProps {
  icon: React.ReactNode
  title: string
  description: string
  actionLabel?: string
  actionHref?: string
  onAction?: () => void
}

export function EmptyState({ icon, title, description, actionLabel, actionHref, onAction }: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center py-12 px-4 text-center">
      <div className="w-12 h-12 rounded-full bg-gray-100 flex items-center justify-center mb-4 text-gray-400">
        {icon}
      </div>
      <h3 className="text-sm font-semibold text-indigo mb-1">{title}</h3>
      <p className="text-sm text-gray-500 max-w-sm mb-4">{description}</p>
      {actionLabel && actionHref && (
        <Link href={actionHref}>
          <Button size="sm">{actionLabel}</Button>
        </Link>
      )}
      {actionLabel && onAction && !actionHref && (
        <Button size="sm" onClick={onAction}>{actionLabel}</Button>
      )}
    </div>
  )
}
```

Example usage in `payouts/page.tsx` (replace lines 91-96):

```tsx
<Card>
  <CardContent className="p-0">
    <EmptyState
      icon={
        <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 18.75a60.07 60.07 0 0115.797 2.101c.727.198 1.453-.342 1.453-1.096V18.75M3.75 4.5v.75A.75.75 0 013 6h-.75m0 0v-.375c0-.621.504-1.125 1.125-1.125H20.25M2.25 6v9m18-10.5v.75c0 .414.336.75.75.75h.75m-1.5-1.5h.375c.621 0 1.125.504 1.125 1.125v9.75c0 .621-.504 1.125-1.125 1.125h-.375m1.5-1.5H21a.75.75 0 00-.75.75v.75m0 0H3.75m0 0h-.375a1.125 1.125 0 01-1.125-1.125V15m1.5 1.5v-.75A.75.75 0 003 15h-.75M15 10.5a3 3 0 11-6 0 3 3 0 016 0zm3 0h.008v.008H18V10.5zm-12 0h.008v.008H6V10.5z" />
        </svg>
      }
      title="No payouts yet"
      description="Payouts are processed when your balance reaches the minimum threshold ($25). Start monetizing tools to see payouts here."
      actionLabel="Manage Tools"
      actionHref="/dashboard/tools"
    />
  </CardContent>
</Card>
```

### Step 2.9 — Add period selector to dashboard overview

**File:** `apps/web/src/app/(dashboard)/dashboard/page.tsx`
**Complexity:** 2
**Impact:** Users can switch between 7d/30d/90d views on the overview page

Add a `PeriodSelector` component (can be inline since it's simple):

In the dashboard page, add state:
```tsx
const [period, setPeriod] = useState<'7' | '30' | '90'>('30')
```

Add the selector UI in the header area (after `<h1>`):
```tsx
<div className="flex items-center justify-between">
  <h1 className="text-2xl font-bold text-indigo">Dashboard</h1>
  <div className="flex items-center gap-1 bg-gray-100 rounded-lg p-1">
    {(['7', '30', '90'] as const).map((p) => (
      <button
        key={p}
        onClick={() => setPeriod(p)}
        className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
          period === p
            ? 'bg-white text-indigo shadow-sm'
            : 'text-gray-500 hover:text-gray-700'
        }`}
      >
        {p}d
      </button>
    ))}
  </div>
</div>
```

Note: The analytics page already has this pattern (lines 153-167). This brings it to the overview page too.

---

## Phase 3: Marketing Page Polish

**Goal:** Transform the homepage from functional to market-dominating.

### Step 3.1 — Dark hero section with gradient mesh background

**File:** `apps/web/src/app/page.tsx`
**Complexity:** 3
**Impact:** Hero section becomes dark and premium-feeling, matching enterprise SaaS aesthetics

Replace the hero `<section>` (lines 303-340) background. Change:

```tsx
// OLD
<section className="px-6 py-24">
```

To:

```tsx
// NEW
<section className="relative px-6 py-24 bg-indigo overflow-hidden">
  {/* CSS-only gradient mesh background */}
  <div
    className="absolute inset-0 opacity-30"
    style={{
      background: `
        radial-gradient(ellipse 80% 50% at 50% -20%, rgba(16, 185, 129, 0.3), transparent),
        radial-gradient(ellipse 60% 40% at 80% 50%, rgba(14, 165, 233, 0.15), transparent),
        radial-gradient(ellipse 50% 60% at 10% 80%, rgba(139, 92, 246, 0.1), transparent)
      `,
    }}
  />
  <div className="relative z-10 max-w-6xl mx-auto grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
```

Then update text colors within the hero:
- `text-indigo` on h1 becomes `text-white`
- `text-gray-600` on paragraph becomes `text-gray-300`
- `text-gray-500` on subtitle items becomes `text-gray-400`
- The "Now in Public Beta" badge: change `bg-emerald-light text-brand-text` to `bg-white/10 text-brand-light border border-white/20`
- Primary CTA button stays `bg-brand` (good contrast on dark)
- Secondary CTA: change `border-2 border-indigo text-indigo hover:bg-indigo hover:text-white` to `border-2 border-white/30 text-white hover:bg-white/10`

Close the section properly by moving the closing `</div>` after the grid content:
```tsx
  </div>
</section>
```

### Step 3.2 — Code snippet syntax highlighting with copy button

**File:** `apps/web/src/app/page.tsx`
**Complexity:** 3
**Impact:** Code snippet in hero looks professional with keyword coloring and copy-to-clipboard

Replace the `CodeSnippet` function (lines 113-147) with:

```tsx
'use client' // Note: page.tsx must stay a server component. Extract CodeSnippet to its own file.
```

**File:** `apps/web/src/components/marketing/code-snippet.tsx` (NEW)

```tsx
'use client'

import { useState } from 'react'

const lines = [
  { text: 'import', cls: 'text-violet-400' },
  { text: " { settlegrid } ", cls: 'text-gray-300' },
  { text: 'from', cls: 'text-violet-400' },
  { text: " '@settlegrid/mcp'", cls: 'text-emerald-400' },
  { text: '', cls: '' },
  { text: 'const', cls: 'text-violet-400' },
  { text: ' sg = settlegrid.', cls: 'text-gray-300' },
  { text: 'init', cls: 'text-sky-400' },
  { text: '({', cls: 'text-gray-300' },
  { text: "  toolSlug: ", cls: 'text-gray-300' },
  { text: "'weather-api'", cls: 'text-emerald-400' },
  { text: ',', cls: 'text-gray-300' },
  { text: '  pricing: {', cls: 'text-gray-300' },
  { text: '    defaultCostCents: ', cls: 'text-gray-300' },
  { text: '1', cls: 'text-amber-400' },
  { text: ',', cls: 'text-gray-300' },
  { text: '    methods: {', cls: 'text-gray-300' },
  { text: "      'get-forecast'", cls: 'text-emerald-400' },
  { text: ': { costCents: ', cls: 'text-gray-300' },
  { text: '2', cls: 'text-amber-400' },
  { text: ' },', cls: 'text-gray-300' },
  { text: '    },', cls: 'text-gray-300' },
  { text: '  },', cls: 'text-gray-300' },
  { text: '})', cls: 'text-gray-300' },
]

const RAW_CODE = `import { settlegrid } from '@settlegrid/mcp'

const sg = settlegrid.init({
  toolSlug: 'weather-api',
  pricing: {
    defaultCostCents: 1,
    methods: {
      'get-forecast': { costCents: 2 },
      'get-historical': { costCents: 5 },
    },
  },
})

// Wrap any function as a monetized tool
const getForecast = sg.wrap(
  async (args: { city: string }) => {
    const data = await fetchWeather(args.city)
    return { forecast: data }
  },
  { method: 'get-forecast' }
)`

export function CodeSnippet() {
  const [copied, setCopied] = useState(false)

  function handleCopy() {
    navigator.clipboard.writeText(RAW_CODE).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    })
  }

  return (
    <div className="bg-[#0D1117] rounded-xl p-6 text-sm font-mono text-left overflow-x-auto shadow-2xl border border-white/10">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-1.5">
          <div className="w-3 h-3 rounded-full bg-red-400/80" />
          <div className="w-3 h-3 rounded-full bg-yellow-400/80" />
          <div className="w-3 h-3 rounded-full bg-green-400/80" />
          <span className="text-xs text-gray-500 ml-2">index.ts</span>
        </div>
        <button
          onClick={handleCopy}
          className="text-xs text-gray-500 hover:text-white transition-colors flex items-center gap-1"
          aria-label="Copy code"
        >
          {copied ? (
            <>
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
              </svg>
              Copied
            </>
          ) : (
            <>
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M15.666 3.888A2.25 2.25 0 0013.5 2.25h-3c-1.03 0-1.9.693-2.166 1.638m7.332 0c.055.194.084.4.084.612v0a.75.75 0 01-.75.75H9.75a.75.75 0 01-.75-.75v0c0-.212.03-.418.084-.612m7.332 0c.646.049 1.288.11 1.927.184 1.1.128 1.907 1.077 1.907 2.185V19.5a2.25 2.25 0 01-2.25 2.25H6.75A2.25 2.25 0 014.5 19.5V6.257c0-1.108.806-2.057 1.907-2.185a48.208 48.208 0 011.927-.184" />
              </svg>
              Copy
            </>
          )}
        </button>
      </div>
      <pre className="text-gray-300 leading-relaxed">
        <code>{RAW_CODE}</code>
      </pre>
    </div>
  )
}
```

Then in `page.tsx`, replace the old `CodeSnippet` function with an import. Since the homepage `page.tsx` is a Server Component (it exports `metadata`), you need to extract just the code snippet as a client component:

```tsx
// At top of page.tsx, add:
import { CodeSnippet } from '@/components/marketing/code-snippet'
// Remove the old CodeSnippet function definition (lines 113-147)
```

### Step 3.3 — Bento grid feature layout (restructure 26 cards)

**File:** `apps/web/src/app/page.tsx`
**Complexity:** 4
**Impact:** Features section goes from 26 uniform cards to a visually-weighted bento grid

Replace the features section (lines 345-529, the entire section with 5 groups of cards) with a bento grid layout.

**Strategy:** Keep the same 26 features, but present 3 "hero features" as large cards (spanning 2 columns), and the rest as compact cards in a dense grid. Group them visually, not with category headers.

**Hero features (large cards):**
1. Sub-50ms Redis Metering (core differentiator)
2. MCP-Native SDK with LRU Cache (developer story)
3. Fraud Detection (trust/security story)

**New layout structure:**

```tsx
<section className="px-6 py-24 bg-cloud">
  <div className="max-w-6xl mx-auto">
    <h2 className="text-3xl font-bold text-indigo text-center mb-4">
      Everything you need to monetize AI tools
    </h2>
    <p className="text-gray-600 text-center mb-16 max-w-2xl mx-auto">
      From one-line SDK integration to a full marketplace with analytics, security, and
      consumer-facing features — SettleGrid handles the entire commerce layer.
    </p>

    {/* Bento grid: 3 hero cards spanning 2 cols, then remaining cards in 3-col grid */}
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
      {/* Hero card 1 — spans 2 cols */}
      <div className="md:col-span-2 p-8 rounded-xl border border-gray-200 bg-white hover:border-brand/40 hover:shadow-md transition-all duration-200">
        <div className="flex items-start gap-6">
          <div className="w-12 h-12 rounded-xl bg-brand/10 flex items-center justify-center shrink-0">
            <Icon d={iconRedisMetering} />
          </div>
          <div>
            <h3 className="font-semibold text-lg text-indigo mb-2">Sub-50ms Redis Metering</h3>
            <p className="text-sm text-gray-600 leading-relaxed">
              Every tool call is metered through Redis with sub-50ms overhead. Balance checks,
              deductions, and usage recording in a single atomic pipeline. The fastest metering
              layer in the MCP ecosystem.
            </p>
          </div>
        </div>
      </div>

      {/* Standard card */}
      <FeatureCard icon={<Icon d={iconBilling} />} title="Per-Call Billing" description="..." />

      {/* ... remaining FeatureCards at normal size ... */}

      {/* Hero card 2 — spans 2 cols */}
      <div className="md:col-span-2 p-8 rounded-xl border border-gray-200 bg-white hover:border-brand/40 hover:shadow-md transition-all duration-200">
        {/* SDK hero card content */}
      </div>

      {/* ... more standard cards ... */}

      {/* Hero card 3 — spans 2 cols */}
      <div className="md:col-span-2 p-8 rounded-xl border border-gray-200 bg-white hover:border-brand/40 hover:shadow-md transition-all duration-200">
        {/* Fraud detection hero card content */}
      </div>

      {/* ... remaining standard cards ... */}
    </div>
  </div>
</section>
```

Keep all 26 FeatureCards. The 3 hero features use a wider layout with icon + text side by side. The remaining 23 use the existing `FeatureCard` component. Remove the category labels (`<p className="text-xs font-semibold text-gray-500 uppercase">`) and the separate grid sections — everything goes into one bento grid.

### Step 3.4 — Integration logo bar (social proof)

**File:** `apps/web/src/app/page.tsx`
**Complexity:** 2
**Impact:** Trust signal immediately below hero — shows integration partners

Add this section between the Hero (section 1) and Features (section 2):

```tsx
{/* ---- Integration logos ---- */}
<section className="px-6 py-12 border-b border-gray-200">
  <div className="max-w-4xl mx-auto">
    <p className="text-center text-sm text-gray-500 mb-8">Integrates with tools you already use</p>
    <div className="flex items-center justify-center gap-12 flex-wrap">
      {[
        { name: 'Stripe', width: 60 },
        { name: 'Claude', width: 60 },
        { name: 'Cursor', width: 60 },
        { name: 'VS Code', width: 60 },
        { name: 'Windsurf', width: 60 },
      ].map((logo) => (
        <span
          key={logo.name}
          className="text-gray-400 hover:text-gray-600 transition-colors font-semibold text-lg select-none"
          style={{ width: logo.width, textAlign: 'center' }}
        >
          {logo.name}
        </span>
      ))}
    </div>
  </div>
</section>
```

Note: Using text for now instead of actual logo SVGs. If logo SVGs are available later, swap in `<img>` tags with `className="grayscale hover:grayscale-0 opacity-50 hover:opacity-100 transition-all"`.

### Step 3.5 — Security/trust badges section

**File:** `apps/web/src/app/page.tsx`
**Complexity:** 2
**Impact:** Trust signal in the enterprise section

Add a trust badges row inside the Enterprise section (after the bullet list, before the code block). Insert between lines 595-596:

```tsx
<div className="flex flex-wrap items-center gap-4 mt-8">
  {[
    'SOC 2 Ready',
    'HMAC-SHA256',
    'SHA-256 at Rest',
    '99.9% SLA',
  ].map((badge) => (
    <span
      key={badge}
      className="inline-flex items-center gap-1.5 bg-white/10 border border-white/20 rounded-full px-3 py-1.5 text-xs font-medium text-white/80"
    >
      <svg className="w-3.5 h-3.5 text-brand-light" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75m-3-7.036A11.959 11.959 0 013.598 6 11.99 11.99 0 003 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285z" />
      </svg>
      {badge}
    </span>
  ))}
</div>
```

### Step 3.6 — Pricing section restructure (4 tiers)

**File:** `apps/web/src/app/page.tsx`
**Complexity:** 3
**Impact:** Clearer pricing with 4 tiers matching a standard SaaS ladder

Replace the `PricingSection` function (lines 149-200) with:

```tsx
function PricingSection() {
  const tiers = [
    {
      name: 'Free',
      price: '$0',
      period: 'forever',
      description: 'For experimenting and prototyping',
      features: [
        '1 tool',
        '1,000 calls/month',
        'Per-call billing',
        'Basic dashboard',
        '85% revenue share',
      ],
      cta: 'Start Free',
      href: '/register',
      highlighted: false,
    },
    {
      name: 'Builder',
      price: '$29',
      period: '/month',
      description: 'For solo developers shipping tools',
      features: [
        '5 tools',
        '50,000 calls/month',
        'Full analytics',
        'Webhook events',
        'Sandbox mode',
        '85% revenue share',
      ],
      cta: 'Start Building',
      href: '/register',
      highlighted: false,
    },
    {
      name: 'Scale',
      price: '$99',
      period: '/month',
      description: 'For teams with growing usage',
      features: [
        'Unlimited tools',
        '500,000 calls/month',
        'Priority webhooks',
        'IP allowlisting',
        'CSV export',
        'Referral system',
        '87% revenue share',
      ],
      cta: 'Get Started',
      href: '/register',
      highlighted: true,
    },
    {
      name: 'Platform',
      price: '$299',
      period: '/month',
      description: 'For enterprises and platforms',
      features: [
        'Unlimited everything',
        'Dedicated support',
        '99.9% SLA',
        'Fraud detection',
        'Audit logging',
        'Custom integrations',
        '90% revenue share',
      ],
      cta: 'Contact Sales',
      href: '/register',
      highlighted: false,
    },
  ]

  return (
    <div className="text-center">
      <h2 className="text-3xl font-bold text-indigo mb-4">Simple, Transparent Pricing</h2>
      <p className="text-gray-600 mb-10 max-w-xl mx-auto">
        Start free. Scale as you grow. You always keep the majority of your revenue.
      </p>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 max-w-5xl mx-auto">
        {tiers.map((tier) => (
          <div
            key={tier.name}
            className={`p-6 rounded-xl border-2 text-left relative ${
              tier.highlighted
                ? 'border-brand shadow-lg shadow-brand/10'
                : 'border-gray-200'
            }`}
          >
            {tier.highlighted && (
              <div className="absolute -top-3 left-1/2 transform -translate-x-1/2 bg-brand text-white text-xs font-semibold px-3 py-1 rounded-full">
                Most Popular
              </div>
            )}
            <h3 className="font-semibold text-lg text-indigo">{tier.name}</h3>
            <div className="mt-2 mb-1">
              <span className="text-3xl font-bold text-indigo">{tier.price}</span>
              <span className="text-sm text-gray-500">{tier.period}</span>
            </div>
            <p className="text-xs text-gray-500 mb-4">{tier.description}</p>
            <a
              href={tier.href}
              className={`block w-full text-center py-2 rounded-lg text-sm font-semibold transition-colors mb-4 ${
                tier.highlighted
                  ? 'bg-brand text-white hover:bg-brand-dark'
                  : 'bg-gray-100 text-indigo hover:bg-gray-200'
              }`}
            >
              {tier.cta}
            </a>
            <ul className="space-y-2">
              {tier.features.map((f) => (
                <li key={f} className="flex items-start gap-2 text-sm text-gray-600">
                  <span className="text-brand-text mt-0.5 shrink-0">&#10003;</span>
                  {f}
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
    </div>
  )
}
```

### Step 3.7 — Scroll reveal animations (fade-up on section entry)

**File:** `apps/web/src/components/marketing/scroll-reveal.tsx` (NEW)
**Complexity:** 2
**Impact:** Sections fade in as user scrolls — polished feel without being distracting

```tsx
'use client'

import { useRef } from 'react'
import { motion, useInView } from 'framer-motion'

interface ScrollRevealProps {
  children: React.ReactNode
  className?: string
  delay?: number
}

export function ScrollReveal({ children, className, delay = 0 }: ScrollRevealProps) {
  const ref = useRef<HTMLDivElement>(null)
  const isInView = useInView(ref, { once: true, margin: '-80px' })

  return (
    <motion.div
      ref={ref}
      initial={{ opacity: 0, y: 24 }}
      animate={isInView ? { opacity: 1, y: 0 } : { opacity: 0, y: 24 }}
      transition={{ duration: 0.5, delay, ease: 'easeOut' }}
      className={className}
    >
      {children}
    </motion.div>
  )
}
```

**Usage in homepage:** Wrap each major section's inner content (not the `<section>` itself, as that could break the bg color). For the server-component page, wrap the sections that contain client components, or convert the page to use a client wrapper for the scrollable content.

Simplest approach: Create a `HomeContent` client component that wraps each section in `<ScrollReveal>`.

**File:** `apps/web/src/components/marketing/home-sections.tsx` (NEW)

```tsx
'use client'

import { ScrollReveal } from './scroll-reveal'

export function RevealSection({ children, className, delay }: {
  children: React.ReactNode
  className?: string
  delay?: number
}) {
  return (
    <ScrollReveal className={className} delay={delay}>
      {children}
    </ScrollReveal>
  )
}
```

Then in `page.tsx`, wrap each section's inner `<div className="max-w-...">` with `<RevealSection>`:

```tsx
import { RevealSection } from '@/components/marketing/home-sections'

// Example in the "How it works" section:
<section className="px-6 py-24">
  <RevealSection>
    <div className="max-w-4xl mx-auto">
      {/* ... existing content ... */}
    </div>
  </RevealSection>
</section>
```

Apply to these sections:
- Integration logos bar
- Features bento grid
- How it works
- Enterprise section
- Comparison table
- Pricing
- CTA

Do NOT apply to the hero section (it should be immediately visible).

### Step 3.8 — Reorder homepage sections

**File:** `apps/web/src/app/page.tsx`
**Complexity:** 2
**Impact:** Optimal conversion flow

Reorder sections to match the recommended flow:

1. Hero (with dark bg + gradient mesh) -- stays at top
2. Integration logo bar -- NEW, right below hero
3. How it works (3-step flow) -- moved up
4. Features bento grid -- moved down slightly
5. Enterprise section -- stays
6. Comparison table -- stays
7. Pricing (4 tiers) -- stays
8. CTA -- stays

This puts the "how easy it is" message right after the hook, then expands into features.

---

## Phase 4: Dark Mode

**Goal:** Full dark mode support with system preference detection and manual toggle.

### Step 4.1 — Configure next-themes provider

**File:** `apps/web/src/app/layout.tsx`
**Complexity:** 2
**Impact:** Enables dark mode across the entire app

Modify the root layout:

```tsx
import type { Metadata } from 'next'
import { ClerkProvider } from '@clerk/nextjs'
import { Outfit } from 'next/font/google'
import { ThemeProvider } from 'next-themes'
import './globals.css'

const outfit = Outfit({
  subsets: ['latin'],
  variable: '--font-sans',
  display: 'swap',
  weight: ['300', '400', '500', '600', '700'],
})

export const metadata: Metadata = {
  /* ... existing metadata unchanged ... */
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <ClerkProvider>
      <html lang="en" className={outfit.variable} suppressHydrationWarning>
        <body className="font-sans antialiased bg-white text-indigo dark:bg-gray-950 dark:text-gray-100">
          <ThemeProvider attribute="class" defaultTheme="system" enableSystem>
            {children}
          </ThemeProvider>
        </body>
      </html>
    </ClerkProvider>
  )
}
```

Key details:
- `suppressHydrationWarning` on `<html>` is required by next-themes to avoid hydration mismatch
- `attribute="class"` means dark mode is toggled via `.dark` class on `<html>`
- `defaultTheme="system"` respects OS preference

### Step 4.2 — Add dark mode CSS variables

**File:** `apps/web/src/app/globals.css`
**Complexity:** 2
**Impact:** All semantic tokens flip for dark mode

Add after the `@theme` block:

```css
/* Dark mode overrides */
.dark {
  --color-surface: #0F1629;
  --color-surface-secondary: #1A1F3A;
  --color-border: #2A2F4A;
  --color-border-hover: rgba(16, 185, 129, 0.5);
  --color-text-primary: #F9FAFB;
  --color-text-secondary: #9CA3AF;
  --color-text-muted: #6B7280;
  --color-cloud: #111827;
}
```

Note: Because Tailwind v4 uses `@theme` for token definitions, and dark mode uses `.dark` class, you need both systems. The brand colors (emerald, indigo) remain the same in dark mode — only surfaces, borders, and text change.

### Step 4.3 — Add dark mode classes to all existing components

**File:** Multiple UI component files
**Complexity:** 3
**Impact:** Every component looks correct in dark mode

**card.tsx** — Update Card's base class:
```tsx
// OLD
'rounded-lg border border-gray-200 bg-white shadow-sm'
// NEW
'rounded-lg border border-gray-200 bg-white shadow-sm dark:border-gray-800 dark:bg-gray-900'
```

**button.tsx** — Update outline variant:
```tsx
// OLD
outline: 'border border-gray-300 bg-white text-gray-700 hover:bg-gray-50',
// NEW
outline: 'border border-gray-300 bg-white text-gray-700 hover:bg-gray-50 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-200 dark:hover:bg-gray-800',
```

Update ghost variant:
```tsx
// OLD
ghost: 'text-gray-700 hover:bg-gray-100',
// NEW
ghost: 'text-gray-700 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-800',
```

**badge.tsx** — Update secondary variant:
```tsx
// OLD
secondary: 'border-transparent bg-gray-100 text-gray-800',
// NEW
secondary: 'border-transparent bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-200',
```

**input.tsx** — Update base class:
```tsx
// OLD (the long class string)
// Add at end:
dark:border-gray-700 dark:bg-gray-900 dark:text-gray-100 dark:placeholder:text-gray-500
```

### Step 4.4 — Add dark mode to dashboard layout

**File:** `apps/web/src/app/(dashboard)/layout.tsx`
**Complexity:** 2
**Impact:** Dashboard sidebar and main area look correct in dark mode

The sidebar already uses `bg-indigo` which works in both modes. Update the main content area:

```tsx
// OLD
<header className="sticky top-0 z-30 bg-white border-b border-gray-200 px-6 py-4 lg:hidden">
// NEW
<header className="sticky top-0 z-30 bg-white border-b border-gray-200 px-6 py-4 lg:hidden dark:bg-gray-950 dark:border-gray-800">
```

The sidebar's white text on dark indigo background works in both modes. No changes needed there.

### Step 4.5 — Add dark mode to homepage

**File:** `apps/web/src/app/page.tsx`
**Complexity:** 3
**Impact:** Marketing pages look great in dark mode

Key areas to add dark mode classes:

**Header:**
```tsx
// OLD
<header className="border-b border-gray-200 px-6 py-4">
// NEW
<header className="border-b border-gray-200 px-6 py-4 dark:border-gray-800 dark:bg-gray-950">
```

Header links:
```tsx
// OLD
className="text-sm font-medium text-gray-600 hover:text-indigo transition-colors"
// NEW
className="text-sm font-medium text-gray-600 hover:text-indigo transition-colors dark:text-gray-400 dark:hover:text-white"
```

**Feature cards (bg-cloud section):**
```tsx
// OLD
<section className="px-6 py-24 bg-cloud">
// NEW
<section className="px-6 py-24 bg-cloud dark:bg-gray-950">
```

FeatureCard borders:
```tsx
// OLD
className="group p-6 rounded-xl border border-gray-200 hover:border-brand/40 hover:shadow-md transition-all duration-200"
// NEW
className="group p-6 rounded-xl border border-gray-200 hover:border-brand/40 hover:shadow-md transition-all duration-200 dark:border-gray-800 dark:hover:border-brand/50"
```

FeatureCard text:
```tsx
// OLD
<p className="text-sm text-gray-600 leading-relaxed">
// NEW
<p className="text-sm text-gray-600 leading-relaxed dark:text-gray-400">
```

**Comparison table:**
```tsx
// Table header: add dark:border-gray-800
// Table rows: add dark:border-gray-800/50
// Feature name td: add dark:text-gray-300
```

**Footer:**
```tsx
// OLD
<footer className="border-t border-gray-200 px-6 py-8">
// NEW
<footer className="border-t border-gray-200 px-6 py-8 dark:border-gray-800">
```

### Step 4.6 — Theme toggle component

**File:** `apps/web/src/components/ui/theme-toggle.tsx` (NEW)
**Complexity:** 2
**Impact:** Users can manually switch between light/dark/system

```tsx
'use client'

import { useTheme } from 'next-themes'
import { useEffect, useState } from 'react'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Button } from '@/components/ui/button'

export function ThemeToggle() {
  const { setTheme, theme } = useTheme()
  const [mounted, setMounted] = useState(false)

  useEffect(() => setMounted(true), [])

  if (!mounted) {
    return (
      <Button variant="ghost" size="icon" aria-label="Toggle theme">
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 3v2.25m6.364.386l-1.591 1.591M21 12h-2.25m-.386 6.364l-1.591-1.591M12 18.75V21m-4.773-4.227l-1.591 1.591M5.25 12H3m4.227-4.773L5.636 5.636M15.75 12a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0z" />
        </svg>
      </Button>
    )
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" aria-label="Toggle theme">
          {theme === 'dark' ? (
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M21.752 15.002A9.718 9.718 0 0118 15.75c-5.385 0-9.75-4.365-9.75-9.75 0-1.33.266-2.597.748-3.752A9.753 9.753 0 003 11.25C3 16.635 7.365 21 12.75 21a9.753 9.753 0 009.002-5.998z" />
            </svg>
          ) : (
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 3v2.25m6.364.386l-1.591 1.591M21 12h-2.25m-.386 6.364l-1.591-1.591M12 18.75V21m-4.773-4.227l-1.591 1.591M5.25 12H3m4.227-4.773L5.636 5.636M15.75 12a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0z" />
            </svg>
          )}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem onClick={() => setTheme('light')}>Light</DropdownMenuItem>
        <DropdownMenuItem onClick={() => setTheme('dark')}>Dark</DropdownMenuItem>
        <DropdownMenuItem onClick={() => setTheme('system')}>System</DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
```

**Placement — Homepage header:** Add `<ThemeToggle />` in the header nav, before the "Log in" link.

**Placement — Dashboard sidebar:** Add `<ThemeToggle />` in the sidebar bottom area (line 74 area), next to the `<UserButton>`.

---

## Phase 5: Advanced Interactions

**Goal:** Command palette, number counting, collapsible sidebar, toast notifications.

### Step 5.1 — Command palette (Cmd+K)

**File:** `apps/web/src/components/command-palette.tsx` (NEW)
**Complexity:** 4
**Impact:** Global search and navigation across dashboard — power-user feature that signals quality

Depends on `cmdk` (installed in Step 1.8) and the Dialog component (Step 1.7).

```tsx
'use client'

import { useEffect, useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { Command } from 'cmdk'

const pages = [
  { name: 'Dashboard', href: '/dashboard', group: 'Navigation' },
  { name: 'Tools', href: '/dashboard/tools', group: 'Navigation' },
  { name: 'Analytics', href: '/dashboard/analytics', group: 'Navigation' },
  { name: 'Health', href: '/dashboard/health', group: 'Navigation' },
  { name: 'Payouts', href: '/dashboard/payouts', group: 'Navigation' },
  { name: 'Referrals', href: '/dashboard/referrals', group: 'Navigation' },
  { name: 'Fraud Detection', href: '/dashboard/fraud', group: 'Navigation' },
  { name: 'Reputation', href: '/dashboard/reputation', group: 'Navigation' },
  { name: 'Webhooks', href: '/dashboard/webhooks', group: 'Navigation' },
  { name: 'Audit Log', href: '/dashboard/audit-log', group: 'Navigation' },
  { name: 'Settings', href: '/dashboard/settings', group: 'Navigation' },
  { name: 'Consumer Dashboard', href: '/consumer', group: 'Navigation' },
  { name: 'Marketplace', href: '/tools', group: 'Navigation' },
  { name: 'Documentation', href: '/docs', group: 'Navigation' },
  { name: 'Create Tool', href: '/dashboard/tools', group: 'Actions' },
  { name: 'Add Webhook', href: '/dashboard/webhooks', group: 'Actions' },
  { name: 'Export Audit Log', href: '/dashboard/audit-log', group: 'Actions' },
  { name: 'Request Payout', href: '/dashboard/payouts', group: 'Actions' },
]

export function CommandPalette() {
  const [open, setOpen] = useState(false)
  const router = useRouter()

  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault()
        setOpen((prev) => !prev)
      }
    }
    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [])

  const navigate = useCallback(
    (href: string) => {
      setOpen(false)
      router.push(href)
    },
    [router]
  )

  if (!open) return null

  return (
    <div className="fixed inset-0 z-[100]">
      <div className="fixed inset-0 bg-black/50" onClick={() => setOpen(false)} />
      <div className="fixed top-[20%] left-1/2 -translate-x-1/2 w-full max-w-lg">
        <Command
          className="bg-white dark:bg-gray-900 rounded-xl shadow-2xl border border-gray-200 dark:border-gray-800 overflow-hidden"
          label="Command palette"
        >
          <div className="flex items-center border-b border-gray-200 dark:border-gray-800 px-4">
            <svg className="w-4 h-4 text-gray-400 mr-2 shrink-0" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z" />
            </svg>
            <Command.Input
              placeholder="Search pages and actions..."
              className="w-full h-12 bg-transparent text-sm text-gray-900 dark:text-gray-100 placeholder:text-gray-500 focus:outline-none"
            />
            <kbd className="hidden sm:inline-flex items-center gap-1 rounded border border-gray-300 dark:border-gray-700 px-1.5 py-0.5 text-[10px] font-mono text-gray-500">
              ESC
            </kbd>
          </div>
          <Command.List className="max-h-80 overflow-y-auto p-2">
            <Command.Empty className="py-6 text-center text-sm text-gray-500">
              No results found.
            </Command.Empty>
            {['Navigation', 'Actions'].map((group) => (
              <Command.Group
                key={group}
                heading={group}
                className="[&_[cmdk-group-heading]]:text-xs [&_[cmdk-group-heading]]:font-medium [&_[cmdk-group-heading]]:text-gray-500 [&_[cmdk-group-heading]]:px-2 [&_[cmdk-group-heading]]:py-1.5"
              >
                {pages
                  .filter((p) => p.group === group)
                  .map((page) => (
                    <Command.Item
                      key={page.href + page.name}
                      value={page.name}
                      onSelect={() => navigate(page.href)}
                      className="flex items-center gap-2 px-3 py-2 text-sm rounded-md cursor-pointer text-gray-700 dark:text-gray-300 data-[selected=true]:bg-gray-100 dark:data-[selected=true]:bg-gray-800"
                    >
                      <svg className="w-4 h-4 text-gray-400" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" d={
                          group === 'Actions'
                            ? 'M12 4.5v15m7.5-7.5h-15'
                            : 'M13.5 4.5L21 12m0 0l-7.5 7.5M21 12H3'
                        } />
                      </svg>
                      {page.name}
                    </Command.Item>
                  ))}
              </Command.Group>
            ))}
          </Command.List>
        </Command>
      </div>
    </div>
  )
}
```

**Mount it** in `apps/web/src/app/(dashboard)/layout.tsx`, inside the `<div className="flex-1 flex flex-col min-w-0">` block:

```tsx
import { CommandPalette } from '@/components/command-palette'

// Inside the component, add:
<CommandPalette />
```

Also add a keyboard shortcut hint in the dashboard header (the mobile header bar, and optionally a desktop top bar):

```tsx
<div className="hidden lg:flex items-center gap-2 text-xs text-gray-400">
  <kbd className="rounded border border-gray-300 px-1.5 py-0.5 font-mono text-[10px]">&#8984;K</kbd>
  <span>Search</span>
</div>
```

### Step 5.2 — Animated number counting for KPI cards

**File:** `apps/web/src/components/ui/stat-card.tsx`
**Complexity:** 3
**Impact:** Numbers animate from 0 to final value when cards first appear

Update the StatCard component to optionally animate:

```tsx
'use client'

import { useEffect, useRef, useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { cn } from '@/lib/utils'

interface StatCardProps {
  title: string
  value: string
  subtitle?: string
  trend?: number
  variant?: 'default' | 'danger'
  /** If true, the numeric portion of value will count up from 0 on mount */
  animate?: boolean
}

function useCountUp(target: number, duration: number = 800, enabled: boolean = true) {
  const [current, setCurrent] = useState(enabled ? 0 : target)
  const startTime = useRef<number | null>(null)
  const animationRef = useRef<number | null>(null)

  useEffect(() => {
    if (!enabled || target === 0) {
      setCurrent(target)
      return
    }

    function step(timestamp: number) {
      if (!startTime.current) startTime.current = timestamp
      const progress = Math.min((timestamp - startTime.current) / duration, 1)
      const eased = 1 - Math.pow(1 - progress, 3) // easeOutCubic
      setCurrent(Math.round(eased * target))
      if (progress < 1) {
        animationRef.current = requestAnimationFrame(step)
      }
    }

    animationRef.current = requestAnimationFrame(step)
    return () => {
      if (animationRef.current) cancelAnimationFrame(animationRef.current)
    }
  }, [target, duration, enabled])

  return current
}

export function StatCard({ title, value, subtitle, trend, variant, animate = false }: StatCardProps) {
  // Extract numeric value for animation
  const numericMatch = value.match(/[\d,.]+/)
  const numericValue = numericMatch ? parseFloat(numericMatch[0].replace(/,/g, '')) : 0
  const animatedNum = useCountUp(numericValue, 800, animate)

  const showTrend = trend !== undefined && trend !== 0

  // Reconstruct the displayed value with animated number
  const displayValue = animate && numericMatch
    ? value.replace(numericMatch[0], animatedNum.toLocaleString())
    : value

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-medium text-gray-500">{title}</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="flex items-baseline gap-2">
          <span className={cn(
            'text-3xl font-bold tabular-nums',
            variant === 'danger' ? 'text-red-600' : 'text-indigo'
          )}>
            {displayValue}
          </span>
          {showTrend && (
            <span className={cn(
              'inline-flex items-center text-xs font-medium',
              trend > 0 ? 'text-green-600' : 'text-red-600'
            )}>
              <svg
                className={cn('w-3 h-3 mr-0.5', trend < 0 && 'rotate-180')}
                fill="none"
                viewBox="0 0 24 24"
                strokeWidth={2.5}
                stroke="currentColor"
              >
                <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 15.75l7.5-7.5 7.5 7.5" />
              </svg>
              {Math.abs(trend).toFixed(1)}%
            </span>
          )}
        </div>
        {subtitle && <p className="text-xs text-gray-500 mt-1">{subtitle}</p>}
      </CardContent>
    </Card>
  )
}
```

Key detail: `tabular-nums` class ensures numbers don't shift during animation (monospaced digits).

Usage: Add `animate` prop to StatCards on the main dashboard page:
```tsx
<StatCard title="Total Revenue" value={formatCents(stats?.totalRevenueCents ?? 0)} animate />
```

### Step 5.3 — Collapsible sidebar with cookie persistence

**File:** `apps/web/src/app/(dashboard)/layout.tsx`
**Complexity:** 3
**Impact:** Sidebar can collapse to icons-only, giving more space to content

Add state and toggle logic:

```tsx
'use client'

import { useState, useEffect } from 'react'
// ... existing imports ...

function getSidebarState(): boolean {
  if (typeof document === 'undefined') return false
  const match = document.cookie.match(/sidebar_collapsed=(\w+)/)
  return match?.[1] === 'true'
}

function setSidebarCookie(collapsed: boolean) {
  document.cookie = `sidebar_collapsed=${collapsed}; path=/; max-age=${60 * 60 * 24 * 365}; SameSite=Lax`
}

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const [sidebarOpen, setSidebarOpen] = useState(false) // mobile
  const [collapsed, setCollapsed] = useState(false) // desktop

  useEffect(() => {
    setCollapsed(getSidebarState())
  }, [])

  function toggleCollapsed() {
    const next = !collapsed
    setCollapsed(next)
    setSidebarCookie(next)
  }

  return (
    <div className="min-h-screen flex">
      <aside
        className={cn(
          'fixed inset-y-0 left-0 z-50 bg-indigo text-white transform transition-all duration-200 lg:translate-x-0 lg:static lg:inset-0',
          sidebarOpen ? 'translate-x-0' : '-translate-x-full',
          collapsed ? 'w-16' : 'w-64'
        )}
      >
        {/* Logo area */}
        <div className="flex items-center justify-between px-4 py-5 border-b border-white/10">
          <Link href="/dashboard">
            {collapsed ? (
              <SettleGridLogo variant="mark" size={28} theme="dark" />
            ) : (
              <SettleGridLogo variant="horizontal" size={28} theme="dark" />
            )}
          </Link>
          {/* Mobile close button */}
          <button
            type="button"
            onClick={() => setSidebarOpen(false)}
            className="lg:hidden text-white/60 hover:text-white"
            aria-label="Close sidebar"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Nav items */}
        <nav className="px-2 py-4 space-y-1">
          {devNavItems.map((item) => {
            const isActive = pathname === item.href || (item.href !== '/dashboard' && pathname.startsWith(item.href))
            return (
              <Link
                key={item.href}
                href={item.href}
                title={collapsed ? item.label : undefined}
                className={cn(
                  'flex items-center gap-3 rounded-lg text-sm font-medium transition-colors',
                  collapsed ? 'justify-center px-2 py-2.5' : 'px-3 py-2.5',
                  isActive
                    ? 'bg-white/15 text-white'
                    : 'text-white/60 hover:text-white hover:bg-white/10'
                )}
              >
                <svg className="w-5 h-5 shrink-0" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d={item.icon} />
                </svg>
                {!collapsed && item.label}
              </Link>
            )
          })}
        </nav>

        {/* Collapse toggle (desktop only) */}
        <div className="absolute bottom-14 left-0 right-0 px-2 hidden lg:block">
          <button
            onClick={toggleCollapsed}
            className="flex items-center justify-center w-full py-2 text-white/40 hover:text-white/80 transition-colors"
            aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          >
            <svg
              className={cn('w-4 h-4 transition-transform', collapsed && 'rotate-180')}
              fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor"
            >
              <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5L8.25 12l7.5-7.5" />
            </svg>
          </button>
        </div>

        {/* User button */}
        <div className={cn(
          'absolute bottom-4 left-0 right-0 flex items-center gap-3',
          collapsed ? 'justify-center px-2' : 'px-3'
        )}>
          <UserButton afterSignOutUrl="/login" />
        </div>
      </aside>

      {/* ... rest unchanged ... */}
    </div>
  )
}
```

### Step 5.4 — Toast notification system

**File:** `apps/web/src/components/ui/toast.tsx` (NEW)
**Complexity:** 3
**Impact:** Non-blocking success/error notifications for API actions

Simple toast implementation using React context (no additional dependency needed):

```tsx
'use client'

import { createContext, useContext, useState, useCallback } from 'react'
import { cn } from '@/lib/utils'

type ToastType = 'success' | 'error' | 'info'

interface Toast {
  id: string
  message: string
  type: ToastType
}

interface ToastContextValue {
  toast: (message: string, type?: ToastType) => void
}

const ToastContext = createContext<ToastContextValue>({
  toast: () => {},
})

export function useToast() {
  return useContext(ToastContext)
}

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([])

  const addToast = useCallback((message: string, type: ToastType = 'info') => {
    const id = crypto.randomUUID()
    setToasts((prev) => [...prev, { id, message, type }])
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id))
    }, 3000)
  }, [])

  function dismiss(id: string) {
    setToasts((prev) => prev.filter((t) => t.id !== id))
  }

  return (
    <ToastContext.Provider value={{ toast: addToast }}>
      {children}
      {/* Toast container */}
      <div className="fixed bottom-4 right-4 z-[200] flex flex-col gap-2 pointer-events-none">
        {toasts.map((t) => (
          <div
            key={t.id}
            role="alert"
            className={cn(
              'pointer-events-auto flex items-center gap-3 rounded-lg border px-4 py-3 shadow-lg text-sm font-medium animate-in slide-in-from-bottom-2 fade-in duration-200',
              t.type === 'success' && 'bg-green-50 border-green-200 text-green-800 dark:bg-green-900/30 dark:border-green-800 dark:text-green-300',
              t.type === 'error' && 'bg-red-50 border-red-200 text-red-800 dark:bg-red-900/30 dark:border-red-800 dark:text-red-300',
              t.type === 'info' && 'bg-white border-gray-200 text-gray-800 dark:bg-gray-900 dark:border-gray-800 dark:text-gray-200',
            )}
          >
            <span className="flex-1">{t.message}</span>
            <button
              onClick={() => dismiss(t.id)}
              className="text-current opacity-50 hover:opacity-100 transition-opacity"
              aria-label="Dismiss"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  )
}
```

**Mount it** in the dashboard layout (wrapping `{children}`):

```tsx
import { ToastProvider } from '@/components/ui/toast'

// Inside the layout:
<main className="flex-1 p-6 lg:p-8">
  <ToastProvider>
    {children}
  </ToastProvider>
</main>
```

**Usage example** (in any dashboard page):
```tsx
import { useToast } from '@/components/ui/toast'

function MyComponent() {
  const { toast } = useToast()

  async function handleAction() {
    try {
      await doSomething()
      toast('Action completed successfully', 'success')
    } catch {
      toast('Failed to complete action', 'error')
    }
  }
}
```

### Step 5.5 — Add Cmd+K shortcut hint to dashboard header

**File:** `apps/web/src/app/(dashboard)/layout.tsx`
**Complexity:** 1
**Impact:** Users discover the command palette

Add a desktop-only top bar inside the main content area, above `{children}`:

```tsx
{/* Desktop top bar with search hint */}
<div className="hidden lg:flex items-center justify-end gap-4 px-8 py-3 border-b border-gray-200 dark:border-gray-800">
  <button
    onClick={() => {
      // Dispatch the keyboard event to trigger command palette
      document.dispatchEvent(new KeyboardEvent('keydown', { key: 'k', metaKey: true }))
    }}
    className="flex items-center gap-2 text-sm text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors"
  >
    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z" />
    </svg>
    <span>Search...</span>
    <kbd className="rounded border border-gray-300 dark:border-gray-700 px-1.5 py-0.5 font-mono text-[10px]">&#8984;K</kbd>
  </button>
  <ThemeToggle />
</div>
```

---

## Phase 6: Uncovered Pages & Research Gaps

**Goal:** Address all remaining pages and features identified in the UI audit, data viz, marketing, and Tailwind/shadcn research teams that Phases 1-5 do not cover.

### Step 6.1 — Auth pages (login/register) Clerk theming with brand colors and dark mode

**Files:**
- `apps/web/src/app/(auth)/login/page.tsx`
- `apps/web/src/app/(auth)/register/page.tsx`

**Complexity:** 2
**Impact:** Auth pages use SettleGrid brand colors and work in dark mode instead of bare Clerk defaults

Currently both pages use minimal `appearance` props. Expand to include brand tokens and dark mode support:

```tsx
// In both login/page.tsx and register/page.tsx, update the appearance prop:
appearance={{
  variables: {
    colorPrimary: '#10B981',          // brand emerald
    colorText: '#1A1F3A',             // indigo
    colorBackground: '#FFFFFF',
    colorInputBackground: '#FFFFFF',
    colorInputText: '#1A1F3A',
    borderRadius: '0.5rem',
    fontFamily: "'Outfit', system-ui, sans-serif",
  },
  elements: {
    rootBox: 'mx-auto',
    card: 'shadow-lg border border-gray-200 dark:border-gray-800 dark:bg-gray-900',
    headerTitle: 'text-indigo dark:text-white',
    headerSubtitle: 'text-gray-500 dark:text-gray-400',
    formButtonPrimary: 'bg-brand hover:bg-brand-dark',
    footerActionLink: 'text-brand-text hover:text-brand-dark',
  },
}}
```

Also update the wrapper div for dark mode:
```tsx
// OLD
<div className="min-h-screen flex items-center justify-center px-4 bg-cloud">
// NEW
<div className="min-h-screen flex items-center justify-center px-4 bg-cloud dark:bg-gray-950">
```

### Step 6.2 — Gate page dark mode support

**File:** `apps/web/src/app/gate/page.tsx`
**Complexity:** 1
**Impact:** Gate page respects dark mode (already uses dark bg so changes are minimal)

The gate page already uses `bg-indigo` which works in both modes. Add dark mode for the input and error states:

```tsx
// Input field — add dark variants:
// OLD (find the <input> element)
className="w-full px-4 py-3 rounded-lg bg-white/10 border border-white/20 text-white placeholder-white/40 ..."
// This already works in dark mode since it uses white/opacity patterns. No change needed.
```

Verify the gate page works in dark mode — since it uses `bg-indigo` with white text and white/opacity borders, it inherently works. Mark as verified, no code changes needed.

### Step 6.3 — Docs page syntax highlighting with keyword coloring

**File:** `apps/web/src/app/docs/page.tsx`
**Complexity:** 3
**Impact:** Code blocks gain syntax-highlighted keywords, improving readability and professional appearance

Replace the `CodeBlock` function with a version that applies keyword coloring (same approach as the marketing code snippet):

```tsx
function CodeBlock({ children, title }: { children: string; title?: string }) {
  // Simple keyword highlighting via regex replacement
  const highlighted = children
    .replace(/(import|from|const|async|await|export|function|return|interface|type|string|number|boolean)\b/g,
      '<span class="text-violet-400">$1</span>')
    .replace(/'[^']*'/g, '<span class="text-emerald-400">$&</span>')
    .replace(/\/\/[^\n]*/g, '<span class="text-gray-500">$&</span>')
    .replace(/\b(\d+)\b/g, '<span class="text-amber-400">$1</span>')

  return (
    <div className="my-4">
      {title && <div className="bg-gray-700 text-gray-300 text-xs px-4 py-2 rounded-t-lg font-mono">{title}</div>}
      <div className={`bg-[#0D1117] text-gray-300 text-sm font-mono p-4 overflow-x-auto ${title ? 'rounded-b-lg' : 'rounded-lg'}`}>
        <pre><code dangerouslySetInnerHTML={{ __html: highlighted }} /></pre>
      </div>
    </div>
  )
}
```

Note: This uses `dangerouslySetInnerHTML` which is safe here because the code content is hardcoded in the source file, not user-supplied. The regex approach avoids adding a syntax highlighting dependency (prismjs/shiki) while providing 80% of the visual benefit.

### Step 6.4 — Docs page search with Cmd+K integration

**File:** `apps/web/src/app/docs/page.tsx`
**Complexity:** 2
**Impact:** Users can search docs sections with a search input in the sidebar

Add a search input at the top of the docs sidebar that filters the navigation links:

```tsx
// At the top of the sidebar <nav>, add:
<div className="mb-4">
  <input
    type="search"
    placeholder="Search docs..."
    className="w-full px-3 py-2 text-sm rounded-md border border-gray-200 bg-white placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-brand focus:border-transparent dark:bg-gray-900 dark:border-gray-700 dark:text-gray-100"
    onChange={(e) => {
      const query = e.target.value.toLowerCase()
      document.querySelectorAll('[data-doc-section]').forEach((el) => {
        const text = el.getAttribute('data-doc-section') || ''
        ;(el as HTMLElement).style.display = text.includes(query) ? '' : 'none'
      })
    }}
  />
</div>
```

Add `data-doc-section={item.label.toLowerCase()}` to each sidebar nav link for filtering.

Note: Since the docs page is a Server Component, convert the sidebar to a client component or extract a `DocsSearchSidebar` client component.

### Step 6.5 — Docs page "Time to first API call" metric

**File:** `apps/web/src/app/docs/page.tsx`
**Complexity:** 1
**Impact:** Developer confidence — shows how fast integration is

Add a callout box at the top of the Quick Start section:

```tsx
// Inside the Quick Start <Section>, before the first <p>, add:
<div className="flex items-center gap-3 p-4 rounded-lg bg-brand/5 border border-brand/20 mb-6">
  <div className="w-10 h-10 rounded-full bg-brand/10 flex items-center justify-center shrink-0">
    <svg className="w-5 h-5 text-brand" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" />
    </svg>
  </div>
  <div>
    <p className="text-sm font-semibold text-indigo">Under 5 minutes to first API call</p>
    <p className="text-xs text-gray-500">Install, wrap, deploy. Most developers are billing in under 5 minutes.</p>
  </div>
</div>
```

### Step 6.6 — Docs page dark mode

**File:** `apps/web/src/app/docs/page.tsx`
**Complexity:** 2
**Impact:** Docs page works correctly in dark mode

Apply dark mode classes:

```tsx
// Header
// OLD
<header className="border-b border-gray-200 px-6 py-4 sticky top-0 bg-white z-10">
// NEW
<header className="border-b border-gray-200 px-6 py-4 sticky top-0 bg-white z-10 dark:bg-gray-950 dark:border-gray-800">

// Sidebar
// OLD
<aside className="hidden lg:block w-56 border-r border-gray-200 p-6 ...">
// NEW
<aside className="hidden lg:block w-56 border-r border-gray-200 p-6 ... dark:border-gray-800">

// Sidebar links
// OLD
className="block py-2 px-3 rounded-md text-gray-600 hover:text-indigo hover:bg-gray-100 transition-colors"
// NEW
className="block py-2 px-3 rounded-md text-gray-600 hover:text-indigo hover:bg-gray-100 transition-colors dark:text-gray-400 dark:hover:text-white dark:hover:bg-gray-800"

// Section headings
// Add dark:text-white to all h2 elements

// Body text
// Add dark:text-gray-400 to all text-gray-600 paragraphs

// Inline code
// OLD
className="bg-gray-100 px-1.5 py-0.5 rounded text-xs"
// NEW
className="bg-gray-100 px-1.5 py-0.5 rounded text-xs dark:bg-gray-800"
```

### Step 6.7 — Privacy and Terms pages dark mode

**Files:**
- `apps/web/src/app/privacy/page.tsx`
- `apps/web/src/app/terms/page.tsx`

**Complexity:** 1
**Impact:** Legal pages work correctly in dark mode

Both pages share an identical structure. Apply these changes to both:

```tsx
// Header
// OLD
<header className="border-b border-gray-200 px-6 py-4">
// NEW
<header className="border-b border-gray-200 px-6 py-4 dark:border-gray-800 dark:bg-gray-950">

// Header nav links
// Add dark:text-gray-400 dark:hover:text-white to text-gray-600 links

// Page title h1
// Add dark:text-white to text-indigo

// Section title h2
// Add dark:text-white to text-indigo

// Body text
// Add dark:text-gray-400 to text-gray-600 content

// Footer
// Add dark:border-gray-800 to footer border
```

### Step 6.8 — Marketplace page (/tools) dark mode

**File:** `apps/web/src/app/tools/page.tsx`
**Complexity:** 1
**Impact:** Marketplace landing page works in dark mode

Apply the same dark mode pattern as privacy/terms pages:

```tsx
// Header: add dark:border-gray-800 dark:bg-gray-950
// Header links: add dark:text-gray-400 dark:hover:text-white
// Content area: add dark:text-gray-400 to body text
```

### Step 6.9 — Typewriter animation for hero code snippet

**File:** `apps/web/src/components/marketing/code-snippet.tsx`
**Complexity:** 3
**Impact:** Code appears to type itself out in the hero, drawing attention and demonstrating the SDK

Update the CodeSnippet component created in Step 3.2 to include a typewriter effect on first render:

```tsx
// Add to CodeSnippet component state:
const [displayedChars, setDisplayedChars] = useState(0)
const [isTyping, setIsTyping] = useState(true)

useEffect(() => {
  if (!isTyping) return
  if (displayedChars >= RAW_CODE.length) {
    setIsTyping(false)
    return
  }
  const timeout = setTimeout(() => {
    setDisplayedChars((prev) => Math.min(prev + 2, RAW_CODE.length)) // 2 chars at a time for speed
  }, 15) // 15ms per tick = fast typewriter
  return () => clearTimeout(timeout)
}, [displayedChars, isTyping])

// In the <pre>, conditionally show partial code:
<pre className="text-gray-300 leading-relaxed">
  <code>{isTyping ? RAW_CODE.slice(0, displayedChars) : RAW_CODE}</code>
  {isTyping && <span className="inline-block w-2 h-4 bg-brand animate-pulse ml-0.5" />}
</pre>
```

Note: The blinking cursor (`animate-pulse` on a green block) disappears once typing completes. The `slice(0, displayedChars)` approach is simple and avoids complex token-by-token rendering. The full syntax-colored version shows after typing finishes.

### Step 6.10 — Annual/monthly pricing toggle

**File:** `apps/web/src/app/page.tsx` (PricingSection function)
**Complexity:** 2
**Impact:** Users can see annual discount, increasing perceived value

Since `page.tsx` is a Server Component (exports `metadata`), extract the pricing section to a client component.

**File:** `apps/web/src/components/marketing/pricing-section.tsx` (NEW)

```tsx
'use client'

import { useState } from 'react'
import Link from 'next/link'

export function PricingSection() {
  const [annual, setAnnual] = useState(false)

  const tiers = [
    {
      name: 'Free',
      monthlyPrice: 0,
      annualPrice: 0,
      // ... same as Step 3.6 but with both prices
    },
    {
      name: 'Builder',
      monthlyPrice: 29,
      annualPrice: 24, // ~17% discount
      // ...
    },
    {
      name: 'Scale',
      monthlyPrice: 99,
      annualPrice: 79, // ~20% discount
      highlighted: true,
      // ...
    },
    {
      name: 'Platform',
      monthlyPrice: 299,
      annualPrice: 249, // ~17% discount
      // ...
    },
  ]

  return (
    <div className="text-center">
      <h2 className="text-3xl font-bold text-indigo mb-4">Simple, Transparent Pricing</h2>
      <p className="text-gray-600 mb-6 max-w-xl mx-auto">
        Start free. Scale as you grow. You always keep the majority of your revenue.
      </p>

      {/* Annual/Monthly toggle */}
      <div className="flex items-center justify-center gap-3 mb-10">
        <span className={`text-sm font-medium ${!annual ? 'text-indigo' : 'text-gray-500'}`}>Monthly</span>
        <button
          onClick={() => setAnnual(!annual)}
          className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${annual ? 'bg-brand' : 'bg-gray-300'}`}
          role="switch"
          aria-checked={annual}
          aria-label="Toggle annual billing"
        >
          <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${annual ? 'translate-x-6' : 'translate-x-1'}`} />
        </button>
        <span className={`text-sm font-medium ${annual ? 'text-indigo' : 'text-gray-500'}`}>
          Annual
          <span className="ml-1.5 inline-flex items-center rounded-full bg-brand/10 px-2 py-0.5 text-xs font-semibold text-brand-text">
            Save 20%
          </span>
        </span>
      </div>

      {/* ... rest of pricing cards using annual ? tier.annualPrice : tier.monthlyPrice ... */}
    </div>
  )
}
```

In `page.tsx`, replace the inline `PricingSection` function with:
```tsx
import { PricingSection } from '@/components/marketing/pricing-section'
// Remove the old PricingSection function definition
```

### Step 6.11 — GitHub stars badge and npm downloads on homepage

**File:** `apps/web/src/app/page.tsx`
**Complexity:** 1
**Impact:** Social proof for developers — shows real adoption metrics

Add badges in the hero section, below the subtitle items (after the "Free to start / No monthly fees / <50ms overhead" line):

```tsx
<div className="flex items-center gap-4 mt-4">
  <a
    href="https://github.com/settlegrid/mcp"
    target="_blank"
    rel="noopener noreferrer"
    className="inline-flex items-center gap-1.5 text-xs font-medium text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 transition-colors"
  >
    <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
      <path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23A11.509 11.509 0 0112 5.803c1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576C20.566 21.797 24 17.3 24 12c0-6.627-5.373-12-12-12z" />
    </svg>
    <img src="https://img.shields.io/github/stars/settlegrid/mcp?style=flat&color=10B981" alt="GitHub stars" className="h-5" />
  </a>
  <a
    href="https://www.npmjs.com/package/@settlegrid/mcp"
    target="_blank"
    rel="noopener noreferrer"
    className="inline-flex items-center gap-1.5 text-xs font-medium text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 transition-colors"
  >
    <img src="https://img.shields.io/npm/dm/@settlegrid/mcp?style=flat&color=0EA5E9" alt="npm downloads" className="h-5" />
  </a>
</div>
```

Note: These use shields.io badges which auto-update. Replace repo URLs with the actual GitHub/npm paths once they are public.

### Step 6.12 — Architecture diagram for trust/enterprise section

**File:** `apps/web/src/app/page.tsx`
**Complexity:** 2
**Impact:** Visual explanation of the SettleGrid architecture builds trust with enterprise buyers

Add an ASCII-to-CSS architecture diagram in the Enterprise section (after the trust badges added in Step 3.5):

```tsx
{/* Architecture diagram */}
<div className="mt-10 p-6 rounded-xl bg-white/5 border border-white/10">
  <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-4">Architecture</p>
  <div className="flex flex-col md:flex-row items-center gap-4 text-xs font-mono text-gray-300">
    <div className="px-4 py-3 rounded-lg bg-white/10 border border-white/20 text-center">
      <p className="font-semibold text-white mb-1">Your MCP Server</p>
      <p className="text-gray-400">sg.wrap(handler)</p>
    </div>
    <svg className="w-6 h-6 text-brand shrink-0 rotate-90 md:rotate-0" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 4.5L21 12m0 0l-7.5 7.5M21 12H3" />
    </svg>
    <div className="px-4 py-3 rounded-lg bg-brand/20 border border-brand/30 text-center">
      <p className="font-semibold text-white mb-1">SettleGrid API</p>
      <p className="text-gray-400">Redis metering + Stripe</p>
    </div>
    <svg className="w-6 h-6 text-brand shrink-0 rotate-90 md:rotate-0" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 4.5L21 12m0 0l-7.5 7.5M21 12H3" />
    </svg>
    <div className="px-4 py-3 rounded-lg bg-white/10 border border-white/20 text-center">
      <p className="font-semibold text-white mb-1">AI Consumer</p>
      <p className="text-gray-400">Claude / Cursor / API</p>
    </div>
  </div>
</div>
```

### Step 6.13 — Competitor comparison table enhancements

**File:** `apps/web/src/app/page.tsx`
**Complexity:** 2
**Impact:** Comparison table becomes more visually distinct and scannable

Enhance the existing `ComparisonTable` function:

```tsx
// 1. Add dark mode to the table:
// Table wrapper: add dark:border-gray-800
// Table header row: add dark:bg-gray-900 dark:text-gray-300
// Table rows: add dark:border-gray-800/50
// Feature name cells: add dark:text-gray-300

// 2. Add a "SettleGrid" column header highlight:
// The SettleGrid column header should have a brand background:
<th className="py-3 px-4 text-brand-text font-bold bg-brand/5 dark:bg-brand/10">SettleGrid</th>

// 3. Add hover highlighting to rows:
// OLD
<tr key={f.name} className="border-b border-gray-200">
// NEW
<tr key={f.name} className="border-b border-gray-200 dark:border-gray-800 hover:bg-gray-50 dark:hover:bg-gray-900/50 transition-colors">

// 4. Replace plain checkmarks with colored icons:
// SettleGrid checks: use brand green
// Competitor checks: use neutral gray-400
```

### Step 6.14 — SSE streaming with pulsing "Live" indicator for dashboard

**File:** `apps/web/src/components/ui/live-indicator.tsx` (NEW)
**Complexity:** 2
**Impact:** Real-time feel for dashboard data that updates via SSE or polling

```tsx
interface LiveIndicatorProps {
  /** Whether the connection is active */
  connected: boolean
  /** Optional label override */
  label?: string
}

export function LiveIndicator({ connected, label = 'Live' }: LiveIndicatorProps) {
  if (!connected) return null

  return (
    <div className="inline-flex items-center gap-1.5 text-xs font-medium text-brand-text">
      <span className="relative flex h-2 w-2">
        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-brand opacity-75" />
        <span className="relative inline-flex rounded-full h-2 w-2 bg-brand" />
      </span>
      {label}
    </div>
  )
}
```

Usage: Add to any dashboard page header that supports real-time updates:
```tsx
import { LiveIndicator } from '@/components/ui/live-indicator'

// In the header area, next to the page title:
<div className="flex items-center gap-3">
  <h1 className="text-2xl font-bold text-indigo">Dashboard</h1>
  <LiveIndicator connected={!!data} />
</div>
```

### Step 6.15 — Table status badges using existing Badge component

**File:** Multiple dashboard pages that render tables (webhooks, audit-log, payouts, fraud)
**Complexity:** 2
**Impact:** Consistent, colored status indicators across all dashboard tables

Define a shared status-to-variant mapping and use the existing Badge component:

```tsx
// In each page that renders a status in a table cell, replace raw text with Badge:
import { Badge } from '@/components/ui/badge'

// Status mapping helper (can be placed in lib/utils.ts or inline):
function statusVariant(status: string): 'default' | 'secondary' | 'destructive' | 'outline' {
  switch (status.toLowerCase()) {
    case 'active':
    case 'success':
    case 'delivered':
    case 'paid':
      return 'default' // green-ish via brand color
    case 'pending':
    case 'processing':
      return 'secondary'
    case 'failed':
    case 'error':
    case 'flagged':
      return 'destructive'
    default:
      return 'outline'
  }
}

// Usage in table cells:
// OLD
<td className="py-2">{webhook.status}</td>
// NEW
<td className="py-2"><Badge variant={statusVariant(webhook.status)}>{webhook.status}</Badge></td>
```

Pages to update:
- `dashboard/webhooks/page.tsx` — webhook delivery status
- `dashboard/audit-log/page.tsx` — event type badges
- `dashboard/payouts/page.tsx` — payout status
- `dashboard/fraud/page.tsx` — alert severity
- `consumer/page.tsx` — key status

### Step 6.16 — Virtual scrolling note for large datasets

**Complexity:** 0 (documentation note, no code change)
**Impact:** Ensures future scalability for large tables

Note for implementers: If any dashboard table (audit log, webhooks, analytics) exceeds 500 rows, consider adding `@tanstack/react-virtual` for virtual scrolling. The current implementation paginates server-side, so virtual scrolling is not immediately needed. If added later:

```bash
cd apps/web && npm install @tanstack/react-virtual
```

The audit-log and webhooks pages are the most likely candidates. Wrap the `<tbody>` with a virtualizer that renders only visible rows. This is deferred until data volumes justify the added complexity.

### Step 6.17 — Accessible chart wrappers with ARIA attributes

**Files:**
- `apps/web/src/components/charts/area-chart.tsx`
- `apps/web/src/components/charts/bar-chart.tsx`

**Complexity:** 1
**Impact:** Charts are accessible to screen readers per WCAG 2.1

Wrap each `<ResponsiveContainer>` in both chart components with an accessible container:

```tsx
// In AreaChart, wrap the return:
return (
  <div role="img" aria-label={`Area chart showing ${yKey} over ${xKey}`}>
    <ResponsiveContainer width="100%" height={height}>
      {/* ... existing chart ... */}
    </ResponsiveContainer>
  </div>
)

// In BarChart, wrap the return:
return (
  <div role="img" aria-label={`Bar chart showing ${yKey} by ${xKey}`}>
    <ResponsiveContainer width="100%" height={height}>
      {/* ... existing chart ... */}
    </ResponsiveContainer>
  </div>
)
```

Also update the chart prop interfaces to accept an optional `ariaLabel` prop:

```tsx
interface AreaChartProps {
  // ... existing props ...
  /** Accessible label for screen readers */
  ariaLabel?: string
}
```

Then use `ariaLabel` in `aria-label` if provided, falling back to the auto-generated label.

### Step 6.18 — Container queries for responsive dashboard cards

**File:** `apps/web/src/app/globals.css`
**Complexity:** 2
**Impact:** Dashboard stat cards and chart cards adapt to their container width, not just viewport width — critical for the collapsible sidebar (Step 5.3)

Add container query utilities after the dark mode overrides in `globals.css`:

```css
/* Container query support for responsive dashboard cards */
.card-container {
  container-type: inline-size;
}

/* When container is narrower than 300px, stack stat card content vertically */
@container (max-width: 300px) {
  .stat-card-content {
    flex-direction: column;
    align-items: flex-start;
  }
  .stat-card-content .text-3xl {
    font-size: 1.5rem;
  }
}

/* When container is narrower than 400px, reduce chart height */
@container (max-width: 400px) {
  .chart-wrapper {
    min-height: 120px;
  }
}
```

Apply `card-container` to Card wrappers in dashboard pages where responsive sizing matters:

```tsx
// In dashboard/page.tsx, wrap the stats grid:
<div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 card-container">
```

### Step 6.19 — Form validation components (react-hook-form + Zod)

**Complexity:** 2
**Impact:** Settings, webhooks, tools, and other forms get proper client-side validation with error states

Note: The codebase already uses `zod` for API route validation. This step adds form-level validation for the UI.

**File:** `apps/web/src/components/ui/form.tsx` (NEW)

Create a lightweight form wrapper that connects react-hook-form with the existing Input component:

```tsx
'use client'

import * as React from 'react'
import { useFormContext, Controller, type FieldPath, type FieldValues } from 'react-hook-form'
import { cn } from '@/lib/utils'

interface FormFieldProps {
  name: string
  label: string
  description?: string
  children: React.ReactNode
}

export function FormField({ name, label, description, children }: FormFieldProps) {
  const { formState: { errors } } = useFormContext()
  const error = errors[name]

  return (
    <div className="space-y-2">
      <label htmlFor={name} className="text-sm font-medium text-indigo dark:text-gray-200">
        {label}
      </label>
      {description && <p className="text-xs text-gray-500">{description}</p>}
      {children}
      {error && (
        <p className="text-xs text-red-600 dark:text-red-400" role="alert">
          {error.message as string}
        </p>
      )}
    </div>
  )
}

export function FormMessage({ className, ...props }: React.HTMLAttributes<HTMLParagraphElement>) {
  return (
    <p className={cn('text-xs text-red-600 dark:text-red-400', className)} role="alert" {...props} />
  )
}
```

react-hook-form is already installed (found in package.json via the zod resolver search). If not installed:

```bash
cd apps/web && npm install react-hook-form @hookform/resolvers
```

### Step 6.20 — @starting-style CSS-native entry animations (deferred)

**Complexity:** 0 (documentation note)
**Impact:** Future enhancement for CSS-only animations without JS

Note for implementers: The `@starting-style` CSS feature enables entry animations for elements that appear in the DOM (e.g., dialog overlays, dropdown menus) without needing JavaScript animation libraries. As of March 2026, browser support is approximately 85% (Chrome 117+, Safari 17.5+, Firefox 129+).

This is NOT added now because:
1. framer-motion already handles entry animations for Phase 3 (scroll reveal)
2. Radix UI components in Phase 1 use `data-[state=open]` animation classes
3. The toast component in Phase 5 uses Tailwind `animate-in` utilities

When browser support reaches 95%+, consider migrating toast and dropdown animations from JS to `@starting-style`:

```css
/* Example future migration for toast */
.toast-enter {
  @starting-style {
    opacity: 0;
    transform: translateY(8px);
  }
  opacity: 1;
  transform: translateY(0);
  transition: opacity 200ms, transform 200ms;
}
```

### Step 6.21 — next/font optimization verification

**Complexity:** 0 (verification step, no code change needed)
**Impact:** Confirms font loading is optimal

Verified: The root layout at `apps/web/src/app/layout.tsx` already uses the correct pattern:

```tsx
const outfit = Outfit({
  subsets: ['latin'],
  variable: '--font-sans',
  display: 'swap',
  weight: ['300', '400', '500', '600', '700'],
})
```

This is correct:
- `next/font/google` with `Outfit` — automatic self-hosting, no external network requests
- `display: 'swap'` — text visible immediately with fallback font, swaps when Outfit loads
- `variable: '--font-sans'` — CSS variable for Tailwind integration
- `subsets: ['latin']` — only loads Latin glyphs, reducing font file size

No changes needed. Mark as verified.

---

## Phase 6 Summary

| Step | File(s) | Complexity | Research Team |
|------|---------|------------|---------------|
| 6.1 | auth login/register | 2 | Team 1 (UI Audit) |
| 6.2 | gate page | 1 | Team 1 (UI Audit) |
| 6.3 | docs page code blocks | 3 | Team 1 (UI Audit) |
| 6.4 | docs page search | 2 | Team 1 (UI Audit) |
| 6.5 | docs "time to first API call" | 1 | Team 3 (Marketing) |
| 6.6 | docs dark mode | 2 | Team 1 (UI Audit) |
| 6.7 | privacy/terms dark mode | 1 | Team 1 (UI Audit) |
| 6.8 | marketplace dark mode | 1 | Team 1 (UI Audit) |
| 6.9 | typewriter animation | 3 | Team 3 (Marketing) |
| 6.10 | annual/monthly pricing toggle | 2 | Team 3 (Marketing) |
| 6.11 | GitHub stars / npm badges | 1 | Team 3 (Marketing) |
| 6.12 | architecture diagram | 2 | Team 3 (Marketing) |
| 6.13 | comparison table enhancements | 2 | Team 3 (Marketing) |
| 6.14 | SSE live indicator | 2 | Team 4 (Data Viz) |
| 6.15 | table status badges | 2 | Team 4 (Data Viz) |
| 6.16 | virtual scrolling (deferred) | 0 | Team 4 (Data Viz) |
| 6.17 | accessible chart ARIA attrs | 1 | Team 4 (Data Viz) |
| 6.18 | container queries | 2 | Team 5 (Tailwind) |
| 6.19 | form validation components | 2 | Team 5 (Tailwind) |
| 6.20 | @starting-style (deferred) | 0 | Team 5 (Tailwind) |
| 6.21 | next/font verification | 0 | Team 5 (Tailwind) |

**Phase 6 totals: 4 new files, 12+ modified files, 0-1 new npm packages, ~4 hours**

---

## Implementation Order (Recommended)

Execute phases in order. Within each phase, steps are numbered for dependency order.

| Phase | Steps | New Deps | New Files | Modified Files | Est. Time |
|-------|-------|----------|-----------|----------------|-----------|
| 1 | 1.1-1.8 | 7 npm packages | 5 component files | 2 files (globals.css, package.json) | 1 hour |
| 2 | 2.1-2.9 | 0 | 4 component files | 10+ dashboard pages | 3 hours |
| 3 | 3.1-3.8 | 0 | 3 component files | 1 file (page.tsx) | 3 hours |
| 4 | 4.1-4.6 | 0 | 1 component file | 8+ files | 2 hours |
| 5 | 5.1-5.5 | 0 | 2 component files | 2 files | 2 hours |
| 6 | 6.1-6.20 | 0-1 (react-hook-form if not present) | 4 component files | 12+ files | 4 hours |

**Total: 19 new files, 32+ modified files, 7-8 npm packages, ~15 hours of implementation**

Phase 6 depends on Phase 4 (dark mode infrastructure) being complete for steps 6.1-6.8. Steps 6.9-6.13 depend on Phase 3 (marketing polish). Steps 6.14-6.20 can run in parallel with any phase after Phase 1.

---

## Test Safety Checklist

After EVERY step, run:
```bash
cd /Users/lex/settlegrid && npm run test -- --run
```

Steps most likely to cause test failures:
- Step 2.1 (StatCard extraction) — ensure import paths are correct
- Step 2.4-2.5 (Recharts replacement) — ensure data mapping matches test expectations
- Step 4.1 (ThemeProvider) — ensure `suppressHydrationWarning` is present

Steps that should NEVER cause test failures:
- All Phase 1 steps (new files only)
- Steps 3.1-3.8 (homepage visual changes — tests don't cover pixel rendering)
- Step 5.1 (new component, no existing code changed)
- Steps 6.1-6.2, 6.5-6.8, 6.11-6.12, 6.14, 6.16-6.20 (CSS-only changes, new files, or verification steps)

Steps in Phase 6 that need care:
- Step 6.3 (docs CodeBlock rewrite) — if any test imports CodeBlock directly, update the import
- Step 6.9 (typewriter animation) — ensure the typing effect does not break snapshot tests of the hero section
- Step 6.10 (pricing toggle extraction) — ensure the PricingSection import is updated in page.tsx
- Step 6.15 (Badge in tables) — verify Badge component import path and that status strings match the mapping

---

## Files Index

### New Files (19 total)
```
apps/web/src/components/ui/skeleton.tsx          (Phase 1)
apps/web/src/components/ui/tooltip.tsx           (Phase 1)
apps/web/src/components/ui/dropdown-menu.tsx     (Phase 1)
apps/web/src/components/ui/tabs.tsx              (Phase 1)
apps/web/src/components/ui/dialog.tsx            (Phase 1)
apps/web/src/components/ui/stat-card.tsx         (Phase 2)
apps/web/src/components/ui/breadcrumbs.tsx       (Phase 2)
apps/web/src/components/ui/empty-state.tsx       (Phase 2)
apps/web/src/components/charts/area-chart.tsx    (Phase 2)
apps/web/src/components/charts/bar-chart.tsx     (Phase 2)
apps/web/src/components/marketing/code-snippet.tsx     (Phase 3)
apps/web/src/components/marketing/scroll-reveal.tsx    (Phase 3)
apps/web/src/components/marketing/home-sections.tsx    (Phase 3)
apps/web/src/components/ui/theme-toggle.tsx      (Phase 4)
apps/web/src/components/ui/toast.tsx             (Phase 5)
apps/web/src/components/command-palette.tsx       (Phase 5)
apps/web/src/components/ui/live-indicator.tsx     (Phase 6)
apps/web/src/components/marketing/pricing-section.tsx  (Phase 6)
apps/web/src/components/ui/form.tsx              (Phase 6)
```

### Modified Files (key ones)
```
apps/web/src/app/globals.css                     (Phase 1, 4, 6)
apps/web/src/app/layout.tsx                      (Phase 4)
apps/web/src/app/page.tsx                        (Phase 3, 6)
apps/web/src/app/(dashboard)/layout.tsx          (Phase 5)
apps/web/src/app/(dashboard)/dashboard/page.tsx  (Phase 2, 6)
apps/web/src/app/(dashboard)/dashboard/analytics/page.tsx  (Phase 2)
apps/web/src/app/(dashboard)/dashboard/health/page.tsx     (Phase 2)
apps/web/src/app/(dashboard)/dashboard/fraud/page.tsx      (Phase 2, 6)
apps/web/src/app/(dashboard)/dashboard/payouts/page.tsx    (Phase 2, 6)
apps/web/src/app/(dashboard)/dashboard/referrals/page.tsx  (Phase 2)
apps/web/src/app/(dashboard)/dashboard/webhooks/page.tsx   (Phase 2, 6)
apps/web/src/app/(dashboard)/dashboard/audit-log/page.tsx  (Phase 2, 6)
apps/web/src/app/(dashboard)/dashboard/settings/page.tsx   (Phase 2)
apps/web/src/app/(dashboard)/dashboard/reputation/page.tsx (Phase 2)
apps/web/src/app/(dashboard)/dashboard/tools/page.tsx      (Phase 2)
apps/web/src/app/(dashboard)/consumer/page.tsx   (Phase 2, 6)
apps/web/src/components/ui/card.tsx              (Phase 4)
apps/web/src/components/ui/button.tsx            (Phase 4)
apps/web/src/components/ui/badge.tsx             (Phase 4)
apps/web/src/components/ui/input.tsx             (Phase 4)
apps/web/src/app/(auth)/login/page.tsx           (Phase 6)
apps/web/src/app/(auth)/register/page.tsx        (Phase 6)
apps/web/src/app/docs/page.tsx                   (Phase 6)
apps/web/src/app/privacy/page.tsx                (Phase 6)
apps/web/src/app/terms/page.tsx                  (Phase 6)
apps/web/src/app/tools/page.tsx                  (Phase 6)
apps/web/src/components/charts/area-chart.tsx     (Phase 6 — ARIA)
apps/web/src/components/charts/bar-chart.tsx      (Phase 6 — ARIA)
```

### NPM Packages Added
```
framer-motion          — scroll reveal animations, number counting
next-themes            — dark mode with system preference
@radix-ui/react-tooltip       — accessible tooltips
@radix-ui/react-dropdown-menu — theme toggle dropdown
@radix-ui/react-tabs          — tabbed sections
@radix-ui/react-dialog        — command palette backdrop
cmdk                          — command palette search
react-hook-form               — form validation (if not already installed)
@hookform/resolvers            — zod resolver for react-hook-form (if not already installed)
sonner                         — toast notifications (replaces custom context, Step 5.4 amendment)
lucide-react                   — icon library (replaces inline SVGs)
```

---

## Amendments — SaaS Dashboard Research (Team 2)

The following amendments incorporate findings from the SaaS Dashboard research team. Each amendment targets a specific phase/step. **Do not rewrite existing steps — apply these as additive patches during implementation.**

### Amendment A — `tabular-nums` on ALL numeric displays (Phase 2)

**Applies to:** Step 2.1 (StatCard), plus all dashboard table pages

The plan applies `tabular-nums` only to the StatCard component. Per Team 2, **every numeric display** must use `font-variant-numeric: tabular-nums` to prevent column misalignment during updates. This includes:

- Revenue and balance figures in tables (payouts, analytics, referrals)
- Usage count columns (tools, consumer, audit-log)
- Timestamps rendered in fixed-width columns
- Any `<td>` or `<span>` rendering formatted numbers

**Implementation:** Add a global utility class in `globals.css`:

```css
/* After the @theme block */
.numeric {
  font-variant-numeric: tabular-nums;
}
```

Then apply `className="numeric"` (or `tabular-nums` directly) to all `<td>` cells containing numbers across dashboard table pages. The StatCard already has this — extend to: `payouts/page.tsx`, `analytics/page.tsx`, `referrals/page.tsx`, `audit-log/page.tsx`, `webhooks/page.tsx`, `tools/page.tsx`, `consumer/page.tsx`, `fraud/page.tsx`.

### Amendment B — Complete semantic color token set (Phase 1, Step 1.2)

**Applies to:** Step 1.2 (globals.css @theme block)

The current token set is missing interactive states and status colors. Add these tokens inside the existing `@theme` block:

```css
  /* ---- Semantic: interactive states ---- */
  --color-surface-hover: #F3F4F6;
  --color-surface-active: #E5E7EB;
  --color-border-strong: #D1D5DB;

  /* ---- Semantic: text tiers ---- */
  --color-text-tertiary: #9CA3AF;

  /* ---- Semantic: status ---- */
  --color-success: #059669;
  --color-warning: #D97706;
  --color-error: #DC2626;
  --color-info: #2563EB;
```

And corresponding dark mode overrides in Step 4.2:

```css
.dark {
  --color-surface-hover: #1E2438;
  --color-surface-active: #2A2F4A;
  --color-border-strong: #4B5563;
  --color-text-tertiary: #6B7280;
  --color-success: #34D399;
  --color-warning: #FBBF24;
  --color-error: #F87171;
  --color-info: #60A5FA;
}
```

### Amendment C — WCAG AA contrast warning for Emerald (Phase 1, Step 1.2)

**Applies to:** Step 1.2

**CRITICAL:** Emerald `#10B981` on white background **fails WCAG AA** (contrast ratio 3.4:1, minimum 4.5:1 required for normal text). The plan already defines `--color-brand-text: #047857` and `--color-brand-dark: #059669` — implementers **must** use these for any text rendered on white/light backgrounds:

- `#047857` (7.1:1) — primary green text on white
- `#059669` (5.1:1) — secondary green text on white
- `#10B981` — **buttons, badges, and decorative elements only** (large text or non-text)

Add this as a comment in `globals.css`:

```css
  /* ---- Brand ---- */
  /* WARNING: --color-brand (#10B981) fails WCAG AA on white (3.4:1).
     Use --color-brand-text (#047857) for text on light backgrounds.
     Use --color-brand-dark (#059669) for smaller interactive text.
     --color-brand is safe for: buttons, filled badges, large headings, decorative. */
```

### Amendment D — Replace custom toast with Sonner (Phase 5, Step 5.4)

**Applies to:** Step 5.4

Replace the custom React context toast implementation with [Sonner](https://sonner.emilkowal.dev/). Sonner provides:
- Stacked multi-toast with auto-dismiss
- Swipe-to-dismiss on mobile
- Promise toasts (loading -> success/error)
- Built-in dark mode support via `theme` prop
- Zero-config accessible announcements (aria-live)
- ~4KB gzipped

**Installation:**
```bash
cd apps/web && npm install sonner
```

**In `apps/web/src/app/layout.tsx`:**
```tsx
import { Toaster } from 'sonner'
// Inside the body, after children:
<Toaster
  position="bottom-right"
  theme="system"
  toastOptions={{
    className: 'font-sans',
    style: { fontFamily: 'var(--font-sans)' },
  }}
/>
```

**Usage (replaces `useToast()` calls):**
```tsx
import { toast } from 'sonner'
toast.success('API key created')
toast.error('Failed to save changes')
toast.promise(saveSettings(), {
  loading: 'Saving...',
  success: 'Settings saved',
  error: 'Failed to save',
})
```

This replaces the custom `ToastProvider` / `useToast` context. The `toast.tsx` file in the plan (Step 5.4) should be skipped entirely — Sonner handles everything.

### Amendment E — Elevation hierarchy with 6 shadow levels (Phase 1, Step 1.2)

**Applies to:** Step 1.2 (globals.css @theme block)

Replace the 2-level shadow system (`--shadow-card`, `--shadow-card-hover`) with a 6-level hierarchy:

```css
  /* ---- Elevation (6 levels) ---- */
  --shadow-xs: 0 1px 2px 0 rgba(0, 0, 0, 0.05);
  --shadow-sm: 0 1px 3px 0 rgba(0, 0, 0, 0.06), 0 1px 2px -1px rgba(0, 0, 0, 0.06);
  --shadow-md: 0 4px 6px -1px rgba(0, 0, 0, 0.07), 0 2px 4px -2px rgba(0, 0, 0, 0.05);
  --shadow-lg: 0 10px 15px -3px rgba(0, 0, 0, 0.08), 0 4px 6px -4px rgba(0, 0, 0, 0.04);
  --shadow-xl: 0 20px 25px -5px rgba(0, 0, 0, 0.08), 0 8px 10px -6px rgba(0, 0, 0, 0.04);
  --shadow-2xl: 0 25px 50px -12px rgba(0, 0, 0, 0.2);
```

Usage guide:
| Level | Token | Use case |
|-------|-------|----------|
| 0 | (none) | Flat elements, table rows |
| 1 | `--shadow-xs` | Subtle input borders, dividers |
| 2 | `--shadow-sm` | Cards at rest, sidebar |
| 3 | `--shadow-md` | Cards on hover, dropdowns |
| 4 | `--shadow-lg` | Modals, command palette |
| 5 | `--shadow-xl` | Popovers, floating panels |
| 6 | `--shadow-2xl` | Full-screen overlays |

Keep `--shadow-card` and `--shadow-card-hover` as aliases for backward compatibility:
```css
  --shadow-card: var(--shadow-sm);
  --shadow-card-hover: var(--shadow-md);
```

### Amendment F — Lucide-react for icons (Phase 2+)

**Applies to:** All phases using inline SVGs

Replace inline SVG icons with [lucide-react](https://lucide.dev/) throughout the plan. Benefits:
- Tree-shakeable (only bundles icons actually imported)
- Consistent 24x24 grid, 1.5px stroke
- ~200 bytes per icon vs 300-500 bytes for inline SVGs
- TypeScript props (`size`, `strokeWidth`, `color`, `className`)

**Installation:**
```bash
cd apps/web && npm install lucide-react
```

**Example migration (EmptyState in Step 2.8):**
```tsx
// Before (inline SVG):
<svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
  <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 18.75a60.07..." />
</svg>

// After (lucide-react):
import { Wallet } from 'lucide-react'
<Wallet className="w-6 h-6" strokeWidth={1.5} />
```

Apply to: StatCard trend arrows, EmptyState icons, theme toggle icons, navigation icons, status indicators, and any other inline SVGs in the plan.

### Amendment G — Empty states with actionable CLI commands (Phase 2, Step 2.8)

**Applies to:** Step 2.8 (EmptyState component)

Developer-facing empty states should show **actual CLI commands**, not just descriptions. SettleGrid's audience is developers — give them copy-pasteable next steps.

Update the EmptyState component to support a `code` prop:

```tsx
interface EmptyStateProps {
  icon: React.ReactNode
  title: string
  description: string
  code?: string            // <-- NEW: CLI command to display
  actionLabel?: string
  actionHref?: string
  onAction?: () => void
}

// Inside the component, after the description <p>:
{code && (
  <pre className="mt-3 mb-4 rounded-lg bg-gray-900 px-4 py-3 text-sm text-gray-100 font-mono select-all">
    <code>{code}</code>
  </pre>
)}
```

Example usages:
- Tools page: `code="npm install @settlegrid/mcp"`
- Webhooks page: `code="curl -X POST https://api.settlegrid.ai/v1/webhooks ..."`
- API Keys page: `code="settlegrid.init({ apiKey: 'sg_live_...' })"`
- Analytics: `code="npx @settlegrid/mcp test --dry-run"`

### Amendment H — Form validation with `:user-invalid`, `aria-invalid`, `aria-describedby` (Phase 6, Step 6.19)

**Applies to:** Step 6.19 (FormField component)

The current FormField uses `role="alert"` but lacks proper ARIA bindings. Update the component:

```tsx
export function FormField({ name, label, description, children }: FormFieldProps) {
  const { formState: { errors } } = useFormContext()
  const error = errors[name]
  const errorId = `${name}-error`
  const descId = description ? `${name}-desc` : undefined

  return (
    <div className="space-y-2">
      <label htmlFor={name} className="text-sm font-medium text-indigo dark:text-gray-200">
        {label}
      </label>
      {description && (
        <p id={descId} className="text-xs text-gray-500">{description}</p>
      )}
      {/* Clone child to inject aria attributes */}
      {React.Children.map(children, (child) =>
        React.isValidElement(child)
          ? React.cloneElement(child as React.ReactElement, {
              'aria-invalid': error ? 'true' : undefined,
              'aria-describedby': [error && errorId, descId].filter(Boolean).join(' ') || undefined,
            })
          : child
      )}
      {error && (
        <p id={errorId} className="text-xs text-red-600 dark:text-red-400" role="alert" aria-live="polite">
          {error.message as string}
        </p>
      )}
    </div>
  )
}
```

Also add a CSS rule in `globals.css` to use `:user-invalid` instead of `:invalid` for native form styling (prevents validation flash before user interaction):

```css
/* Native validation — only show error styling after user interaction */
input:user-invalid,
select:user-invalid,
textarea:user-invalid {
  border-color: var(--color-error);
  outline-color: var(--color-error);
}
```

### Amendment I — Dark mode urgency context (Phase 4)

**Applies to:** Phase 4 introduction

Add this context to the Phase 4 preamble: **82% of developer users prefer dark mode** (JetBrains Developer Survey 2024, Stack Overflow Developer Survey 2024). For a developer-facing product like SettleGrid, dark mode is not a nice-to-have — it is a launch requirement. Ship Phase 4 before any public beta or marketing launch. Do not deprioritize.

---

## Convergence Status

All 10 SaaS Dashboard Research (Team 2) findings have been reviewed:

| # | Finding | Status | Amendment |
|---|---------|--------|-----------|
| 1 | `tabular-nums` on all numerics | Was partial (StatCard only) | **A** — extended to all tables |
| 2 | Semantic color tokens | Was partial (missing 8 tokens) | **B** — added hover/active/strong/tertiary/status |
| 3 | WCAG AA Emerald contrast | Was implicit | **C** — explicit warning + usage guide |
| 4 | Sonner for toasts | Was missing (custom context) | **D** — replaced with Sonner |
| 5 | 6-level elevation hierarchy | Was missing (2 levels only) | **E** — 6 shadow levels + aliases |
| 6 | Lucide-react for icons | Was missing (inline SVGs) | **F** — lucide-react recommended |
| 7 | `tabular-nums` for numeric columns | Same as #1 | **A** — covered |
| 8 | CLI commands in empty states | Was missing | **G** — `code` prop + examples |
| 9 | `:user-invalid` + ARIA bindings | Was missing | **H** — aria-invalid/describedby + CSS |
| 10 | Dark mode urgency (82% stat) | Was missing context | **I** — urgency framing added |

**CONVERGENCE REACHED.** No further amendments needed from any research team.
