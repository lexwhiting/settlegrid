import { describe, it, expect } from 'vitest'
import { readFileSync, readdirSync, statSync, existsSync } from 'node:fs'
import { join, resolve, dirname } from 'node:path'
import ts from 'typescript'

/**
 * Repo-wide check behind the one-connection pool (lib/db/index.ts): no callback of
 * `db.transaction(...)` may use the shared `db`, directly or through a helper it
 * calls (followed up to MAX_DEPTH calls deep, across local and imported
 * functions). With one connection per instance such a use would wait for the
 * connection the transaction holds. The runtime backstop is lib/db/tx-guard.ts.
 */

const SRC = resolve(__dirname, '../../..')
const MAX_DEPTH = 4
const DB_MEMBERS = new Set(['select', 'selectDistinct', 'insert', 'update', 'delete', 'execute', 'query', 'transaction', 'with', 'refreshMaterializedView'])

function walk(dir: string, out: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name)
    if (statSync(p).isDirectory()) {
      if (name === '__tests__' || name === 'node_modules') continue
      walk(p, out)
    } else if (/\.tsx?$/.test(name) && !/\.(test|spec)\.tsx?$/.test(name) && !name.endsWith('.d.ts')) {
      out.push(p)
    }
  }
  return out
}

const parsed = new Map<string, ts.SourceFile>()
function parse(file: string): ts.SourceFile {
  let sf = parsed.get(file)
  if (!sf) {
    sf = ts.createSourceFile(file, readFileSync(file, 'utf8'), ts.ScriptTarget.Latest, true, file.endsWith('x') ? ts.ScriptKind.TSX : ts.ScriptKind.TS)
    parsed.set(file, sf)
  }
  return sf
}

function resolveModule(spec: string, from: string): string | null {
  let base: string
  if (spec.startsWith('@/')) base = join(SRC, spec.slice(2))
  else if (spec.startsWith('.')) base = resolve(dirname(from), spec)
  else return null
  for (const c of [`${base}.ts`, `${base}.tsx`, join(base, 'index.ts')]) if (existsSync(c)) return c
  return null
}

/** name -> module specifier for named imports in a file. */
function imports(sf: ts.SourceFile): Map<string, string> {
  const m = new Map<string, string>()
  for (const st of sf.statements) {
    if (!ts.isImportDeclaration(st) || !st.importClause?.namedBindings) continue
    if (!ts.isNamedImports(st.importClause.namedBindings)) continue
    const spec = (st.moduleSpecifier as ts.StringLiteral).text
    for (const el of st.importClause.namedBindings.elements) m.set(el.name.text, spec)
  }
  return m
}

type Fn = ts.FunctionDeclaration | ts.ArrowFunction | ts.FunctionExpression

/** A top-level function or const-arrow named `name` in a file. */
function findFunction(sf: ts.SourceFile, name: string): Fn | null {
  for (const st of sf.statements) {
    if (ts.isFunctionDeclaration(st) && st.name?.text === name && st.body) return st
    if (ts.isVariableStatement(st)) {
      for (const d of st.declarationList.declarations) {
        if (ts.isIdentifier(d.name) && d.name.text === name && d.initializer &&
            (ts.isArrowFunction(d.initializer) || ts.isFunctionExpression(d.initializer))) return d.initializer
      }
    }
  }
  return null
}

/** Indexes of parameters that default to the shared db (`executor = db`). */
function dbDefaultParams(fn: Fn): number[] {
  return fn.parameters.flatMap((p, i) => (p.initializer && ts.isIdentifier(p.initializer) && p.initializer.text === 'db' ? [i] : []))
}

/** Direct uses of the shared db (`db.<member>`) and plain function calls inside a node. */
function scan(node: ts.Node): { dbUses: ts.Node[]; calls: ts.CallExpression[] } {
  const dbUses: ts.Node[] = []
  const calls: ts.CallExpression[] = []
  const visit = (n: ts.Node) => {
    if (ts.isPropertyAccessExpression(n) && ts.isIdentifier(n.expression) && n.expression.text === 'db' && DB_MEMBERS.has(n.name.text)) dbUses.push(n)
    if (ts.isCallExpression(n) && ts.isIdentifier(n.expression)) calls.push(n)
    ts.forEachChild(n, visit)
  }
  visit(node)
  return { dbUses, calls }
}

