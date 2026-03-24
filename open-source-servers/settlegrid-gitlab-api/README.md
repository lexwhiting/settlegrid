# settlegrid-gitlab-api

GitLab MCP Server with per-call billing via [SettleGrid](https://settlegrid.ai).

[![Powered by SettleGrid](https://img.shields.io/badge/Powered%20by-SettleGrid-10B981?style=flat-square)](https://settlegrid.ai)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg?style=flat-square)](LICENSE)
[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https://github.com/settlegrid/settlegrid-gitlab-api)

Search projects, merge requests, and pipelines on GitLab.

## Quick Start

```bash
npm install
cp .env.example .env   # Add your SettleGrid API key + GITLAB_TOKEN
npm run dev
```

## Methods

| Method | Description | Cost |
|--------|-------------|------|
| `search_projects(query)` | Search GitLab projects by name or keyword | 2¢ |
| `get_project(id)` | Get details of a specific GitLab project by ID | 2¢ |
| `list_pipelines(project_id)` | List recent CI/CD pipelines for a project | 2¢ |

## Parameters

### search_projects
- `query` (string, required)

### get_project
- `id` (number, required)

### list_pipelines
- `project_id` (number, required)

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `SETTLEGRID_API_KEY` | Yes | Your SettleGrid API key from [settlegrid.ai](https://settlegrid.ai) |
| `GITLAB_TOKEN` | Yes | Personal access token from gitlab.com/-/user_settings/personal_access_tokens |


## Upstream API

- **Provider**: GitLab
- **Base URL**: https://gitlab.com/api/v4
- **Auth**: Free API key required
- **Rate Limits**: 2000 req/hr (authenticated)
- **Docs**: https://docs.gitlab.com/ee/api/rest/

## Deploy

### Docker

```bash
docker build -t settlegrid-gitlab-api .
docker run -e SETTLEGRID_API_KEY=sg_live_xxx -e GITLAB_TOKEN=xxx -p 3000:3000 settlegrid-gitlab-api
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
