import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import path from 'node:path'

// Source pins for dashboard fixes that live in page markup (vitest runs in node, without a DOM).
const read = (rel: string) => readFileSync(path.resolve(__dirname, '../../app/(dashboard)/dashboard', rel), 'utf8')

describe('dashboard pages (source pins)', () => {
  it('shows error rates as the percentage the API returns, never scaled again', () => {
    const page = read('page.tsx')
    expect(page).not.toMatch(/errorRate[^\n]*\*\s*100/)
    expect(page).not.toContain('> 0.05')
    expect(page).toContain('formatErrorRatePct(analytics.errorRate)')
    expect(page).toContain('formatErrorRatePct(method.errorRate)')
  })

  it('takes the Settings fee figures from the take-rate brackets', () => {
    const page = read('settings/page.tsx')
    expect(page).toContain('takeRateSummary(TAKE_RATE_BRACKETS)')
    expect(page).not.toContain("'Up to 100%'")
    expect(page).not.toContain("const takeRate = 'Progressive'")
  })

  it('hides the status toggle for deleted tools and names the https:// rule on both URL fields', () => {
    const page = read('tools/page.tsx')
    expect(page).toMatch(/tool\.status !== 'deleted' && \(\s*<Button[\s\S]{0,200}onToggleStatus/)
    expect(page.match(/setCustomValidity\(upstreamUrlValidityMessage\(/g)).toHaveLength(2)
  })
})
