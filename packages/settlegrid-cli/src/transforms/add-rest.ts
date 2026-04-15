import jscodeshift from 'jscodeshift'
import {
  buildSettlegridInitStatement,
  buildSgWrapCall,
  ensureSettlegridImport,
  findEnclosingStatement,
  hasSettlegridInit,
  isAlreadySgWrap,
  looksLikeFunction,
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
 * Extract the literal path string from a path argument node.
 * Returns null if the argument isn't a string literal (dynamic paths
 * like template strings or identifiers fall back to '/' in the caller).
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function extractLiteralPath(arg: any): string | null {
  if (!arg) return null
  if (arg.type === 'Literal' && typeof arg.value === 'string') return arg.value
  if (arg.type === 'StringLiteral' && typeof arg.value === 'string')
    return arg.value
  return null
}

/**
 * For chain-form calls like `app.route('/users').get(handler)`, walk
 * up the callee chain looking for a `.route()` call. Returns the
 * CallExpression node of the route call itself (or null if the chain
 * doesn't contain one). Callers can then extract the path and — more
 * importantly — confirm a chain's `.get(handler)` actually belongs to
 * a route chain, not to an unrelated object like an Immutable.List
 * that also has a `.get(index)` method.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function findRouteCallInChain(calleeObject: any): any {
  let node = calleeObject
  while (node && node.type === 'CallExpression') {
    const cal = node.callee
    if (
      cal &&
      cal.type === 'MemberExpression' &&
      cal.property &&
      cal.property.type === 'Identifier' &&
      cal.property.name === 'route'
    ) {
      return node
    }
    // Keep walking up the chain.
    if (cal && cal.type === 'MemberExpression') {
      node = cal.object
    } else {
      break
    }
  }
  return null
}

/**
 * Transform a REST-framework file (express/hono/fastify/koa) by wrapping
 * every route handler argument in `sg.wrap(handler, { method: '<verb>:<path>' })`.
 *
 * Supports both route-registration forms:
 *   - Direct: `app.get('/x', handler)` (two+ args, path first)
 *   - Chain:  `app.route('/x').get(handler)` (one arg, path walked
 *             up from the enclosing `.route()` call)
 *
 * Only wraps when the handler position holds something that plausibly
 * evaluates to a function, so `someMap.get(key)` / `list.get(idx)` /
 * `app.get('/health')` (no handler) are NOT misidentified as routes.
 *
 * Adds the settlegrid import at top and `settlegrid.init(...)` before
 * the first route registration — functional invariant: `const sg = …`
 * must precede every inline `sg.wrap(…)` or module load hits a TDZ
 * ReferenceError. Files with no route registrations are returned
 * unchanged.
 */
export const addRestTransform: Codemod = (source, ctx) => {
  const j = jscodeshift.withParser('tsx')
  let root
  try {
    root = j(source)
  } catch {
    return source
  }

  // Candidate calls: anything matching `<expr>.<verb>(...)` with at least
  // one arg. Handler/arity-splitting happens below so we can distinguish
  // chain form from direct form and reject non-function handler args.
  const routeCalls = root.find(j.CallExpression).filter((p) => {
    const callee = p.node.callee
    if (!callee || callee.type !== 'MemberExpression') return false
    if (!callee.property || callee.property.type !== 'Identifier') return false
    if (!REST_METHODS.has(callee.property.name)) return false
    const args = p.node.arguments
    return Array.isArray(args) && args.length >= 1
  })

  if (routeCalls.length === 0) return source

  let modified = false
  let wrappedAny = false

  if (ensureSettlegridImport(j, root)) modified = true

  routeCalls.forEach((p) => {
    const args = p.node.arguments
    if (!Array.isArray(args) || args.length < 1) return
    const callee = p.node.callee
    if (!callee || callee.type !== 'MemberExpression') return
    const property = callee.property
    if (!property || property.type !== 'Identifier') return

    let pathStr: string
    let handlerIndex: number

    if (args.length === 1) {
      // Chain form — must have a `.route(…)` ancestor, otherwise this
      // call is almost certainly not a route registration (could be
      // Immutable.List.get(idx), Map.get(key), a custom DSL, etc.).
      // Skipping is strictly safer than speculatively wrapping a
      // non-function single arg.
      const routeCall = findRouteCallInChain(callee.object)
      if (!routeCall) return
      const pathArg = Array.isArray(routeCall.arguments)
        ? routeCall.arguments[0]
        : null
      pathStr = extractLiteralPath(pathArg) ?? '/'
      handlerIndex = 0
    } else {
      // Direct form: `app.<verb>('/x', ..., handler)`. Path is arg[0],
      // handler is the last arg (anything in between is middleware).
      pathStr = extractLiteralPath(args[0]) ?? '/'
      handlerIndex = args.length - 1
    }

    const handler = args[handlerIndex]
    if (isAlreadySgWrap(handler)) return
    // Don't wrap literal / object / primitive args that happen to land
    // in the handler slot (defensive against the method-name collisions
    // noted above).
    if (!looksLikeFunction(handler)) return

    const methodKey = `${property.name}:${pathStr}`

    args[handlerIndex] = buildSgWrapCall(j, handler, methodKey)
    wrappedAny = true
    modified = true
  })

  // If we only inserted the import but didn't actually wrap any handler
  // (e.g. every route's handler was non-function), bail out so the
  // file isn't touched at all — a bare import with no init or wrap
  // would be dead weight in the target repo.
  if (!wrappedAny) return source

  if (!hasSettlegridInit(j, root)) {
    // Insert init IMMEDIATELY BEFORE the first route registration so
    // `const sg = …` precedes every inline `sg.wrap(…)`. See the
    // P2.3 spec-diff commit for why the spec's literal "before
    // app.listen" placement is unsafe here.
    const firstRouteEnclosing = findEnclosingStatement(j, routeCalls.get(0))
    if (firstRouteEnclosing) {
      const initStmt = buildSettlegridInitStatement(j, ctx.toolSlug)
      j(firstRouteEnclosing).insertBefore(initStmt)
      modified = true
    }
  }

  if (!modified) return source
  return root.toSource({ quote: 'single' })
}
