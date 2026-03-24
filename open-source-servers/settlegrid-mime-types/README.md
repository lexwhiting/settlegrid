# settlegrid-mime-types

MIME Types MCP Server with per-call billing via [SettleGrid](https://settlegrid.ai).

[![Powered by SettleGrid](https://img.shields.io/badge/Powered%20by-SettleGrid-10B981?style=flat-square)](https://settlegrid.ai)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg?style=flat-square)](LICENSE)
[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https://github.com/settlegrid/settlegrid-mime-types)

Look up MIME types by extension and vice versa. All local, no API needed.

## Quick Start

```bash
npm install
cp .env.example .env   # Add your SettleGrid API key
npm run dev
```

## Methods

| Method | Description | Cost |
|--------|-------------|------|
| `lookup_mime(extension)` | Get MIME type for extension | Free |
| `lookup_extension(mimeType)` | Get extension for MIME type | Free |
| `get_mime_info(mimeType)` | Detailed MIME type info | Free |

## Parameters

### lookup_mime
- `extension` (string, required) — File extension (e.g., png, json)

### lookup_extension
- `mimeType` (string, required) — MIME type (e.g., image/png)

### get_mime_info
- `mimeType` (string, required) — MIME type string

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `SETTLEGRID_API_KEY` | Yes | Your SettleGrid API key from [settlegrid.ai](https://settlegrid.ai) |




## Deploy

### Docker

```bash
docker build -t settlegrid-mime-types .
docker run -e SETTLEGRID_API_KEY=sg_live_xxx -p 3000:3000 settlegrid-mime-types
```

### Vercel

```bash
npm run build
vercel --prod
```

## License

MIT - see [LICENSE](LICENSE)

---

Built with [SettleGrid](https://settlegrid.ai) — The Settlement Layer for the AI Economy
