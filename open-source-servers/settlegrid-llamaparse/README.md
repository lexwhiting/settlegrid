# settlegrid-llamaparse

LlamaParse MCP Server with per-call billing via [SettleGrid](https://settlegrid.ai).

[![Powered by SettleGrid](https://img.shields.io/badge/Powered%20by-SettleGrid-10B981?style=flat-square)](https://settlegrid.ai)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg?style=flat-square)](LICENSE)
[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https://github.com/settlegrid/settlegrid-llamaparse)

Upload documents for AI-powered parsing and retrieve results in markdown, text, or JSON format via the LlamaIndex LlamaParse API.

## Quick Start

```bash
npm install
cp .env.example .env   # Add your SettleGrid API key
npm run dev
```

## Methods

| Method | Description | Cost |
|--------|-------------|------|
| `upload_file_for_parsing(file_content: string, file_name: string, content_type?: string)` | Upload a file (by URL or base64) to start a parsing job | 5¢ |
| `get_job_status(job_id: string)` | Get the status of a parsing job by job ID | 1¢ |
| `get_result_markdown(job_id: string)` | Get the parsed document result as markdown | 2¢ |
| `get_result_text(job_id: string)` | Get the parsed document result as plain text | 2¢ |
| `get_result_json(job_id: string)` | Get the parsed document result as structured JSON | 2¢ |
| `get_page_image(job_id: string, page: number)` | Get a rendered PNG image of a specific page from a parsed job | 2¢ |
| `delete_job(job_id: string)` | Delete a parsing job and its associated data | 1¢ |

## Parameters

### upload_file_for_parsing
- `file_content` (string, required) — Base64-encoded file content to upload for parsing
- `file_name` (string, required) — Original file name including extension (e.g. report.pdf)
- `content_type` (string) — MIME type of the file (default: application/pdf)

### get_job_status
- `job_id` (string, required) — The ID of the parsing job returned from upload

### get_result_markdown
- `job_id` (string, required) — The ID of the completed parsing job

### get_result_text
- `job_id` (string, required) — The ID of the completed parsing job

### get_result_json
- `job_id` (string, required) — The ID of the completed parsing job

### get_page_image
- `job_id` (string, required) — The ID of the completed parsing job
- `page` (number, required) — Zero-based page number to retrieve as PNG

### delete_job
- `job_id` (string, required) — The ID of the parsing job to delete

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `SETTLEGRID_API_KEY` | Yes | Your SettleGrid API key from [settlegrid.ai](https://settlegrid.ai) |
| `LLAMA_CLOUD_API_KEY` | Yes | LlamaIndex LlamaParse API key from [https://cloud.llamaindex.ai](https://cloud.llamaindex.ai) |

## Upstream API

- **Provider**: LlamaIndex LlamaParse
- **Base URL**: https://api.cloud.llamaindex.ai
- **Auth**: API key required
- **Docs**: https://developers.llamaindex.ai/llamaparse/parse/guides/api-reference/

## Deploy

### Docker

```bash
docker build -t settlegrid-llamaparse .
docker run -e SETTLEGRID_API_KEY=sg_live_xxx -p 3000:3000 settlegrid-llamaparse
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
