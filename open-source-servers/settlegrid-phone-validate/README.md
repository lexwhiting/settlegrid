# settlegrid-phone-validate

Phone Validator MCP Server with per-call billing via [SettleGrid](https://settlegrid.ai).

[![Powered by SettleGrid](https://img.shields.io/badge/Powered%20by-SettleGrid-10B981?style=flat-square)](https://settlegrid.ai)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg?style=flat-square)](LICENSE)
[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https://github.com/settlegrid/settlegrid-phone-validate)

Validate and lookup phone numbers via Abstract API.

## Quick Start

```bash
npm install
cp .env.example .env   # Add your SettleGrid API key + ABSTRACT_PHONE_KEY
npm run dev
```

## Methods

| Method | Description | Cost |
|--------|-------------|------|
| `validate(phone)` | Validate a phone number | 2¢ |

## Parameters

### validate
- `phone` (string, required)

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `SETTLEGRID_API_KEY` | Yes | Your SettleGrid API key from [settlegrid.ai](https://settlegrid.ai) |
| `ABSTRACT_PHONE_KEY` | Yes | Free key from abstractapi.com |


## Upstream API

- **Provider**: Abstract API
- **Base URL**: https://phonevalidation.abstractapi.com/v1
- **Auth**: Free API key required
- **Rate Limits**: 100 req/day (free)
- **Docs**: https://docs.abstractapi.com/phone-validation

## Deploy

### Docker

```bash
docker build -t settlegrid-phone-validate .
docker run -e SETTLEGRID_API_KEY=sg_live_xxx -e ABSTRACT_PHONE_KEY=xxx -p 3000:3000 settlegrid-phone-validate
```

### Vercel

Click the "Deploy with Vercel" button above, or:

```bash
npm run build
vercel --prod
```

## License

MIT - see [LICENSE](LICENSE)

---

Built with [SettleGrid](https://settlegrid.ai) — The Settlement Layer for the AI Economy
