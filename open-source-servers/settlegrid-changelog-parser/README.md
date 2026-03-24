# settlegrid-changelog-parser

Changelog Parser MCP Server with per-call billing via [SettleGrid](https://settlegrid.ai).

[![Powered by SettleGrid](https://img.shields.io/badge/Powered%20by-SettleGrid-10B981?style=flat-square)](https://settlegrid.ai)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg?style=flat-square)](LICENSE)
[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https://github.com/settlegrid/settlegrid-changelog-parser)

Fetch and parse changelogs and GitHub release notes. No API key needed.

## Quick Start

```bash
npm install
cp .env.example .env   # Add your SettleGrid API key
npm run dev
```

## Methods

| Method | Description | Cost |
|--------|-------------|------|
| `get_releases(owner, repo, limit?)` | GitHub releases list | 1¢ |
| `get_latest_release(owner, repo)` | Latest release info | 1¢ |
| `get_changelog(owner, repo)` | Parse CHANGELOG.md | 1¢ |

## Parameters

### get_releases
- `owner` (string, required) — GitHub owner/org
- `repo` (string, required) — Repository name
- `limit` (number) — Max releases (1-30, default 10)

### get_latest_release / get_changelog
- `owner` (string, required) — GitHub owner/org
- `repo` (string, required) — Repository name

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `SETTLEGRID_API_KEY` | Yes | Your SettleGrid API key from [settlegrid.ai](https://settlegrid.ai) |




## Deploy

### Docker

```bash
docker build -t settlegrid-changelog-parser .
docker run -e SETTLEGRID_API_KEY=sg_live_xxx -p 3000:3000 settlegrid-changelog-parser
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
