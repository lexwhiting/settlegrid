# settlegrid-trustpilot

Trustpilot MCP Server with per-call billing via [SettleGrid](https://settlegrid.ai).

[![Powered by SettleGrid](https://img.shields.io/badge/Powered%20by-SettleGrid-10B981?style=flat-square)](https://settlegrid.ai)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg?style=flat-square)](LICENSE)

Access Trustpilot business reviews and ratings.

## Quick Start

```bash
npm install
cp .env.example .env
npm run dev
```

## Methods

| Method | Description | Cost |
|--------|-------------|------|
| `search_business(query)` | Search businesses | 1¢ |
| `get_business(domain)` | Get business by domain | 1¢ |
| `get_reviews(business_id)` | Get business reviews | 2¢ |
| `get_categories()` | List business categories | 1¢ |

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `SETTLEGRID_API_KEY` | Yes | Your SettleGrid API key |
| `TRUSTPILOT_API_KEY` | Yes | Trustpilot API key from [businessapp.b2b.trustpilot.com](https://businessapp.b2b.trustpilot.com/) |

## Upstream API

- **Provider**: Trustpilot
- **Base URL**: https://api.trustpilot.com/v1
- **Auth**: API key (query param)
- **Docs**: https://documentation-apidocumentation.trustpilot.com/

## Deploy

### Docker
```bash
docker build -t settlegrid-trustpilot .
docker run -e SETTLEGRID_API_KEY=sg_live_xxx -e TRUSTPILOT_API_KEY=xxx -p 3000:3000 settlegrid-trustpilot
```

### Vercel
```bash
npm run build && vercel --prod
```

## License
MIT - see [LICENSE](LICENSE)

---
Built with [SettleGrid](https://settlegrid.ai) --- The Settlement Layer for the AI Economy
