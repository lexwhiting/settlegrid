# settlegrid-figlet-text

figlet text utility MCP Server with SettleGrid billing

[![Powered by SettleGrid](https://img.shields.io/badge/Powered%20by-SettleGrid-10B981?style=flat-square)](https://settlegrid.ai)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg?style=flat-square)](LICENSE)
[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https://github.com/settlegrid/settlegrid-figlet-text)

## Quick Start

```bash
npm install
cp .env.example .env   # Add your SettleGrid API key
npm run dev
```

## Methods

| Method | Description | Cost |
|--------|-------------|------|
| `render(...)` | Render FIGlet Text | 1¢ |
| `list_fonts(...)` | List Fonts | 1¢ |

## Parameters

### render
- `text` (string; font?: string, required)

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `SETTLEGRID_API_KEY` | Yes | Your SettleGrid API key |

---

Built with [SettleGrid](https://settlegrid.ai) — The Settlement Layer for the AI Economy
