# settlegrid-deepgram

Deepgram MCP Server with per-call billing via [SettleGrid](https://settlegrid.ai).

[![Powered by SettleGrid](https://img.shields.io/badge/Powered%20by-SettleGrid-10B981?style=flat-square)](https://settlegrid.ai)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg?style=flat-square)](LICENSE)
[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https://github.com/settlegrid/settlegrid-deepgram)

Transcribe audio to text, convert text to speech, and analyze audio/text intelligence using the Deepgram API.

## Quick Start

```bash
npm install
cp .env.example .env   # Add your SettleGrid API key
npm run dev
```

## Methods

| Method | Description | Cost |
|--------|-------------|------|
| `transcribe_audio(url: string, model?: string, language?: string, punctuate?: boolean, diarize?: boolean)` | Transcribe pre-recorded audio from a URL | 5¢ |
| `synthesize_speech(text: string, model?: string, encoding?: string)` | Convert text to speech audio using Deepgram TTS | 5¢ |
| `analyze_text(url: string, sentiment?: boolean, summarize?: boolean, topics?: boolean, intents?: boolean)` | Analyze text or audio for intelligence features like sentiment and summarization | 5¢ |
| `list_projects()` | List all Deepgram projects for the authenticated account | 1¢ |
| `get_project(project_id: string)` | Get details for a specific Deepgram project | 1¢ |
| `get_project_usage(project_id: string, start?: string, end?: string)` | Get usage statistics for a Deepgram project | 1¢ |
| `list_project_keys(project_id: string)` | List API keys for a Deepgram project | 1¢ |
| `get_project_balances(project_id: string)` | Get billing balances for a Deepgram project | 1¢ |

## Parameters

### transcribe_audio
- `url` (string, required) — Publicly accessible URL of the audio file to transcribe
- `model` (string) — Deepgram model to use (e.g. nova-3, nova-2, base). Defaults to nova-2.
- `language` (string) — BCP-47 language code (e.g. en, es, fr). Defaults to en.
- `punctuate` (boolean) — Whether to add punctuation to the transcript. Defaults to true.
- `diarize` (boolean) — Whether to identify different speakers. Defaults to false.

### synthesize_speech
- `text` (string, required) — Text to convert to speech (max 2000 characters)
- `model` (string) — TTS model/voice to use (e.g. aura-asteria-en). Defaults to aura-asteria-en.
- `encoding` (string) — Audio encoding format (e.g. mp3, linear16, opus). Defaults to mp3.

### analyze_text
- `url` (string, required) — Publicly accessible URL of the audio file to analyze
- `sentiment` (boolean) — Enable sentiment analysis. Defaults to false.
- `summarize` (boolean) — Enable summarization. Defaults to false.
- `topics` (boolean) — Enable topic detection. Defaults to false.
- `intents` (boolean) — Enable intent detection. Defaults to false.

### list_projects

### get_project
- `project_id` (string, required) — The unique identifier of the project

### get_project_usage
- `project_id` (string, required) — The unique identifier of the project
- `start` (string) — Start date for usage query in ISO 8601 format (e.g. 2024-01-01)
- `end` (string) — End date for usage query in ISO 8601 format (e.g. 2024-01-31)

### list_project_keys
- `project_id` (string, required) — The unique identifier of the project

### get_project_balances
- `project_id` (string, required) — The unique identifier of the project

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `SETTLEGRID_API_KEY` | Yes | Your SettleGrid API key from [settlegrid.ai](https://settlegrid.ai) |
| `DEEPGRAM_API_KEY` | Yes | Deepgram API key from [https://console.deepgram.com/signup](https://console.deepgram.com/signup) |

## Upstream API

- **Provider**: Deepgram
- **Base URL**: https://api.deepgram.com
- **Auth**: API key required
- **Docs**: https://developers.deepgram.com/docs

## Deploy

### Docker

```bash
docker build -t settlegrid-deepgram .
docker run -e SETTLEGRID_API_KEY=sg_live_xxx -p 3000:3000 settlegrid-deepgram
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
