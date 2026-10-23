import { describe, it, expect } from 'vitest'
import { readFileSync, readdirSync, statSync } from 'fs'
import path from 'path'
import {
  AUDIT_ACTIONS,
  AUDIT_RESOURCE_TYPES,
  DEVELOPER_AUDIT_ACTIONS,
  DEVELOPER_AUDIT_RESOURCE_TYPES,
} from '../audit-actions'

const SRC = path.resolve(__dirname, '../..')

function sourceFiles(dir: string): string[] {
  const out: string[] = []
  for (const name of readdirSync(dir)) {
    const full = path.join(dir, name)
    if (name === '__tests__' || name === 'node_modules') continue
    if (statSync(full).isDirectory()) out.push(...sourceFiles(full))
    else if (/\.(ts|tsx)$/.test(name) && !/\.test\./.test(name)) out.push(full)
  }
  return out
}

describe('audit actions', () => {
  it('has no duplicates', () => {
    expect(new Set(AUDIT_ACTIONS).size).toBe(AUDIT_ACTIONS.length)
    expect(new Set(AUDIT_RESOURCE_TYPES).size).toBe(AUDIT_RESOURCE_TYPES.length)
  })

  it('developer filter lists are subsets of the full lists', () => {
    for (const a of DEVELOPER_AUDIT_ACTIONS) expect(AUDIT_ACTIONS).toContain(a)
    for (const r of DEVELOPER_AUDIT_RESOURCE_TYPES) expect(AUDIT_RESOURCE_TYPES).toContain(r)
  })

  it('covers every literal action passed to writeAuditLog', () => {
    const literal = /writeAuditLog\(\{[\s\S]*?action:\s*'([^']+)'/g
    const missing: string[] = []
    for (const file of sourceFiles(SRC)) {
      const text = readFileSync(file, 'utf8')
      for (const m of text.matchAll(literal)) {
        if (!(AUDIT_ACTIONS as readonly string[]).includes(m[1])) missing.push(`${path.relative(SRC, file)}: ${m[1]}`)
      }
    }
    expect(missing).toEqual([])
  })
})
