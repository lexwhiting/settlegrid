# How to Remove SettleGrid

This guide explains how to remove the `@settlegrid/mcp` dependency and run the server without billing. **You can leave anytime — no lock-in.**

## Steps

### 1. Remove the dependency

```bash
npm uninstall @settlegrid/mcp
```

### 2. Remove the SettleGrid import

In `src/server.ts`, delete the import line:

```typescript
// DELETE THIS LINE:
import { SettleGrid } from '@settlegrid/mcp'
```

### 3. Remove the init call

Delete the SettleGrid initialization block:

```typescript
// DELETE THIS BLOCK:
const sg = new SettleGrid({
  apiKey: process.env.SETTLEGRID_API_KEY!,
})
```

### 4. Unwrap handler calls

Replace each `sg.wrap(handler, { method, costCents })` with the original handler directly:

```typescript
// BEFORE (with SettleGrid):
server.setRequestHandler(schema, sg.wrap(myHandler, { method: 'search', costCents: 2 }))

// AFTER (without SettleGrid):
server.setRequestHandler(schema, myHandler)
```

### 5. Remove the environment variable

Delete `SETTLEGRID_API_KEY` from your `.env` file and any deployment configuration.

### 6. Test

```bash
npm run dev
```

Your server now runs without any billing layer. All API functionality is preserved.

---

*SettleGrid adds value without lock-in. If you want billing back, run `npm install @settlegrid/mcp` and re-wrap your handlers.*
