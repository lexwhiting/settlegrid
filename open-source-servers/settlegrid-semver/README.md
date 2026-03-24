# settlegrid-semver

Semantic Versioning MCP Server with per-call billing via [SettleGrid](https://settlegrid.ai).

[![Powered by SettleGrid](https://img.shields.io/badge/Powered%20by-SettleGrid-10B981?style=flat-square)](https://settlegrid.ai)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg?style=flat-square)](LICENSE)
[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https://github.com/settlegrid/settlegrid-semver)

Parse, compare, sort, and bump semantic versions. All local computation, no external API.

## Quick Start

```bash
npm install
cp .env.example .env   # Add your SettleGrid API key
npm run dev
```

## Methods

| Method | Description | Cost |
|--------|-------------|------|
| `parse_version(version)` | Parse a semver string | Free |
| `compare_versions(a, b)` | Compare two versions | Free |
| `sort_versions(versions)` | Sort version array | Free |
| `satisfies_range(version, range)` | Check range satisfaction | Free |
| `bump_version(version, type)` | Bump version | Free |

## Parameters

### parse_version
- `version` (string, required) — Semver string (e.g., 1.2.3-beta.1)

### compare_versions
- `a` (string, required) — First version
- `b` (string, required) — Second version

### sort_versions
- `versions` (string[], required) — Array of version strings

### bump_version
- `version` (string, required) — Current version
- `type` (string, required) — major, minor, patch, premajor, preminor, prepatch, prerelease

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `SETTLEGRID_API_KEY` | Yes | Your SettleGrid API key from [settlegrid.ai](https://settlegrid.ai) |




## Deploy

### Docker

```bash
docker build -t settlegrid-semver .
docker run -e SETTLEGRID_API_KEY=sg_live_xxx -p 3000:3000 settlegrid-semver
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
