#!/usr/bin/env npx tsx
/**
 * P5.1 — Funnel-analysis CLI for the day-60 memo.
 *
 * Runs the full funnel-queries module against PostHog and emits two
 * outputs: a JSON file of raw numbers (one per run), and a markdown
 * block printed to stdout that the founder pastes into
 * `docs/memos/funnel-analysis-day60.md` sections 1-4. Sections 5-6
 * (hypothesis comparison + Phase 5 recommendations) are founder rewrite
 * — this script does not generate them.
 *
 * ## Usage
 *
 *   POSTHOG_PERSONAL_API_KEY=phx_... \
 *   POSTHOG_PROJECT_ID=12345         \
 *     npx tsx scripts/funnel-analysis.ts [--days 30] [--out docs/memos/funnel-data-day60.json]
 *
 * Flags:
 *   --days N   Window size in days. Default 30.
 *   --out PATH Where to write the JSON output. Default
 *              `docs/memos/funnel-data-day60.json`.
 *   --quiet    Suppress the markdown stdout block; only write JSON.
 *
 * Exit codes:
 *   0 — success (data written + markdown emitted)
 *   1 — env vars missing or PostHog query failed
 *
 * The markdown block is intentionally terse and tabular. It's the
 * scaffolded data for sections 1-4 of the memo. Sections 5-6 of the
 * memo template carry founder-rewrite TODOs.
 */
import { writeFileSync, mkdirSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import {
  runFunnelQueries,
  type FunnelData,
} from '../apps/web/src/lib/funnel-queries.js'
import { buildMarkdown } from '../apps/web/src/lib/funnel-markdown.js'

interface CliArgs {
  days: number
  outPath: string
  quiet: boolean
}

function parseArgs(argv: string[]): CliArgs {
  const args: CliArgs = {
    days: 30,
    outPath: 'docs/memos/funnel-data-day60.json',
    quiet: false,
  }
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i]
    if (arg === '--days') {
      const next = argv[++i]
      const n = Number(next)
      if (!Number.isFinite(n) || n <= 0) {
        throw new Error(`--days requires a positive number, got ${next}`)
      }
      args.days = Math.floor(n)
    } else if (arg === '--out') {
      const next = argv[++i]
      if (!next) throw new Error('--out requires a path')
      args.outPath = next
    } else if (arg === '--quiet') {
      args.quiet = true
    } else if (arg === '-h' || arg === '--help') {
      // eslint-disable-next-line no-console
      console.log(USAGE)
      process.exit(0)
    } else {
      throw new Error(`Unknown argument: ${arg}`)
    }
  }
  return args
}

const USAGE = `Usage: funnel-analysis.ts [--days N] [--out PATH] [--quiet]

Required env:
  POSTHOG_PERSONAL_API_KEY  PostHog personal API key with project-read access
  POSTHOG_PROJECT_ID        Numeric project ID

Optional env:
  NEXT_PUBLIC_POSTHOG_HOST  Defaults to https://us.i.posthog.com
`

async function main(): Promise<number> {
  let cli: CliArgs
  try {
    cli = parseArgs(process.argv.slice(2))
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error(err instanceof Error ? err.message : err)
    // eslint-disable-next-line no-console
    console.error(USAGE)
    return 1
  }

  let data: FunnelData | null
  try {
    data = await runFunnelQueries({ days: cli.days })
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error(`PostHog query failed: ${err instanceof Error ? err.message : err}`)
    return 1
  }

  if (data === null) {
    // eslint-disable-next-line no-console
    console.error(
      'POSTHOG_PERSONAL_API_KEY and/or POSTHOG_PROJECT_ID are not set. ' +
        'See `--help` for required env. Exiting without writing.',
    )
    return 1
  }

  const outPath = resolve(process.cwd(), cli.outPath)
  mkdirSync(dirname(outPath), { recursive: true })
  writeFileSync(outPath, JSON.stringify(data, null, 2) + '\n', 'utf8')
  // eslint-disable-next-line no-console
  console.error(`✓ Wrote JSON: ${outPath}`)

  if (!cli.quiet) {
    // The markdown summary goes to stdout so the founder can pipe
    // (e.g. `... | pbcopy`) or redirect into the memo file.
    process.stdout.write(buildMarkdown(data) + '\n')
  }
  return 0
}

main().then(
  (code) => process.exit(code),
  (err) => {
    // eslint-disable-next-line no-console
    console.error(err)
    process.exit(1)
  },
)
