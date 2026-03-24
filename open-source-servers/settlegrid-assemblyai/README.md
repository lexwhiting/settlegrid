# settlegrid-assemblyai

AssemblyAI MCP Server with per-call billing via [SettleGrid](https://settlegrid.ai).

[![Powered by SettleGrid](https://img.shields.io/badge/Powered%20by-SettleGrid-10B981?style=flat-square)](https://settlegrid.ai)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg?style=flat-square)](LICENSE)
[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https://github.com/settlegrid/settlegrid-assemblyai)

Speech-to-text transcription with speaker labels and sentiment

## Quick Start

```bash
npm install
cp .env.example .env   # Add your SettleGrid API key + ASSEMBLYAI_API_KEY
npm run dev
```

## Methods

| Method | Description | Cost |
|--------|-------------|------|
| `create_transcript(audio_url)` | Submit audio URL for transcription | 5¢ |
| `get_transcript(id)` | Get transcription result | 1¢ |

## Parameters

### create_transcript
- `audio_url` (string, required) — URL of audio file to transcribe
- `language_code` (string, optional) — Language code (e.g. en) (default: "en")

### get_transcript
- `id` (string, required) — Transcript ID

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `SETTLEGRID_API_KEY` | Yes | Your SettleGrid API key from [settlegrid.ai](https://settlegrid.ai) |
| `ASSEMBLYAI_API_KEY` | Yes | AssemblyAI API key from [https://www.assemblyai.com/](https://www.assemblyai.com/) |

## Upstream API

- **Provider**: AssemblyAI
- **Base URL**: https://api.assemblyai.com/v2
- **Auth**: API key (header)
- **Docs**: https://www.assemblyai.com/docs/

## Deploy

### Docker

```bash
docker build -t settlegrid-assemblyai .
docker run -e SETTLEGRID_API_KEY=sg_live_xxx -e ASSEMBLYAI_API_KEY=xxx -p 3000:3000 settlegrid-assemblyai
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
