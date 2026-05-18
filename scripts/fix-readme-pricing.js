#!/usr/bin/env node
/**
 * fix-readme-pricing.js — correct the "## Monetization" table in the
 * template READMEs to SettleGrid's canonical progressive take rate
 * (0% on the first $1,000/mo of revenue, 2-5% volume-tiered above),
 * replacing the stale flat-20%-fee table.
 *
 * Sibling of fix-monetization-docs.js, which made the same correction
 * to the monetization.md files. The affected templates (those with a
 * monetization.md) are all priced at 1¢/call, so the corrected block
 * is a fixed string; the script asserts the price and skips — with a
 * warning, never a wrong table — anything that is not 1¢/call.
 *
 * Idempotent. Run from the repo root:
 *   node scripts/fix-readme-pricing.js
 */
const fs = require('fs')
const path = require('path')

const SERVERS_DIR = path.join(__dirname, '..', 'open-source-servers')

/** The stale block, byte-identical across every affected README. */
const STALE_BLOCK = `## Monetization

Turn this template into a revenue stream. At the default 1¢/call pricing:

| Monthly Calls | Your Revenue (after 20% fee) |
|---------------|------------------------------|
| 1,000 | $8 |
| 10,000 | $80 |
| 100,000 | $800 |

See [monetization.md](monetization.md) for full pricing math and payout details.`

/**
 * The corrected block. At 1¢/call every row stays at or under the
 * $1,000/mo fee-free threshold, so "Your Revenue" equals gross — the
 * intro sentence states the take rate so the figures are not
 * mistaken for fee-free-everywhere.
 */
const CORRECT_BLOCK = `## Monetization

Turn this template into a revenue stream. At the default 1¢/call pricing, SettleGrid takes 0% on your first $1,000/mo of revenue (then 2–5%, volume-tiered, above it):

| Monthly Calls | Your Revenue |
|---------------|--------------|
| 1,000 | $10 |
| 10,000 | $100 |
| 100,000 | $1,000 |

See [monetization.md](monetization.md) for full pricing math and payout details.`

function perCallCents(dir) {
  try {
    const tj = JSON.parse(
      fs.readFileSync(path.join(dir, 'template.json'), 'utf8'),
    )
    return tj && tj.pricing ? tj.pricing.perCallUsdCents : undefined
  } catch {
    return undefined
  }
}

let fixed = 0
let already = 0
let skipped = 0
let notFound = 0
const warnings = []

for (const entry of fs.readdirSync(SERVERS_DIR).sort()) {
  const dir = path.join(SERVERS_DIR, entry)
  const readmePath = path.join(dir, 'README.md')
  // Only the monetizable showcase templates (those with a
  // monetization.md) carry the README revenue table.
  if (!fs.existsSync(path.join(dir, 'monetization.md'))) continue
  if (!fs.existsSync(readmePath)) continue

  const readme = fs.readFileSync(readmePath, 'utf8')

  if (readme.includes(CORRECT_BLOCK)) {
    already++
    continue
  }
  if (!readme.includes(STALE_BLOCK)) {
    // No recognised Monetization block — never guess; report only.
    notFound++
    warnings.push(
      `  ${entry}: stale block not found (unrecognised README shape — left untouched)`,
    )
    continue
  }
  const price = perCallCents(dir)
  if (price !== 1) {
    skipped++
    warnings.push(
      `  ${entry}: per-call price is ${price}¢, not 1¢ — the canned table assumes 1¢; left untouched`,
    )
    continue
  }

  fs.writeFileSync(readmePath, readme.replace(STALE_BLOCK, CORRECT_BLOCK), 'utf8')
  fixed++
  console.log(`  fixed: ${entry}/README.md`)
}

console.log(
  `\nfix-readme-pricing: ${fixed} fixed, ${already} already correct, ` +
    `${skipped} skipped, ${notFound} not-found`,
)
if (warnings.length) {
  console.log('warnings:')
  for (const w of warnings) console.log(w)
}
