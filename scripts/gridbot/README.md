# GridBot — SettleGrid Demand Generator

GridBot is both a consumer and a demonstration of the SettleGrid marketplace. It discovers tools via the Discovery API, pays for them with founder-funded credits via the Smart Proxy, and answers real questions. Every invocation generates real marketplace activity: tool calls, revenue, invocation counts, and transaction history.

## Why GridBot Exists

SettleGrid's marketplace starts with zero organic invocations. GridBot bootstraps demand by:

1. **Proving the workflow works** — discovery, selection, payment, invocation, result
2. **Generating real transaction data** — invocations, revenue, latency metrics
3. **Populating tool statistics** — invocation counts that make tools look active
4. **Testing the full stack** — if GridBot can pay for and use a tool, so can any agent

## Quick Start

```bash
# Set your API key
export SETTLEGRID_API_KEY=sg_your_key_here

# Ask a single question
npx tsx scripts/gridbot/index.ts "What's the weather in Tokyo?"

# Dry run (discover & select without paying)
npx tsx scripts/gridbot/index.ts --dry-run "Convert 100 USD to EUR"

# Check daily spending
npx tsx scripts/gridbot/index.ts --status
```

Or via npm scripts from the repo root:

```bash
npm run gridbot -- "What's the weather in NYC?"
npm run gridbot:schedule
```

## Configuration

| Variable | Default | Description |
|----------|---------|-------------|
| `SETTLEGRID_API_KEY` | (required) | Your SettleGrid API key |
| `SETTLEGRID_URL` | `https://settlegrid.ai` | API base URL |
| `GRIDBOT_BUDGET` | `100` | Daily budget in cents ($1.00) |

## Manual Usage

```bash
# Ask any question
npx tsx scripts/gridbot/index.ts "What are the latest papers about transformers?"

# Pipe input
echo "Check SSL cert for example.com" | npx tsx scripts/gridbot/index.ts

# View help
npx tsx scripts/gridbot/index.ts --help
```

## Scheduler

The scheduler runs GridBot on a pool of 16 diverse questions, targeting different tool categories:

```bash
# Run all pending questions for today
npx tsx scripts/gridbot/scheduler.ts

# Run one question and exit (for cron)
npx tsx scripts/gridbot/scheduler.ts --once

# View schedule status
npx tsx scripts/gridbot/scheduler.ts --status
```

### Cron Setup

Run one question every 30 minutes during business hours (8am-8pm UTC):

```
*/30 8-20 * * * cd /Users/lex/settlegrid && SETTLEGRID_API_KEY=sg_xxx npx tsx scripts/gridbot/scheduler.ts --once 2>&1 >> /tmp/gridbot.log
```

This generates 10-16 real paid invocations per day across data, code, finance, search, security, NLP, image, utility, analytics, and science categories.

### Idempotency

The scheduler tracks which questions have been run today in `schedule-state.json`. Running the scheduler multiple times in the same day is safe — it skips already-completed questions and respects the daily budget.

## Transaction Logs

Every invocation (successful or not) is logged to `scripts/gridbot/logs/` as JSONL files, one per day:

```
scripts/gridbot/logs/2026-03-26.jsonl
```

Each line is a JSON object:

```json
{
  "timestamp": "2026-03-26T14:30:00.000Z",
  "question": "What's the weather in Tokyo?",
  "category": "data",
  "toolSlug": "weather-api",
  "toolName": "Weather API",
  "costCents": 5,
  "latencyMs": 342,
  "status": "success"
}
```

Status values: `success`, `error`, `no_tools`, `budget_exceeded`, `skipped` (dry run).

## Budget Tracking

GridBot enforces a daily spending limit (default: $1.00/day = 100 cents). The budget resets at midnight UTC. State is stored in `scripts/gridbot/state.json`.

## Files

```
scripts/gridbot/
  index.ts           Main CLI script
  lib.ts             Shared library (discovery, proxy, budget, logging)
  scheduler.ts       Automated scheduling across question pool
  README.md          This file
  state.json         Daily budget state (auto-generated)
  schedule-state.json  Scheduler state (auto-generated)
  logs/              Transaction logs (auto-generated)
    2026-03-26.jsonl
```

## How It Generates Marketplace Activity

Each GridBot invocation:

1. **Calls the Discovery API** — proves the search/filter pipeline works
2. **Selects a tool** — validates that pricing/category metadata is correct
3. **Calls the Smart Proxy** — triggers a real upstream request with billing
4. **Charges the consumer balance** — generates a real financial transaction
5. **Increments tool invocation count** — makes tools look active in the marketplace
6. **Records an invocation row** — populates the dashboard analytics
7. **Credits the developer** — proves the revenue-share model works end-to-end
