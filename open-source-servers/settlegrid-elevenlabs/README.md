# settlegrid-elevenlabs

ElevenLabs MCP Server with per-call billing via [SettleGrid](https://settlegrid.ai).

[![Powered by SettleGrid](https://img.shields.io/badge/Powered%20by-SettleGrid-10B981?style=flat-square)](https://settlegrid.ai)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg?style=flat-square)](LICENSE)
[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https://github.com/settlegrid/settlegrid-elevenlabs)

Generate sound effects, retrieve speech history, and isolate audio using the ElevenLabs AI audio API.

## Quick Start

```bash
npm install
cp .env.example .env   # Add your SettleGrid API key
npm run dev
```

## Methods

| Method | Description | Cost |
|--------|-------------|------|
| `get_speech_history(page_size?: number, voice_id?: string, model_id?: string, search?: string, source?: string, sort_direction?: string)` | List generated audio history items | 1¢ |
| `get_history_item(history_item_id: string)` | Retrieve a specific speech history item by ID | 1¢ |
| `delete_history_item(history_item_id: string)` | Delete a speech history item by ID | 2¢ |
| `generate_sound_effect(text: string, duration_seconds?: number, prompt_influence?: number, output_format?: string)` | Generate a sound effect from a text description | 8¢ |
| `download_history_items(history_item_ids: string[])` | Download one or more history items as audio or zip | 3¢ |

## Parameters

### get_speech_history
- `page_size` (number) — Number of history items to return (default 100, max 1000)
- `voice_id` (string) — Filter by voice ID
- `model_id` (string) — Filter by model ID (e.g. eleven_turbo_v2)
- `search` (string) — Search term for filtering history items
- `source` (string) — Filter by source: TTS or STS
- `sort_direction` (string) — Sort direction: asc or desc (default desc)

### get_history_item
- `history_item_id` (string, required) — History item ID to retrieve

### delete_history_item
- `history_item_id` (string, required) — History item ID to delete

### generate_sound_effect
- `text` (string, required) — Text description of the sound effect to generate
- `duration_seconds` (number) — Duration of the generated audio in seconds
- `prompt_influence` (number) — How closely to follow the prompt (0.0 to 1.0)
- `output_format` (string) — Output format e.g. mp3_44100_128 (default mp3_44100_128)

### download_history_items
- `history_item_ids` (string[], required) — Array of history item IDs to download (single = audio file, multiple = zip)

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `SETTLEGRID_API_KEY` | Yes | Your SettleGrid API key from [settlegrid.ai](https://settlegrid.ai) |
| `ELEVENLABS_API_KEY` | Yes | ElevenLabs API key from [https://elevenlabs.io/app/settings/api-keys](https://elevenlabs.io/app/settings/api-keys) |

## Upstream API

- **Provider**: ElevenLabs
- **Base URL**: https://api.elevenlabs.io
- **Auth**: API key required
- **Docs**: https://elevenlabs.io/docs/api-reference

## Deploy

### Docker

```bash
docker build -t settlegrid-elevenlabs .
docker run -e SETTLEGRID_API_KEY=sg_live_xxx -p 3000:3000 settlegrid-elevenlabs
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
