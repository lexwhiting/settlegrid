# settlegrid-tonic-fabricate

Tonic Fabricate MCP Server with per-call billing via [SettleGrid](https://settlegrid.ai).

[![Powered by SettleGrid](https://img.shields.io/badge/Powered%20by-SettleGrid-10B981?style=flat-square)](https://settlegrid.ai)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg?style=flat-square)](LICENSE)
[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https://github.com/settlegrid/settlegrid-tonic-fabricate)

Generate realistic synthetic data at scale using Tonic Fabricate's API-driven data generation engine.

## Quick Start

```bash
npm install
cp .env.example .env   # Add your SettleGrid API key
npm run dev
```

## Methods

| Method | Description | Cost |
|--------|-------------|------|
| `generate_data(schema: object, numRows?: number, seed?: number)` | Generate synthetic data using a Tonic Fabricate schema | 5¢ |

## Parameters

### generate_data
- `schema` (object, required) — JSON schema describing the fields and generators to use for data generation
- `numRows` (number) — Number of rows to generate (default 10, max 1000)
- `seed` (number) — Optional random seed for reproducible output

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `SETTLEGRID_API_KEY` | Yes | Your SettleGrid API key from [settlegrid.ai](https://settlegrid.ai) |
| `TONIC_API_KEY` | Yes | Tonic Fabricate API key from [https://app.tonic.ai](https://app.tonic.ai) |

## Upstream API

- **Provider**: Tonic Fabricate
- **Base URL**: https://app.tonic.ai
- **Auth**: API key required
- **Docs**: https://docs.tonic.ai

## Deploy

### Docker

```bash
docker build -t settlegrid-tonic-fabricate .
docker run -e SETTLEGRID_API_KEY=sg_live_xxx -p 3000:3000 settlegrid-tonic-fabricate
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
