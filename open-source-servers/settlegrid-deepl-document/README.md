# settlegrid-deepl-document

DeepL Document Translation MCP Server with per-call billing via [SettleGrid](https://settlegrid.ai).

[![Powered by SettleGrid](https://img.shields.io/badge/Powered%20by-SettleGrid-10B981?style=flat-square)](https://settlegrid.ai)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg?style=flat-square)](LICENSE)
[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https://github.com/settlegrid/settlegrid-deepl-document)

Upload, check status, and download translated documents using the DeepL API.

## Quick Start

```bash
npm install
cp .env.example .env   # Add your SettleGrid API key
npm run dev
```

## Methods

| Method | Description | Cost |
|--------|-------------|------|
| `upload_document(file_url: string, target_lang: string, source_lang?: string, filename?: string, formality?: string, glossary_id?: string, output_format?: string)` | Upload a document for translation | 5¢ |
| `get_document_status(document_id: string, document_key: string)` | Check the translation status of an uploaded document | 1¢ |
| `download_document(document_id: string, document_key: string)` | Download the translated document once translation is complete | 2¢ |

## Parameters

### upload_document
- `file_url` (string, required) — Public URL of the document file to fetch and upload for translation
- `target_lang` (string, required) — Target language code (e.g. EN-US, DE, FR, ES)
- `source_lang` (string) — Source language code. If omitted, DeepL will auto-detect.
- `filename` (string) — Filename including extension (e.g. report.pdf). Required if extension cannot be inferred from URL.
- `formality` (string) — Formality level: default, more, less, prefer_more, prefer_less
- `glossary_id` (string) — Glossary ID to use during translation
- `output_format` (string) — Desired output file format (e.g. docx, pdf)

### get_document_status
- `document_id` (string, required) — Document ID returned when the document was uploaded
- `document_key` (string, required) — Document encryption key returned when the document was uploaded

### download_document
- `document_id` (string, required) — Document ID returned when the document was uploaded
- `document_key` (string, required) — Document encryption key returned when the document was uploaded

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `SETTLEGRID_API_KEY` | Yes | Your SettleGrid API key from [settlegrid.ai](https://settlegrid.ai) |
| `DEEPL_API_KEY` | Yes | DeepL API key from [https://www.deepl.com/pro-api](https://www.deepl.com/pro-api) |

## Upstream API

- **Provider**: DeepL
- **Base URL**: https://api.deepl.com
- **Auth**: API key required
- **Docs**: https://developers.deepl.com/api-reference/document

## Deploy

### Docker

```bash
docker build -t settlegrid-deepl-document .
docker run -e SETTLEGRID_API_KEY=sg_live_xxx -p 3000:3000 settlegrid-deepl-document
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
