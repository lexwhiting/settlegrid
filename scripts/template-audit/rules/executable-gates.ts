/**
 * Executable-gates rule — wraps the heavy quality-gates (tsc compile +
 * security lint) into a Rule so the orchestrator can treat them uniformly.
 *
 * The TSC gate is a high-signal check: the settlegrid-hebrew-calendar
 * Python-ternary leakage fails TSC with multiple errors and the
 * pollution-detection rules catch it separately, so either gate alone
 * would REMOVE that template. Running both provides defense-in-depth.
 *
 * We re-implement a lightweight version here rather than importing the
 * 900-LOC agents-repo quality-gates, because:
 *   - the agents repo is not a workspace peer of settlegrid
 *   - this audit is a one-shot tool; pulling agents-repo deps in is excess
 *   - the full smoke gate (spawning tsx) is out of scope — it would add
 *     60s per template × 1022 templates = 17 hours. Instead, the pollution
 *     + SDK-integration rules cover the "does the code even make sense"
 *     question cheaply. A smoke-gate pass can be layered in via the
 *     agents-repo runQualityGates in a follow-up if desired.
 *
 * So "executable" here is really "TSC compile only, inline" — the name
 * reserves the category for a future smoke-gate addition.
 */

import * as ts from 'typescript';
import * as path from 'node:path';
import type { Rule, RuleFinding, TemplateInput } from '../types.js';
import { baselineGood, baselineBad } from '../fixtures.js';

// Settlegrid repo root — derived relative to this file so TSC can resolve
// lib.*.d.ts + @types via the workspace node_modules. Without this, the
// virtual compile host can't find global types like Promise/Error and
// every known-good baseline fails with "Cannot find global type Promise".
const SETTLEGRID_ROOT = path.resolve(__dirname, '..', '..', '..');

const SETTLEGRID_MCP_AMBIENT = `
declare module '@settlegrid/mcp' {
  export interface SettleGridMethodPricing { costCents: number; displayName?: string }
  export interface SettleGridPricingConfig {
    defaultCostCents: number
    methods?: Record<string, SettleGridMethodPricing>
  }
  export interface SettleGridInitConfig {
    toolSlug: string
    pricing: SettleGridPricingConfig
    apiUrl?: string
    debug?: boolean
    cacheTtlMs?: number
    timeoutMs?: number
  }
  export interface WrapOptions { method: string; costCents?: number }
  export interface SettleGridInstance {
    wrap<T extends (...args: any[]) => any>(h: T, opts: WrapOptions): T
    validateKey(k: string): Promise<{ valid: boolean; consumerId: string; balanceCents: number }>
    meter(k: string, m: string): Promise<{ success: boolean; remainingBalanceCents: number; costCents: number }>
    clearCache(): void
  }
  export const settlegrid: { init(c: SettleGridInitConfig): SettleGridInstance }
  export function settlegridMiddleware(c: any): any
  export const SDK_VERSION: string
  export class SettleGridError extends Error {}
  export class InvalidKeyError extends SettleGridError {}
  export class InsufficientCreditsError extends SettleGridError { topUpUrl?: string }
  export class RateLimitedError extends SettleGridError { retryAfterSeconds?: number }
}

// Minimal Node + Web ambient declarations so templates that use process.env,
// fetch, console etc. type-check without resolving @types/node from the
// target template's node_modules (which we don't have).
//
// IMPORTANT: these must be permissive enough to accept valid template code
// WITHOUT introducing false positives. A false positive on a well-formed
// template (e.g. settlegrid-minecraft's \`return { ...await res.json() }\`)
// would flag a good template as REMOVE-worthy. Return types default to
// \`any\` so spreading / indexing results is always permitted.

declare const process: { env: Record<string, string | undefined> }
declare const console: {
  log(...args: any[]): void
  error(...args: any[]): void
  warn(...args: any[]): void
  info(...args: any[]): void
  debug(...args: any[]): void
}
declare function fetch(input: any, init?: any): Promise<Response>
declare interface Response {
  ok: boolean
  status: number
  statusText: string
  headers: any
  url: string
  json(): Promise<any>
  text(): Promise<string>
  arrayBuffer(): Promise<any>
  blob(): Promise<any>
  clone(): Response
}
declare class URL {
  constructor(input: string, base?: string)
  searchParams: URLSearchParams
  toString(): string
  pathname: string
  href: string
  origin: string
  host: string
  hostname: string
  port: string
  protocol: string
  search: string
  hash: string
  username: string
  password: string
}
declare class URLSearchParams {
  constructor(init?: any)
  set(k: string, v: string): void
  get(k: string): string | null
  getAll(k: string): string[]
  append(k: string, v: string): void
  has(k: string): boolean
  delete(k: string): void
  forEach(cb: (v: string, k: string) => void): void
  keys(): IterableIterator<string>
  values(): IterableIterator<string>
  entries(): IterableIterator<[string, string]>
  [Symbol.iterator](): IterableIterator<[string, string]>
  toString(): string
}
declare type RequestInit = any
declare type HeadersInit = any
declare class Buffer {
  static from(input: any, encoding?: string): Buffer
  toString(encoding?: string): string
  length: number
}
declare class TextEncoder {
  encode(input: string): any
}
declare class TextDecoder {
  decode(input: any): string
}
declare function setTimeout(cb: () => void, ms: number): any
declare function clearTimeout(handle: any): void
declare function setInterval(cb: () => void, ms: number): any
declare function clearInterval(handle: any): void
`.trim();

