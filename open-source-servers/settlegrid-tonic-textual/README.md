# settlegrid-tonic-textual

Tonic Textual MCP Server with per-call billing via [SettleGrid](https://settlegrid.ai).

[![Powered by SettleGrid](https://img.shields.io/badge/Powered%20by-SettleGrid-10B981?style=flat-square)](https://settlegrid.ai)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg?style=flat-square)](LICENSE)
[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https://github.com/settlegrid/settlegrid-tonic-textual)

Redact and de-identify sensitive information from text strings using the Tonic Textual API.

## Quick Start

```bash
npm install
cp .env.example .env   # Add your SettleGrid API key
npm run dev
```

## Methods

| Method | Description | Cost |
|--------|-------------|------|
| `redact_text(text: string, redactedFields?: string[])` | Redact sensitive PII from a text string | 3¢ |

## Parameters

### redact_text
- `text` (string, required) — The input text to redact sensitive information from
- `redactedFields` (string[]) — Optional list of PII entity types to redact (e.g. ['NAME', 'EMAIL', 'PHONE']). Defaults to all detected types.

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `SETTLEGRID_API_KEY` | Yes | Your SettleGrid API key from [settlegrid.ai](https://settlegrid.ai) |
| `TONIC_TEXTUAL_API_KEY` | Yes | Tonic Textual API key from [https://app.tonic.ai](https://app.tonic.ai) |

## Upstream API

- **Provider**: Tonic Textual
- **Base URL**: https://app.tonic.ai
- **Auth**: API key required
- **Docs**: https://docs.tonic.ai

## Deploy

### Docker

```bash
docker build -t settlegrid-tonic-textual .
docker run -e SETTLEGRID_API_KEY=sg_live_xxx -p 3000:3000 settlegrid-tonic-textual
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
