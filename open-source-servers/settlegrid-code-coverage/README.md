# settlegrid-code-coverage

code coverage developer tool MCP Server with SettleGrid billing

[![Powered by SettleGrid](https://img.shields.io/badge/Powered%20by-SettleGrid-10B981?style=flat-square)](https://settlegrid.ai)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg?style=flat-square)](LICENSE)
[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https://github.com/settlegrid/settlegrid-code-coverage)

## Quick Start

```bash
npm install
cp .env.example .env   # Add your SettleGrid API key
npm run dev
```

## Methods

| Method | Description | Cost |
|--------|-------------|------|
| `analyze_coverage(...)` | Analyze Coverage Report | 1¢ |
| `get_badge(...)` | Get Coverage Badge | 1¢ |

## Parameters

### analyze_coverage
- `total_lines` (number; covered_lines: number; total_branches?: number; covered_branches?: number; total_functions?: number; covered_functions?: number, required)

### get_badge
- `coverage_pct` (number, required)

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `SETTLEGRID_API_KEY` | Yes | Your SettleGrid API key |

---

Built with [SettleGrid](https://settlegrid.ai) — The Settlement Layer for the AI Economy
