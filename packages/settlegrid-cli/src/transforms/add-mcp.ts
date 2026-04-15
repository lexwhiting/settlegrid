import jscodeshift from 'jscodeshift'
import {
  buildSettlegridInitStatement,
  buildSgWrapCall,
  ensureSettlegridImport,
  extractMcpMethodName,
  findEnclosingStatement,
  hasSettlegridInit,
  isAlreadySgWrap,
  looksLikeFunction,
} from './shared.js'
import type { Codemod } from './runner.js'

/**
 * Match MCP server constructor callees — both bare identifier form
 * (`new Server()`, `new McpServer()`) and namespace form
 * (`new sdk.Server()`, `new mcp.McpServer()`). Without the member
 * form we'd miss repos that import the SDK as a namespace.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function isMcpServerCallee(callee: any): boolean {
  if (!callee) return false
  if (callee.type === 'Identifier') {
    return callee.name === 'Server' || callee.name === 'McpServer'
  }
  if (
    callee.type === 'MemberExpression' &&
    callee.property &&
    callee.property.type === 'Identifier'
  ) {
    return (
      callee.property.name === 'Server' ||
      callee.property.name === 'McpServer'
    )
  }
  return false
}

/**
 * Transform a file that uses `new Server(...)` +
 * `server.setRequestHandler(schema, handler)` so it:
 *   1. Imports `settlegrid` from '@settlegrid/mcp'.
 *   2. Calls `settlegrid.init({ toolSlug, pricing })` before the
 *      first anchor point (Server construction if visible, else the
 *      first setRequestHandler call — handlers inline `sg.wrap(…)`
 *      so `const sg = …` MUST be hoisted above them, and files that
 *      import their `server` from elsewhere still need the init).
 *   3. Wraps each setRequestHandler's handler argument with
 *      `sg.wrap(handler, { method: <schema-derived-name> })`, skipping
 *      handlers that don't look like functions (defensive against
 *      false positives on similarly-named methods in unrelated code).
 *
 * Files that don't look like an MCP server (no Server/McpServer
 * construction and no `setRequestHandler` calls) are returned
 * unchanged.
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

  const serverNews = root
    .find(j.NewExpression)
    .filter((p) => isMcpServerCallee(p.node.callee))

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

  if (ensureSettlegridImport(j, root)) {
    modified = true
  }

  if (!hasSettlegridInit(j, root)) {
    // Anchor init before the first Server construction if visible;
    // otherwise before the first setRequestHandler (for repos that
    // import `server` from elsewhere and only register handlers here).
    // Either way, init lands above every `sg.wrap(…)` usage so there's
    // no TDZ ReferenceError at module load.
    const anchorSource =
      serverNews.length > 0 ? serverNews.get(0) : setHandlerCalls.get(0)
    const anchor = findEnclosingStatement(j, anchorSource)
    if (anchor) {
      const initStmt = buildSettlegridInitStatement(j, ctx.toolSlug)
      j(anchor).insertBefore(initStmt)
      modified = true
    }
  }

  setHandlerCalls.forEach((p) => {
    const args = p.node.arguments
    if (!Array.isArray(args) || args.length < 2) return
    const handler = args[1]
    if (isAlreadySgWrap(handler)) return
    // Don't wrap obviously-non-function args (defensive against future
    // refactors or accidental matches on unrelated code that happens to
    // call a `.setRequestHandler` lookalike).
    if (!looksLikeFunction(handler)) return

    const methodName = extractMcpMethodName(args[0])
    const wrapped = buildSgWrapCall(j, handler, methodName)
    args[1] = wrapped
    modified = true
  })

  if (!modified) return source
  return root.toSource({ quote: 'single' })
}
