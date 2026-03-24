# settlegrid-license-checker

License Checker MCP Server with per-call billing via [SettleGrid](https://settlegrid.ai).

[![Powered by SettleGrid](https://img.shields.io/badge/Powered%20by-SettleGrid-10B981?style=flat-square)](https://settlegrid.ai)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg?style=flat-square)](LICENSE)
[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https://github.com/settlegrid/settlegrid-license-checker)

Look up and classify open source licenses for npm packages.

## Quick Start

```bash
npm install
cp .env.example .env   # Add your SettleGrid API key
npm run dev
```

## Methods

| Method | Description | Cost |
|--------|-------------|------|
| `check_license(package)` | License info for a package | 1¢ |
| `check_licenses_bulk(packages)` | Bulk license check (up to 50) | 3¢ |
| `classify_license(license)` | Classify a license type | Free |

## Parameters

### check_license
- `package` (string, required) — npm package name

### check_licenses_bulk
- `packages` (string[], required) — Array of package names (max 50)

### classify_license
- `license` (string, required) — SPDX license identifier (e.g., MIT, GPL-3.0)

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `SETTLEGRID_API_KEY` | Yes | Your SettleGrid API key from [settlegrid.ai](https://settlegrid.ai) |




## Deploy

### Docker

```bash
docker build -t settlegrid-license-checker .
docker run -e SETTLEGRID_API_KEY=sg_live_xxx -p 3000:3000 settlegrid-license-checker
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
