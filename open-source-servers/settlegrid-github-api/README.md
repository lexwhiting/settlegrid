# GitHub API

> Search repos, issues, and users on GitHub.

[![Powered by SettleGrid](https://img.shields.io/badge/Powered%20by-SettleGrid-10B981?style=flat-square)](https://settlegrid.ai)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg?style=flat-square)](LICENSE)
[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https://github.com/settlegrid/settlegrid-github-api)

## 30-Second Quickstart

```bash
# Option 1: Use the CLI scaffolder
npx create-settlegrid-tool --template github-api

# Option 2: Clone and run
git clone https://github.com/settlegrid/settlegrid-github-api.git
cd settlegrid-github-api
npm install
cp .env.example .env   # Add your API keys
npm run dev
```

## Methods

| Method | Description | Cost |
|--------|-------------|------|
| `search_repos(query, per_page)` | Search GitHub repositories by query | 2¢ |
| `get_repo(owner, repo)` | Get details about a specific repository | 2¢ |
| `search_issues(query, per_page)` | Search issues and pull requests across GitHub | 2¢ |

## Monetization

Turn this template into a revenue stream. At the default 1¢/call pricing:

| Monthly Calls | Your Revenue (after 20% fee) |
|---------------|------------------------------|
| 1,000 | $8 |
| 10,000 | $80 |
| 100,000 | $800 |

See [monetization.md](monetization.md) for full pricing math and payout details.

## Deploy

[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https://github.com/settlegrid/settlegrid-github-api)

```bash
# Or use Docker
docker build -t settlegrid-github-api .
docker run -e SETTLEGRID_API_KEY=sg_live_xxx -p 3000:3000 settlegrid-github-api
```

## Demo

<!-- Replace with your Loom recording URL -->
> Loom demo placeholder — record a 30-second walkthrough and paste the embed URL here.

## Standalone Value

This template works without SettleGrid. See [remove-settlegrid.md](remove-settlegrid.md) for step-by-step removal instructions. **No lock-in.**

## License

MIT — see [LICENSE](LICENSE)

---

Built with [SettleGrid](https://settlegrid.ai) — The Settlement Layer for the AI Economy
