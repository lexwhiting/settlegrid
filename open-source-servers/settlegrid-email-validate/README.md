# settlegrid-email-validate

Email Validator MCP Server with per-call billing via [SettleGrid](https://settlegrid.ai).

[![Powered by SettleGrid](https://img.shields.io/badge/Powered%20by-SettleGrid-10B981?style=flat-square)](https://settlegrid.ai)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg?style=flat-square)](LICENSE)
[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https://github.com/settlegrid/settlegrid-email-validate)

Validate email addresses via Abstract API.

## Quick Start

```bash
npm install
cp .env.example .env   # Add your SettleGrid API key + ABSTRACT_EMAIL_KEY
npm run dev
```

## Methods

| Method | Description | Cost |
|--------|-------------|------|
| `validate(email)` | Validate an email address | 2¢ |

## Parameters

### validate
- `email` (string, required)

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `SETTLEGRID_API_KEY` | Yes | Your SettleGrid API key from [settlegrid.ai](https://settlegrid.ai) |
| `ABSTRACT_EMAIL_KEY` | Yes | Free key from abstractapi.com |


## Upstream API

- **Provider**: Abstract API
- **Base URL**: https://emailvalidation.abstractapi.com/v1
- **Auth**: Free API key required
- **Rate Limits**: 100 req/day (free)
- **Docs**: https://docs.abstractapi.com/email-validation

## Deploy

### Docker

```bash
docker build -t settlegrid-email-validate .
docker run -e SETTLEGRID_API_KEY=sg_live_xxx -e ABSTRACT_EMAIL_KEY=xxx -p 3000:3000 settlegrid-email-validate
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
