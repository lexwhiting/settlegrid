# settlegrid-lilt

Lilt MCP Server with per-call billing via [SettleGrid](https://settlegrid.ai).

[![Powered by SettleGrid](https://img.shields.io/badge/Powered%20by-SettleGrid-10B981?style=flat-square)](https://settlegrid.ai)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg?style=flat-square)](LICENSE)
[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https://github.com/settlegrid/settlegrid-lilt)

Access Lilt's translation and content generation services including adaptive machine translation, document management, and AI-powered content creation.

## Quick Start

```bash
npm install
cp .env.example .env   # Add your SettleGrid API key
npm run dev
```

## Methods

| Method | Description | Cost |
|--------|-------------|------|
| `get_create_content()` | Get all Lilt Create content | 1¢ |
| `get_create_content_by_id(contentId: number)` | Get Lilt Create content by ID | 1¢ |
| `create_content(language: string, topic: string, tone?: string)` | Generate new Lilt Create content | 5¢ |
| `delete_create_content(contentId: number)` | Delete Lilt Create content by ID | 2¢ |
| `get_create_preferences()` | Get Lilt Create preferences | 1¢ |
| `get_domains()` | Retrieve available translation domains | 1¢ |
| `get_files(name?: string)` | Retrieve files stored in Lilt | 1¢ |
| `regenerate_create_content(contentId: number)` | Regenerate Lilt Create content by ID | 5¢ |

## Parameters

### get_create_content

### get_create_content_by_id
- `contentId` (number, required) — The content ID to retrieve

### create_content
- `language` (string, required) — Target language for the generated content (e.g. 'en', 'fr')
- `topic` (string, required) — Topic or subject for the content to be generated
- `tone` (string) — Desired tone of the content (e.g. 'professional', 'casual')

### delete_create_content
- `contentId` (number, required) — The content ID to delete

### get_create_preferences

### get_domains

### get_files
- `name` (string) — Optional file name filter

### regenerate_create_content
- `contentId` (number, required) — The content ID to regenerate

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `SETTLEGRID_API_KEY` | Yes | Your SettleGrid API key from [settlegrid.ai](https://settlegrid.ai) |
| `LILT_API_KEY` | Yes | Lilt API key from [https://lilt.com/docs/api](https://lilt.com/docs/api) |

## Upstream API

- **Provider**: Lilt
- **Base URL**: https://api.lilt.com
- **Auth**: API key required
- **Docs**: https://lilt.github.io/lilt-python/

## Deploy

### Docker

```bash
docker build -t settlegrid-lilt .
docker run -e SETTLEGRID_API_KEY=sg_live_xxx -p 3000:3000 settlegrid-lilt
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
