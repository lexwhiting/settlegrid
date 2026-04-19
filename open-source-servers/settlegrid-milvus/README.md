# settlegrid-milvus

Milvus MCP Server with per-call billing via [SettleGrid](https://settlegrid.ai).

[![Powered by SettleGrid](https://img.shields.io/badge/Powered%20by-SettleGrid-10B981?style=flat-square)](https://settlegrid.ai)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg?style=flat-square)](LICENSE)
[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https://github.com/settlegrid/settlegrid-milvus)

Create and manage vector database collections in Milvus via its RESTful API.

## Quick Start

```bash
npm install
cp .env.example .env   # Add your SettleGrid API key
npm run dev
```

## Methods

| Method | Description | Cost |
|--------|-------------|------|
| `create_collection(collectionName: string, dimension?: number, metricType?: string, idType?: string, autoId?: boolean, primaryFieldName?: string, vectorFieldName?: string)` | Create a new vector collection in Milvus | 5¢ |

## Parameters

### create_collection
- `collectionName` (string, required) — The name of the collection to create
- `dimension` (number) — The dimension of the vector field (e.g. 128, 768, 1536)
- `metricType` (string) — Metric type for vector similarity search (e.g. COSINE, L2, IP)
- `idType` (string) — Data type of the primary key field (e.g. Int64, VarChar)
- `autoId` (boolean) — Whether to enable automatic ID generation
- `primaryFieldName` (string) — The name of the primary field (default: id)
- `vectorFieldName` (string) — The name of the vector field (default: vector)

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `SETTLEGRID_API_KEY` | Yes | Your SettleGrid API key from [settlegrid.ai](https://settlegrid.ai) |
| `MILVUS_TOKEN` | Yes | Milvus API key from [https://milvus.io/docs/authenticate.md](https://milvus.io/docs/authenticate.md) |

## Upstream API

- **Provider**: Milvus
- **Base URL**: http://{milvus_host}:{milvus_port}
- **Auth**: API key required
- **Docs**: https://milvus.io/api-reference/restful/v2.5.x/v2/Collection%20(v2)/Create.md

## Deploy

### Docker

```bash
docker build -t settlegrid-milvus .
docker run -e SETTLEGRID_API_KEY=sg_live_xxx -p 3000:3000 settlegrid-milvus
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
