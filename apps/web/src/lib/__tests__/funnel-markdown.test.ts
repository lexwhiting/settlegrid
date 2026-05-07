/**
 * P5.1 — Tests for the pure formatters + markdown builder.
 *
 * The CLI script and the dashboard share these formatters via
 * `lib/funnel-markdown.ts`. Tests live here (web's vitest runner)
 * because the script can't easily host its own runner under turbo.
 *
 * Coverage:
 *   - `fmtNum`: locale-formatted integers, NaN/Infinity → '0'
 *   - `fmtPct`: null/NaN/Infinity → 'n/a', regular rates → '<n>%'
 *   - `fmtMinutes`: each branch in the duration table
 *   - `buildMarkdown`: section structure, edge cases (empty arrays),
 *     spike/dip thresholds, hour-clustering peak-share branches.
 */
import { describe, it, expect } from 'vitest'
import { fmtNum, fmtPct, fmtMinutes, buildMarkdown } from '../funnel-markdown'
import type { FunnelData } from '../funnel-queries'

describe('fmtNum', () => {
  it('formats integers with locale grouping', () => {
    expect(fmtNum(0)).toBe('0')
    expect(fmtNum(1)).toBe('1')
    expect(fmtNum(1234)).toBe('1,234')
    expect(fmtNum(1_000_000)).toBe('1,000,000')
  })

  it('returns "0" for NaN and Infinity (NaN-safe)', () => {
    expect(fmtNum(Number.NaN)).toBe('0')
    expect(fmtNum(Number.POSITIVE_INFINITY)).toBe('0')
    expect(fmtNum(Number.NEGATIVE_INFINITY)).toBe('0')
  })

  it('formats decimals (passes through to Intl)', () => {
    // The function name is fmtNum but it doesn't enforce integers — it
    // just delegates to Intl.NumberFormat. Guard the contract.
    expect(fmtNum(1.5)).toBe('1.5')
  })
})

describe('fmtPct', () => {
  it('formats rates as percent with 1 decimal', () => {
    expect(fmtPct(0)).toBe('0.0%')
    expect(fmtPct(0.5)).toBe('50.0%')
    expect(fmtPct(0.625)).toBe('62.5%')
    expect(fmtPct(1)).toBe('100.0%')
  })

  it('returns "n/a" for null', () => {
    expect(fmtPct(null)).toBe('n/a')
  })

  it('returns "n/a" for NaN/Infinity', () => {
    expect(fmtPct(Number.NaN)).toBe('n/a')
    expect(fmtPct(Number.POSITIVE_INFINITY)).toBe('n/a')
  })
})

describe('fmtMinutes', () => {
  it('returns "n/a" for null, NaN, zero, and negative inputs', () => {
    // The "<= 0" guard collapses no-data and degenerate-zero into the
    // same display state.
    expect(fmtMinutes(null)).toBe('n/a')
    expect(fmtMinutes(Number.NaN)).toBe('n/a')
    expect(fmtMinutes(0)).toBe('n/a')
    expect(fmtMinutes(-1)).toBe('n/a')
  })

  it('formats sub-minute durations as seconds (rounded)', () => {
    // The hostile-review fix: sub-3-second medians used to drop to 0
    // and render as "n/a"; now they show as "Ns".
    expect(fmtMinutes(0.025)).toBe('2s') // 1.5s → "2s"
    expect(fmtMinutes(0.5)).toBe('30s')
    expect(fmtMinutes(0.99)).toBe('59s')
  })

  it('formats 1m–60m as minutes with 1 decimal', () => {
    expect(fmtMinutes(1)).toBe('1.0m')
    expect(fmtMinutes(5.5)).toBe('5.5m')
    expect(fmtMinutes(59.9)).toBe('59.9m')
  })

  it('formats 60m–24h as hours with 1 decimal', () => {
    expect(fmtMinutes(60)).toBe('1.0h')
    expect(fmtMinutes(90)).toBe('1.5h')
    expect(fmtMinutes(1439)).toBe('24.0h')
  })

  it('formats >= 24h as days with 1 decimal', () => {
    expect(fmtMinutes(1440)).toBe('1.0d')
    expect(fmtMinutes(2880)).toBe('2.0d')
    expect(fmtMinutes(43_200)).toBe('30.0d')
  })
})

// ─── buildMarkdown fixture ─────────────────────────────────────────────────

