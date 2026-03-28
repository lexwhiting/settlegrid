# SettleGrid Service Templates

Reference implementations showing how to wrap various services with SettleGrid's `sg.wrap()` pattern for per-usage billing. These are **not** deployable projects -- they are standalone TypeScript files demonstrating the billing integration pattern for each service type.

## Templates

### 1. `llm-proxy.ts` -- LLM Proxy
Wraps OpenAI chat completions with **per-token billing**. Callers pay per 1K tokens without needing their own OpenAI key.
- **Pricing model:** Per-token ($0.003/1K tokens)
- **Dependencies:** `settlegrid`, `openai`

### 2. `browser-scraper.ts` -- Browser Scraper
Wraps Playwright page scraping with **per-page billing**. Callers provide a URL and get extracted content.
- **Pricing model:** Per-call ($0.05/scrape)
- **Dependencies:** `settlegrid`, `playwright`

### 3. `image-generator.ts` -- Image Generator
Wraps DALL-E image generation with **per-image billing**. Multi-image requests are charged per image.
- **Pricing model:** Per-unit ($0.10/image)
- **Dependencies:** `settlegrid`, `openai`

### 4. `email-sender.ts` -- Email Sender
Wraps the Resend email API with **per-email billing**. Callers send transactional emails without managing email infrastructure.
- **Pricing model:** Per-call ($0.01/email)
- **Dependencies:** `settlegrid`, `resend`

### 5. `code-sandbox.ts` -- Code Sandbox
Wraps sandboxed code execution with **per-second billing**. Supports Python, JavaScript, TypeScript, and Bash.
- **Pricing model:** Per-second ($0.01/second)
- **Dependencies:** `settlegrid` (+ Docker recommended for production)

### 6. `search-api.ts` -- Search API
Wraps a web search API (Brave Search) with **per-query billing**. Returns structured search results.
- **Pricing model:** Per-call ($0.02/query)
- **Dependencies:** `settlegrid`

## Common Pattern

Every template follows the same structure:

```typescript
import { SettleGrid } from 'settlegrid'

const sg = new SettleGrid({ secret: process.env.SETTLEGRID_SECRET! })

async function handler(input: RequestType): Promise<ResponseType> {
  // Your service logic here
}

export default sg.wrap(handler, {
  name: 'service-name',
  pricing: { model: 'per-call', costCentsPerCall: 5 },
  rateLimit: { requests: 60, window: '1m' },
})
```

## Pricing Models

| Model | Field | Use Case |
|-------|-------|----------|
| `per-call` | `costCentsPerCall` | Fixed cost per request (email, search) |
| `per-token` | `costPer1kTokens` | LLM inference, text processing |
| `per-unit` | `costCentsPerUnit` | Image generation, batch operations |
| `per-second` | `costCentsPerSecond` | Code execution, long-running tasks |

## Getting Started

1. Pick a template that matches your service type
2. Install dependencies: `npm install settlegrid <service-sdk>`
3. Set `SETTLEGRID_SECRET` from your SettleGrid dashboard
4. Implement your service logic in the handler function
5. Deploy to any Node.js host (Vercel, Railway, Fly.io, etc.)
6. Register the endpoint URL on your SettleGrid dashboard