export const tscCompileRule: Rule = {
  id: 'executable:tsc-compile',
  description: 'server.ts must type-check clean against @settlegrid/mcp ambient stub.',
  severity: 'high',
  category: 'executable',
  fixtures: {
    knownGood: baselineGood(),
    knownBad: baselineBad('Python ternary breaks TSC', (f) => ({
      'src/server.ts':
        f['src/server.ts'] +
        `\nconst names = {"HEBREW_MONTHS" if slug == "hebrew-calendar" else "ISLAMIC_MONTHS"}\n`,
    })),
  },
  async check(input: TemplateInput): Promise<RuleFinding[]> {
    const content = input.files.get('src/server.ts');
    if (!content) return [];

    // Virtual root lives UNDER the real settlegrid root so Node-style lib
    // resolution walks up into the real node_modules and finds lib.*.d.ts.
    // A rootless path like '/virtual' has no ancestor that ships lib files
    // and every Promise/Error lookup fails.
    const rootDir = path.join(SETTLEGRID_ROOT, '__template_audit_virtual__');
    const sourceFile = path.join(rootDir, 'src/server.ts');
    const stubFile = path.join(rootDir, '__settlegrid_mcp_stub__.d.ts');
    const virtualFiles = new Map<string, string>([
      [sourceFile, content],
      [stubFile, SETTLEGRID_MCP_AMBIENT],
    ]);

    const compilerOptions: ts.CompilerOptions = {
      target: ts.ScriptTarget.ES2022,
      module: ts.ModuleKind.ES2022,
      moduleResolution: ts.ModuleResolutionKind.Bundler,
      strict: false, // corpus not held to strict — match the existing templates
      noEmit: true,
      skipLibCheck: true,
      esModuleInterop: true,
      allowSyntheticDefaultImports: true,
      resolveJsonModule: true,
      lib: ['es2022', 'dom'],
      types: [],
    };

    // Base host provides getSourceFile for lib files (Promise, Error, etc.)
    // via the TypeScript install. We override only the virtual-file hooks
    // and fall through to the base for real disk lookups — critical, because
    // without it lib.es2022.d.ts / lib.dom.d.ts don't load and every global
    // like Promise becomes "Cannot find name".
    const baseHost = ts.createCompilerHost(compilerOptions, true);
    const host: ts.CompilerHost = {
      ...baseHost,
      getCurrentDirectory: () => rootDir,
      useCaseSensitiveFileNames: () => true,
      getCanonicalFileName: (f) => f.replace(/\\/g, '/'),
      fileExists: (f) => virtualFiles.has(f) || baseHost.fileExists(f),
      readFile: (f) => virtualFiles.get(f) ?? baseHost.readFile(f),
      getSourceFile: (f, v, onError, shouldCreate) => {
        const virt = virtualFiles.get(f);
        if (virt !== undefined) return ts.createSourceFile(f, virt, v, true);
        return baseHost.getSourceFile(f, v, onError, shouldCreate);
      },
      writeFile: () => {},
    };

    const program = ts.createProgram([sourceFile, stubFile], compilerOptions, host);
    const diagnostics = [
      ...program.getSyntacticDiagnostics(),
      ...program.getSemanticDiagnostics(),
    ].filter((d) => d.category === ts.DiagnosticCategory.Error);

    if (diagnostics.length === 0) return [];

    // Cap findings so a bombed compile doesn't produce hundreds of lines.
    const shown = diagnostics.slice(0, 5);
    const samples = shown.map((d) => {
      const text = ts.flattenDiagnosticMessageText(d.messageText, '\n').slice(0, 200);
      if (d.file && typeof d.start === 'number') {
        const { line } = d.file.getLineAndCharacterOfPosition(d.start);
        return `${line + 1}: ${text}`;
      }
      return text;
    });

    return [
      {
        ruleId: 'executable:tsc-compile',
        severity: 'high',
        message: `tsc failed with ${diagnostics.length} error(s); first: ${samples[0]}`,
        evidence: {
          file: 'src/server.ts',
          data: { errorCount: diagnostics.length, samples },
        },
      },
    ];
  },
};

export const executableGatesRules: Rule[] = [tscCompileRule];
