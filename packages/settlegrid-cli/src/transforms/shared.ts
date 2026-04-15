/**
 * Shared jscodeshift helpers used across all three codemods
 * (add-mcp, add-langchain, add-rest). Kept in one module so the three
 * transforms stay small and focused on their own pattern matching.
 *
 * NOTE ON THE SDK API: P2.3 spec prescribes `sg.wrap('<method>', handler)`
 * and `settlegrid.init({ apiKey })`, but the real @settlegrid/mcp API is:
 *   - settlegrid.init({ toolSlug, pricing: { defaultCostCents } })
 *   - sg.wrap(handler, { method })
 * Emitting real-API code per step 1 of the prompt ("confirm the exact
 * signatures; cite line numbers"). The generated code compiles + runs
 * against the actually-published @settlegrid/mcp@0.1.1.
 */
import type { Collection, JSCodeshift } from 'jscodeshift'

export const SETTLEGRID_MCP_IMPORT = '@settlegrid/mcp'

/**
 * True if the file imports from `@settlegrid/mcp` — either the main
 * entry (`@settlegrid/mcp`) or any exports subpath
 * (`@settlegrid/mcp/kernel`, `@settlegrid/mcp/rest`, etc.). Treating
 * subpath imports as already-wrapped is the safer default: the user
 * has already committed to the SDK in this file, so we don't want to
 * add a duplicate top-level import on top of it.
 */
export function hasSettlegridImport(
  j: JSCodeshift,
  root: Collection,
): boolean {
  return (
    root.find(j.ImportDeclaration).filter((p) => {
      const src = p.node.source
      if (!src || typeof src.value !== 'string') return false
      return (
        src.value === SETTLEGRID_MCP_IMPORT ||
        src.value.startsWith(SETTLEGRID_MCP_IMPORT + '/')
      )
    }).length > 0
  )
}

/** True if the file already calls settlegrid.init(...). */
export function hasSettlegridInit(
  j: JSCodeshift,
  root: Collection,
): boolean {
  return (
    root.find(j.CallExpression, {
      callee: {
        type: 'MemberExpression',
        object: { type: 'Identifier', name: 'settlegrid' },
        property: { type: 'Identifier', name: 'init' },
      },
    }).length > 0
  )
}

/**
 * Insert `import { settlegrid } from '@settlegrid/mcp'` after the last
 * existing import, or at the top of the program if there are none.
 * No-op if such an import (main or subpath) already exists.
 */
export function ensureSettlegridImport(
  j: JSCodeshift,
  root: Collection,
): boolean {
  if (hasSettlegridImport(j, root)) return false

  const newImport = j.importDeclaration(
    [j.importSpecifier(j.identifier('settlegrid'))],
    j.literal(SETTLEGRID_MCP_IMPORT),
  )

  const imports = root.find(j.ImportDeclaration)
  if (imports.length > 0) {
    imports.at(imports.length - 1).insertAfter(newImport)
  } else {
    const program = root.get().node.program
    program.body.unshift(newImport)
  }
  return true
}

/**
 * Build an AST for `const sg = settlegrid.init({ toolSlug, pricing: {...} })`.
 * Used by MCP / LangChain / REST codemods to insert the SDK init call.
 */
export function buildSettlegridInitStatement(
  j: JSCodeshift,
  toolSlug: string,
): ReturnType<JSCodeshift['variableDeclaration']> {
  return j.variableDeclaration('const', [
    j.variableDeclarator(
      j.identifier('sg'),
      j.callExpression(
        j.memberExpression(j.identifier('settlegrid'), j.identifier('init')),
        [
          j.objectExpression([
            j.property(
              'init',
              j.identifier('toolSlug'),
              j.literal(toolSlug),
            ),
            j.property(
              'init',
              j.identifier('pricing'),
              j.objectExpression([
                j.property(
                  'init',
                  j.identifier('defaultCostCents'),
                  j.literal(1),
                ),
              ]),
            ),
          ]),
        ],
      ),
    ),
  ])
}

/**
 * Build `sg.wrap(handler, { method: <methodName> })`.
 *
 * `handler` is typed as a Node (the loosest useful type); callers pass
 * whatever AST expression they captured (ArrowFunctionExpression,
 * FunctionExpression, Identifier, MemberExpression, CallExpression).
 * The narrow types emitted by jscodeshift's builder are purely symbolic —
 * all Node subtypes satisfy the underlying builder contract at runtime.
 */
