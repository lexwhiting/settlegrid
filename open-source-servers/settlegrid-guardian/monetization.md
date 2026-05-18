# Monetization Guide — The Guardian

## Revenue Model

This template uses **per-call pricing** via SettleGrid with **progressive
take rates**. The first $1,000 of monthly revenue per developer is
fee-free; tiered fees apply only above that threshold.

| Tier | SettleGrid take | Your share |
|------|-----------------|------------|
| First $1,000 / month | **0%** | **100%** |
| Above $1,000 / month | **2–5%** (volume-tiered) | **95–98%** |

| Metric | Value |
|--------|-------|
| **Price per call** | $0.02 (2¢) |
| **Your revenue per call – first $1,000/mo** | $0.0200 (100%) |
| **Your revenue per call – above $1,000/mo** | $0.0190–$0.0196 |

## Revenue Examples (at $0.02 / call)

| Monthly Calls | Gross Revenue | SettleGrid Fee | Your Revenue |
|---------------|---------------|----------------|--------------|
| 1,000 | $20 | **$0** (under $1k) | **$20** |
| 10,000 | $200 | **$0** (under $1k) | **$200** |
| 100,000 | $2,000 | ~$50 (≈5% on $1k above $1k) | **~$1,950** |
| 1,000,000 | $20,000 | ~$950 (≈5% on $19k above $1k) | **~$19,050** |

## How It Works

1. An AI agent calls your MCP server method
2. SettleGrid meters the call and charges the caller's account
3. Revenue accumulates in your SettleGrid dashboard
4. Payouts via Stripe Connect on your configured schedule

## Adjusting Pricing

Edit `src/server.ts` and change the `costCents` parameter in each `sg.wrap()` call:

```typescript
sg.wrap(handler, { method: 'my_method', costCents: 5 }) // 5¢ per call
```

Higher-value methods (e.g., complex queries, real-time data) can command higher prices.
Rebuild and redeploy after changing prices.
