# settlegrid-bright-data

Bright Data Scrapers Library MCP Server with per-call billing via [SettleGrid](https://settlegrid.ai).

[![Powered by SettleGrid](https://img.shields.io/badge/Powered%20by-SettleGrid-10B981?style=flat-square)](https://settlegrid.ai)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg?style=flat-square)](LICENSE)
[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https://github.com/settlegrid/settlegrid-bright-data)

Trigger and retrieve structured web scraping jobs from Bright Data's library of 660+ pre-built scrapers.

## Quick Start

```bash
npm install
cp .env.example .env   # Add your SettleGrid API key
npm run dev
```

## Methods

| Method | Description | Cost |
|--------|-------------|------|
| `trigger_scraper_job(scraper_id: string, inputs: object[], endpoint?: string, notify?: string, format?: string)` | Trigger an asynchronous scraper job from the Scrapers Library | 5¢ |
| `get_job_progress(snapshot_id: string)` | Check the progress of an asynchronous scraper job | 1¢ |
| `get_snapshot_results(snapshot_id: string, format?: string)` | Retrieve the results of a completed scraper job by snapshot ID | 2¢ |
| `scrape_sync(scraper_id: string, inputs: object[], format?: string)` | Trigger a synchronous scraper job and wait for results | 8¢ |

## Parameters

### trigger_scraper_job
- `scraper_id` (string, required) — The scraper/dataset ID to use (e.g. gd_l1vikfnt1wgvvqz95w)
- `inputs` (object[], required) — Array of input objects for the scraper (e.g. [{url: 'https://...'}])
- `endpoint` (string) — Webhook endpoint URL to receive results when job completes
- `notify` (string) — Notification URL when job completes
- `format` (string) — Output format: json (default) or csv

### get_job_progress
- `snapshot_id` (string, required) — The snapshot ID returned from the trigger endpoint

### get_snapshot_results
- `snapshot_id` (string, required) — The snapshot ID of the completed job
- `format` (string) — Output format: json (default) or csv

### scrape_sync
- `scraper_id` (string, required) — The scraper/dataset ID to use (e.g. gd_l1vikfnt1wgvvqz95w)
- `inputs` (object[], required) — Array of input objects for the scraper (e.g. [{url: 'https://...'}])
- `format` (string) — Output format: json (default) or csv

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `SETTLEGRID_API_KEY` | Yes | Your SettleGrid API key from [settlegrid.ai](https://settlegrid.ai) |
| `BRIGHTDATA_API_KEY` | Yes | Bright Data API key from [https://brightdata.com/cp/setting](https://brightdata.com/cp/setting) |

## Upstream API

- **Provider**: Bright Data
- **Base URL**: https://api.brightdata.com
- **Auth**: API key required
- **Docs**: https://docs.brightdata.com/datasets/scrapers/scrapers-library/overview

## Deploy

### Docker

```bash
docker build -t settlegrid-bright-data .
docker run -e SETTLEGRID_API_KEY=sg_live_xxx -p 3000:3000 settlegrid-bright-data
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
