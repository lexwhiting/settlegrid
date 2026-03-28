/**
 * SettleGrid Service Template: Code Sandbox
 *
 * Wraps a sandboxed code execution environment with per-second billing
 * through SettleGrid. Callers submit code in a supported language and
 * receive stdout/stderr output. Execution is time-bounded for safety.
 *
 * Pricing: $0.01 per second of execution time (configurable)
 *
 * Usage:
 *   1. `npm install settlegrid`
 *   2. Set SETTLEGRID_SECRET in your environment
 *   3. Ensure Docker or a sandboxed runtime is available on the host
 *   4. Deploy and register on SettleGrid dashboard
 *
 * Note: This template uses child_process as a reference. In production,
 * use a container-based sandbox (Docker, Firecracker, gVisor) for
 * proper isolation.
 */

import { SettleGrid } from 'settlegrid'
import { execFile } from 'node:child_process'
import { writeFile, unlink, mkdtemp } from 'node:fs/promises'
import { join } from 'node:path'
import { tmpdir } from 'node:os'

// ─── Initialize ─────────────────────────────────────────────────────────────

const sg = new SettleGrid({
  secret: process.env.SETTLEGRID_SECRET!,
})

// ─── Constants ──────────────────────────────────────────────────────────────

/** Maximum execution time in seconds */
const MAX_EXECUTION_SECONDS = 30

/** Maximum output size in characters */
const MAX_OUTPUT_LENGTH = 50_000

/** Maximum code input size in characters */
const MAX_CODE_LENGTH = 100_000

/** Supported language runtimes */
const RUNTIMES: Record<string, { command: string; extension: string }> = {
  python: { command: 'python3', extension: '.py' },
  javascript: { command: 'node', extension: '.js' },
  typescript: { command: 'npx tsx', extension: '.ts' },
  bash: { command: 'bash', extension: '.sh' },
}

// ─── Types ──────────────────────────────────────────────────────────────────

interface CodeRequest {
  code: string
  language: string
  timeout?: number  // Max seconds (capped at MAX_EXECUTION_SECONDS)
  stdin?: string    // Optional stdin input
}

interface CodeResponse {
  stdout: string
  stderr: string
  exitCode: number
  language: string
  executionTimeMs: number
  executionTimeSeconds: number
  timedOut: boolean
}

// ─── Handler ────────────────────────────────────────────────────────────────

async function handleCodeExecution(input: CodeRequest): Promise<CodeResponse> {
  const code = input.code
  if (!code || typeof code !== 'string' || code.trim().length === 0) {
    throw new Error('code is required')
  }
  if (code.length > MAX_CODE_LENGTH) {
    throw new Error(`Code too large (${code.length} chars, max ${MAX_CODE_LENGTH})`)
  }

  const language = input.language?.toLowerCase()
  if (!language || !(language in RUNTIMES)) {
    throw new Error(`Unsupported language: ${language}. Supported: ${Object.keys(RUNTIMES).join(', ')}`)
  }

  const runtime = RUNTIMES[language]
  const timeoutSeconds = Math.min(input.timeout ?? 10, MAX_EXECUTION_SECONDS)

  // Write code to a temp file
  const tempDir = await mkdtemp(join(tmpdir(), 'sg-sandbox-'))
  const filePath = join(tempDir, `code${runtime.extension}`)
  await writeFile(filePath, code, 'utf-8')

  const start = Date.now()

  try {
    const result = await new Promise<{ stdout: string; stderr: string; exitCode: number; timedOut: boolean }>(
      (resolve) => {
        const args = runtime.command.includes(' ')
          ? [...runtime.command.split(' ').slice(1), filePath]
          : [filePath]
        const cmd = runtime.command.split(' ')[0]

        const child = execFile(
          cmd,
          args,
          {
            timeout: timeoutSeconds * 1000,
            maxBuffer: MAX_OUTPUT_LENGTH * 2,
            env: {
              ...process.env,
              // Restrict environment for sandboxing
              HOME: tempDir,
              TMPDIR: tempDir,
            },
          },
          (error, stdout, stderr) => {
            const timedOut = error?.killed === true
            const exitCode = error?.code !== undefined
              ? (typeof error.code === 'number' ? error.code : 1)
              : 0

            resolve({
              stdout: (stdout ?? '').slice(0, MAX_OUTPUT_LENGTH),
              stderr: (stderr ?? '').slice(0, MAX_OUTPUT_LENGTH),
              exitCode,
              timedOut,
            })
          },
        )

        // Pipe stdin if provided
        if (input.stdin && child.stdin) {
          child.stdin.write(input.stdin)
          child.stdin.end()
        }
      },
    )

    const executionTimeMs = Date.now() - start
    const executionTimeSeconds = Math.ceil(executionTimeMs / 1000)

    return {
      ...result,
      language,
      executionTimeMs,
      executionTimeSeconds,
    }
  } finally {
    // Clean up temp file
    await unlink(filePath).catch(() => {})
  }
}

// ─── SettleGrid Wrap ────────────────────────────────────────────────────────

/**
 * sg.wrap() intercepts each request, verifies the caller's SettleGrid
 * API key, charges per-second of execution time, and records usage
 * on the SettleGrid ledger.
 */
export default sg.wrap(handleCodeExecution, {
  name: 'code-sandbox',
  pricing: {
    model: 'per-second',
    costCentsPerSecond: 1, // $0.01 per second of execution
    // Billing is based on the executionTimeSeconds field in the response
    usageField: 'executionTimeSeconds',
  },
  rateLimit: {
    requests: 20,
    window: '1m',
  },
})