function makeFunnelData(overrides: Partial<FunnelData> = {}): FunnelData {
  // Includes all 8 EVENT_NAMES so buildMarkdown's Section-1 loop has
  // a row for each. Numbers chosen to exercise the conversion-rate
  // and time-to-convert formatters.
  return {
    generatedAt: '2026-05-07T00:00:00.000Z',
    windowDays: 30,
    events: {
      gallery_viewed: { total: 100, unique: 80 },
      template_detail_viewed: { total: 60, unique: 50 },
      shadow_directory_viewed: { total: 4, unique: 3 },
      cli_install_started: { total: 30, unique: 25 },
      scaffold_success: { total: 20, unique: 18 },
      scaffold_failed: { total: 5, unique: 4 },
      sdk_first_init: { total: 15, unique: 12 },
      first_billed_call: { total: 8, unique: 7 },
    },
    daily: [
      { day: '2026-05-01', event: 'gallery_viewed', count: 12 },
      { day: '2026-05-02', event: 'gallery_viewed', count: 18 },
    ],
    dailyStats: {
      gallery_viewed: {
        total: 100,
        activeDays: 14,
        minNonZero: 1,
        median: 6,
        max: 24,
        peakDay: '2026-05-04',
        spikeRatio: 4,
      },
      template_detail_viewed: {
        total: 60,
        activeDays: 20,
        minNonZero: 1,
        median: 3,
        max: 5,
        peakDay: '2026-05-03',
        spikeRatio: 1.67,
      },
      shadow_directory_viewed: {
        total: 4,
        activeDays: 3,
        minNonZero: 1,
        median: 1,
        max: 2,
        peakDay: '2026-05-05',
        spikeRatio: 2,
      },
      cli_install_started: {
        total: 30,
        activeDays: 10,
        minNonZero: 1,
        median: 3,
        max: 4,
        peakDay: '2026-05-02',
        spikeRatio: 1.33,
      },
      scaffold_success: {
        total: 20,
        activeDays: 8,
        minNonZero: 1,
        median: 2,
        max: 3,
        peakDay: '2026-05-06',
        spikeRatio: 1.5,
      },
      scaffold_failed: {
        total: 5,
        activeDays: 4,
        minNonZero: 1,
        median: 1,
        max: 2,
        peakDay: '2026-05-04',
        spikeRatio: 2,
      },
      sdk_first_init: {
        total: 15,
        activeDays: 7,
        minNonZero: 1,
        median: 2,
        max: 3,
        peakDay: '2026-05-03',
        spikeRatio: 1.5,
      },
      first_billed_call: {
        total: 8,
        activeDays: 5,
        minNonZero: 1,
        median: 1,
        max: 3,
        peakDay: '2026-05-05',
        spikeRatio: 3,
      },
    },
    hourClusters: [
      { hourUtc: 14, count: 42 },
      { hourUtc: 15, count: 30 },
      { hourUtc: 16, count: 28 },
    ],
    conversions: [
      {
        fromStage: 'gallery_viewed',
        toStage: 'template_detail_viewed',
        fromUniques: 80,
        toUniques: 50,
        rate: 0.625,
        medianMinutesToConvert: 0.4,
      },
      {
        fromStage: 'template_detail_viewed',
        toStage: 'cli_install_started',
        fromUniques: 50,
        toUniques: 25,
        rate: 0.5,
        medianMinutesToConvert: 5.5,
      },
      {
        fromStage: 'cli_install_started',
        toStage: 'scaffold_success',
        fromUniques: 25,
        toUniques: 18,
        rate: 0.72,
        medianMinutesToConvert: 90,
      },
      {
        fromStage: 'scaffold_success',
        toStage: 'first_billed_call',
        fromUniques: 18,
        toUniques: 7,
        rate: 0.388,
        medianMinutesToConvert: null,
      },
    ],
    topTemplates: [
      { slug: 'classifier', successes: 12 },
      { slug: 'translator', successes: 8 },
    ],
    topErrors: [
      { code: 'ERR_NPM_INSTALL', failures: 3 },
      { code: 'ERR_NETWORK', failures: 2 },
    ],
    geoBreakdown: [
      { country: 'US', events: 70 },
      { country: 'GB', events: 15 },
    ],
    ...overrides,
  }
}

