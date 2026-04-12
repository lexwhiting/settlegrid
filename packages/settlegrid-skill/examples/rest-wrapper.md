# Example: REST API Wrapper with @modelcontextprotocol/sdk

A 40-line MCP server that wraps a public REST API (Open-Meteo weather) and charges 1 cent per call.

## Before

```typescript
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js'
import { z } from 'zod'

const server = new McpServer({ name: 'weather', version: '1.0.0' })

server.tool(
  'get_weather',
  'Get current weather for a location',
  { latitude: z.number(), longitude: z.number() },
  async ({ latitude, longitude }) => {
    const url = `https://api.open-meteo.com/v1/forecast?latitude=${latitude}&longitude=${longitude}&current_weather=true`
    const res = await fetch(url)
    const data = await res.json()
    return { content: [{ type: 'text', text: JSON.stringify(data.current_weather) }] }
  }
)

server.tool(
  'get_forecast',
  'Get 7-day forecast for a location',
  { latitude: z.number(), longitude: z.number() },
  async ({ latitude, longitude }) => {
    const url = `https://api.open-meteo.com/v1/forecast?latitude=${latitude}&longitude=${longitude}&daily=temperature_2m_max,temperature_2m_min&timezone=auto`
    const res = await fetch(url)
    const data = await res.json()
    return { content: [{ type: 'text', text: JSON.stringify(data.daily) }] }
  }
)

const transport = new StdioServerTransport()
await server.connect(transport)
```

## After

```typescript
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js'
import { z } from 'zod'
import { settlegrid } from '@settlegrid/mcp'

const sg = settlegrid.init({
  toolSlug: 'weather-api',
  pricing: {
    defaultCostCents: 1,
    methods: {
      get_weather: { costCents: 1, displayName: 'Current Weather' },
      get_forecast: { costCents: 2, displayName: '7-Day Forecast' },
    },
  },
})

const server = new McpServer({ name: 'weather', version: '1.0.0' })

const getWeather = sg.wrap(
  async (args: { latitude: number; longitude: number }) => {
    const url = `https://api.open-meteo.com/v1/forecast?latitude=${args.latitude}&longitude=${args.longitude}&current_weather=true`
    const res = await fetch(url)
    const data = await res.json()
    return { content: [{ type: 'text', text: JSON.stringify(data.current_weather) }] }
  },
  { method: 'get_weather' }
)

const getForecast = sg.wrap(
  async (args: { latitude: number; longitude: number }) => {
    const url = `https://api.open-meteo.com/v1/forecast?latitude=${args.latitude}&longitude=${args.longitude}&daily=temperature_2m_max,temperature_2m_min&timezone=auto`
    const res = await fetch(url)
    const data = await res.json()
    return { content: [{ type: 'text', text: JSON.stringify(data.daily) }] }
  },
  { method: 'get_forecast' }
)

server.tool(
  'get_weather',
  'Get current weather for a location',
  { latitude: z.number(), longitude: z.number() },
  async ({ latitude, longitude }) => {
    return getWeather(
      { latitude, longitude },
      { metadata: { 'settlegrid-api-key': process.env.SETTLEGRID_API_KEY } }
    )
  }
)

server.tool(
  'get_forecast',
  'Get 7-day forecast for a location',
  { latitude: z.number(), longitude: z.number() },
  async ({ latitude, longitude }) => {
    return getForecast(
      { latitude, longitude },
      { metadata: { 'settlegrid-api-key': process.env.SETTLEGRID_API_KEY } }
    )
  }
)

const transport = new StdioServerTransport()
await server.connect(transport)
```

### Key Changes

- **Lines 4, 6-16**: Added `@settlegrid/mcp` import and `settlegrid.init()` with per-method pricing.
- **Lines 20-30, 32-42**: Extracted handler logic into `sg.wrap()` calls with typed args.
- **Lines 44-56, 58-69**: Server tool registrations now delegate to the wrapped handlers, passing the API key via MCP metadata.

### Dashboard View

After deploying, the SettleGrid dashboard at `https://settlegrid.ai/dashboard` shows a real-time chart of invocations per tool. Each row displays the method name (e.g. "Current Weather"), the 24-hour call count, total revenue in cents, and the consumer who made the call. A usage spike triggers an email alert if you enable it in settings.

### Revenue Math

- **Calls/day**: 500 (modest usage from 10 active consumers)
- **Average cost**: 1.5 cents/call (mix of 1c weather + 2c forecast)
- **Projected monthly**: 500 × 1.5 × 30 = **$225/month**
