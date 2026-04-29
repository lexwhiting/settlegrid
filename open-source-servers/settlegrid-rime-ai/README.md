# settlegrid-rime-ai

Rime AI MCP Server with per-call billing via [SettleGrid](https://settlegrid.ai).

[![Powered by SettleGrid](https://img.shields.io/badge/Powered%20by-SettleGrid-10B981?style=flat-square)](https://settlegrid.ai)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg?style=flat-square)](LICENSE)
[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https://github.com/settlegrid/settlegrid-rime-ai)

Convert text to lifelike speech audio using Rime AI's text-to-speech synthesis API.

## Quick Start

```bash
npm install
cp .env.example .env   # Add your SettleGrid API key
npm run dev
```

## Methods

| Method | Description | Cost |
|--------|-------------|------|
| `synthesize_speech(text: string, speaker?: string, audioFormat?: string, samplingRate?: number, speedAlpha?: number, reduceLatency?: boolean)` | Synthesize text into speech audio using a chosen voice | 5¢ |

## Parameters

### synthesize_speech
- `text` (string, required) — The text to synthesize into speech
- `speaker` (string) — The voice/speaker ID to use for synthesis (e.g. 'maya')
- `audioFormat` (string) — Output audio format (e.g. 'mp3', 'wav', 'pcm')
- `samplingRate` (number) — Sampling rate in Hz for the audio output (e.g. 22050, 44100)
- `speedAlpha` (number) — Speech speed multiplier (e.g. 1.0 = normal, 1.5 = faster)
- `reduceLatency` (boolean) — Whether to optimize for lower latency generation

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `SETTLEGRID_API_KEY` | Yes | Your SettleGrid API key from [settlegrid.ai](https://settlegrid.ai) |
| `RIME_API_KEY` | Yes | Rime AI API key from [https://rime.ai](https://rime.ai) |

## Upstream API

- **Provider**: Rime AI
- **Base URL**: https://users.rime.ai
- **Auth**: API key required
- **Docs**: https://docs.rime.ai/docs/quickstart-five-minute

## Deploy

### Docker

```bash
docker build -t settlegrid-rime-ai .
docker run -e SETTLEGRID_API_KEY=sg_live_xxx -p 3000:3000 settlegrid-rime-ai
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