describe('buildMarkdown', () => {
  it('emits the generated-at HTML comment header', () => {
    const md = buildMarkdown(makeFunnelData())
    expect(md.startsWith('<!-- Generated by scripts/funnel-analysis.ts at 2026-05-07T00:00:00.000Z -->')).toBe(true)
  })

  it('includes Sections 1-4 headers and the founder-rewrite trailing comment', () => {
    const md = buildMarkdown(makeFunnelData())
    expect(md).toContain('## Section 1 — Raw event counts (30-day window)')
    expect(md).toContain('## Section 2 — Conversion rates between funnel stages')
    expect(md).toContain('## Section 3 — Dropoff diagnosis')
    expect(md).toContain('## Section 4 — Anomalies (spikes, dips, timezone effects)')
    expect(md).toContain(
      '<!-- Sections 5-6 (hypothesis comparison + recommendations) are founder rewrite. Do not generate these from data alone. -->',
    )
  })

  it('renders all 8 canonical events as rows in Section 1', () => {
    const md = buildMarkdown(makeFunnelData())
    // Every event shows up as a backticked cell in the table.
    for (const e of [
      'gallery_viewed',
      'template_detail_viewed',
      'shadow_directory_viewed',
      'cli_install_started',
      'scaffold_success',
      'scaffold_failed',
      'sdk_first_init',
      'first_billed_call',
    ]) {
      expect(md).toContain(`| \`${e}\` |`)
    }
  })

  it('formats Section 2 conversion rows with rate + time-to-convert', () => {
    const md = buildMarkdown(makeFunnelData())
    // 80 → 50 = 62.5% with 0.4-min (24s) median.
    expect(md).toContain(
      '| `gallery_viewed` → `template_detail_viewed` | 80 | 50 | 62.5% | 24s |',
    )
    // 5.5min → "5.5m"
    expect(md).toContain(
      '| `template_detail_viewed` → `cli_install_started` | 50 | 25 | 50.0% | 5.5m |',
    )
    // 90min → "1.5h"
    expect(md).toContain(
      '| `cli_install_started` → `scaffold_success` | 25 | 18 | 72.0% | 1.5h |',
    )
    // null medianMinutesToConvert → 'n/a'
    expect(md).toContain(
      '| `scaffold_success` → `first_billed_call` | 18 | 7 | 38.8% | n/a |',
    )
  })

  it('renders the per-stage uniques bullet list', () => {
    const md = buildMarkdown(makeFunnelData())
    // Stage 1 uses events.gallery_viewed.unique (80), others use the
    // toUniques from the conversions array.
    expect(md).toContain('- Stage 1 (`gallery_viewed`): **80** users')
    expect(md).toContain('- Stage 2 (`template_detail_viewed`): **50** users')
    expect(md).toContain('- Stage 3 (`cli_install_started`): **25** users')
    expect(md).toContain('- Stage 4 (`scaffold_success`): **18** users')
    expect(md).toContain('- Stage 5 (`first_billed_call`): **7** users')
  })

  it('sorts Section 3 dropoffs by absolute users lost (descending)', () => {
    const md = buildMarkdown(makeFunnelData())
    // gallery → template loses 30 (largest), template → cli loses 25,
    // success → billed loses 11, cli → success loses 7.
    const idxGallery = md.indexOf('`gallery_viewed` → `template_detail_viewed`: lost **30 users**')
    const idxTemplate = md.indexOf('`template_detail_viewed` → `cli_install_started`: lost **25 users**')
    const idxScaffold = md.indexOf('`scaffold_success` → `first_billed_call`: lost **11 users**')
    const idxCli = md.indexOf('`cli_install_started` → `scaffold_success`: lost **7 users**')
    expect(idxGallery).toBeGreaterThan(0)
    expect(idxTemplate).toBeGreaterThan(idxGallery)
    expect(idxScaffold).toBeGreaterThan(idxTemplate)
    expect(idxCli).toBeGreaterThan(idxScaffold)
  })

  it('renders top errors when present', () => {
    const md = buildMarkdown(makeFunnelData())
    expect(md).toContain('- `ERR_NPM_INSTALL`: 3 failures')
    expect(md).toContain('- `ERR_NETWORK`: 2 failures')
  })

  it('falls back to "no scaffold failures" placeholder when topErrors is empty', () => {
    const md = buildMarkdown(makeFunnelData({ topErrors: [] }))
    expect(md).toContain('- _(no scaffold failures in window)_')
  })

  it('lists Section 4 spikes (>= 2x) sorted by spikeRatio desc; omits sub-2x', () => {
    const md = buildMarkdown(makeFunnelData())
    // gallery_viewed spikeRatio=4 (top), first_billed_call=3,
    // shadow_directory_viewed=2, scaffold_failed=2 — all should appear.
    // Sub-2x (template_detail=1.67, cli_install=1.33, etc) excluded.
    expect(md).toContain('`gallery_viewed`: 24 on 2026-05-04 vs median 6 (4.0x)')
    expect(md).toContain('`first_billed_call`: 3 on 2026-05-05 vs median 1 (3.0x)')
    expect(md).not.toContain('`template_detail_viewed`: 5')
    expect(md).not.toContain('`cli_install_started`: 4')
    // Ordering: gallery (4x) before first_billed_call (3x).
    const idxGallery = md.indexOf('`gallery_viewed`: 24 on 2026-05-04')
    const idxBilled = md.indexOf('`first_billed_call`: 3 on 2026-05-05')
    expect(idxGallery).toBeLessThan(idxBilled)
  })

  it('falls back to "no spikes" placeholder when no events have ratio >= 2', () => {
    const md = buildMarkdown(
      makeFunnelData({
        // Force every spikeRatio below the threshold.
        dailyStats: Object.fromEntries(
          Object.entries(makeFunnelData().dailyStats).map(([k, v]) => [
            k,
            { ...v, spikeRatio: 1.5 },
          ]),
        ) as FunnelData['dailyStats'],
      }),
    )
    expect(md).toContain('- _(no events have a max-day-to-median-day ratio ≥ 2x)_')
  })

  it('lists Section 4 dips (activeDays < windowDays/2) sorted asc', () => {
    // windowDays=30 → threshold is 15. gallery=14 active days qualifies;
    // template_detail=20 does not. Several others qualify too.
    const md = buildMarkdown(makeFunnelData())
    expect(md).toContain('`gallery_viewed`: only 14 of 30 days had any events')
    expect(md).toContain('`scaffold_success`: only 8 of 30 days had any events')
    // template_detail had 20 active days — does NOT qualify as a dip.
    expect(md).not.toContain('`template_detail_viewed`: only 20 of 30 days')
  })

  it('falls back to "well-distributed" placeholder when no event has < 50% coverage', () => {
    const md = buildMarkdown(
      makeFunnelData({
        dailyStats: Object.fromEntries(
          Object.entries(makeFunnelData().dailyStats).map(([k, v]) => [
            k,
            { ...v, activeDays: 25 },
          ]),
        ) as FunnelData['dailyStats'],
      }),
    )
    expect(md).toContain('- _(no events with < 50% day coverage; activity is well-distributed)_')
  })

  it('flags concentrated peak hour with the >= 20% callout', () => {
    const md = buildMarkdown(makeFunnelData())
    // 14:00 UTC has 42/100 = 42%, well over 20%.
    expect(md).toContain('Peak hour: **14:00 UTC** with 42 events (42.0% of total)')
    expect(md).toContain('Concentration ≥ 20% in a single hour suggests a dominant timezone')
  })

  it('shows the "spread" message when no hour exceeds 20% share', () => {
    // Spread evenly across hours so peak is < 20%.
    const md = buildMarkdown(
      makeFunnelData({
        hourClusters: Array.from({ length: 24 }, (_, h) => ({ hourUtc: h, count: 10 })),
      }),
    )
    expect(md).toContain('Distribution is reasonably spread; no single timezone dominates.')
    expect(md).not.toContain('Concentration ≥ 20%')
  })

  it('zero-pads single-digit peak hour as "0H:00 UTC"', () => {
    const md = buildMarkdown(
      makeFunnelData({ hourClusters: [{ hourUtc: 3, count: 100 }] }),
    )
    expect(md).toContain('Peak hour: **03:00 UTC**')
  })

  it('falls back to placeholder when hourClusters is empty', () => {
    const md = buildMarkdown(makeFunnelData({ hourClusters: [] }))
    expect(md).toContain('- _(no `gallery_viewed` events in window)_')
  })

  it('renders top templates and falls back when empty', () => {
    expect(buildMarkdown(makeFunnelData())).toContain('- `classifier`: 12 successes')
    expect(buildMarkdown(makeFunnelData({ topTemplates: [] }))).toContain(
      '- _(no scaffold successes in window)_',
    )
  })

  it('renders geo breakdown and falls back when empty', () => {
    expect(buildMarkdown(makeFunnelData())).toContain('- `US`: 70 events')
    expect(buildMarkdown(makeFunnelData({ geoBreakdown: [] }))).toContain(
      '- _(no country-tagged events in window)_',
    )
  })

  it('Section 1 row uses peakDay value or "n/a" when null', () => {
    // Default fixture: gallery has peakDay '2026-05-04'. Override to null
    // and confirm 'n/a' shows up in the row.
    const data = makeFunnelData()
    const md = buildMarkdown({
      ...data,
      dailyStats: {
        ...data.dailyStats,
        gallery_viewed: { ...data.dailyStats.gallery_viewed, peakDay: null },
      },
    })
    // Row format: `| \`gallery_viewed\` | <total> | <unique> | <activeDays> | <min> | <median> | <max> | <peakDay or n/a> |`
    // With peakDay=null we expect the row to end with '| n/a |'.
    const galleryRow = md
      .split('\n')
      .find((l) => l.startsWith('| `gallery_viewed` |'))
    expect(galleryRow).toMatch(/\| n\/a \|$/)
  })
})
