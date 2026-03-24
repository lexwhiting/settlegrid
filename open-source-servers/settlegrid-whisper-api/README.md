# settlegrid-whisper-api

OpenAI Whisper MCP Server with per-call billing via [SettleGrid](https://settlegrid.ai).

[![Powered by SettleGrid](https://img.shields.io/badge/Powered%20by-SettleGrid-10B981?style=flat-square)](https://settlegrid.ai)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg?style=flat-square)](LICENSE)
[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https://github.com/settlegrid/settlegrid-whisper-api)

Audio transcription and translation via the OpenAI Whisper API.

## Quick Start

```bash
npm install
cp .env.example .env   # Add your SettleGrid API key + OPENAI_API_KEY
npm run dev
```

## Methods

| Method | Description | Cost |
|--------|-------------|------|
| `transcribe_audio(url, language)` | Transcribe audio file to text via Whisper | 5¢ |
| `translate_audio(url)` | Translate audio to English text via Whisper | 5¢ |

## Parameters

### transcribe_audio
- `url` (string, required)
- `language` (string, optional)

### translate_audio
- `url` (string, required)

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `SETTLEGRID_API_KEY` | Yes | Your SettleGrid API key from [settlegrid.ai](https://settlegrid.ai) |
| `OPENAI_API_KEY` | Yes | API key from platform.openai.com/api-keys |


## Upstream API

- **Provider**: OpenAI
- **Base URL**: https://api.openai.com
- **Auth**: Free API key required
- **Rate Limits**: Tier-based (see OpenAI docs)
- **Docs**: https://platform.openai.com/docs/api-reference/audio

## Deploy

### Docker

```bash
docker build -t settlegrid-whisper-api .
docker run -e SETTLEGRID_API_KEY=sg_live_xxx -e OPENAI_API_KEY=xxx -p 3000:3000 settlegrid-whisper-api
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
