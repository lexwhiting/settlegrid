import jscodeshift from 'jscodeshift'
import {
  bodyContainsSgWrap,
  buildSettlegridInitStatement,
  ensureSettlegridImport,
  hasSettlegridInit,
} from './shared.js'
import type { Codemod } from './runner.js'

const LANGCHAIN_TOOL_SUPERCLASSES = new Set([
  'StructuredTool',
  'DynamicStructuredTool',
  'Tool',
])

const WRAPPED_METHOD_NAMES = new Set(['_call', 'invoke'])

/**
 * Transform a file that defines a class extending StructuredTool /
 * DynamicStructuredTool / Tool by wrapping its `_call` / `invoke` method
 * body in `sg.wrap(async () => { <original body> }, { method: this.name })()`.
 *
 * Adds the settlegrid import + `settlegrid.init({ toolSlug, pricing })`
 * call at file scope, placed immediately before the first target class.
 * Files without a matching class are returned unchanged.
 */
export const addLangchainTransform: Codemod = (source, ctx) => {
  const j = jscodeshift.withParser('tsx')
  let root
  try {
    root = j(source)
  } catch {
    return source
  }

  const toolClassPaths = root.find(j.ClassDeclaration).filter((p) => {
    const sup = p.node.superClass
    return (
      !!sup &&
      sup.type === 'Identifier' &&
      LANGCHAIN_TOOL_SUPERCLASSES.has(sup.name)
    )
  })

  if (toolClassPaths.length === 0) return source

  let modified = false

  if (ensureSettlegridImport(j, root)) modified = true

  if (!hasSettlegridInit(j, root)) {
    // `.at(0)` returns a sub-collection with just the first class path;
    // `.insertBefore` targets that path's parent array (Program.body)
    // which is where the `const sg = settlegrid.init(...)` belongs.
    const initStmt = buildSettlegridInitStatement(j, ctx.toolSlug)
    toolClassPaths.at(0).insertBefore(initStmt)
    modified = true
  }

  toolClassPaths.forEach((classPath) => {
    const body = classPath.node.body
    if (!body || body.type !== 'ClassBody') return

    for (const member of body.body) {
      const isMethod =
        member.type === 'MethodDefinition' || member.type === 'ClassMethod'
      if (!isMethod) continue
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const m = member as any
      if (!m.key || m.key.type !== 'Identifier') continue
      if (!WRAPPED_METHOD_NAMES.has(m.key.name)) continue

      const fn = m.value ?? m
      if (!fn || !fn.body || fn.body.type !== 'BlockStatement') continue

      // Per-method idempotency: skip if the body already contains an
      // `sg.wrap(…)` CALL (AST-level so comments / strings mentioning
      // "sg.wrap(" don't false-positive the skip).
      if (bodyContainsSgWrap(j, fn.body)) continue

      const originalBody = fn.body

      // Build an async arrow with the original block body. Using the
      // plain builder (no .from()) + post-mutation of `.async` avoids
      // type-check hiccups in ast-types' builder validation for
      // ArrowFunctionExpression in tsx parser mode.
      const arrow = j.arrowFunctionExpression([], originalBody)
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      ;(arrow as any).async = true

      const sgWrap = j.callExpression(
        j.memberExpression(j.identifier('sg'), j.identifier('wrap')),
        [
          arrow,
          j.objectExpression([
            j.property(
              'init',
              j.identifier('method'),
              j.memberExpression(
                j.thisExpression(),
                j.identifier('name'),
              ),
            ),
          ]),
        ],
      )

      // `return await sg.wrap(async () => { ... }, { method: this.name })()`
      const invoked = j.callExpression(sgWrap, [])
      const wrappedReturn = j.returnStatement(j.awaitExpression(invoked))

      fn.body = j.blockStatement([wrappedReturn])
      modified = true
    }
  })

  if (!modified) return source
  return root.toSource({ quote: 'single' })
}
