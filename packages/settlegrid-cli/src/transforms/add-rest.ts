import jscodeshift from 'jscodeshift'
import {
  buildSettlegridInitStatement,
  buildSgWrapCall,
  ensureSettlegridImport,
  findEnclosingStatement,
  hasSettlegridInit,
  isAlreadySgWrap,
} from './shared.js'
import type { Codemod } from './runner.js'

// Method names on express / hono / koa / fastify app instances that
// register HTTP route handlers. `use` is excluded — it's for middleware,
// not a billable endpoint.
const REST_METHODS = new Set([
  'get',
  'post',
  'put',
  'delete',
  'patch',
  'head',
  'options',
  'all',
])

/**
 * Transform a REST-framework file (express/hono/fastify/koa) by wrapping
 * every route handler argument in `sg.wrap(handler, { method: '<verb>:<path>' })`.
 *
 * Adds the settlegrid import + `settlegrid.init({ toolSlug, pricing })`
 * immediately before the first route registration. Files with no route
 * registrations are returned unchanged.
 */
export const addRestTransform: Codemod = (source, ctx) => {
  const j = jscodeshift.withParser('tsx')
  let root
  try {
    root = j(source)
  } catch {
    return source
  }

  // Collect `<app>.<verb>(<path>, ..., <handler>)` style calls.
  const routeCalls = root.find(j.CallExpression).filter((p) => {
    const callee = p.node.callee
    if (!callee || callee.type !== 'MemberExpression') return false
    if (!callee.property || callee.property.type !== 'Identifier') return false
    if (!REST_METHODS.has(callee.property.name)) return false
    // Must have at least (path, handler) — 2 args. More (middlewares) OK.
    const args = p.node.arguments
    return Array.isArray(args) && args.length >= 2
  })

  if (routeCalls.length === 0) return source

  let modified = false

  if (ensureSettlegridImport(j, root)) modified = true

  if (!hasSettlegridInit(j, root)) {
    const firstRouteEnclosing = findEnclosingStatement(j, routeCalls.get(0))
    if (firstRouteEnclosing) {
      const initStmt = buildSettlegridInitStatement(j, ctx.toolSlug)
      j(firstRouteEnclosing).insertBefore(initStmt)
      modified = true
    }
  }

  routeCalls.forEach((p) => {
    const args = p.node.arguments
    if (!Array.isArray(args) || args.length < 2) return
    const handler = args[args.length - 1]
    if (isAlreadySgWrap(handler)) return

    const pathArg = args[0]
    const pathStr =
      pathArg &&
      pathArg.type === 'Literal' &&
      typeof pathArg.value === 'string'
        ? pathArg.value
        : pathArg &&
          pathArg.type === 'StringLiteral' &&
          typeof pathArg.value === 'string'
        ? pathArg.value
        : '/'
    const callee = p.node.callee
    if (!callee || callee.type !== 'MemberExpression') return
    const property = callee.property
    if (!property || property.type !== 'Identifier') return
    const methodKey = `${property.name}:${pathStr}`

    args[args.length - 1] = buildSgWrapCall(
      j,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      handler as any,
      methodKey,
    )
    modified = true
  })

  if (!modified) return source
  return root.toSource({ quote: 'single' })
}