export function buildSgWrapCall(
  j: JSCodeshift,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  handler: any,
  methodName: string,
): ReturnType<JSCodeshift['callExpression']> {
  return j.callExpression(
    j.memberExpression(j.identifier('sg'), j.identifier('wrap')),
    [
      handler,
      j.objectExpression([
        j.property(
          'init',
          j.identifier('method'),
          j.literal(methodName),
        ),
      ]),
    ],
  )
}

/**
 * Return true if `node` is already `sg.wrap(...)` — used to skip
 * already-wrapped handlers during re-runs, giving per-call idempotency
 * on top of the file-level "already-wrapped" skip in the runner.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function isAlreadySgWrap(node: any): boolean {
  return (
    node &&
    node.type === 'CallExpression' &&
    node.callee &&
    node.callee.type === 'MemberExpression' &&
    node.callee.object &&
    node.callee.object.type === 'Identifier' &&
    node.callee.object.name === 'sg' &&
    node.callee.property &&
    node.callee.property.type === 'Identifier' &&
    node.callee.property.name === 'wrap'
  )
}

/**
 * True if `node` could plausibly be a route / request handler function
 * at runtime. Used to avoid wrapping non-function arguments that merely
 * share a method name with our route verbs (e.g. `someMap.get(key)`,
 * `list.get(idx)`, `app.get('/health')` with no handler arg).
 *
 * Conservative allowlist: function/arrow literals, bare identifiers
 * (likely variables holding functions), member-access (obj.method),
 * and call expressions (factory returning a function). Everything
 * else — literals, numbers, strings, objects, arrays — is excluded.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function looksLikeFunction(node: any): boolean {
  if (!node || typeof node.type !== 'string') return false
  return (
    node.type === 'FunctionExpression' ||
    node.type === 'ArrowFunctionExpression' ||
    node.type === 'Identifier' ||
    node.type === 'MemberExpression' ||
    node.type === 'CallExpression'
  )
}

/**
 * Kebab-case an MCP schema identifier by stripping the conventional
 * `Schema` / `Request` suffixes and converting CamelCase to kebab-case.
 * Shared so the `extractMcpMethodName` Identifier and MemberExpression
 * branches produce the same output for the same underlying schema.
 */
function kebabMcpSchemaName(name: string): string {
  let base = name
  if (base.endsWith('Schema')) base = base.slice(0, -'Schema'.length)
  if (base.endsWith('Request')) base = base.slice(0, -'Request'.length)
  const kebab = base
    .replace(/([a-z0-9])([A-Z])/g, '$1-$2')
    .replace(/([A-Z])([A-Z][a-z])/g, '$1-$2')
    .toLowerCase()
  return kebab || 'handler'
}

/**
 * Given an MCP schema argument node like `ListToolsRequestSchema` or
 * `schemas.CallToolRequestSchema`, derive a stable method key for
 * `sg.wrap`. Both identifier and member-expression forms go through
 * the same kebab-case normalization so `ListToolsRequestSchema` and
 * `schemas.ListToolsRequestSchema` both yield `'list-tools'`.
 * Falls back to 'handler' when the schema is a non-identifier /
 * non-string expression (dynamically-built object, template literal).
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function extractMcpMethodName(schema: any): string {
  if (!schema) return 'handler'
  if (schema.type === 'Identifier' && typeof schema.name === 'string') {
    return kebabMcpSchemaName(schema.name)
  }
  if (
    schema.type === 'MemberExpression' &&
    schema.property &&
    schema.property.type === 'Identifier' &&
    typeof schema.property.name === 'string'
  ) {
    return kebabMcpSchemaName(schema.property.name)
  }
  if (schema.type === 'Literal' && typeof schema.value === 'string') {
    return schema.value
  }
  if (schema.type === 'StringLiteral' && typeof schema.value === 'string') {
    return schema.value
  }
  return 'handler'
}

/**
 * Walk up the AST from `nodePath` until we find the enclosing Statement,
 * so we can insert a sibling statement before/after it.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function findEnclosingStatement(j: JSCodeshift, nodePath: any): any {
  let p = nodePath
  while (p && p.node) {
    if (j.Statement.check(p.node)) return p
    p = p.parent
  }
  return null
}

/**
 * AST-based check: does `bodyNode` contain a `sg.wrap(...)` call
 * anywhere inside it? Safer than a textual grep (which false-positives
 * on comments like `// TODO: add sg.wrap here`).
 */
export function bodyContainsSgWrap(
  j: JSCodeshift,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  bodyNode: any,
): boolean {
  let found = false
  j(bodyNode)
    .find(j.CallExpression)
    .forEach((p) => {
      if (isAlreadySgWrap(p.node)) found = true
    })
  return found
}
