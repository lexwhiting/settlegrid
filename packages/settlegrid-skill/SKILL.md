---
name: monetize-this-mcp
description: >-
  Wraps a user's existing MCP server with the SettleGrid SDK to enable
  pay-per-call billing in under 60 seconds.
when_to_use: >-
  User asks to "monetize", "add billing to", "charge for", or "add payment to"
  their MCP server, or shows an MCP server file and asks how to make money
  from it.
version: 0.1.0
inputs:
  - name: server_file_path
    description: Path to the MCP server entry file (usually src/server.ts or index.ts)
    required: true
  - name: pricing_cents
    description: Default price per call in cents
    required: false
    default: 1
---

## Goal

Add per-call billing to the user's MCP server using the `@settlegrid/mcp` SDK (v0.1.1). After you finish, every tool invocation will check an API key, validate credits, deduct the configured amount, and return the result — all in one `sg.wrap()` call. The user can view revenue on the SettleGrid dashboard at `https://settlegrid.ai/dashboard`.

## Inputs

- **`server_file_path`** (required): The path to the MCP server entry file. Usually `src/server.ts` or `index.ts`. Ask the user if you cannot determine it from the project structure.
- **`pricing_cents`** (optional, default `1`): The default price per tool invocation in US cents. Individual methods can override this in the pricing config.

## Preflight Checks

Run these six checks before making any changes. Stop and tell the user if any fail.

1. **File exists** — Confirm `server_file_path` points to a real file on disk.
2. **MCP server pattern** — The file must export or register tool handlers. Look for `server.tool(...)`, `server.setRequestHandler(...)`, `mcpServer.tool(...)`, or plain exported async functions the user wants to expose as tools.
3. **Node ≥ 18** — Run `node --version` and verify the major version is 18 or higher (required for the `fetch` API used internally by the SDK).
4. **API key available** — Check if `SETTLEGRID_API_KEY` is set in `.env`, `.env.local`, or the shell environment. If not, guide the user through the onboarding path below.
5. **Compatible framework** — The server uses `@modelcontextprotocol/sdk`, `fastmcp`, Express, Hono, Next.js, or plain exported functions. Other frameworks may work but are not officially tested.
6. **Not already wrapped** — Grep the file for `@settlegrid/mcp` or `settlegrid.init`. If found, tell the user billing is already integrated and offer to update the pricing config instead.

## Step-by-Step Playbook

Follow these steps in order. Do not skip any step.

1. **Read the server file** — Load the contents of `server_file_path` into context. Identify the language (TypeScript or JavaScript) and the framework in use.

2. **Identify tool handlers** — List every function that acts as a tool handler. Record each handler's name and its argument type (if typed). These become the `methods` keys in the pricing config.

3. **Install the SDK** — Detect the package manager from the lockfile (`pnpm-lock.yaml` → pnpm, `yarn.lock` → yarn, otherwise npm). Run the appropriate install command:
   ```bash
   npm install @settlegrid/mcp
   ```

4. **Insert the import** — Add this line at the top of the file, after any existing imports:
   ```typescript
   import { settlegrid } from '@settlegrid/mcp'
   ```

5. **Insert the init call** — Immediately after the import block, add:
   ```typescript
   const sg = settlegrid.init({
     toolSlug: '<slug>',
     pricing: {
       defaultCostCents: <pricing_cents>,
       methods: {
         '<method_name>': { costCents: <cents>, displayName: '<Human Name>' },
       },
     },
   })
   ```
   Replace `<slug>` with a URL-safe identifier for the server (e.g. `weather-api`). Replace `<method_name>` with the name of each tool handler from step 2.

6. **Wrap each handler** — For every tool handler identified in step 2, wrap it with `sg.wrap()`:
   ```typescript
   const billedHandler = sg.wrap(
     async (args: { query: string }) => {
       return originalHandler(args)
     },
     { method: 'handler_name' }
   )
   ```
   Then replace the original handler reference in the server registration with `billedHandler`. The `method` string must match a key in `pricing.methods`.

7. **Add middleware (if REST)** — If the server exposes an HTTP endpoint (Express, Hono, Next.js API route), also add:
   ```typescript
   import { settlegridMiddleware } from '@settlegrid/mcp'

   const withBilling = settlegridMiddleware({
     toolSlug: '<slug>',
     pricing: { defaultCostCents: <pricing_cents> },
   })
   ```
   Then wrap each route handler with `withBilling(request, handler)`.

8. **Add env var** — Append to `.env.example` (create if missing):
   ```
   SETTLEGRID_API_KEY=sg_live_your_key_here
   ```

9. **Generate server card** — Add a script or a startup hook that writes pricing metadata:
   ```typescript
   import { generateServerCardBilling } from '@settlegrid/mcp'

   const billing = generateServerCardBilling({
     toolSlug: '<slug>',
     pricing: { model: 'per-invocation', defaultCostCents: <pricing_cents> },
   })
   ```
   Write the output to `.well-known/settlegrid.json` so registries can discover the server's pricing.

10. **Test** — Tell the user to run:
    ```bash
    SETTLEGRID_API_KEY=sg_test_demo123 node src/server.ts
    ```
    Then verify with a curl call (adapt the URL to their framework):
    ```bash
    curl -X POST http://localhost:3000 \
      -H "Content-Type: application/json" \
      -H "x-api-key: sg_test_demo123" \
      -d '{"method": "<method_name>", "params": {}}'
    ```

11. **Print the verification command** — Show the exact command the user should copy-paste to confirm the integration works. Include the expected output format.

12. **Print summary** — Output a short summary listing: the number of tools wrapped, the pricing per method, and a link to the dashboard (`https://settlegrid.ai/dashboard`).

## Onboarding Path (No API Key)

If the user does not have a `SETTLEGRID_API_KEY`:

1. Direct them to **https://settlegrid.ai/signup**.
2. They enter an email address and create a password. No credit card required.
3. After signing in, they land on the dashboard. Click **"Create New Tool"** and enter the tool slug from step 5.
4. The dashboard generates a live API key (`sg_live_...`) and a test key (`sg_test_...`).
5. Copy the live key into `.env` as `SETTLEGRID_API_KEY=sg_live_...`.
6. The free tier allows **1,000 free invocations per month** — no charge until they exceed that.

## Anti-Patterns

Do NOT do any of the following:

1. **Do not hardcode the API key** — Always read it from `process.env.SETTLEGRID_API_KEY` or from the request headers. Never put a literal `sg_live_...` string in source code.
2. **Do not wrap without confirming the tool slug** — Ask the user to choose a slug. If they have an existing slug registered on the dashboard, reuse it. Duplicate slugs cause billing conflicts.
3. **Do not skip the test step** — Always run the server and verify at least one billed call succeeds before declaring the integration complete.
4. **Do not remove existing error handling** — The SDK wraps handlers non-destructively. Keep all existing try/catch blocks and error responses intact.
5. **Do not set `pricing_cents` to 0** — A zero price means every call is free and metering is a no-op. If the user wants a free tier, tell them about the 1,000 free invocations on the dashboard instead.

## Worked Examples

See the three example files for complete before/after code:

- [`examples/rest-wrapper.md`](examples/rest-wrapper.md) — Wrapping a `@modelcontextprotocol/sdk` server that calls a public REST API.
- [`examples/fastmcp-wrapper.md`](examples/fastmcp-wrapper.md) — Wrapping a `fastmcp` server with 3 tools.
- [`examples/typescript-sdk-wrapper.md`](examples/typescript-sdk-wrapper.md) — Promoting plain TypeScript functions to MCP tools with billing.
