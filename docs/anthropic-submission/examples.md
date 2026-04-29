# SettleGrid Discovery MCP Server -- Working Examples

These examples demonstrate the SettleGrid Discovery MCP server's capabilities for the Anthropic MCP Directory submission. Each example shows a realistic user interaction, the MCP tool calls involved, and the expected response format.

Server URL: `https://settlegrid.ai/api/mcp`

---

## Example 1: Tool Discovery -- Finding a Weather API by Price

**User prompt:**
> "Find me a weather API that costs less than 5 cents per call"

**Step 1 -- Agent calls `search_tools`:**

```json
{
  "method": "tools/call",
  "params": {
    "name": "search_tools",
    "arguments": {
      "query": "weather",
      "limit": 10
    }
  }
}
```

**Expected response:**

```json
{
  "content": [
    {
      "type": "text",
      "text": "{\n  \"tools\": [\n    {\n      \"name\": \"OpenWeatherMap\",\n      \"slug\": \"openweathermap\",\n      \"description\": \"Real-time weather data, forecasts, and historical weather for any location worldwide. Supports current conditions, 5-day forecasts, and weather alerts.\",\n      \"category\": \"data\",\n      \"tags\": [\"weather\", \"forecast\", \"climate\", \"api\"],\n      \"version\": \"2.5.0\",\n      \"pricing\": {\n        \"model\": \"per_call\",\n        \"defaultCostCents\": 2\n      },\n      \"costCents\": 2,\n      \"invocations\": 48230,\n      \"verified\": true,\n      \"averageRating\": 4.6,\n      \"developer\": \"WeatherStack Labs\",\n      \"developerSlug\": \"weatherstack-labs\",\n      \"url\": \"https://settlegrid.ai/tools/openweathermap\",\n      \"developerUrl\": \"https://settlegrid.ai/dev/weatherstack-labs\"\n    },\n    {\n      \"name\": \"Weather Forecast Pro\",\n      \"slug\": \"weather-forecast-pro\",\n      \"description\": \"High-accuracy weather forecasts with hourly granularity. Includes UV index, air quality, and precipitation probability.\",\n      \"category\": \"data\",\n      \"tags\": [\"weather\", \"forecast\", \"uv-index\"],\n      \"version\": \"1.3.0\",\n      \"pricing\": {\n        \"model\": \"per_call\",\n        \"defaultCostCents\": 3\n      },\n      \"costCents\": 3,\n      \"invocations\": 12450,\n      \"verified\": true,\n      \"averageRating\": 4.3,\n      \"developer\": \"Forecast.io\",\n      \"developerSlug\": \"forecast-io\",\n      \"url\": \"https://settlegrid.ai/tools/weather-forecast-pro\",\n      \"developerUrl\": \"https://settlegrid.ai/dev/forecast-io\"\n    }\n  ],\n  \"total\": 8,\n  \"limit\": 10,\n  \"offset\": 0,\n  \"hasMore\": false\n}"
    }
  ]
}
```

**What Claude tells the user:**
> I found several weather APIs on SettleGrid under 5 cents per call. The most popular is **OpenWeatherMap** at $0.02/call with a 4.6-star rating and 48,000+ invocations. It covers real-time data, 5-day forecasts, and weather alerts. **Weather Forecast Pro** at $0.03/call adds UV index and air quality data.

---

## Example 2: Tool Comparison -- Evaluating Translation Tools

**User prompt:**
> "Compare the top 3 translation tools on SettleGrid"

**Step 1 -- Agent calls `search_tools` to find translation tools:**

```json
{
  "method": "tools/call",
  "params": {
    "name": "search_tools",
    "arguments": {
      "query": "translation",
      "limit": 3
    }
  }
}
```

**Expected response (abbreviated):**

```json
{
  "content": [
    {
      "type": "text",
      "text": "{\n  \"tools\": [\n    {\n      \"name\": \"Translation Engine\",\n      \"slug\": \"translation-engine\",\n      \"category\": \"nlp\",\n      \"costCents\": 1,\n      \"invocations\": 34210,\n      \"averageRating\": 4.4,\n      \"developer\": \"SettleGrid\"\n    },\n    {\n      \"name\": \"DeepTranslate\",\n      \"slug\": \"deep-translate\",\n      \"category\": \"nlp\",\n      \"costCents\": 5,\n      \"invocations\": 18700,\n      \"averageRating\": 4.7,\n      \"developer\": \"LinguaAI\"\n    },\n    {\n      \"name\": \"MultiLang API\",\n      \"slug\": \"multilang-api\",\n      \"category\": \"nlp\",\n      \"costCents\": 3,\n      \"invocations\": 9340,\n      \"averageRating\": 4.1,\n      \"developer\": \"Polyglot Labs\"\n    }\n  ],\n  \"total\": 3,\n  \"limit\": 3,\n  \"offset\": 0,\n  \"hasMore\": true\n}"
    }
  ]
}
```

**Step 2 -- Agent calls `get_tool` for each result (3 parallel calls):**

```json
{
  "method": "tools/call",
  "params": {
    "name": "get_tool",
    "arguments": {
      "slug": "translation-engine"
    }
  }
}
```

