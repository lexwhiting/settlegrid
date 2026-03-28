# SettleGrid Publish Action

Publish your MCP tool to the SettleGrid registry directly from your CI pipeline. Works like `npm publish` but for the SettleGrid tool marketplace.

On every push to `main`, this action reads your `settlegrid.config.json` and upserts the tool in the registry — creating it on the first run and updating it on subsequent runs.

## Usage

Add to your GitHub Actions workflow:

```yaml
name: Deploy & Publish
on:
  push:
    branches: [main]

jobs:
  publish:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - uses: settlegrid/publish-action@v1
        with:
          api-key: ${{ secrets.SETTLEGRID_API_KEY }}
```

## `settlegrid.config.json`

Create this file in your repository root:

```json
{
  "name": "My Translation Tool",
  "slug": "my-translation-tool",
  "description": "AI-powered translation across 50+ languages",
  "category": "nlp",
  "version": "1.2.0",
  "pricing": {
    "model": "per-invocation",
    "defaultCostCents": 2
  },
  "healthEndpoint": "https://my-tool.example.com/health",
  "tags": ["translation", "nlp", "language"]
}
```

### Required Fields

| Field | Description |
|-------|-------------|
| `name` | Display name for your tool (max 200 chars) |
| `slug` | URL-safe identifier (lowercase, numbers, hyphens only; max 100 chars) |
| `description` | What your tool does (max 2000 chars) |
| `category` | Tool category (e.g. `data`, `nlp`, `image`, `code`, `search`, `finance`) |
| `version` | Semantic version (e.g. `1.0.0`) |
| `pricing` | Pricing configuration object (see below) |

### Optional Fields

| Field | Description |
|-------|-------------|
| `healthEndpoint` | URL for health checks (must be a valid URL) |
| `tags` | Array of string tags for discoverability (max 20 tags) |

### Pricing Models

| Model | Required Fields |
|-------|----------------|
| `per-invocation` | `defaultCostCents` |
| `per-token` | `costPerToken` |
| `per-byte` | `costPerMB` |
| `per-second` | `costPerSecond` |
| `tiered` | `methods` (object with at least one method) |
| `outcome` | `outcomeConfig.successCostCents` |

## Inputs

| Input | Required | Default | Description |
|-------|----------|---------|-------------|
| `api-key` | Yes | | Your SettleGrid developer API key |
| `config-path` | No | `./settlegrid.config.json` | Path to your config file |
| `base-url` | No | `https://settlegrid.ai` | SettleGrid API base URL |

## Outputs

| Output | Description |
|--------|-------------|
| `tool-url` | Storefront URL for the published tool |
| `tool-slug` | The tool slug in the registry |
| `version` | The published version |

## How It Works

1. Reads your `settlegrid.config.json`
2. Validates all required fields and pricing config
3. Calls `PUT /api/tools/publish` with your tool data
4. If a tool with your slug exists and belongs to you, it updates it
5. If no tool with your slug exists, it creates a new one
6. Sets the tool status to `active`

## Getting Your API Key

1. Sign in to [settlegrid.ai](https://settlegrid.ai)
2. Go to Developer Settings
3. Generate an API key
4. Add it as a repository secret named `SETTLEGRID_API_KEY`

## Pricing

SettleGrid uses a progressive take rate model — developers keep more as they grow:

| Monthly Revenue | Take Rate | Developer Keeps |
|-----------------|-----------|-----------------|
| $0 - $1,000 | 0% | 100% |
| $1,001 - $10,000 | 2% | 98% |
| $10,001 - $50,000 | 3% | 97% |
| $50,001+ | 5% | 95% |

**Free tier:** 50,000 ops/month, unlimited tools, no credit card required.
**Builder tier:** $19/month for 500,000 ops/month.

## Docs

Full documentation at [settlegrid.ai/docs](https://settlegrid.ai/docs)
