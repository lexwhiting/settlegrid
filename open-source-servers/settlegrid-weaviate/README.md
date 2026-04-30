# settlegrid-weaviate

Weaviate MCP Server with per-call billing via [SettleGrid](https://settlegrid.ai).

[![Powered by SettleGrid](https://img.shields.io/badge/Powered%20by-SettleGrid-10B981?style=flat-square)](https://settlegrid.ai)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg?style=flat-square)](LICENSE)
[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https://github.com/settlegrid/settlegrid-weaviate)

Manage Weaviate database users, roles, and permissions via the Weaviate REST API.

## Quick Start

```bash
npm install
cp .env.example .env   # Add your SettleGrid API key
npm run dev
```

## Methods

| Method | Description | Cost |
|--------|-------------|------|
| `get_own_info()` | Get info about the currently authenticated user | 1¢ |
| `get_user(userId: string)` | Get information about a specific database user | 1¢ |
| `create_user(userId: string)` | Create a new database user | 3¢ |
| `get_user_roles(userId: string, userType?: string)` | Get roles assigned to a specific user | 1¢ |
| `list_roles()` | Get a list of all authorization roles | 1¢ |
| `get_role(roleName: string)` | Get information about a specific role | 1¢ |
| `get_role_users(roleName: string)` | Get users assigned to a specific role | 1¢ |
| `rotate_user_key(userId: string)` | Rotate the API key for a database user | 5¢ |

## Parameters

### get_own_info

### get_user
- `userId` (string, required) — The ID of the user to retrieve

### create_user
- `userId` (string, required) — The ID of the user to create

### get_user_roles
- `userId` (string, required) — The ID of the user
- `userType` (string) — The type of user: 'db' or 'oidc'

### list_roles

### get_role
- `roleName` (string, required) — The name of the role to retrieve

### get_role_users
- `roleName` (string, required) — The name of the role

### rotate_user_key
- `userId` (string, required) — The ID of the user whose API key to rotate

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `SETTLEGRID_API_KEY` | Yes | Your SettleGrid API key from [settlegrid.ai](https://settlegrid.ai) |
| `WEAVIATE_API_KEY` | Yes | Weaviate API key from [https://weaviate.io/developers/weaviate/configuration/authentication](https://weaviate.io/developers/weaviate/configuration/authentication) |

## Upstream API

- **Provider**: Weaviate
- **Base URL**: https://your-weaviate-instance.weaviate.network/v1
- **Auth**: API key required
- **Docs**: https://weaviate.io/developers/weaviate/api/rest

## Deploy

### Docker

```bash
docker build -t settlegrid-weaviate .
docker run -e SETTLEGRID_API_KEY=sg_live_xxx -p 3000:3000 settlegrid-weaviate
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