type Violation = string
function checkCallback(sf: ts.SourceFile, cb: ts.Node, where: string): Violation[] {
  const out: Violation[] = []
  const seen = new Set<string>()
  const queue: Array<{ sf: ts.SourceFile; node: ts.Node; chain: string; depth: number }> = [{ sf, node: cb, chain: where, depth: 0 }]
  while (queue.length) {
    const { sf: f, node, chain, depth } = queue.shift()!
    const { dbUses, calls } = scan(node)
    for (const u of dbUses) {
      const { line } = f.getLineAndCharacterOfPosition(u.getStart())
      out.push(`${chain} -> ${f.fileName.replace(SRC + '/', '')}:${line + 1} ${u.getText()}`)
    }
    const imp = imports(f)
    for (const call of calls) {
      const c = (call.expression as ts.Identifier).text
      let target: ts.SourceFile | null = null
      let fn = findFunction(f, c)
      if (fn) target = f
      else if (imp.has(c)) {
        const file = resolveModule(imp.get(c)!, f.fileName)
        if (file) {
          target = parse(file)
          fn = findFunction(target, c)
        }
      }
      if (!target || !fn || !fn.body) continue
      // A helper whose db parameter is left at its default (`executor = db`) uses the shared db.
      for (const i of dbDefaultParams(fn)) {
        if (call.arguments.length <= i) {
          const { line } = f.getLineAndCharacterOfPosition(call.getStart())
          out.push(`${chain} -> ${f.fileName.replace(SRC + '/', '')}:${line + 1} ${c}() without its db argument (defaults to the shared db)`)
        }
      }
      if (depth >= MAX_DEPTH) continue
      const key = `${target.fileName}#${c}`
      if (seen.has(key)) continue
      seen.add(key)
      queue.push({ sf: target, node: fn.body, chain: `${chain} -> ${c}()`, depth: depth + 1 })
    }
  }
  return out
}

function findTransactions() {
  const found: Array<{ where: string; violations: Violation[] }> = []
  for (const file of walk(SRC)) {
    const sf = parse(file)
    const visit = (n: ts.Node) => {
      if (ts.isCallExpression(n) && ts.isPropertyAccessExpression(n.expression) &&
          ts.isIdentifier(n.expression.expression) && n.expression.expression.text === 'db' &&
          n.expression.name.text === 'transaction') {
        const cb = n.arguments[0]
        const { line } = sf.getLineAndCharacterOfPosition(n.getStart())
        const where = `${file.replace(SRC + '/', '')}:${line + 1}`
        if (cb && (ts.isArrowFunction(cb) || ts.isFunctionExpression(cb))) {
          found.push({ where, violations: checkCallback(sf, cb.body, where) })
        } else {
          found.push({ where, violations: [`${where}: callback is not an inline function; check it by hand`] })
        }
      }
      ts.forEachChild(n, visit)
    }
    visit(sf)
  }
  return found
}

describe('db.transaction callbacks never use the shared db (one-connection pool)', () => {
  const found = findTransactions()

  it('finds the transactions in apps/web/src', () => {
    // 19 at the time of writing (2026-11); new ones are checked automatically.
    expect(found.length).toBeGreaterThanOrEqual(19)
  })

  it('no callback, or helper it calls, uses the shared db', () => {
    expect(found.flatMap((f) => f.violations)).toEqual([])
  })

  it('the checker itself flags a violation (control)', () => {
    const sf = ts.createSourceFile('control.ts', `
      import { db } from '@/lib/db'
      async function helper() { return db.select().from(x) }
      export async function f() { await db.transaction(async (tx) => { await tx.select(); await helper() }) }
    `, ts.ScriptTarget.Latest, true)
    let cb: ts.Node | null = null
    const visit = (n: ts.Node) => {
      if (ts.isCallExpression(n) && n.expression.getText(sf) === 'db.transaction') cb = (n.arguments[0] as ts.ArrowFunction).body
      ts.forEachChild(n, visit)
    }
    visit(sf)
    expect(cb).not.toBeNull()
    expect(checkCallback(sf, cb!, 'control.ts')).toEqual(['control.ts -> helper() -> control.ts:3 db.select'])
  })

  it('the checker flags a helper left on its shared-db default (control)', () => {
    const sf = ts.createSourceFile('control2.ts', `
      import { db } from '@/lib/db'
      async function count(executor = db) { return executor.select().from(x) }
      export async function f() { await db.transaction(async (tx) => { await count(tx); await count() }) }
    `, ts.ScriptTarget.Latest, true)
    let cb: ts.Node | null = null
    const visit = (n: ts.Node) => {
      if (ts.isCallExpression(n) && n.expression.getText(sf) === 'db.transaction') cb = (n.arguments[0] as ts.ArrowFunction).body
      ts.forEachChild(n, visit)
    }
    visit(sf)
    expect(checkCallback(sf, cb!, 'control2.ts')).toEqual([
      'control2.ts -> control2.ts:4 count() without its db argument (defaults to the shared db)',
    ])
  })
})
