# settlegrid-arize-ax

Arize AX MCP Server with per-call billing via [SettleGrid](https://settlegrid.ai).

[![Powered by SettleGrid](https://img.shields.io/badge/Powered%20by-SettleGrid-10B981?style=flat-square)](https://settlegrid.ai)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg?style=flat-square)](LICENSE)
[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https://github.com/settlegrid/settlegrid-arize-ax)

Manage spaces, models, and monitors in Arize AX — the AI observability and LLM evaluation platform.

## Quick Start

```bash
npm install
cp .env.example .env   # Add your SettleGrid API key
npm run dev
```

## Methods

| Method | Description | Cost |
|--------|-------------|------|
| `list_spaces()` | List all spaces in the account | 1¢ |
| `get_space(space_id: string)` | Get a specific space by ID | 1¢ |
| `list_models(space_id: string)` | List all models in a space | 1¢ |
| `get_model(space_id: string, model_id: string)` | Get a specific model by ID | 1¢ |
| `delete_model(space_id: string, model_id: string)` | Delete a specific model by ID | 3¢ |
| `list_monitors(space_id: string)` | List all monitors in a space | 1¢ |
| `get_monitor(space_id: string, monitor_id: string)` | Get a specific monitor by ID | 1¢ |
| `delete_monitor(space_id: string, monitor_id: string)` | Delete a specific monitor by ID | 3¢ |

## Parameters

### list_spaces

### get_space
- `space_id` (string, required) — The ID of the space to retrieve

### list_models
- `space_id` (string, required) — The ID of the space containing the models

### get_model
- `space_id` (string, required) — The ID of the space containing the model
- `model_id` (string, required) — The ID of the model to retrieve

### delete_model
- `space_id` (string, required) — The ID of the space containing the model
- `model_id` (string, required) — The ID of the model to delete

### list_monitors
- `space_id` (string, required) — The ID of the space containing the monitors

### get_monitor
- `space_id` (string, required) — The ID of the space containing the monitor
- `monitor_id` (string, required) — The ID of the monitor to retrieve

### delete_monitor
- `space_id` (string, required) — The ID of the space containing the monitor
- `monitor_id` (string, required) — The ID of the monitor to delete

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `SETTLEGRID_API_KEY` | Yes | Your SettleGrid API key from [settlegrid.ai](https://settlegrid.ai) |
| `ARIZE_API_KEY` | Yes | Arize AX API key from [https://app.arize.com/settings/api-keys](https://app.arize.com/settings/api-keys) |

## Upstream API

- **Provider**: Arize AX
- **Base URL**: https://api.arize.com
- **Auth**: API key required
- **Docs**: https://arize.com/docs/ax/rest-reference/overview

## Deploy

### Docker

```bash
docker build -t settlegrid-arize-ax .
docker run -e SETTLEGRID_API_KEY=sg_live_xxx -p 3000:3000 settlegrid-arize-ax
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
