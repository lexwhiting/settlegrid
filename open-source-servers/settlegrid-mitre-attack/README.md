# settlegrid-mitre-attack

MITRE ATT&CK MCP Server with per-call billing via [SettleGrid](https://settlegrid.ai).

[![Powered by SettleGrid](https://img.shields.io/badge/Powered%20by-SettleGrid-10B981?style=flat-square)](https://settlegrid.ai)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg?style=flat-square)](LICENSE)
[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https://github.com/settlegrid/settlegrid-mitre-attack)

MITRE ATT&CK framework tactics, techniques, and groups data.

## Quick Start

```bash
npm install
cp .env.example .env   # Add your SettleGrid API key
npm run dev
```

## Methods

| Method | Description | Cost |
|--------|-------------|------|
| `search_techniques(query)` | Search ATT&CK techniques | 1¢ |
| `get_technique(technique_id)` | Get technique by ID | 1¢ |

## Parameters

### search_techniques
- `query` (string, required) — Search term for techniques

### get_technique
- `technique_id` (string, required) — Technique ID (e.g. T1566)

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `SETTLEGRID_API_KEY` | Yes | Your SettleGrid API key from [settlegrid.ai](https://settlegrid.ai) |

No API key needed for the upstream MITRE ATT&CK STIX API — it is completely free.

## Upstream API

- **Provider**: MITRE ATT&CK STIX
- **Base URL**: https://raw.githubusercontent.com/mitre/cti/master/enterprise-attack
- **Auth**: None required
- **Docs**: https://attack.mitre.org/resources/working-with-attack/

## Deploy

### Docker

```bash
docker build -t settlegrid-mitre-attack .
docker run -e SETTLEGRID_API_KEY=sg_live_xxx -p 3000:3000 settlegrid-mitre-attack
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
