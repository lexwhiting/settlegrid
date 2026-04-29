# settlegrid-firecrawl

Firecrawl MCP Server with per-call billing via [SettleGrid](https://settlegrid.ai).

[![Powered by SettleGrid](https://img.shields.io/badge/Powered%20by-SettleGrid-10B981?style=flat-square)](https://settlegrid.ai)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg?style=flat-square)](LICENSE)
[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https://github.com/settlegrid/settlegrid-firecrawl)

Scrape, crawl, map, and extract structured data from websites using the Firecrawl API.

## Quick Start

```bash
npm install
cp .env.example .env   # Add your SettleGrid API key
npm run dev
```

## Methods

| Method | Description | Cost |
|--------|-------------|------|
| `scrape_url(url: string, formats?: string[], onlyMainContent?: boolean)` | Scrape a single URL and return its content | 2¢ |
| `crawl_website(url: string, maxDepth?: number, limit?: number, includePaths?: string[], excludePaths?: string[])` | Start a crawl job on a website starting from a base URL | 5¢ |
| `get_crawl_status(id: string)` | Get the status and results of a crawl job by ID | 1¢ |
| `map_website(url: string, search?: string, limit?: number, includeSubdomains?: boolean)` | Map a website to discover all its URLs | 2¢ |
| `extract_data(urls: string[], prompt: string, schema?: object)` | Extract structured data from one or more URLs using AI | 8¢ |
| `get_extract_status(id: string)` | Get the status and results of an extract job by ID | 1¢ |
| `generate_llmstxt(url: string, maxUrls?: number, showFullText?: boolean)` | Generate an LLMs.txt file for a given website URL | 5¢ |
| `get_llmstxt_status(id: string)` | Get the status and results of an LLMs.txt generation job by ID | 1¢ |

## Parameters

### scrape_url
- `url` (string, required) — The URL to scrape
- `formats` (string[]) — Output formats: markdown, html, rawHtml, links, screenshot (default: ["markdown"])
- `onlyMainContent` (boolean) — Only return the main content of the page, stripping navigation and boilerplate

### crawl_website
- `url` (string, required) — The base URL to start crawling from
- `maxDepth` (number) — Maximum crawl depth (default 2, max 10)
- `limit` (number) — Maximum number of pages to crawl (default 10, max 100)
- `includePaths` (string[]) — URL path patterns to include during crawl
- `excludePaths` (string[]) — URL path patterns to exclude during crawl

### get_crawl_status
- `id` (string, required) — The crawl job ID returned by crawl_website

### map_website
- `url` (string, required) — The website URL to map
- `search` (string) — Search query to filter discovered URLs
- `limit` (number) — Maximum number of URLs to return (default 50, max 500)
- `includeSubdomains` (boolean) — Include subdomains in the URL map

### extract_data
- `urls` (string[], required) — List of URLs to extract structured data from
- `prompt` (string, required) — Natural language prompt describing the data to extract
- `schema` (object) — Optional JSON schema defining the structure of extracted data

### get_extract_status
- `id` (string, required) — The extract job ID returned by extract_data

### generate_llmstxt
- `url` (string, required) — The website URL to generate LLMs.txt for
- `maxUrls` (number) — Maximum number of URLs to include (default 10, max 50)
- `showFullText` (boolean) — Include full page text in the LLMs.txt output

### get_llmstxt_status
- `id` (string, required) — The LLMs.txt generation job ID

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `SETTLEGRID_API_KEY` | Yes | Your SettleGrid API key from [settlegrid.ai](https://settlegrid.ai) |
| `FIRECRAWL_API_KEY` | Yes | Firecrawl API key from [https://firecrawl.dev](https://firecrawl.dev) |

## Upstream API

- **Provider**: Firecrawl
- **Base URL**: https://api.firecrawl.dev
- **Auth**: API key required
- **Docs**: https://docs.firecrawl.dev/api-reference/introduction

## Deploy

### Docker

```bash
docker build -t settlegrid-firecrawl .
docker run -e SETTLEGRID_API_KEY=sg_live_xxx -p 3000:3000 settlegrid-firecrawl
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
