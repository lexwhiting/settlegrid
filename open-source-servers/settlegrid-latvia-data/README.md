# settlegrid-latvia-data

latvia statistics open data MCP Server with SettleGrid billing via [SettleGrid](https://settlegrid.ai).

[![Powered by SettleGrid](https://img.shields.io/badge/Powered%20by-SettleGrid-10B981?style=flat-square)](https://settlegrid.ai)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg?style=flat-square)](LICENSE)

## Quick Start

```bash
npm install && cp .env.example .env && npm run dev
```

## Deploy

```bash
docker build -t settlegrid-latvia-data . && docker run -e SETTLEGRID_API_KEY=sg_live_xxx -p 3000:3000 settlegrid-latvia-data
```

---
Built with [SettleGrid](https://settlegrid.ai) — The Settlement Layer for the AI Economy
