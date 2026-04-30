# settlegrid-codacy

Codacy MCP Server with per-call billing via [SettleGrid](https://settlegrid.ai).

[![Powered by SettleGrid](https://img.shields.io/badge/Powered%20by-SettleGrid-10B981?style=flat-square)](https://settlegrid.ai)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg?style=flat-square)](LICENSE)
[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https://github.com/settlegrid/settlegrid-codacy)

Access Codacy code quality analysis data including repository issues, commits, and tool configurations via the Codacy API.

## Quick Start

```bash
npm install
cp .env.example .env   # Add your SettleGrid API key
npm run dev
```

## Methods

| Method | Description | Cost |
|--------|-------------|------|
| `get_authenticated_user()` | Get the authenticated Codacy user | 1¢ |
| `list_organizations()` | List organizations for the authenticated user | 1¢ |
| `list_repositories(provider: string, remoteOrganizationName: string, limit?: number)` | List repositories in an organization | 1¢ |
| `get_repository_analysis(provider: string, remoteOrganizationName: string, repositoryName: string)` | Get analysis information for a repository | 1¢ |
| `search_repository_issues(provider: string, remoteOrganizationName: string, repositoryName: string, branchName: string, limit?: number)` | Search issues in a repository branch with optional filters | 2¢ |
| `list_repository_commits(provider: string, remoteOrganizationName: string, repositoryName: string, limit?: number)` | List commits with analysis data for a repository | 1¢ |
| `get_commit_analysis(provider: string, remoteOrganizationName: string, repositoryName: string, commitUuid: string)` | Get analysis results for a specific commit | 1¢ |
| `list_tools(limit?: number)` | List all available Codacy analysis tools | 1¢ |

## Parameters

### get_authenticated_user

### list_organizations

### list_repositories
- `provider` (string, required) — Git provider (e.g. gh, gl, bb)
- `remoteOrganizationName` (string, required) — Remote organization name
- `limit` (number) — Number of results per page (default 20, max 50)

### get_repository_analysis
- `provider` (string, required) — Git provider (e.g. gh, gl, bb)
- `remoteOrganizationName` (string, required) — Remote organization name
- `repositoryName` (string, required) — Repository name

### search_repository_issues
- `provider` (string, required) — Git provider (e.g. gh, gl, bb)
- `remoteOrganizationName` (string, required) — Remote organization name
- `repositoryName` (string, required) — Repository name
- `branchName` (string, required) — Branch name to search issues in
- `limit` (number) — Number of results per page (default 20, max 50)

### list_repository_commits
- `provider` (string, required) — Git provider (e.g. gh, gl, bb)
- `remoteOrganizationName` (string, required) — Remote organization name
- `repositoryName` (string, required) — Repository name
- `limit` (number) — Number of results per page (default 20, max 50)

### get_commit_analysis
- `provider` (string, required) — Git provider (e.g. gh, gl, bb)
- `remoteOrganizationName` (string, required) — Remote organization name
- `repositoryName` (string, required) — Repository name
- `commitUuid` (string, required) — Commit UUID to fetch analysis for

### list_tools
- `limit` (number) — Number of results per page (default 20, max 50)

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `SETTLEGRID_API_KEY` | Yes | Your SettleGrid API key from [settlegrid.ai](https://settlegrid.ai) |
| `CODACY_API_KEY` | Yes | Codacy API key from [https://app.codacy.com/account/apiTokens](https://app.codacy.com/account/apiTokens) |

## Upstream API

- **Provider**: Codacy
- **Base URL**: https://app.codacy.com
- **Auth**: API key required
- **Docs**: https://app.codacy.com/api/api-docs

## Deploy

### Docker

```bash
docker build -t settlegrid-codacy .
docker run -e SETTLEGRID_API_KEY=sg_live_xxx -p 3000:3000 settlegrid-codacy
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
