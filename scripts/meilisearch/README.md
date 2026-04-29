# Meilisearch Deployment

Self-hosted Meilisearch on Fly.io for the SettleGrid gallery search.

## First-time Setup

```bash
cd scripts/meilisearch

# Create the app
fly launch --name settlegrid-meilisearch --region iad --no-deploy

# Create a persistent volume for data
fly volumes create meili_data --region iad --size 1

# Set the master key (generate a strong random key)
fly secrets set MEILI_MASTER_KEY=<your-master-key>

# Deploy
fly deploy
```

## Generate Search-Only Key

After the instance is running, create a search-only API key:

```bash
curl -s "https://settlegrid-meilisearch.fly.dev/keys" \
  -H "Authorization: Bearer <master-key>" \
  -H "Content-Type: application/json" \
  -d '{
    "description": "Gallery search-only key",
    "actions": ["search"],
    "indexes": ["templates"],
    "expiresAt": null
  }'
```

Store the returned `key` value as `MEILI_SEARCH_KEY` in GitHub Secrets
and in the Vercel environment as `NEXT_PUBLIC_MEILI_SEARCH_KEY`.

## Environment Variables

| Variable | Where | Description |
|----------|-------|-------------|
| `MEILI_MASTER_KEY` | Fly secret + GitHub Secret | Admin access for indexing |
| `MEILI_URL` | GitHub Secret | `https://settlegrid-meilisearch.fly.dev` |
| `NEXT_PUBLIC_MEILI_URL` | Vercel env | Same URL, exposed to client |
| `NEXT_PUBLIC_MEILI_SEARCH_KEY` | Vercel env | Search-only key (safe for client) |

## Reindex

```bash
MEILI_URL=https://settlegrid-meilisearch.fly.dev \
MEILI_MASTER_KEY=<master-key> \
npx tsx scripts/meilisearch/index-registry.ts
```

## Monitoring

```bash
fly status -a settlegrid-meilisearch
fly logs -a settlegrid-meilisearch
```
