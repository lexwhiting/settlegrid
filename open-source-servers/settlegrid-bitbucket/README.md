# settlegrid-bitbucket

Bitbucket MCP Server with per-call billing via [SettleGrid](https://settlegrid.ai).

[![Powered by SettleGrid](https://img.shields.io/badge/Powered%20by-SettleGrid-10B981?style=flat-square)](https://settlegrid.ai)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg?style=flat-square)](LICENSE)
[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https://github.com/settlegrid/settlegrid-bitbucket)

Bitbucket repositories, pull requests, and workspace data

## Quick Start

```bash
npm install
cp .env.example .env   # Add your SettleGrid API key + BITBUCKET_TOKEN
npm run dev
```

## Methods

| Method | Description | Cost |
|--------|-------------|------|
| `search_repos(q)` | Search public repositories | 1¢ |

## Parameters

### search_repos
- `q` (string, required) — Search query
- `pagelen` (number, optional) — Results per page (default: 20)

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `SETTLEGRID_API_KEY` | Yes | Your SettleGrid API key from [settlegrid.ai](https://settlegrid.ai) |
| `BITBUCKET_TOKEN` | Yes | Bitbucket API key from [https://bitbucket.org/account/settings/app-passwords/](https://bitbucket.org/account/settings/app-passwords/) |

## Upstream API

- **Provider**: Bitbucket
- **Base URL**: https://api.bitbucket.org/2.0
- **Auth**: API key (bearer)
- **Docs**: https://developer.atlassian.com/cloud/bitbucket/rest/

## Deploy

### Docker

```bash
docker build -t settlegrid-bitbucket .
docker run -e SETTLEGRID_API_KEY=sg_live_xxx -e BITBUCKET_TOKEN=xxx -p 3000:3000 settlegrid-bitbucket
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
