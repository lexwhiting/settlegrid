/**
 * settlegrid-code-metrics — Source Code Metrics MCP Server
 *
 * Takes source code and returns structural metrics: line count, function
 * count, comment ratio, complexity estimate, and language detection.
 * Useful for code review agents, CI pipelines, and quality dashboards.
 *
 * Methods:
 *   analyze_code(code, language?)   — full code metrics (5 cents)
 *   detect_language(code)           — detect programming language (5 cents)
 *   count_functions(code, language?) — count and list functions (5 cents)
 *
 * Pricing: 5 cents per call
 * Category: code
 *
 * Deploy: Vercel, Railway, or any Node.js host
 *   SETTLEGRID_TOOL_SLUG=code-metrics npx tsx code-metrics.ts
 */

import { settlegrid } from '@settlegrid/mcp'

/* -------------------------------------------------------------------------- */
/*  Types                                                                     */
/* -------------------------------------------------------------------------- */

interface CodeInput {
  code: string
  language?: string
}

interface FunctionInfo {
  name: string
  line: number
  type: string
}

interface LanguageSignature {
  name: string
  extensions: string[]
  markers: RegExp[]
  commentSingle: string
  commentMultiStart: string
  commentMultiEnd: string
  functionPatterns: RegExp[]
}

/* -------------------------------------------------------------------------- */
/*  Constants                                                                 */
/* -------------------------------------------------------------------------- */

