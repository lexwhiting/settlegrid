import jscodeshift from 'jscodeshift'
import {
  buildSettlegridInitStatement,
  buildSgWrapCall,
  ensureSettlegridImport,
  extractMcpMethodName,
  findEnclosingStatement,
  hasSettlegridInit,
  isAlreadySgWrap,
} from './shared.js'
import type { Codemod } from './runner.js'

/**
 * Transform a file that uses `new Server(...)` +
 * `server.setRequestHandler(schema, handler)` so it:
 *   1. Imports `settlegrid` from '@settlegrid/mcp'.
 *   2. Calls `settlegrid.init({ toolSlug, pricing })` immediately before
 *      the first Server construction.
 *   3. Wraps each setRequestHandler's handler argument with
 *      `sg.wrap(handler, { method: <schema-derived-name> })`.
 *
 * Files that don't look like an MCP server (no `new Server()` and no
 * `setRequestHandler` calls) are returned unchanged. Per-call and per-
 * file idempotency are both enforced — already-wrapped handlers and
 * already-imported files are left alone.
 */
export const addMcpTransform: Codemod = (source, ctx) => {
  const j = jscodeshift.withParser('tsx')
  let root
  try {
    root = j(source)
  } catch {
    // Unparseable TS/JS — don't break the run; the runner will surface it.
    return source
  }

  // Pattern-match against Server / McpServer instantiations AND
  // setRequestHandler calls. If NEITHER is present, bail early so a
  // throw-away util file in the repo isn't touched.
  const serverNews = root.find(j.NewExpression).filter((p) => {
    const callee = p.node.callee
    return (
      !!callee &&
      callee.type === 'Identifier' &&
      (callee.name === 'Server' || callee.name === 'McpServer')
    )
  })

  const setHandlerCalls = root.find(j.CallExpression).filter((p) => {
    const callee = p.node.callee
    return (
      !!callee &&
      callee.type === 'MemberExpression' &&
      !!callee.property &&
      callee.property.type === 'Identifier' &&
      callee.property.name === 'setRequestHandler'
    )
  })

  if (serverNews.length === 0 && setHandlerCalls.length === 0) {
    return source
  }

  let modified = false

  // (a) Add the import.
  if (ensureSettlegridImport(j, root)) {
    modified = true
  }

  // (b) Add `const sg = settlegrid.init(...)` before the first Server.
  if (!hasSettlegridInit(j, root) && serverNews.length > 0) {
    const firstServerEnclosing = findEnclosingStatement(j, serverNews.get(0))
    if (firstServerEnclosing) {
      const initStmt = buildSettlegridInitStatement(j, ctx.toolSlug)
      j(firstServerEnclosing).insertBefore(initStmt)
      modified = true
    }
  }

  // (c) Wrap each handler arg.
  setHandlerCalls.forEach((p) => {
    const args = p.node.arguments
    if (!Array.isArray(args) || args.length < 2) return
    const handler = args[1]
    if (isAlreadySgWrap(handler)) return

    const methodName = extractMcpMethodName(args[0])
    // Use `handler` in-place — recast preserves the original node's
    // formatting when moved into a CallExpression arg.
    const wrapped = buildSgWrapCall(
      j,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      handler as any,
      methodName,
    )
    args[1] = wrapped
    modified = true
  })

  if (!modified) return source
  return root.toSource({ quote: 'single' })
}
