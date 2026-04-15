# @settlegrid/cli

**Monetize any MCP server, LangChain tool, or REST API with one command.**

`settlegrid add` detects the repo shape, wraps its handlers with
[SettleGrid](https://settlegrid.ai) per-call billing, and optionally opens a
pull request with the changes. Supports local paths and GitHub repos, runs
in dry-run mode by default, and degrades gracefully to a patch file when no
GitHub token is available.

---

## Install

```bash
# One-off run — no install needed
npx settlegrid add <source>

# Or install globally
npm install -g @settlegrid/cli
settlegrid add <source>
```

Requires Node 20+.

## Usage

```bash
settlegrid add <source> [options]
```

`<source>` is either:

- **A GitHub URL** — `https://github.com/acme/mcp-server` or
  `github:acme/mcp-server` or `git@github.com:acme/mcp-server.git`.
  Fetched via giget into a tmpdir.
- **A local path** — an absolute or relative path to a directory
  containing the MCP repo. The CLI operates on the path directly
  (respecting `--dry-run`).

### Flags

| Flag | Description |
|---|---|
| `--github <url>` | GitHub repo URL (alternative to positional `<source>`) |
| `--path <dir>` | Local directory (alternative to positional `<source>`) |
| `--dry-run` | Print intended changes without writing files. Never touches the GitHub API. |
| `--no-pr` | Skip the pull-request step after applying the codemod |
| `--out-branch <name>` | Branch name for the generated PR (default `settlegrid/monetize`) |
| `--force` | Proceed even if the repo type can't be confidently detected |
| `--token <t>` | GitHub token for PR creation (falls back to `GITHUB_TOKEN`) |
| `--json` | Emit a single machine-readable JSON line instead of human-readable prompts |
| `-v, --version` | Print the CLI version and exit |
| `-h, --help` | Show help text |

### Example — dry-run against a real MCP server

```bash
settlegrid add github:modelcontextprotocol/servers/src/everything --dry-run
```

Prints a detection + transform summary, a preview of the first changed
file, and `dry-run complete — re-run without --dry-run to write changes
and update package.json.`

### Example — apply + open a PR

```bash
export GITHUB_TOKEN=ghp_…
settlegrid add https://github.com/acme/mcp-server --out-branch monetize/v1
```

Runs the codemod on a freshly-cloned copy, pushes the changes to the
branch, and opens a PR against `main` with a summary body (changed
files, added dep, required env vars, how-to-remove instructions). Forks
the upstream automatically if the token lacks push access.

### Example — local repo, no token

```bash
cd /path/to/my-mcp-server
settlegrid add --path .
```

Without `GITHUB_TOKEN`, the CLI applies the codemod in place and also
writes `settlegrid-add.patch` to the current directory. Review with
your editor and apply with `git apply` (or `git apply --check` to
preview).

### Example — machine-readable output

```bash
settlegrid add --path ./my-repo --dry-run --no-pr --json
```

Emits a single JSON line with `detect`, `transform`, `status`, and
`mode` fields. Used by the smoke-test runner (see below) but handy
for any script that wants to drive `settlegrid add` programmatically.

## Supported repo shapes

| Detected type | Pattern | Transformation |
|---|---|---|
| `mcp-server` | `@modelcontextprotocol/sdk` in `package.json.dependencies` OR an `import` of it in source | Wraps `server.setRequestHandler(schema, handler)` with `sg.wrap(handler, { method })`, adds `settlegrid.init({ toolSlug, pricing })` before the first `new Server(...)` |
| `langchain-tool` | `@langchain/core` / `langchain` dep AND a class extending `StructuredTool` / `DynamicStructuredTool` / `Tool` | Wraps each class's `_call` / `invoke` method body with `return await sg.wrap(async () => {...}, { method: this.name })()` |
| `rest-api` | `express` / `fastify` / `hono` / `koa` / `@hono/node-server` in deps | Wraps every `app.<verb>(path, …, handler)` (including `app.route(path).<verb>(handler)` chains) |
| `unknown` | No match on the above | Exits 1 unless `--force` is passed |

Detection is bounded (500 files, 5 MB per file, 10 s total) and never
executes any repo code — everything is done via regex + AST parsing.

## Smoke test

A 3-repo end-to-end smoke test lives at `scripts/smoke.ts` and is
wired into the `smoke` npm script. It fetches three pinned,
permissively-licensed MCP server repos via giget, runs the CLI with
`--dry-run --no-pr --json` against each, and asserts the detection +
transformation match expectations in `scripts/smoke-targets.json`.

```bash
# Run the smoke suite (network-bound; ~3 seconds)
npm run smoke

# Or: build the binary first, then run
npm run test:smoke
```

The smoke suite is NOT part of the default `npm test` pipeline because
it's network-bound. Invoke it on demand from the package directory,
or wire it into a separate CI job that can reach GitHub.

Current targets:

- `modelcontextprotocol/servers#src/everything`
- `modelcontextprotocol/servers#src/filesystem`
- `modelcontextprotocol/servers#src/memory`

All three are pinned to a specific commit SHA in `smoke-targets.json`
so the suite is reproducible even as upstream evolves.

## Development

```bash
# From repo root (npm workspaces)
npm install
npm --workspace @settlegrid/cli run build
npm --workspace @settlegrid/cli test
npm --workspace @settlegrid/cli run typecheck
```

## License

MIT © Alerterra, LLC. See [LICENSE](./LICENSE).
