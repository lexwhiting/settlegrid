# settlegrid-gitlab

GitLab MCP Server with per-call billing via [SettleGrid](https://settlegrid.ai).

[![Powered by SettleGrid](https://img.shields.io/badge/Powered%20by-SettleGrid-10B981?style=flat-square)](https://settlegrid.ai)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg?style=flat-square)](LICENSE)
[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https://github.com/settlegrid/settlegrid-gitlab)

GitLab projects, users, and merge requests via REST API

## Quick Start

```bash
npm install
cp .env.example .env   # Add your SettleGrid API key + GITLAB_TOKEN
npm run dev
```

## Methods

| Method | Description | Cost |
|--------|-------------|------|
| `search_projects(search)` | Search for GitLab projects | 1¢ |
| `get_project(id)` | Get project details by ID | 1¢ |

## Parameters

### search_projects
- `search` (string, required) — Search query
- `per_page` (number, optional) — Results per page (default: 20)

### get_project
- `id` (string, required) — Project ID or URL-encoded path

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `SETTLEGRID_API_KEY` | Yes | Your SettleGrid API key from [settlegrid.ai](https://settlegrid.ai) |
| `GITLAB_TOKEN` | Yes | GitLab API key from [https://gitlab.com/-/user_settings/personal_access_tokens](https://gitlab.com/-/user_settings/personal_access_tokens) |

## Upstream API

- **Provider**: GitLab
- **Base URL**: https://gitlab.com/api/v4
- **Auth**: API key (header)
- **Docs**: https://docs.gitlab.com/ee/api/

## Deploy

### Docker

```bash
docker build -t settlegrid-gitlab .
docker run -e SETTLEGRID_API_KEY=sg_live_xxx -e GITLAB_TOKEN=xxx -p 3000:3000 settlegrid-gitlab
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
