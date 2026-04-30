# settlegrid-letta

Letta MCP Server with per-call billing via [SettleGrid](https://settlegrid.ai).

[![Powered by SettleGrid](https://img.shields.io/badge/Powered%20by-SettleGrid-10B981?style=flat-square)](https://settlegrid.ai)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg?style=flat-square)](LICENSE)
[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https://github.com/settlegrid/settlegrid-letta)

Manage stateful AI agents and send messages via the Letta API.

## Quick Start

```bash
npm install
cp .env.example .env   # Add your SettleGrid API key
npm run dev
```

## Methods

| Method | Description | Cost |
|--------|-------------|------|
| `list_agents(limit?: number)` | List all agents | 1¢ |
| `create_agent(name: string, model?: string, system?: string)` | Create a new agent | 5¢ |
| `get_agent(agent_id: string)` | Get a specific agent by ID | 1¢ |
| `update_agent(agent_id: string, name?: string, system?: string)` | Update a specific agent | 3¢ |
| `delete_agent(agent_id: string)` | Delete a specific agent by ID | 2¢ |
| `send_message(agent_id: string, message: string, role?: string)` | Send a message to an agent and get a response | 5¢ |
| `get_messages(agent_id: string, limit?: number)` | Get message history for an agent | 1¢ |

## Parameters

### list_agents
- `limit` (number) — Maximum number of agents to return (default 20, max 50)

### create_agent
- `name` (string, required) — Name for the new agent
- `model` (string) — LLM model to use for the agent (e.g. gpt-4o)
- `system` (string) — System prompt / persona for the agent

### get_agent
- `agent_id` (string, required) — The ID of the agent to retrieve

### update_agent
- `agent_id` (string, required) — The ID of the agent to update
- `name` (string) — New name for the agent
- `system` (string) — New system prompt for the agent

### delete_agent
- `agent_id` (string, required) — The ID of the agent to delete

### send_message
- `agent_id` (string, required) — The ID of the agent to message
- `message` (string, required) — The message content to send to the agent
- `role` (string) — Role of the message sender (default: user)

### get_messages
- `agent_id` (string, required) — The ID of the agent whose messages to retrieve
- `limit` (number) — Maximum number of messages to return (default 20, max 50)

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `SETTLEGRID_API_KEY` | Yes | Your SettleGrid API key from [settlegrid.ai](https://settlegrid.ai) |
| `LETTA_API_KEY` | Yes | Letta API key from [https://app.letta.com](https://app.letta.com) |

## Upstream API

- **Provider**: Letta
- **Base URL**: https://api.letta.com
- **Auth**: API key required
- **Docs**: https://docs.letta.com/api/resources/agents/

## Deploy

### Docker

```bash
docker build -t settlegrid-letta .
docker run -e SETTLEGRID_API_KEY=sg_live_xxx -p 3000:3000 settlegrid-letta
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
