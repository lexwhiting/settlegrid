/**
 * settlegrid-code-coverage — Code Coverage Analysis MCP Server
 *
 * Analyzes code structure and estimates coverage metrics.
 * Parses code locally to count functions, branches, and lines.
 *
 * Methods:
 *   analyze_code(code, language)    — Analyze code structure          (1c)
 *   estimate_coverage(code)         — Estimate coverage metrics       (1c)
 *   get_complexity(code)            — Calculate cyclomatic complexity  (1c)
 */

import { settlegrid } from '@settlegrid/mcp'

// --- Types ------------------------------------------------------------------

interface AnalyzeCodeInput {
  code: string
  language?: string
}

interface EstimateCoverageInput {
  code: string
  test_code?: string
}

interface GetComplexityInput {
  code: string
}

// --- Helpers ----------------------------------------------------------------

function countPatterns(code: string, patterns: RegExp[]): number {
  return patterns.reduce((sum, p) => {
    const matches = code.match(p)
    return sum + (matches?.length ?? 0)
  }, 0)
}

function detectLanguage(code: string): string {
  if (code.includes('import ') && (code.includes(': string') || code.includes(': number'))) return 'typescript'
  if (code.includes('function ') || code.includes('=>') || code.includes('const ')) return 'javascript'
  if (code.includes('def ') && code.includes(':')) return 'python'
  if (code.includes('func ') && code.includes('package ')) return 'go'
  if (code.includes('fn ') && code.includes('let mut')) return 'rust'
  if (code.includes('public class') || code.includes('private void')) return 'java'
  return 'unknown'
}

// --- SettleGrid Init --------------------------------------------------------

const sg = settlegrid.init({
  toolSlug: 'code-coverage',
  pricing: {
    defaultCostCents: 1,
    methods: {
      analyze_code: { costCents: 1, displayName: 'Analyze Code' },
      estimate_coverage: { costCents: 1, displayName: 'Estimate Coverage' },
      get_complexity: { costCents: 1, displayName: 'Get Complexity' },
    },
  },
})

// --- Handlers ---------------------------------------------------------------

const analyzeCode = sg.wrap(async (args: AnalyzeCodeInput) => {
  if (!args.code || typeof args.code !== 'string') throw new Error('code is required')

  const lines = args.code.split('\n')
  const lang = args.language ?? detectLanguage(args.code)
  const codeLines = lines.filter(l => l.trim() && !l.trim().startsWith('//') && !l.trim().startsWith('#') && !l.trim().startsWith('*'))
  const commentLines = lines.filter(l => l.trim().startsWith('//') || l.trim().startsWith('#') || l.trim().startsWith('*'))
  const blankLines = lines.filter(l => !l.trim())

  const functions = countPatterns(args.code, [
    /\bfunction\s+\w+/g, /\bconst\s+\w+\s*=\s*(?:async\s*)?\(/g,
    /\bdef\s+\w+/g, /\bfunc\s+\w+/g, /\bfn\s+\w+/g,
  ])
  const classes = countPatterns(args.code, [/\bclass\s+\w+/g])
  const imports = countPatterns(args.code, [/\bimport\s+/g, /\brequire\s*\(/g, /\bfrom\s+/g])

  return {
    language: lang,
    total_lines: lines.length,
    code_lines: codeLines.length,
    comment_lines: commentLines.length,
    blank_lines: blankLines.length,
    functions,
    classes,
    imports,
    comment_ratio: Math.round((commentLines.length / Math.max(lines.length, 1)) * 100) / 100,
  }
}, { method: 'analyze_code' })

const estimateCoverage = sg.wrap(async (args: EstimateCoverageInput) => {
  if (!args.code) throw new Error('code is required')

  const branches = countPatterns(args.code, [/\bif\s*\(/g, /\belse\b/g, /\bswitch\s*\(/g, /\bcase\b/g, /\?.*:/g])
  const functions = countPatterns(args.code, [/\bfunction\s+\w+/g, /\bconst\s+\w+\s*=\s*(?:async\s*)?\(/g, /\bdef\s+\w+/g])
  const lines = args.code.split('\n').filter(l => l.trim()).length

  let testedFunctions = 0
  if (args.test_code) {
    const testMatches = args.test_code.match(/\b(describe|it|test|expect|assert)\b/g)
    testedFunctions = Math.min(testMatches?.length ?? 0, functions)
  }

  const functionCoverage = functions > 0 ? Math.round((testedFunctions / functions) * 100) : 0
  const estimatedLineCoverage = args.test_code ? Math.min(functionCoverage + 15, 100) : 0

  return {
    total_lines: lines,
    total_functions: functions,
    total_branches: branches,
    tested_functions: testedFunctions,
    function_coverage_pct: functionCoverage,
    estimated_line_coverage_pct: estimatedLineCoverage,
    estimated_branch_coverage_pct: args.test_code ? Math.max(functionCoverage - 20, 0) : 0,
    has_tests: !!args.test_code,
  }
}, { method: 'estimate_coverage' })

const getComplexity = sg.wrap(async (args: GetComplexityInput) => {
  if (!args.code) throw new Error('code is required')

  // Cyclomatic complexity = E - N + 2P (simplified: count decision points + 1)
  const decisions = countPatterns(args.code, [
    /\bif\s*\(/g, /\belse\s+if\s*\(/g, /\bwhile\s*\(/g,
    /\bfor\s*\(/g, /\bcase\s+/g, /\bcatch\s*\(/g,
    /&&/g, /\|\|/g, /\?[^?]/g,
  ])
  const complexity = decisions + 1

  let rating: string
  if (complexity <= 5) rating = 'low (simple, easy to test)'
  else if (complexity <= 10) rating = 'moderate (manageable)'
  else if (complexity <= 20) rating = 'high (consider refactoring)'
  else rating = 'very high (should refactor)'

  return {
    cyclomatic_complexity: complexity,
    decision_points: decisions,
    rating,
    lines: args.code.split('\n').length,
    maintainability_index: Math.max(0, Math.round(171 - 5.2 * Math.log(complexity) - 0.23 * complexity)),
  }
}, { method: 'get_complexity' })

// --- Exports ----------------------------------------------------------------

export { analyzeCode, estimateCoverage, getComplexity }

console.log('settlegrid-code-coverage MCP server ready')
console.log('Methods: analyze_code, estimate_coverage, get_complexity')
console.log('Pricing: 1c per call | Powered by SettleGrid')
