# settlegrid-aws-pricing

AWS Service Pricing MCP Server with per-call billing via [SettleGrid](https://settlegrid.ai).

[![Powered by SettleGrid](https://img.shields.io/badge/Powered%20by-SettleGrid-10B981?style=flat-square)](https://settlegrid.ai)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg?style=flat-square)](LICENSE)
[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https://github.com/settlegrid/settlegrid-aws-pricing)

AWS service pricing data from the public AWS Price List API — EC2, S3, Lambda, and more.

## Quick Start

```bash
npm install
cp .env.example .env   # Add your SettleGrid API key
npm run dev
```

## Methods

| Method | Description | Cost |
|--------|-------------|------|
| `get_ec2_prices(region?, type?)` | Get EC2 instance pricing | 2¢ |
| `list_services()` | List all AWS services with pricing data | 1¢ |
| `get_service_url(service)` | Get pricing JSON URL for an AWS service | 1¢ |

## Parameters

### get_ec2_prices
- `region` (string) — AWS region (e.g. us-east-1)
- `type` (string) — Instance type filter (e.g. m5, t3)

### list_services

### get_service_url
- `service` (string, required) — AWS service code (e.g. AmazonEC2, AmazonS3)

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `SETTLEGRID_API_KEY` | Yes | Your SettleGrid API key from [settlegrid.ai](https://settlegrid.ai) |

No API key needed for the upstream AWS Price List API — it is completely free.

## Upstream API

- **Provider**: AWS Price List
- **Base URL**: https://pricing.us-east-1.amazonaws.com/offers/v1.0/aws
- **Auth**: None required
- **Docs**: https://docs.aws.amazon.com/awsaccountbilling/latest/aboutv2/price-changes.html

## Deploy

### Docker

```bash
docker build -t settlegrid-aws-pricing .
docker run -e SETTLEGRID_API_KEY=sg_live_xxx -p 3000:3000 settlegrid-aws-pricing
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
