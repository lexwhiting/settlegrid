# settlegrid-prefect

Prefect MCP Server with per-call billing via [SettleGrid](https://settlegrid.ai).

[![Powered by SettleGrid](https://img.shields.io/badge/Powered%20by-SettleGrid-10B981?style=flat-square)](https://settlegrid.ai)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg?style=flat-square)](LICENSE)
[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https://github.com/settlegrid/settlegrid-prefect)

Manage and monitor Prefect Cloud workflows, flow runs, deployments, and task runs via the Prefect REST API.

## Quick Start

```bash
npm install
cp .env.example .env   # Add your SettleGrid API key
npm run dev
```

## Methods

| Method | Description | Cost |
|--------|-------------|------|
| `get_flow(flow_id: string)` | Get a flow by ID | 1¢ |
| `filter_flows(name?: string, limit?: number, offset?: number)` | Filter and list flows with optional criteria | 1¢ |
| `get_flow_run(flow_run_id: string)` | Get a flow run by ID | 1¢ |
| `filter_flow_runs(deployment_id?: string, state_type?: string, limit?: number, offset?: number)` | Filter and list flow runs with optional state and deployment filters | 2¢ |
| `create_flow_run_from_deployment(deployment_id: string, parameters?: Record<string, unknown>, name?: string)` | Create a flow run from a deployment | 5¢ |
| `get_deployment(deployment_id: string)` | Get a deployment by ID | 1¢ |
| `filter_deployments(name?: string, limit?: number, offset?: number)` | Filter and list deployments with optional name filter | 1¢ |
| `filter_logs(flow_run_id?: string, task_run_id?: string, level?: number, limit?: number, offset?: number)` | Filter and retrieve logs for a flow run or task run | 2¢ |

## Parameters

### get_flow
- `flow_id` (string, required) — UUID of the flow to retrieve

### filter_flows
- `name` (string) — Optional name filter for flows (partial match)
- `limit` (number) — Maximum number of flows to return (default 20, max 50)
- `offset` (number) — Pagination offset (default 0)

### get_flow_run
- `flow_run_id` (string, required) — UUID of the flow run to retrieve

### filter_flow_runs
- `deployment_id` (string) — Optional UUID of the deployment to filter flow runs by
- `state_type` (string) — Optional state type filter (e.g. COMPLETED, FAILED, RUNNING, SCHEDULED)
- `limit` (number) — Maximum number of flow runs to return (default 20, max 50)
- `offset` (number) — Pagination offset (default 0)

### create_flow_run_from_deployment
- `deployment_id` (string, required) — UUID of the deployment to trigger a flow run from
- `parameters` (object) — Optional parameter overrides for the flow run as a JSON object
- `name` (string) — Optional name for the new flow run

### get_deployment
- `deployment_id` (string, required) — UUID of the deployment to retrieve

### filter_deployments
- `name` (string) — Optional name filter for deployments (partial match)
- `limit` (number) — Maximum number of deployments to return (default 20, max 50)
- `offset` (number) — Pagination offset (default 0)

### filter_logs
- `flow_run_id` (string) — UUID of the flow run to retrieve logs for
- `task_run_id` (string) — UUID of the task run to retrieve logs for
- `level` (number) — Minimum log level (0=DEBUG, 10=INFO, 20=WARNING, 30=ERROR, 40=CRITICAL)
- `limit` (number) — Maximum number of log entries to return (default 20, max 50)
- `offset` (number) — Pagination offset (default 0)

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `SETTLEGRID_API_KEY` | Yes | Your SettleGrid API key from [settlegrid.ai](https://settlegrid.ai) |
| `PREFECT_API_KEY` | Yes | Prefect API key from [https://app.prefect.cloud/my/api-keys](https://app.prefect.cloud/my/api-keys) |

## Upstream API

- **Provider**: Prefect
- **Base URL**: https://api.prefect.cloud/api/accounts/{account_id}/workspaces/{workspace_id}
- **Auth**: API key required
- **Docs**: https://docs.prefect.io/v3/api-ref/rest-api

## Deploy

### Docker

```bash
docker build -t settlegrid-prefect .
docker run -e SETTLEGRID_API_KEY=sg_live_xxx -p 3000:3000 settlegrid-prefect
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
