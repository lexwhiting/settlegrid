# SettleGrid Founder Tools

Five real, working MCP tools that demonstrate SettleGrid billing end-to-end. Each tool is a standalone TypeScript file that runs as an MCP server with per-call billing already wired in.

## Tools

| Tool | File | Price | Category | What it does |
|------|------|-------|----------|--------------|
| JSON Formatter | `json-formatter.ts` | 1 cent | utility | Validate, format, minify, and extract keys from JSON |
| Word Counter | `word-counter.ts` | 1 cent | nlp | Word count, reading time, language detection, text statistics |
| Hash Generator | `hash-generator.ts` | 1 cent | security | Cryptographic hashes, UUIDs, random strings, hash verification |
| URL Analyzer | `url-analyzer.ts` | 2 cents | data | URL parsing, query param extraction, page type classification |
| Code Metrics | `code-metrics.ts` | 5 cents | code | Line count, function count, comment ratio, complexity, language detection |

## Quick Start

### 1. Install dependencies

```bash
npm install @settlegrid/mcp
```

### 2. Run a tool locally

```bash
npx tsx scripts/founder-tools/json-formatter.ts
```

### 3. Deploy to Vercel

Each tool can be deployed as a serverless function. Create a `api/` directory and import the handlers:

```typescript
// api/json-formatter.ts
import { formatJson } from '../scripts/founder-tools/json-formatter'
export default formatJson
```

### 4. Deploy to Railway

```bash
railway init
railway up
```

## Tool Details

### JSON Formatter (`json-formatter.ts`)

**Methods:**
- `format_json(input, indent?, sortKeys?)` -- Validate and pretty-print JSON with structural analysis
- `minify_json(input)` -- Minify JSON to smallest representation
- `extract_keys(input, depth?)` -- Extract all keys with their types at configurable depth

**Use case:** Agents cleaning web-scraped data, validating API responses, or processing configuration files.

### Word Counter (`word-counter.ts`)

**Methods:**
- `count_words(text)` -- Full statistics: words, chars, sentences, paragraphs, syllables, lexical diversity, reading/speaking time
- `reading_time(text, wpm?)` -- Estimated reading time with configurable words-per-minute
- `detect_language(text)` -- Basic language detection using word frequency markers (supports EN, ES, FR, DE, PT, IT, NL, JA, KO, ZH, AR)

**Use case:** Content agents measuring text length, editors estimating read time, translation pipelines detecting source language.

### Hash Generator (`hash-generator.ts`)

**Methods:**
- `generate_hash(text, algorithm?, encoding?)` -- Hash with MD5, SHA-1, SHA-256, or SHA-512 in hex or base64
- `generate_uuid(count?)` -- Generate v4 UUIDs (up to 50 at once)
- `generate_random(length?, charset?, count?)` -- Random strings with alphanumeric, hex, base64, or symbol charsets
- `verify_hash(text, hash, algorithm?)` -- Verify a hash matches input text (supports both hex and base64)

**Use case:** Test data generation, file integrity checks, unique ID creation, secure token generation.

### URL Analyzer (`url-analyzer.ts`)

**Methods:**
- `analyze_url(url)` -- Full analysis: protocol, domain parts, path segments, query params, page type classification, security checks
- `parse_query_params(url)` -- Extract and decode all query parameters
- `compare_urls(url1, url2)` -- Compare two URLs for identity/equivalence

**Use case:** Web crawl processing, link validation, URL normalization, redirect chain analysis.

### Code Metrics (`code-metrics.ts`)

**Methods:**
- `analyze_code(code, language?)` -- Full metrics: lines, functions, comments, complexity, imports, line length stats
- `detect_language(code)` -- Detect programming language (supports TypeScript, JavaScript, Python, Go, Rust, Java, Ruby, PHP, C#, Shell, SQL)
- `count_functions(code, language?)` -- Find and list all functions with line numbers and types

**Use case:** Code review automation, PR size estimation, quality dashboards, codebase audits.

## SettleGrid Pattern

Every tool follows the same pattern:

```typescript
import { settlegrid } from '@settlegrid/mcp'

// 1. Initialize with pricing
const sg = settlegrid.init({
  toolSlug: 'my-tool',
  pricing: {
    defaultCostCents: 1,
    methods: {
      my_method: { costCents: 1, displayName: 'My Method' },
    },
  },
})

// 2. Wrap your handler
const myMethod = sg.wrap(async (args: MyArgs) => {
  // Your logic here
  return { result: 'data' }
}, { method: 'my_method' })

export { myMethod }
```

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `SETTLEGRID_TOOL_SLUG` | No | Override the default tool slug |

## License

MIT
