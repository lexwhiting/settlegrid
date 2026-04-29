# Monetization Guide — ClinicalTrials.gov

## Revenue Model

This template uses **per-call pricing** via SettleGrid.

| Metric | Value |
|--------|-------|
| **Price per call** | $0.01 (1¢) |
| **SettleGrid fee** | 20% |
| **Your revenue per call** | $0.008 |

## Revenue Examples

| Monthly Calls | Gross Revenue | SettleGrid Fee (20%) | Your Revenue |
|---------------|--------------|----------------------|-------------|
| 1,000 | $10 | $2 | **$8** |
| 10,000 | $100 | $20 | **$80** |
| 100,000 | $1,000 | $200 | **$800** |
| 1,000,000 | $10,000 | $2,000 | **$8,000** |

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
