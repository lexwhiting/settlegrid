# settlegrid-push-notify

Push Notification MCP Server with per-call billing via [SettleGrid](https://settlegrid.ai).

[![Powered by SettleGrid](https://img.shields.io/badge/Powered%20by-SettleGrid-10B981?style=flat-square)](https://settlegrid.ai)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg?style=flat-square)](LICENSE)
[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https://github.com/settlegrid/settlegrid-push-notify)

Send push notifications via ntfy.sh. Free, no signup required.

## Quick Start

```bash
npm install
cp .env.example .env   # Add your SettleGrid API key
npm run dev
```

## Methods

| Method | Description | Cost |
|--------|-------------|------|
| `send(title, body, topic)` | Send a push notification | 2¢ |
| `send_batch(notifications[])` | Send multiple notifications | 1¢/msg |

## Parameters

### send
- `title` (string, required) — Notification title
- `body` (string, required) — Notification body
- `topic` (string, required) — ntfy.sh topic (channel name)

### send_batch
- `notifications` (array, required) — Array of {title, body, topic} objects (max 20)

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `SETTLEGRID_API_KEY` | Yes | Your SettleGrid API key from [settlegrid.ai](https://settlegrid.ai) |

## Upstream API

- **Provider**: ntfy.sh
- **Base URL**: https://ntfy.sh
- **Auth**: None required
- **Docs**: https://docs.ntfy.sh/

## Deploy

### Docker

```bash
docker build -t settlegrid-push-notify .
docker run -e SETTLEGRID_API_KEY=sg_live_xxx -p 3000:3000 settlegrid-push-notify
```

### Vercel

```bash
npm run build
vercel --prod
```

## License

MIT - see [LICENSE](LICENSE)

---

Built with [SettleGrid](https://settlegrid.ai) — The Settlement Layer for the AI Economy