const LANGUAGES: LanguageSignature[] = [
  {
    name: 'TypeScript',
    extensions: ['.ts', '.tsx'],
    markers: [/\binterface\s+\w+/, /\btype\s+\w+\s*=/, /:\s*(string|number|boolean|void|any|unknown|never)\b/, /\bimport\s+.*\s+from\s+['"]/, /\bexport\s+(default\s+)?(function|class|const|interface|type)\b/],
    commentSingle: '//',
    commentMultiStart: '/*',
    commentMultiEnd: '*/',
    functionPatterns: [
      /(?:export\s+)?(?:async\s+)?function\s+(\w+)/g,
      /(?:export\s+)?const\s+(\w+)\s*=\s*(?:async\s+)?\(/g,
      /(?:export\s+)?const\s+(\w+)\s*=\s*(?:async\s+)?\w+\s*=>/g,
      /(\w+)\s*\([^)]*\)\s*(?::\s*\w+)?\s*\{/g,
    ],
  },
  {
    name: 'JavaScript',
    extensions: ['.js', '.jsx', '.mjs', '.cjs'],
    markers: [/\bconst\s+\w+\s*=/, /\blet\s+\w+\s*=/, /\bvar\s+\w+\s*=/, /\brequire\s*\(/, /\bmodule\.exports\b/],
    commentSingle: '//',
    commentMultiStart: '/*',
    commentMultiEnd: '*/',
    functionPatterns: [
      /(?:export\s+)?(?:async\s+)?function\s+(\w+)/g,
      /(?:export\s+)?(?:const|let|var)\s+(\w+)\s*=\s*(?:async\s+)?\(/g,
      /(?:export\s+)?(?:const|let|var)\s+(\w+)\s*=\s*(?:async\s+)?\w+\s*=>/g,
    ],
  },
  {
    name: 'Python',
    extensions: ['.py'],
    markers: [/\bdef\s+\w+\s*\(/, /\bclass\s+\w+/, /\bimport\s+\w+/, /\bfrom\s+\w+\s+import/, /\bif\s+__name__\s*==\s*['"]__main__['"]/],
    commentSingle: '#',
    commentMultiStart: '"""',
    commentMultiEnd: '"""',
    functionPatterns: [
      /def\s+(\w+)\s*\(/g,
      /(\w+)\s*=\s*lambda\b/g,
    ],
  },
  {
    name: 'Go',
    extensions: ['.go'],
    markers: [/\bfunc\s+/, /\bpackage\s+\w+/, /\bimport\s*\(/, /\btype\s+\w+\s+struct\b/, /\b:=\s*/],
    commentSingle: '//',
    commentMultiStart: '/*',
    commentMultiEnd: '*/',
    functionPatterns: [
      /func\s+(?:\(\w+\s+\*?\w+\)\s+)?(\w+)\s*\(/g,
    ],
  },
  {
    name: 'Rust',
    extensions: ['.rs'],
    markers: [/\bfn\s+\w+/, /\blet\s+mut\s+/, /\bimpl\s+\w+/, /\buse\s+\w+::/, /\bmatch\s+\w+\s*\{/],
    commentSingle: '//',
    commentMultiStart: '/*',
    commentMultiEnd: '*/',
    functionPatterns: [
      /(?:pub\s+)?(?:async\s+)?fn\s+(\w+)/g,
    ],
  },
  {
    name: 'Java',
    extensions: ['.java'],
    markers: [/\bpublic\s+class\s+\w+/, /\bSystem\.out\.print/, /\bimport\s+java\./, /\b@Override\b/, /\bpublic\s+static\s+void\s+main\b/],
    commentSingle: '//',
    commentMultiStart: '/*',
    commentMultiEnd: '*/',
    functionPatterns: [
      /(?:public|private|protected)\s+(?:static\s+)?(?:\w+\s+)+(\w+)\s*\(/g,
    ],
  },
  {
    name: 'Ruby',
    extensions: ['.rb'],
    markers: [/\bdef\s+\w+/, /\bend\b/, /\brequire\s+['"]/, /\battr_accessor\b/, /\bclass\s+\w+\s*<\s*\w+/],
    commentSingle: '#',
    commentMultiStart: '=begin',
    commentMultiEnd: '=end',
    functionPatterns: [
      /def\s+(?:self\.)?(\w+[?!]?)/g,
    ],
  },
  {
    name: 'PHP',
    extensions: ['.php'],
    markers: [/<\?php/, /\$\w+\s*=/, /\bfunction\s+\w+/, /\b->\w+\(/, /\becho\s+/],
    commentSingle: '//',
    commentMultiStart: '/*',
    commentMultiEnd: '*/',
    functionPatterns: [
      /(?:public|private|protected|static)?\s*function\s+(\w+)/g,
    ],
  },
  {
    name: 'C#',
    extensions: ['.cs'],
    markers: [/\busing\s+System/, /\bnamespace\s+\w+/, /\bpublic\s+class\s+\w+/, /\bConsole\.Write/, /\bvar\s+\w+\s*=/],
    commentSingle: '//',
    commentMultiStart: '/*',
    commentMultiEnd: '*/',
    functionPatterns: [
      /(?:public|private|protected|internal)\s+(?:static\s+)?(?:async\s+)?(?:\w+\s+)+(\w+)\s*\(/g,
    ],
  },
  {
    name: 'Shell',
    extensions: ['.sh', '.bash', '.zsh'],
    markers: [/^#!\/bin\/(bash|sh|zsh)/, /\becho\s+/, /\bfi\b/, /\besac\b/, /\b\$\{\w+\}/],
    commentSingle: '#',
    commentMultiStart: ": '",
    commentMultiEnd: "'",
    functionPatterns: [
      /(?:function\s+)?(\w+)\s*\(\)\s*\{/g,
    ],
  },
  {
    name: 'SQL',
    extensions: ['.sql'],
    markers: [/\bSELECT\b/i, /\bFROM\b/i, /\bCREATE\s+TABLE\b/i, /\bINSERT\s+INTO\b/i, /\bWHERE\b/i],
    commentSingle: '--',
    commentMultiStart: '/*',
    commentMultiEnd: '*/',
    functionPatterns: [
      /CREATE\s+(?:OR\s+REPLACE\s+)?(?:FUNCTION|PROCEDURE)\s+(\w+)/gi,
    ],
  },
]

/* -------------------------------------------------------------------------- */
/*  SettleGrid init                                                           */
/* -------------------------------------------------------------------------- */

const sg = settlegrid.init({
  toolSlug: process.env.SETTLEGRID_TOOL_SLUG || 'code-metrics',
  pricing: {
    defaultCostCents: 5,
    methods: {
      analyze_code: { costCents: 5, displayName: 'Analyze Code' },
      detect_language: { costCents: 5, displayName: 'Detect Language' },
      count_functions: { costCents: 5, displayName: 'Count Functions' },
    },
  },
})

/* -------------------------------------------------------------------------- */
/*  Helpers                                                                   */
/* -------------------------------------------------------------------------- */

function detectLanguageFromCode(code: string): { name: string; confidence: number } {
  let bestMatch = { name: 'Unknown', confidence: 0 }

  for (const lang of LANGUAGES) {
    let matchCount = 0
    for (const marker of lang.markers) {
      if (marker.test(code)) matchCount++
    }
    const confidence = matchCount / lang.markers.length
    if (confidence > bestMatch.confidence) {
      bestMatch = { name: lang.name, confidence }
    }
  }

  if (bestMatch.confidence < 0.2) {
    return { name: 'Unknown', confidence: 0 }
  }

  return { ...bestMatch, confidence: Math.round(bestMatch.confidence * 100) / 100 }
}

function getLanguageSignature(langName: string): LanguageSignature | undefined {
  return LANGUAGES.find((l) => l.name.toLowerCase() === langName.toLowerCase())
}

function countCommentLines(code: string, lang: LanguageSignature): number {
  const lines = code.split('\n')
  let commentLines = 0
  let inMultiline = false

  for (const line of lines) {
    const trimmed = line.trim()

    if (inMultiline) {
      commentLines++
      if (trimmed.includes(lang.commentMultiEnd)) {
        inMultiline = false
      }
      continue
    }

    if (trimmed.startsWith(lang.commentSingle)) {
      commentLines++
      continue
    }

    if (trimmed.includes(lang.commentMultiStart)) {
      commentLines++
      if (!trimmed.includes(lang.commentMultiEnd) || trimmed.indexOf(lang.commentMultiEnd) < trimmed.indexOf(lang.commentMultiStart) + lang.commentMultiStart.length) {
        inMultiline = true
      }
    }
  }

  return commentLines
}

function findFunctions(code: string, lang: LanguageSignature): FunctionInfo[] {
  const functions: FunctionInfo[] = []
  const lines = code.split('\n')
  const seenNames = new Set<string>()

  for (const pattern of lang.functionPatterns) {
    // Reset the regex for each pattern
    const regex = new RegExp(pattern.source, pattern.flags)
    let match: RegExpExecArray | null

    while ((match = regex.exec(code)) !== null) {
      const name = match[1]
      if (!name || seenNames.has(name)) continue
      seenNames.add(name)

      // Find line number
      const beforeMatch = code.substring(0, match.index)
      const lineNumber = beforeMatch.split('\n').length

      // Determine function type
      let type = 'function'
      const matchText = match[0]
      if (matchText.includes('async')) type = 'async_function'
      if (matchText.includes('=>') || matchText.includes('lambda')) type = 'arrow_function'
      if (matchText.includes('class') || matchText.includes('def self.')) type = 'method'

      functions.push({ name, line: lineNumber, type })
    }
  }

  // Sort by line number
  functions.sort((a, b) => a.line - b.line)
  return functions
}

function estimateComplexity(code: string): {
  cyclomatic_estimate: number
  nesting_depth_max: number
  complexity_level: string
} {
  // Count branching keywords
  const branchPatterns = [
    /\bif\b/g, /\belse\s+if\b/g, /\belif\b/g, /\belse\b/g,
    /\bfor\b/g, /\bwhile\b/g, /\bswitch\b/g, /\bcase\b/g,
    /\bcatch\b/g, /\b\?\s*:/g, /&&/g, /\|\|/g,
    /\bmatch\b/g, /\bwhen\b/g,
  ]

  let branchCount = 1 // Base complexity
  for (const pattern of branchPatterns) {
    const matches = code.match(pattern)
    if (matches) branchCount += matches.length
  }

  // Estimate max nesting depth
  let maxDepth = 0
  let currentDepth = 0
  for (const char of code) {
    if (char === '{' || char === '(') {
      currentDepth++
      maxDepth = Math.max(maxDepth, currentDepth)
    } else if (char === '}' || char === ')') {
      currentDepth = Math.max(0, currentDepth - 1)
    }
  }

  // Python indentation-based nesting
  if (!code.includes('{')) {
    const lines = code.split('\n').filter((l) => l.trim().length > 0)
    for (const line of lines) {
      const indent = line.match(/^(\s*)/)?.[1].length ?? 0
      const depth = Math.floor(indent / 4) // Assume 4-space indent
      maxDepth = Math.max(maxDepth, depth)
    }
  }

  const complexityLevel =
    branchCount <= 5 ? 'low' :
    branchCount <= 15 ? 'moderate' :
    branchCount <= 30 ? 'high' :
    'very_high'

  return {
    cyclomatic_estimate: branchCount,
    nesting_depth_max: maxDepth,
    complexity_level: complexityLevel,
  }
}

/* -------------------------------------------------------------------------- */
/*  Wrapped handlers                                                          */
/* -------------------------------------------------------------------------- */

const analyzeCode = sg.wrap(async (args: CodeInput) => {
  if (!args.code || typeof args.code !== 'string') {
    throw new Error('code is required and must be a string')
  }

  const code = args.code
  const lines = code.split('\n')
  const totalLines = lines.length
  const blankLines = lines.filter((l) => l.trim().length === 0).length
  const codeLines = totalLines - blankLines

  // Detect or use provided language
  const detected = detectLanguageFromCode(code)
  const langName = args.language || detected.name
  const lang = getLanguageSignature(langName)

  let commentLines = 0
  let functions: FunctionInfo[] = []

  if (lang) {
    commentLines = countCommentLines(code, lang)
    functions = findFunctions(code, lang)
  }

  const commentRatio = totalLines > 0
    ? Math.round((commentLines / totalLines) * 100) / 100
    : 0

  const complexity = estimateComplexity(code)
  const charCount = code.length
  const byteCount = Buffer.byteLength(code, 'utf8')

  // Average line length (excluding blank lines)
  const nonBlankLines = lines.filter((l) => l.trim().length > 0)
  const avgLineLength = nonBlankLines.length > 0
    ? Math.round(nonBlankLines.reduce((sum, l) => sum + l.length, 0) / nonBlankLines.length)
    : 0
  const maxLineLength = Math.max(...lines.map((l) => l.length), 0)

  // Count imports
  const importCount = (code.match(/^(?:import|from|require|use|using|include)\b/gm) || []).length

  return {
    language: langName,
    language_confidence: args.language ? 1 : detected.confidence,
    total_lines: totalLines,
    code_lines: codeLines,
    blank_lines: blankLines,
    comment_lines: commentLines,
    comment_ratio: commentRatio,
    function_count: functions.length,
    functions: functions.slice(0, 50), // Cap at 50 functions in response
    import_count: importCount,
    character_count: charCount,
    byte_count: byteCount,
    avg_line_length: avgLineLength,
    max_line_length: maxLineLength,
    complexity: complexity,
  }
}, { method: 'analyze_code' })

const detectLang = sg.wrap(async (args: { code: string }) => {
  if (!args.code || typeof args.code !== 'string') {
    throw new Error('code is required and must be a string')
  }

  const detected = detectLanguageFromCode(args.code)
  const lang = getLanguageSignature(detected.name)

  return {
    language: detected.name,
    confidence: detected.confidence,
    extensions: lang?.extensions ?? [],
    comment_style: lang ? {
      single_line: lang.commentSingle,
      multi_line_start: lang.commentMultiStart,
      multi_line_end: lang.commentMultiEnd,
    } : null,
  }
}, { method: 'detect_language' })

const countFunctions = sg.wrap(async (args: CodeInput) => {
  if (!args.code || typeof args.code !== 'string') {
    throw new Error('code is required and must be a string')
  }

  const detected = detectLanguageFromCode(args.code)
  const langName = args.language || detected.name
  const lang = getLanguageSignature(langName)

  if (!lang) {
    return {
      language: langName,
      function_count: 0,
      functions: [],
      note: `Language "${langName}" not recognized. Supported: ${LANGUAGES.map((l) => l.name).join(', ')}`,
    }
  }

  const functions = findFunctions(args.code, lang)

  return {
    language: langName,
    function_count: functions.length,
    functions,
    function_types: {
      regular: functions.filter((f) => f.type === 'function').length,
      async: functions.filter((f) => f.type === 'async_function').length,
      arrow: functions.filter((f) => f.type === 'arrow_function').length,
      method: functions.filter((f) => f.type === 'method').length,
    },
  }
}, { method: 'count_functions' })

/* -------------------------------------------------------------------------- */
/*  Exports                                                                   */
/* -------------------------------------------------------------------------- */

export { analyzeCode, detectLang, countFunctions }

console.log('settlegrid-code-metrics MCP server ready')
console.log('Methods: analyze_code, detect_language, count_functions')
console.log('Pricing: 5 cents per call | Powered by SettleGrid')
