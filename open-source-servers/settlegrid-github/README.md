# settlegrid-github

GitHub MCP Server with per-call billing via [SettleGrid](https://settlegrid.ai).

[![Powered by SettleGrid](https://img.shields.io/badge/Powered%20by-SettleGrid-10B981?style=flat-square)](https://settlegrid.ai)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg?style=flat-square)](LICENSE)
[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https://github.com/settlegrid/settlegrid-github)

GitHub repositories, users, issues, and code search via REST API v3

## Quick Start

```bash
npm install
cp .env.example .env   # Add your SettleGrid API key + GITHUB_TOKEN
npm run dev
```

## Methods

| Method | Description | Cost |
|--------|-------------|------|
| `get_repo(owner, repo)` | Get repository details | 1¢ |
| `search_repos(q)` | Search for repositories | 2¢ |
| `get_user(username)` | Get user profile information | 1¢ |
| `list_issues(owner, repo)` | List issues for a repository | 1¢ |

## Parameters

### get_repo
- `owner` (string, required) — Repository owner
- `repo` (string, required) — Repository name

### search_repos
- `q` (string, required) — Search query
- `sort` (string, optional) — Sort: stars, forks, updated (default: "stars")
- `per_page` (number, optional) — Results per page (default: 20)

### get_user
- `username` (string, required) — GitHub username

### list_issues
- `owner` (string, required) — Repository owner
- `repo` (string, required) — Repository name
- `state` (string, optional) — State: open, closed, all (default: "open")

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `SETTLEGRID_API_KEY` | Yes | Your SettleGrid API key from [settlegrid.ai](https://settlegrid.ai) |
| `GITHUB_TOKEN` | Yes | GitHub API key from [https://github.com/settings/tokens](https://github.com/settings/tokens) |

## Upstream API

- **Provider**: GitHub
- **Base URL**: https://api.github.com
- **Auth**: API key (bearer)
- **Docs**: https://docs.github.com/en/rest

## Deploy

### Docker

```bash
docker build -t settlegrid-github .
docker run -e SETTLEGRID_API_KEY=sg_live_xxx -e GITHUB_TOKEN=xxx -p 3000:3000 settlegrid-github
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
