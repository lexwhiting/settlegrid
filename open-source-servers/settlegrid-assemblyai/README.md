# settlegrid-assemblyai

AssemblyAI MCP Server with per-call billing via [SettleGrid](https://settlegrid.ai).

[![Powered by SettleGrid](https://img.shields.io/badge/Powered%20by-SettleGrid-10B981?style=flat-square)](https://settlegrid.ai)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg?style=flat-square)](LICENSE)
[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https://github.com/settlegrid/settlegrid-assemblyai)

Transcribe audio, retrieve transcripts, and generate AI-powered summaries and insights using AssemblyAI's speech-to-text and LeMUR APIs.

## Quick Start

```bash
npm install
cp .env.example .env   # Add your SettleGrid API key
npm run dev
```

## Methods

| Method | Description | Cost |
|--------|-------------|------|
| `submit_transcription(audio_url: string, language_code?: string, speaker_labels?: boolean)` | Submit audio URL for transcription | 5¢ |
| `get_transcription(transcript_id: string)` | Get transcription result by ID | 1¢ |
| `list_transcriptions(limit?: number)` | List recent transcripts | 1¢ |
| `get_transcript_sentences(transcript_id: string)` | Get sentences from a completed transcript | 1¢ |
| `export_transcript(transcript_id: string, format: string)` | Export transcript in SRT or VTT subtitle format | 2¢ |
| `generate_summary(transcript_ids: string, context?: string)` | Generate a LeMUR summary of a transcript | 8¢ |
| `ask_lemur(transcript_ids: string, question: string)` | Ask a question about a transcript using LeMUR | 8¢ |
| `generate_action_items(transcript_ids: string, context?: string)` | Extract action items from a transcript using LeMUR | 8¢ |

## Parameters

### submit_transcription
- `audio_url` (string, required) — Publicly accessible URL of the audio file to transcribe
- `language_code` (string) — BCP-47 language code (e.g. 'en', 'es', 'fr'). Defaults to 'en'
- `speaker_labels` (boolean) — Whether to enable speaker diarization (default false)

### get_transcription
- `transcript_id` (string, required) — The ID of the transcript to retrieve

### list_transcriptions
- `limit` (number) — Maximum number of transcripts to return (default 10, max 50)

### get_transcript_sentences
- `transcript_id` (string, required) — The ID of the completed transcript

### export_transcript
- `transcript_id` (string, required) — The ID of the completed transcript
- `format` (string, required) — Export format: 'srt' or 'vtt'

### generate_summary
- `transcript_ids` (string, required) — Comma-separated list of transcript IDs to summarize
- `context` (string) — Optional context or instructions to guide the summary

### ask_lemur
- `transcript_ids` (string, required) — Comma-separated list of transcript IDs to query
- `question` (string, required) — The question to answer based on the transcript content

### generate_action_items
- `transcript_ids` (string, required) — Comma-separated list of transcript IDs to analyze
- `context` (string) — Optional context or instructions to guide action item extraction

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `SETTLEGRID_API_KEY` | Yes | Your SettleGrid API key from [settlegrid.ai](https://settlegrid.ai) |
| `ASSEMBLYAI_API_KEY` | Yes | AssemblyAI API key from [https://www.assemblyai.com/dashboard](https://www.assemblyai.com/dashboard) |

## Upstream API

- **Provider**: AssemblyAI
- **Base URL**: https://api.assemblyai.com
- **Auth**: API key required
- **Docs**: https://www.assemblyai.com/docs

## Deploy

### Docker

```bash
docker build -t settlegrid-assemblyai .
docker run -e SETTLEGRID_API_KEY=sg_live_xxx -p 3000:3000 settlegrid-assemblyai
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
