import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import path from 'node:path'

// Source pins for the dashboard home page's use of the stats and forecast responses
// (vitest runs in node, without a DOM).
const page = readFileSync(path.resolve(__dirname, '../../app/(dashboard)/dashboard/page.tsx'), 'utf8')

describe('dashboard home page (source pins)', () => {
  it('ticks Getting Started from tools created and from any call, not from the active-tool count', () => {
    expect(page).toContain('(stats?.toolsCreated ?? stats?.toolCount ?? 0) > 0')
    expect(page).toContain('stats?.hasInvocations ?? (stats?.totalInvocations ?? 0) > 0')
    expect(page).toMatch(/title="Active Tools"[\s\S]{0,120}subtitle="Live now"/)
  })

  it('shows a "not enough data" forecast card ahead of the projection card', () => {
    expect(page).toMatch(/forecastData\?\.insufficientData \? \([\s\S]{0,600}Not enough data yet\.[\s\S]{0,400}forecastData\.dailyDataPoints\} so far/)
  })

  it('says so when a developer with tools had no calls in the last 24 hours', () => {
    expect(page).toContain("hasTools ? 'No calls in the last 24 hours.'")
  })
})
