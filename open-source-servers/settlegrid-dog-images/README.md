# settlegrid-dog-images

Dog Images MCP Server with per-call billing via [SettleGrid](https://settlegrid.ai).

[![Powered by SettleGrid](https://img.shields.io/badge/Powered%20by-SettleGrid-10B981?style=flat-square)](https://settlegrid.ai)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg?style=flat-square)](LICENSE)

Get random dog images, breed lists, and breed-specific images.

## Quick Start

```bash
npm install && cp .env.example .env && npm run dev
```

## Methods

| Method | Description | Cost |
|--------|-------------|------|
| `random_image()` | Get a random dog image | 1¢ |
| `breed_image(breed)` | Get image by breed | 1¢ |
| `list_breeds()` | List all dog breeds | 1¢ |
| `random_by_breed(breed, count)` | Multiple images by breed | 1¢ |

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `SETTLEGRID_API_KEY` | Yes | Your SettleGrid API key |

## Upstream API

- **Provider**: Dog CEO
- **Base URL**: https://dog.ceo/api
- **Auth**: None (public)
- **Docs**: https://dog.ceo/dog-api/documentation/

## License
MIT - see [LICENSE](LICENSE)

---
Built with [SettleGrid](https://settlegrid.ai) --- The Settlement Layer for the AI Economy
