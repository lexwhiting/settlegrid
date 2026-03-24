# settlegrid-chat-format

Message Formatting MCP Server with per-call billing via [SettleGrid](https://settlegrid.ai).

[![Powered by SettleGrid](https://img.shields.io/badge/Powered%20by-SettleGrid-10B981?style=flat-square)](https://settlegrid.ai)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg?style=flat-square)](LICENSE)
[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https://github.com/settlegrid/settlegrid-chat-format)

Convert between Markdown, HTML, and plain text formats. No external API needed.

## Quick Start

```bash
npm install
cp .env.example .env   # Add your SettleGrid API key
npm run dev
```

## Methods

| Method | Description | Cost |
|--------|-------------|------|
| `to_markdown(text)` | Convert plain text to Markdown | 1¢ |
| `to_html(markdown)` | Convert Markdown to HTML | 1¢ |
| `to_plaintext(html)` | Strip HTML to plain text | 1¢ |

## Parameters

### to_markdown
- `text` (string, required) — Plain text to convert

### to_html
- `markdown` (string, required) — Markdown to convert

### to_plaintext
- `html` (string, required) — HTML to strip

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `SETTLEGRID_API_KEY` | Yes | Your SettleGrid API key from [settlegrid.ai](https://settlegrid.ai) |

## Deploy

### Docker

```bash
docker build -t settlegrid-chat-format .
docker run -e SETTLEGRID_API_KEY=sg_live_xxx -p 3000:3000 settlegrid-chat-format
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
