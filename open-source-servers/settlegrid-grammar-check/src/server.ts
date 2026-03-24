/**
 * settlegrid-grammar-check — Grammar Check MCP Server
 *
 * Wraps LanguageTool API with SettleGrid billing.
 * No API key needed.
 *
 * Methods:
 *   check_grammar(text, language?) — grammar check (1¢)
 */

import { settlegrid } from '@settlegrid/mcp'

interface GrammarInput { text: string; language?: string }

const API_BASE = 'https://api.languagetool.org/v2'

const sg = settlegrid.init({
  toolSlug: 'grammar-check',
  pricing: { defaultCostCents: 1, methods: { check_grammar: { costCents: 1, displayName: 'Check Grammar' } } },
})

const checkGrammar = sg.wrap(async (args: GrammarInput) => {
  if (!args.text) throw new Error('text is required')
  const lang = args.language || 'en-US'
  const res = await fetch(`${API_BASE}/check`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: `text=${encodeURIComponent(args.text)}&language=${lang}`,
  })
  if (!res.ok) throw new Error(`API ${res.status}`)
  const data = await res.json() as any
  return {
    language: data.language?.name,
    issues: (data.matches || []).map((m: any) => ({
      message: m.message, offset: m.offset, length: m.length,
      rule: m.rule?.id, category: m.rule?.category?.name,
      replacements: m.replacements?.slice(0, 3).map((r: any) => r.value),
      context: m.context?.text,
    })),
    issue_count: data.matches?.length || 0,
  }
}, { method: 'check_grammar' })

export { checkGrammar }

console.log('settlegrid-grammar-check MCP server ready')
console.log('Methods: check_grammar')
console.log('Pricing: 1¢ per call | Powered by SettleGrid')