**Expected response for `translation-engine`:**

```json
{
  "content": [
    {
      "type": "text",
      "text": "{\n  \"tool\": {\n    \"name\": \"Translation Engine\",\n    \"slug\": \"translation-engine\",\n    \"description\": \"Multi-language text translation with automatic language detection. Supports 40+ languages including English, Spanish, French, German, Japanese, Chinese, Korean, Portuguese, Italian, Russian, and Arabic.\",\n    \"category\": \"nlp\",\n    \"tags\": [\"translation\", \"language\", \"i18n\", \"localization\"],\n    \"version\": \"1.0.0\",\n    \"pricing\": {\n      \"model\": \"per_call\",\n      \"defaultCostCents\": 1\n    },\n    \"invocations\": 34210,\n    \"developer\": \"SettleGrid\",\n    \"developerSlug\": \"settlegrid\",\n    \"developerBio\": \"The SettleGrid team. Building the settlement layer for the AI economy.\",\n    \"url\": \"https://settlegrid.ai/tools/translation-engine\",\n    \"reviews\": [\n      {\n        \"rating\": 5,\n        \"comment\": \"Fast and accurate for common language pairs.\",\n        \"createdAt\": \"2026-03-20T14:30:00Z\"\n      },\n      {\n        \"rating\": 4,\n        \"comment\": \"Good for basic translations. Less accurate for specialized jargon.\",\n        \"createdAt\": \"2026-03-18T09:15:00Z\"\n      }\n    ],\n    \"changelog\": [\n      {\n        \"version\": \"1.0.0\",\n        \"changeType\": \"release\",\n        \"summary\": \"Initial release with 40+ language support\",\n        \"createdAt\": \"2026-03-01T00:00:00Z\"\n      }\n    ],\n    \"quickStart\": {\n      \"install\": \"npm install @settlegrid/mcp\",\n      \"usage\": \"import SettleGrid from '@settlegrid/mcp'\\nconst sg = SettleGrid.init({ apiKey: 'YOUR_KEY' })\\nconst result = await sg.call('translation-engine', 'method_name', { ...params })\"\n    }\n  }\n}"
    }
  ]
}
```

**What Claude tells the user:**

> Here's a comparison of the top 3 translation tools on SettleGrid:
>
> | Feature | Translation Engine | DeepTranslate | MultiLang API |
> |---|---|---|---|
> | Cost per call | $0.01 | $0.05 | $0.03 |
> | Rating | 4.4/5 | 4.7/5 | 4.1/5 |
> | Total uses | 34,210 | 18,700 | 9,340 |
> | Languages | 40+ | 100+ | 25 |
> | Best for | Quick, affordable translations | Highest accuracy | Budget option |
>
> **DeepTranslate** has the best accuracy rating but costs 5x more. **Translation Engine** is the most popular choice and cheapest at just 1 cent per call.

---

## Example 3: Tool Details -- Evaluating a Specific Tool

**User prompt:**
> "Tell me about the Dad Jokes tool on SettleGrid — what does it cost and how popular is it?"

**Agent calls `get_tool`:**

```json
{
  "method": "tools/call",
  "params": {
    "name": "get_tool",
    "arguments": {
      "slug": "dad-jokes"
    }
  }
}
```

**Expected response (abbreviated):**

```json
{
  "content": [
    {
      "type": "text",
      "text": "{\n  \"name\": \"Dad Jokes\",\n  \"slug\": \"dad-jokes\",\n  \"description\": \"Random dad jokes and joke search. Get a random joke or search for jokes by keyword.\",\n  \"category\": \"data\",\n  \"costCents\": 0,\n  \"invocations\": 15820,\n  \"averageRating\": 4.8,\n  \"developer\": {\n    \"name\": \"SettleGrid System\",\n    \"slug\": \"settlegrid-system\"\n  },\n  \"url\": \"https://settlegrid.ai/tools/dad-jokes\"\n}"
    }
  ]
}
```

**What Claude tells the user:**
> The Dad Jokes tool on SettleGrid is free to use (0¢ per call), has been invoked over 15,000 times, and has a 4.8 star rating. It offers random jokes and keyword search. You can try it at settlegrid.ai/tools/dad-jokes.

---

## Example 4: Category Browsing -- Exploring Available Tools

**User prompt:**
> "What kinds of tools are available on SettleGrid?"

**Step 1 -- Agent calls `list_categories`:**

```json
{
  "method": "tools/call",
  "params": {
    "name": "list_categories",
    "arguments": {}
  }
}
```

**Expected response:**

