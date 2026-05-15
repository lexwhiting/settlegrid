**Fiat payment protocol sketch (responding to @kormco's request)**

@kormco asked whether the `payment[]` design accommodates non-crypto rails. Here's a minimal `"protocol": "stripe"` sketch based on running Stripe-based per-call billing in production across ~400 tools:

**In `tools/list`:**
```json
{
  "payment": [
    {
      "protocol": "stripe",
      "paymentRequired": {
        "amount": 500,
        "currency": "usd",
        "description": "Premium weather analysis",
        "paymentMethods": ["card", "us_bank_account"]
      }
    }
  ]
}
```

**In `-32402` challenge:**
```json
{
  "protocol": "stripe",
  "paymentRequired": {
    "amount": 500,
    "currency": "usd",
    "clientSecret": "pi_3abc_secret_xyz",
    "publishableKey": "pk_live_..."
  }
}
```

**In `tools/call` with payment:**
```json
{
  "payment": {
    "protocol": "stripe",
    "paymentInput": {
      "paymentIntentId": "pi_3abc",
      "paymentMethodId": "pm_1xyz"
    }
  }
}
```

**In response:**
```json
{
  "payment": {
    "protocol": "stripe",
    "paymentOutput": {
      "paymentIntentId": "pi_3abc",
      "status": "succeeded",
      "receiptUrl": "https://pay.stripe.com/receipts/..."
    }
  }
}
```

This validates that the `payment[]` array design works for fiat. The key difference from x402: Stripe uses a two-phase intent model (create intent → confirm with payment method) rather than a signed-authorization model. The `-32402` challenge carries the `clientSecret`, and the client confirms the intent before retrying the tool call.

One production nuance: for high-volume per-call billing ($0.01-0.10 per call), creating a PaymentIntent per call is prohibitively expensive in Stripe fees. In practice, prepaid credit balances work better — the client tops up once, and the server deducts per call from the balance without hitting Stripe on every invocation. This pattern should probably be called out as a recommended approach for sub-dollar payments regardless of protocol.

**On metering without payment (@manja316's point)**

Worth considering a `"protocol": "metered"` mode where the server tracks usage and enforces limits but doesn't collect payment. The `tools/list` payment field would carry cost information for LLM visibility (so agents can still factor cost into tool selection per @kormco's point about cost visibility being the killer feature), but the server handles billing out of band (monthly invoice, prepaid balance, free tier, etc.). This covers the common pattern where a server wants budget enforcement and usage tracking before adding real-time payment collection.

**On dynamic pricing**

The spec notes that the `-32402` response is the "source of truth" over `tools/list` for pricing. This implicitly supports dynamic pricing (cost varies by input), but it might be worth making this explicit. A tool that charges $0.01 for a basic lookup and $0.10 for a deep analysis based on the `arguments` passed should advertise a price range in `tools/list` and return the actual price in the `-32402` challenge after seeing the arguments.

**+1 on @whiteknightonhorse's idempotency and cache points**

Both match production experience. Idempotency should be a MUST for payment-enabled servers — without it, network retries cause double-charging. And cached results at a lower price tier (or free) with `cached: true` in the receipt is a pattern worth codifying.
