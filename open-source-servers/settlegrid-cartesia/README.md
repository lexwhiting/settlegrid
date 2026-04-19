# settlegrid-cartesia

Cartesia MCP Server with per-call billing via [SettleGrid](https://settlegrid.ai).

[![Powered by SettleGrid](https://img.shields.io/badge/Powered%20by-SettleGrid-10B981?style=flat-square)](https://settlegrid.ai)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg?style=flat-square)](LICENSE)
[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https://github.com/settlegrid/settlegrid-cartesia)

Convert text to speech and retrieve audio bytes using Cartesia's high-quality TTS API.

## Quick Start

```bash
npm install
cp .env.example .env   # Add your SettleGrid API key
npm run dev
```

## Methods

| Method | Description | Cost |
|--------|-------------|------|
| `synthesize_speech(text: string, voice_id: string, model_id?: string, output_format?: string, language?: string)` | Convert text to speech and return audio bytes | 5¢ |

## Parameters

### synthesize_speech
- `text` (string, required) — The text to convert to speech (max 5000 characters)
- `voice_id` (string, required) — The ID of the voice to use for synthesis
- `model_id` (string) — Model ID to use (default: sonic-2)
- `output_format` (string) — Output audio format: mp3, wav, pcm (default: mp3)
- `language` (string) — Language code (e.g. en, fr, de; default: en)

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `SETTLEGRID_API_KEY` | Yes | Your SettleGrid API key from [settlegrid.ai](https://settlegrid.ai) |
| `CARTESIA_API_KEY` | Yes | Cartesia API key from [https://play.cartesia.ai/keys](https://play.cartesia.ai/keys) |

## Upstream API

- **Provider**: Cartesia
- **Base URL**: https://api.cartesia.ai
- **Auth**: API key required
- **Docs**: https://docs.cartesia.ai/api-reference/tts/bytes

## Deploy

### Docker

```bash
docker build -t settlegrid-cartesia .
docker run -e SETTLEGRID_API_KEY=sg_live_xxx -p 3000:3000 settlegrid-cartesia
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
