# settlegrid-syntho

Syntho MCP Server with per-call billing via [SettleGrid](https://settlegrid.ai).

[![Powered by SettleGrid](https://img.shields.io/badge/Powered%20by-SettleGrid-10B981?style=flat-square)](https://settlegrid.ai)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg?style=flat-square)](LICENSE)
[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https://github.com/settlegrid/settlegrid-syntho)

Manage organizations and users on the Syntho synthetic data platform via its REST API.

## Quick Start

```bash
npm install
cp .env.example .env   # Add your SettleGrid API key
npm run dev
```

## Methods

| Method | Description | Cost |
|--------|-------------|------|
| `get_organization()` | Get organization details | 1¢ |
| `list_users()` | List all users in the organization | 1¢ |
| `create_user(username: string, email: string, password: string, role?: string)` | Create a new user in the organization | 3¢ |
| `get_user(id: string)` | Get details of a specific user by ID | 1¢ |
| `update_user(id: string, username?: string, email?: string, role?: string)` | Partially update a specific user by ID | 2¢ |
| `delete_user(id: string)` | Delete a specific user by ID | 3¢ |

## Parameters

### get_organization

### list_users

### create_user
- `username` (string, required) — Username for the new user
- `email` (string, required) — Email address for the new user
- `password` (string, required) — Password for the new user
- `role` (string) — Role assigned to the user (e.g. admin, member)

### get_user
- `id` (string, required) — Unique identifier of the user

### update_user
- `id` (string, required) — Unique identifier of the user to update
- `username` (string) — New username
- `email` (string) — New email address
- `role` (string) — New role for the user

### delete_user
- `id` (string, required) — Unique identifier of the user to delete

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `SETTLEGRID_API_KEY` | Yes | Your SettleGrid API key from [settlegrid.ai](https://settlegrid.ai) |
| `SYNTHO_API_KEY` | Yes | Syntho API key from [https://docs.syntho.ai/syntho-api/syntho-rest-api](https://docs.syntho.ai/syntho-api/syntho-rest-api) |

## Upstream API

- **Provider**: Syntho
- **Base URL**: https://docs.syntho.ai/syntho-api/syntho-rest-api
- **Auth**: API key required
- **Docs**: https://docs.syntho.ai/syntho-api/syntho-rest-api

## Deploy

### Docker

```bash
docker build -t settlegrid-syntho .
docker run -e SETTLEGRID_API_KEY=sg_live_xxx -p 3000:3000 settlegrid-syntho
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
