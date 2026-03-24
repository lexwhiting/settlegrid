# settlegrid-github-api

GitHub MCP Server with per-call billing via [SettleGrid](https://settlegrid.ai).

[![Powered by SettleGrid](https://img.shields.io/badge/Powered%20by-SettleGrid-10B981?style=flat-square)](https://settlegrid.ai)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg?style=flat-square)](LICENSE)
[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https://github.com/settlegrid/settlegrid-github-api)

Search repos, issues, and users on GitHub.

## Quick Start

```bash
npm install
cp .env.example .env   # Add your SettleGrid API key + GITHUB_TOKEN
npm run dev
```

## Methods

| Method | Description | Cost |
|--------|-------------|------|
| `search_repos(query, per_page)` | Search GitHub repositories by query | 2¢ |
| `get_repo(owner, repo)` | Get details about a specific repository | 2¢ |
| `search_issues(query, per_page)` | Search issues and pull requests across GitHub | 2¢ |

## Parameters

### search_repos
- `query` (string, required)
- `per_page` (number, optional)

### get_repo
- `owner` (string, required)
- `repo` (string, required)

### search_issues
- `query` (string, required)
- `per_page` (number, optional)

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `SETTLEGRID_API_KEY` | Yes | Your SettleGrid API key from [settlegrid.ai](https://settlegrid.ai) |
| `GITHUB_TOKEN` | Yes | Personal access token from github.com/settings/tokens |


## Upstream API

- **Provider**: GitHub
- **Base URL**: https://api.github.com
- **Auth**: Free API key required
- **Rate Limits**: 5000 req/hr (authenticated)
- **Docs**: https://docs.github.com/en/rest

## Deploy

### Docker

```bash
docker build -t settlegrid-github-api .
docker run -e SETTLEGRID_API_KEY=sg_live_xxx -e GITHUB_TOKEN=xxx -p 3000:3000 settlegrid-github-api
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
