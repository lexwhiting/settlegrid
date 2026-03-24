# settlegrid-chuck-norris

Chuck Norris Jokes MCP Server with per-call billing via [SettleGrid](https://settlegrid.ai).

[![Powered by SettleGrid](https://img.shields.io/badge/Powered%20by-SettleGrid-10B981?style=flat-square)](https://settlegrid.ai)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg?style=flat-square)](LICENSE)
[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https://github.com/settlegrid/settlegrid-chuck-norris)

Get random Chuck Norris jokes from the Chuck Norris API.

## Quick Start

```bash
npm install
cp .env.example .env   # Add your SettleGrid API key
npm run dev
```

## Methods

| Method | Description | Cost |
|--------|-------------|------|
| `get_random()` | Get a random Chuck Norris joke | 1¢ |
| `search_jokes(query)` | Search jokes by keyword | 1¢ |

## Parameters

### search_jokes
- `query` (string, required)

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `SETTLEGRID_API_KEY` | Yes | Your SettleGrid API key from [settlegrid.ai](https://settlegrid.ai) |


## Upstream API

- **Provider**: chucknorris.io
- **Base URL**: https://api.chucknorris.io
- **Auth**: None required
- **Rate Limits**: Unlimited
- **Docs**: https://api.chucknorris.io/

## Deploy

### Docker

```bash
docker build -t settlegrid-chuck-norris .
docker run -e SETTLEGRID_API_KEY=sg_live_xxx -p 3000:3000 settlegrid-chuck-norris
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
