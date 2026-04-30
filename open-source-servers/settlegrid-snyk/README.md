# settlegrid-snyk

Snyk MCP Server with per-call billing via [SettleGrid](https://settlegrid.ai).

[![Powered by SettleGrid](https://img.shields.io/badge/Powered%20by-SettleGrid-10B981?style=flat-square)](https://settlegrid.ai)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg?style=flat-square)](LICENSE)
[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https://github.com/settlegrid/settlegrid-snyk)

Query Snyk security data including organizations, projects, and vulnerability issues via the Snyk API.

## Quick Start

```bash
npm install
cp .env.example .env   # Add your SettleGrid API key
npm run dev
```

## Methods

| Method | Description | Cost |
|--------|-------------|------|
| `get_current_user()` | Get the current authenticated Snyk user | 1¢ |
| `list_orgs()` | List all organizations the current user belongs to | 1¢ |
| `list_projects(orgId: string)` | List all projects for a given organization | 1¢ |
| `get_project_issues(orgId: string, projectId: string, severity?: string)` | List all vulnerability issues for a specific project | 2¢ |
| `list_org_issues(orgId: string, limit?: number)` | List all vulnerability issues for an organization (REST API) | 2¢ |

## Parameters

### get_current_user

### list_orgs

### list_projects
- `orgId` (string, required) — The Snyk organization ID

### get_project_issues
- `orgId` (string, required) — The Snyk organization ID
- `projectId` (string, required) — The Snyk project ID
- `severity` (string) — Filter by severity: critical, high, medium, or low

### list_org_issues
- `orgId` (string, required) — The Snyk organization ID
- `limit` (number) — Maximum number of issues to return (default 10, max 50)

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `SETTLEGRID_API_KEY` | Yes | Your SettleGrid API key from [settlegrid.ai](https://settlegrid.ai) |
| `SNYK_API_KEY` | Yes | Snyk API key from [https://app.snyk.io/account](https://app.snyk.io/account) |

## Upstream API

- **Provider**: Snyk
- **Base URL**: https://api.snyk.io
- **Auth**: API key required
- **Docs**: https://docs.snyk.io/snyk-api

## Deploy

### Docker

```bash
docker build -t settlegrid-snyk .
docker run -e SETTLEGRID_API_KEY=sg_live_xxx -p 3000:3000 settlegrid-snyk
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
