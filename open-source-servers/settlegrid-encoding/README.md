# settlegrid-encoding

Text Encoding MCP Server with per-call billing via [SettleGrid](https://settlegrid.ai).

[![Powered by SettleGrid](https://img.shields.io/badge/Powered%20by-SettleGrid-10B981?style=flat-square)](https://settlegrid.ai)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg?style=flat-square)](LICENSE)
[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https://github.com/settlegrid/settlegrid-encoding)

Encode, decode, and detect text encodings (Base64, URL, HTML, Hex). All local computation.

## Quick Start

```bash
npm install
cp .env.example .env   # Add your SettleGrid API key
npm run dev
```

## Methods

| Method | Description | Cost |
|--------|-------------|------|
| `encode_base64(text)` | Encode text to base64 | Free |
| `decode_base64(encoded)` | Decode base64 to text | Free |
| `encode_url(text)` | URL-encode text | Free |
| `decode_url(encoded)` | URL-decode text | Free |
| `encode_html(text)` | HTML-encode text | Free |
| `decode_html(encoded)` | HTML-decode text | Free |
| `encode_hex(text)` | Text to hex string | Free |
| `detect_encoding(sample)` | Detect text encoding | Free |

## Parameters

All methods accept a single string parameter (`text` or `encoded` or `sample`).

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `SETTLEGRID_API_KEY` | Yes | Your SettleGrid API key from [settlegrid.ai](https://settlegrid.ai) |




## Deploy

### Docker

```bash
docker build -t settlegrid-encoding .
docker run -e SETTLEGRID_API_KEY=sg_live_xxx -p 3000:3000 settlegrid-encoding
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
