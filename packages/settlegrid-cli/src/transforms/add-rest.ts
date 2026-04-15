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
 * up the callee chain looking for a `.route(pathLiteral)` call and
 * return its path argument. Supports arbitrary chain depth, e.g.
 * `app.route('/users').get(h1).post(h2)` (same `.route` resolves for
 * every verb in the chain).
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function extractPathFromRouteChain(calleeObject: any): string | null {
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
      const pathArg = Array.isArray(node.arguments) ? node.arguments[0] : null
      return extractLiteralPath(pathArg)
    }
    // Keep walking up the chain (e.g. app.route('/x').get(h).post walks
    // from .post's callee.object (get-result) down to .route call).
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
 * Adds the settlegrid import at top and `settlegrid.init(...)` before
 * the server-start call (`app.listen(...)` / `serve(...)`), or before
 * the first route if no start call is present. Files with no route
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

  // Collect `<anything>.<verb>(...)` style calls. We relax the old
  // `args.length >= 2` guard to >=1 so chain-form (`.get(handler)`)
  // matches — the handler-vs-path split happens below based on arity.
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

  if (ensureSettlegridImport(j, root)) modified = true

  if (!hasSettlegridInit(j, root)) {
    // Insert init IMMEDIATELY BEFORE the first route registration.
    //
    // Spec phrasing is "Add import + init before app.listen", but that
    // literal placement (right before app.listen at the bottom) would
    // put `const sg = …` AFTER every route registration — and because
    // each route call inlines `sg.wrap(…)`, they'd hit a TDZ
    // ReferenceError when the module loads. Spec intent is "somewhere
    // earlier in the file than the listen call"; "before the first
    // route" satisfies that AND the functional constraint that `sg`
    // must exist by the time any `sg.wrap(…)` runs.
    const firstRouteEnclosing = findEnclosingStatement(j, routeCalls.get(0))
    if (firstRouteEnclosing) {
      const initStmt = buildSettlegridInitStatement(j, ctx.toolSlug)
      j(firstRouteEnclosing).insertBefore(initStmt)
      modified = true
    }
  }

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
      // Chain form: `<app>.route('/x').<verb>(handler)`. The path lives
      // inside the callee chain on a `.route(pathLiteral)` call.
      const chainPath = extractPathFromRouteChain(callee.object)
      pathStr = chainPath ?? '/'
      handlerIndex = 0
    } else {
      // Direct form: `app.<verb>('/x', ..., handler)`. Path is arg[0],
      // handler is the last arg (anything in between is middleware).
      pathStr = extractLiteralPath(args[0]) ?? '/'
      handlerIndex = args.length - 1
    }

    const handler = args[handlerIndex]
    if (isAlreadySgWrap(handler)) return

    const methodKey = `${property.name}:${pathStr}`

    args[handlerIndex] = buildSgWrapCall(
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
