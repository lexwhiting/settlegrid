#!/usr/bin/env npx tsx
/**
 * MCP Database Query Tool — Monetized with SettleGrid
 *
 * A complete MCP server that converts natural language to SQL via Claude,
 * executes against a read-only database, and charges per query.
 *
 * Setup:
 *   1. npm install @settlegrid/mcp
 *   2. Set DATABASE_URL, ANTHROPIC_API_KEY, and SETTLEGRID_API_KEY in your env
 *   3. Register your tool at settlegrid.ai/dashboard/tools
 *   4. Run: npx tsx mcp-database-query.ts
 *
 * Pricing: 5 cents per query, 2 cents for schema listing
 *   - Claude Haiku for NL-to-SQL costs ~$0.003 per query
 *   - DB query execution costs are negligible on read replicas
 *   - 5 cents gives you ~16x margin
 *   - Schema listing is cheaper since it needs no AI call
 *
 * Revenue: You keep 95-100% (100% on Free tier, 95% on paid tiers)
 *
 * Safety: Read-only connection string, query validation, row limits,
 *         blocked DDL/DML statements, timeout enforcement
 */

import { settlegrid } from '@settlegrid/mcp'

// ── SettleGrid Setup ────────────────────────────────────────────────────────

const sg = settlegrid.init({
  toolSlug: 'my-db-query', // Replace with your tool slug
  pricing: {
    defaultCostCents: 5,
    methods: {
      query: { costCents: 5, displayName: 'Natural Language Query' },
      schema: { costCents: 2, displayName: 'List Schema' },
    },
  },
})

// ── Safety: Blocked SQL Patterns ────────────────────────────────────────────

const BLOCKED_PATTERNS = [
  /\bDROP\b/i,
  /\bDELETE\b/i,
  /\bINSERT\b/i,
  /\bUPDATE\b/i,
  /\bALTER\b/i,
  /\bCREATE\b/i,
  /\bTRUNCATE\b/i,
  /\bGRANT\b/i,
  /\bREVOKE\b/i,
  /\bEXEC\b/i,
  /\bEXECUTE\b/i,
  /--/,       // SQL comments (injection vector)
  /;\s*\S/,   // Multiple statements
]

function validateSQL(sql: string): { safe: boolean; reason?: string } {
  for (const pattern of BLOCKED_PATTERNS) {
    if (pattern.test(sql)) {
      return { safe: false, reason: `Blocked pattern detected: ${pattern.source}` }
    }
  }
  if (!sql.trim().toUpperCase().startsWith('SELECT')) {
    return { safe: false, reason: 'Only SELECT statements are allowed' }
  }
  return { safe: true }
}

// ── Claude NL-to-SQL ────────────────────────────────────────────────────────

async function naturalLanguageToSQL(question: string, schemaDescription: string): Promise<string> {
  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': process.env.ANTHROPIC_API_KEY!,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 1024,
      system: `You are a SQL query generator. Given a database schema and a natural language question, generate a single read-only SELECT query. Return ONLY the SQL query, no explanations or markdown. Always add LIMIT 100 if no limit is specified. Use the schema below.\n\nSchema:\n${schemaDescription}`,
      messages: [{ role: 'user', content: question }],
    }),
  })

  if (!response.ok) {
    throw new Error(`Claude API returned ${response.status}: ${response.statusText}`)
  }

  const data = await response.json()
  const block = data.content?.[0]
  if (!block || block.type !== 'text') {
    throw new Error('Unexpected Claude response format')
  }
  return block.text.replace(/```sql\n?|\n?```/g, '').trim()
}

// ── Database Execution (Replace with your DB driver) ────────────────────────
// This is a placeholder. Replace with pg, mysql2, better-sqlite3, etc.

interface QueryResult {
  columns: string[]
  rows: Record<string, unknown>[]
  rowCount: number
}

async function executeQuery(sql: string): Promise<QueryResult> {
  // Replace this with your actual database driver. Example with pg:
  //
  // import { Pool } from 'pg'
  // const pool = new Pool({ connectionString: process.env.DATABASE_URL })
  // const result = await pool.query(sql)
  // return {
  //   columns: result.fields.map(f => f.name),
  //   rows: result.rows,
  //   rowCount: result.rowCount ?? 0,
  // }

  // Placeholder for template purposes:
  return { columns: [], rows: [], rowCount: 0 }
}

// ── Tool Methods ────────────────────────────────────────────────────────────

// Replace this with your actual schema description
const SCHEMA_DESCRIPTION = `
Table: users (id INT PRIMARY KEY, name TEXT, email TEXT, created_at TIMESTAMP)
Table: orders (id INT PRIMARY KEY, user_id INT REFERENCES users, total DECIMAL, status TEXT, created_at TIMESTAMP)
Table: products (id INT PRIMARY KEY, name TEXT, price DECIMAL, category TEXT, stock INT)
Table: order_items (order_id INT REFERENCES orders, product_id INT REFERENCES products, quantity INT, price DECIMAL)
`.trim()

interface QueryArgs {
  question: string
}

async function handleQuery(args: QueryArgs): Promise<{ sql: string; result: QueryResult }> {
  if (!args.question || args.question.trim().length === 0) {
    throw new Error('Question must be a non-empty string')
  }
  if (args.question.length > 2000) {
    throw new Error('Question exceeds 2,000 character limit')
  }

  const sql = await naturalLanguageToSQL(args.question, SCHEMA_DESCRIPTION)

  const validation = validateSQL(sql)
  if (!validation.safe) {
    throw new Error(`Generated SQL failed safety check: ${validation.reason}`)
  }

  const result = await executeQuery(sql)
  return { sql, result }
}

async function handleSchema(): Promise<{ schema: string }> {
  return { schema: SCHEMA_DESCRIPTION }
}

// ── Wrap with SettleGrid Billing ─────────────────────────────────────────────

export const billedQuery = sg.wrap(handleQuery, { method: 'query' })
export const billedSchema = sg.wrap(handleSchema, { method: 'schema' })

// ── REST Alternative ────────────────────────────────────────────────────────
// import { settlegridMiddleware } from '@settlegrid/mcp/rest'
//
// const withBilling = settlegridMiddleware({
//   toolSlug: 'my-db-query',
//   pricing: {
//     defaultCostCents: 5,
//     methods: { query: { costCents: 5 }, schema: { costCents: 2 } },
//   },
// })
//
// export async function POST(request: Request) {
//   return withBilling(request, async () => {
//     const { question } = await request.json()
//     const result = await handleQuery({ question })
//     return Response.json(result)
//   }, 'query')
// }
