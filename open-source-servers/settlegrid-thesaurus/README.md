# settlegrid-thesaurus

Thesaurus MCP Server with per-call billing via [SettleGrid](https://settlegrid.ai).

[![Powered by SettleGrid](https://img.shields.io/badge/Powered%20by-SettleGrid-10B981?style=flat-square)](https://settlegrid.ai)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg?style=flat-square)](LICENSE)
[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https://github.com/settlegrid/settlegrid-thesaurus)

Find synonyms, antonyms, and related words via the Datamuse API.

## Quick Start

```bash
npm install
cp .env.example .env   # Add your SettleGrid API key
npm run dev
```

## Methods

| Method | Description | Cost |
|--------|-------------|------|
| `get_synonyms(word)` | Find synonyms for a word | 1¢ |
| `get_antonyms(word)` | Find antonyms for a word | 1¢ |
| `get_related(word, relation)` | Find words related to a concept | 1¢ |

## Parameters

### get_synonyms
- `word` (string, required) — Word to find synonyms for

### get_antonyms
- `word` (string, required) — Word to find antonyms for

### get_related
- `word` (string, required) — Word or concept
- `relation` (string, optional) — Relation type: syn, ant, trg (triggers), jja (adjectives), jjb (described by), rhy (rhymes)

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `SETTLEGRID_API_KEY` | Yes | Your SettleGrid API key from [settlegrid.ai](https://settlegrid.ai) |


## Upstream API

- **Provider**: Datamuse
- **Base URL**: https://api.datamuse.com
- **Auth**: None required
- **Rate Limits**: 100,000 requests/day
- **Docs**: https://www.datamuse.com/api/

## Deploy

### Docker

```bash
docker build -t settlegrid-thesaurus .
docker run -e SETTLEGRID_API_KEY=sg_live_xxx -p 3000:3000 settlegrid-thesaurus
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
