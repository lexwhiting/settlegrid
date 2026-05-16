#!/usr/bin/env node
/**
 * Rewrites the "Revenue Model" and "Revenue Examples" sections of every
 * open-source-servers/settlegrid-<slug>/monetization.md file to match
 * SettleGrid's canonical progressive-pricing promise (0% on first
 * $1,000/mo, then 2-5% above).
 *
 * Leaves the H1 (template name) and downstream sections (How It Works,
 * Adjusting Pricing, etc.) untouched. Idempotent: a second run on
 * already-rewritten files is a no-op (regex won't match the new
 * content).
 *
 * Usage:
 *   node scripts/fix-monetization-docs.js [--dry-run]
 */

const fs = require('node:fs')
const path = require('node:path')

const ROOT = path.join(__dirname, '..', 'open-source-servers')
const DRY_RUN = process.argv.includes('--dry-run')

const NEW_BODY = (templateName) => `## Revenue Model

This template uses **per-call pricing** via SettleGrid with **progressive
take rates**. The first \$1,000 of monthly revenue per developer is
fee-free; tiered fees apply only above that threshold.

| Tier                            | SettleGrid take | Your share |
|---------------------------------|-----------------|------------|
| First \$1,000 / month           | **0%**          | **100%**   |
| Above \$1,000 / month           | **2–5%** (volume-tiered) | **95–98%**  |

| Metric                                          | Value             |
|-------------------------------------------------|-------------------|
| **Price per call**                              | \$0.01 (1¢)       |
| **Your revenue per call — first \$1,000/mo**    | \$0.0100 (100%)   |
| **Your revenue per call — above \$1,000/mo**    | \$0.0095–\$0.0098 |

## Revenue Examples (at $0.01 / call)

| Monthly Calls | Gross Revenue | SettleGrid Fee       | Your Revenue   |
|---------------|---------------|----------------------|----------------|
| 1,000         | \$10          | **\$0** (under \$1k)  | **\$10**       |
| 10,000        | \$100         | **\$0** (under \$1k)  | **\$100**      |
| 100,000       | \$1,000       | **\$0** (at \$1k cap) | **\$1,000**    |
| 1,000,000     | \$10,000      | ~\$450 (≈5% on \$9k above \$1k) | **~\$9,550** |

`

let updated = 0
let skipped = 0

const dirs = fs.readdirSync(ROOT).filter((d) =>
  fs.existsSync(path.join(ROOT, d, 'monetization.md')),
)

for (const dir of dirs) {
  const file = path.join(ROOT, dir, 'monetization.md')
  const original = fs.readFileSync(file, 'utf8')

  // Match the H1 line up to and including the "Revenue Examples" table.
  // Capture the H1 so we preserve the per-template title.
  const re =
    /^(# Monetization Guide — [^\n]+\n\n)## Revenue Model[\s\S]*?\| 1,000,000 \| \$10,000 \| \$2,000 \| \*\*\$8,000\*\* \|\n/

  if (!re.test(original)) {
    skipped++
    console.log(`SKIP (no match): ${file}`)
    continue
  }

  const replaced = original.replace(re, (_match, h1) => h1 + NEW_BODY())

  if (replaced === original) {
    skipped++
    console.log(`SKIP (no change): ${file}`)
    continue
  }

  if (!DRY_RUN) fs.writeFileSync(file, replaced)
  updated++
  console.log(`${DRY_RUN ? 'DRY-RUN' : 'UPDATED'}: ${file}`)
}

console.log('')
console.log(`=== Summary ===`)
console.log(`Files updated: ${updated}`)
console.log(`Files skipped: ${skipped}`)
console.log(`Total processed: ${dirs.length}`)