```json
{
  "content": [
    {
      "type": "text",
      "text": "{\n  \"categories\": [\n    { \"slug\": \"data\", \"name\": \"Data & APIs\", \"count\": 312 },\n    { \"slug\": \"nlp\", \"name\": \"Natural Language Processing\", \"count\": 247 },\n    { \"slug\": \"code\", \"name\": \"Code & Development\", \"count\": 198 },\n    { \"slug\": \"search\", \"name\": \"Search & Discovery\", \"count\": 156 },\n    { \"slug\": \"finance\", \"name\": \"Finance & Payments\", \"count\": 143 },\n    { \"slug\": \"image\", \"name\": \"Image & Vision\", \"count\": 112 },\n    { \"slug\": \"analytics\", \"name\": \"Analytics & BI\", \"count\": 98 },\n    { \"slug\": \"productivity\", \"name\": \"Productivity\", \"count\": 87 },\n    { \"slug\": \"security\", \"name\": \"Security & Compliance\", \"count\": 65 },\n    { \"slug\": \"other\", \"name\": \"Other\", \"count\": 26 }\n  ]\n}"
    }
  ]
}
```

**What Claude tells the user:**
> SettleGrid has 1,444 tools across 10 categories. The largest categories are Data & APIs (312 tools), Natural Language Processing (247), and Code & Development (198). You can also find Finance, Image & Vision, Analytics, Productivity, and Security tools.

---

## Example 5: Multi-Step Discovery -- Finding and Comparing Finance Tools

**User prompt:**
> "What finance tools are available on SettleGrid? Show me the top 3."

**Step 1 -- Agent calls `list_marketplace_tools` filtered by finance:**

```json
{
  "method": "tools/call",
  "params": {
    "name": "list_marketplace_tools",
    "arguments": {
      "category": "finance",
      "limit": 3
    }
  }
}
```

**Expected response (abbreviated):**

```json
{
  "content": [
    {
      "type": "text",
      "text": "{\n  \"tools\": [\n    {\n      \"name\": \"Forex Rates\",\n      \"slug\": \"forex-rates\",\n      \"description\": \"Live exchange rates from the European Central Bank.\",\n      \"costCents\": 1,\n      \"invocations\": 64970\n    },\n    {\n      \"name\": \"Central Bank Rates\",\n      \"slug\": \"central-bank-rates\",\n      \"description\": \"Currency conversion using ECB reference rates.\",\n      \"costCents\": 1,\n      \"invocations\": 12340\n    },\n    {\n      \"name\": \"Coinpaprika\",\n      \"slug\": \"coinpaprika\",\n      \"description\": \"Cryptocurrency market data, prices, and ticker info.\",\n      \"costCents\": 1,\n      \"invocations\": 8920\n    }\n  ]\n}"
    }
  ]
}
```

**What Claude tells the user:**
> Here are the top 3 finance tools on SettleGrid:
> 1. **Forex Rates** — Live ECB exchange rates (1¢/call, 65K+ invocations)
> 2. **Central Bank Rates** — Currency conversion via ECB (1¢/call, 12K+ invocations)
> 3. **Coinpaprika** — Crypto market data and prices (1¢/call, 9K+ invocations)

---

## Example 6: Developer Research

**User prompt:**
> "Who made the forex rates tool on SettleGrid? What else have they published?"

**Step 1 -- Agent calls `get_tool` to find the developer:**

```json
{
  "method": "tools/call",
  "params": {
    "name": "get_tool",
    "arguments": {
      "slug": "forex-rates"
    }
  }
}
```

**Step 2 -- Agent calls `get_developer` with the developer slug from the response:**

```json
{
  "method": "tools/call",
  "params": {
    "name": "get_developer",
    "arguments": {
      "slug": "settlegrid"
    }
  }
}
```

**Expected response:**

```json
{
  "content": [
    {
      "type": "text",
      "text": "{\n  \"name\": \"SettleGrid\",\n  \"bio\": \"The SettleGrid team. Building the settlement layer for the AI economy.\",\n  \"tools\": [\n    { \"name\": \"Wikipedia\", \"slug\": \"wikipedia\", \"category\": \"data\" },\n    { \"name\": \"Forex Rates\", \"slug\": \"forex-rates\", \"category\": \"finance\" },\n    { \"name\": \"Dad Jokes\", \"slug\": \"dad-jokes\", \"category\": \"data\" },\n    { \"name\": \"Hacker News\", \"slug\": \"hacker-news\", \"category\": \"data\" },\n    { \"name\": \"ISS Tracker\", \"slug\": \"iss-tracker\", \"category\": \"data\" }\n  ],\n  \"reputation\": {\n    \"totalTools\": 29,\n    \"totalInvocations\": 284500,\n    \"averageRating\": 4.5\n  }\n}"
    }
  ]
}
```

---

## Connection Setup

### Streamable HTTP (Claude Desktop, remote MCP)

Add to your Claude Desktop MCP settings:

```json
{
  "mcpServers": {
    "settlegrid": {
      "url": "https://settlegrid.ai/api/mcp",
      "headers": {
        "x-api-key": "YOUR_SETTLEGRID_API_KEY"
      }
    }
  }
}
```

The `x-api-key` header is optional. Without it, you can still search, browse, and invoke free showcase tools. With an API key, you can invoke paid marketplace tools with per-call billing.

### stdio (npm package)

```bash
npx @settlegrid/discovery
```

Or add to Claude Desktop MCP settings:

```json
{
  "mcpServers": {
    "settlegrid": {
      "command": "npx",
      "args": ["-y", "@settlegrid/discovery"]
    }
  }
}
```
