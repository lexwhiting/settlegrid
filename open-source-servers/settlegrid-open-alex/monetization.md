# Monetization Guide — OpenAlex

## Revenue Model

This template uses **per-call pricing** via SettleGrid with **progressive
take rates**. The first $1,000 of monthly revenue per developer is
fee-free; tiered fees apply only above that threshold.

| Tier                            | SettleGrid take | Your share |
|---------------------------------|-----------------|------------|
| First $1,000 / month           | **0%**          | **100%**   |
| Above $1,000 / month           | **2–5%** (volume-tiered) | **95–98%**  |

| Metric                                          | Value             |
|-------------------------------------------------|-------------------|
| **Price per call**                              | $0.01 (1¢)       |
| **Your revenue per call — first $1,000/mo**    | $0.0100 (100%)   |
| **Your revenue per call — above $1,000/mo**    | $0.0095–$0.0098 |

## Revenue Examples (at $0.01 / call)

| Monthly Calls | Gross Revenue | SettleGrid Fee       | Your Revenue   |
|---------------|---------------|----------------------|----------------|
| 1,000         | $10          | **$0** (under $1k)  | **$10**       |
| 10,000        | $100         | **$0** (under $1k)  | **$100**      |
| 100,000       | $1,000       | **$0** (at $1k cap) | **$1,000**    |
| 1,000,000     | $10,000      | ~$450 (≈5% on $9k above $1k) | **~$9,550** |


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
