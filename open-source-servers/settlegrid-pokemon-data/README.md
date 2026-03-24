# settlegrid-pokemon-data

Pokemon Data MCP Server with per-call billing via [SettleGrid](https://settlegrid.ai).

[![Powered by SettleGrid](https://img.shields.io/badge/Powered%20by-SettleGrid-10B981?style=flat-square)](https://settlegrid.ai)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg?style=flat-square)](LICENSE)
[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https://github.com/settlegrid/settlegrid-pokemon-data)

Pokemon species, abilities, and type data from PokeAPI.

## Quick Start

```bash
npm install
cp .env.example .env   # Add your SettleGrid API key
npm run dev
```

## Methods

| Method | Description | Cost |
|--------|-------------|------|
| `get_pokemon(name)` | Get Pokemon by name or ID | 1¢ |
| `get_pokemon_species(name)` | Get Pokemon species info | 1¢ |

## Parameters

### get_pokemon
- `name` (string, required) — Pokemon name or ID

### get_pokemon_species
- `name` (string, required) — Pokemon name or ID

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `SETTLEGRID_API_KEY` | Yes | Your SettleGrid API key from [settlegrid.ai](https://settlegrid.ai) |

No API key needed for the upstream PokeAPI API — it is completely free.

## Upstream API

- **Provider**: PokeAPI
- **Base URL**: https://pokeapi.co/api/v2
- **Auth**: None required
- **Docs**: https://pokeapi.co/docs/v2

## Deploy

### Docker

```bash
docker build -t settlegrid-pokemon-data .
docker run -e SETTLEGRID_API_KEY=sg_live_xxx -p 3000:3000 settlegrid-pokemon-data
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
