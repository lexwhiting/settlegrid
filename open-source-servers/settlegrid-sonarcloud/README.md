# settlegrid-sonarcloud

SonarCloud MCP Server with per-call billing via [SettleGrid](https://settlegrid.ai).

[![Powered by SettleGrid](https://img.shields.io/badge/Powered%20by-SettleGrid-10B981?style=flat-square)](https://settlegrid.ai)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg?style=flat-square)](LICENSE)
[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https://github.com/settlegrid/settlegrid-sonarcloud)

Query SonarCloud projects, issues, metrics, and quality gates via the SonarCloud Web API.

## Quick Start

```bash
npm install
cp .env.example .env   # Add your SettleGrid API key
npm run dev
```

## Methods

| Method | Description | Cost |
|--------|-------------|------|
| `search_issues(projectKey: string, severity?: string, type?: string, pageSize?: number)` | Search code issues in a SonarCloud project | 2¢ |
| `get_project_metrics(projectKey: string, metricKeys?: string)` | Get quality metrics for a SonarCloud project | 1¢ |
| `get_quality_gate_status(projectKey: string)` | Get the quality gate status for a SonarCloud project | 1¢ |
| `list_projects(organization: string, pageSize?: number)` | List projects in a SonarCloud organization | 1¢ |
| `get_project_analyses(projectKey: string, pageSize?: number)` | Get recent analyses for a SonarCloud project | 1¢ |
| `search_hotspots(projectKey: string, status?: string, pageSize?: number)` | Search security hotspots in a SonarCloud project | 2¢ |
| `get_issue_changelog(issueKey: string)` | Get the changelog for a specific SonarCloud issue | 1¢ |
| `list_rules(language?: string, type?: string, pageSize?: number)` | Search and list SonarCloud quality rules | 1¢ |

## Parameters

### search_issues
- `projectKey` (string, required) — SonarCloud project key (e.g. my-org_my-repo)
- `severity` (string) — Filter by severity: INFO, MINOR, MAJOR, CRITICAL, BLOCKER
- `type` (string) — Filter by type: BUG, VULNERABILITY, CODE_SMELL
- `pageSize` (number) — Number of results to return (default 20, max 50)

### get_project_metrics
- `projectKey` (string, required) — SonarCloud project key
- `metricKeys` (string) — Comma-separated metric keys (default: bugs,vulnerabilities,code_smells,coverage,duplicated_lines_density)

### get_quality_gate_status
- `projectKey` (string, required) — SonarCloud project key

### list_projects
- `organization` (string, required) — SonarCloud organization key
- `pageSize` (number) — Number of projects to return (default 20, max 50)

### get_project_analyses
- `projectKey` (string, required) — SonarCloud project key
- `pageSize` (number) — Number of analyses to return (default 10, max 50)

### search_hotspots
- `projectKey` (string, required) — SonarCloud project key
- `status` (string) — Filter by status: TO_REVIEW, REVIEWED
- `pageSize` (number) — Number of hotspots to return (default 20, max 50)

### get_issue_changelog
- `issueKey` (string, required) — Unique identifier of the SonarCloud issue

### list_rules
- `language` (string) — Filter by language (e.g. java, js, py, ts)
- `type` (string) — Filter by type: BUG, VULNERABILITY, CODE_SMELL
- `pageSize` (number) — Number of rules to return (default 20, max 50)

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `SETTLEGRID_API_KEY` | Yes | Your SettleGrid API key from [settlegrid.ai](https://settlegrid.ai) |
| `SONARCLOUD_TOKEN` | Yes | SonarCloud API key from [https://sonarcloud.io/account/security](https://sonarcloud.io/account/security) |

## Upstream API

- **Provider**: SonarCloud
- **Base URL**: https://sonarcloud.io
- **Auth**: API key required
- **Docs**: https://sonarcloud.io/web_api

## Deploy

### Docker

```bash
docker build -t settlegrid-sonarcloud .
docker run -e SETTLEGRID_API_KEY=sg_live_xxx -p 3000:3000 settlegrid-sonarcloud
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
