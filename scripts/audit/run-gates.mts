/**
 * CANONICAL_50 quality-gate runner (P1.6)
 *
 * A small tsx-run subprocess that bridges the .mjs orchestrator
 * (canonical-50.mjs, node-only) to the TypeScript P1.4 quality-gates
 * module in the sibling settlegrid-agents repo. Per-line stdin protocol
 * amortizes tsx startup cost across 100+ template invocations.
 *
 * Protocol:
 *   - stdin  : one template directory path per line (absolute)
 *   - stdout : one JSON object per line:
 *              { "dir": "/path/to/settlegrid-foo",
 *                "result"?: { tscPass, smokePass, securityPass, ... },
 *                "error"?:  "message" }
 *
 * The orchestrator spawns this once, pipes all paths, and collects
 * results in order.
 *
 * The quality-gates module is imported via its default export because
 * the settlegrid-agents repo is `"type": "commonjs"`, and Node's ESM
 * loader wraps CJS modules so their module.exports lands on `default`.
 */

// The import uses a relative path so this file stays portable as long
// as settlegrid-agents is a sibling of settlegrid. The orchestrator
// verifies the path exists before spawning this helper.
// eslint-disable-next-line import/no-unresolved
import qg from '../../../settlegrid-agents/agents/shared/quality-gates';
import { createInterface } from 'node:readline';
import * as path from 'node:path';

type QualityGateResult = {
  slug: string;
  tscPass: boolean;
  tscErrors: string[];
  smokePass: boolean;
  smokeOutput: string;
  securityPass: boolean;
  securityFindings: Array<{
    file: string;
    line: number;
    rule: string;
    snippet: string;
  }>;
  overallPass: boolean;
  durationMs: number;
};

type QualityGateInput = {
  slug: string;
  files: Record<string, string>;
  sourcePath?: string;
};

type QualityGateOptions = {
  skipSmoke?: boolean;
  timeoutMs?: number;
  continueOnFailure?: boolean;
  logDir?: string;
};

const runQualityGates: (
  input: QualityGateInput,
  opts?: QualityGateOptions,
) => Promise<QualityGateResult> = qg.runQualityGates;

// Cap each per-template gate at 45s. The canonical smoke gate boot time
// for settlegrid-500px is ~500ms on a warm cache, but programmatic tsc
// and tsx cold-start can push individual templates into the 10-20s range.
// 45s gives comfortable headroom without letting a runaway template wedge
// the whole batch.
const GATE_TIMEOUT_MS = 45_000;

// Audit logs from quality-gates' failure writer should NOT pollute the
// canonical docs/audit-failures/ tree. Redirect them to a scratch dir
// that the canonical-50.mjs orchestrator can sweep between runs.
const LOG_DIR = '/tmp/canonical-50-gate-logs';

async function main(): Promise<void> {
  const rl = createInterface({
    input: process.stdin,
    crlfDelay: Infinity,
  });

  for await (const rawLine of rl) {
    const dir = rawLine.trim();
    if (!dir) continue;

    // #14 — Defense-in-depth: reject paths that aren't absolute or contain
    // traversal segments. In production the orchestrator only pipes known
    // template directories, but a compromised stdin could try to read
    // arbitrary filesystem locations via sourcePath.
    if (!path.isAbsolute(dir) || dir.includes('..')) {
      process.stdout.write(
        JSON.stringify({ dir, error: `rejected: not an absolute path or contains '..'` }) + '\n',
      );
      continue;
    }

    const slug = path.basename(dir);
    try {
      const result = await runQualityGates(
        { slug, files: {}, sourcePath: dir },
        {
          timeoutMs: GATE_TIMEOUT_MS,
          continueOnFailure: true, // we want all three gate verdicts, not short-circuit
          logDir: LOG_DIR,
        },
      );
      process.stdout.write(
        JSON.stringify({
          dir,
          result: {
            tscPass: result.tscPass,
            smokePass: result.smokePass,
            securityPass: result.securityPass,
            overallPass: result.overallPass,
            tscErrorCount: result.tscErrors.length,
            securityFindingCount: result.securityFindings.length,
            durationMs: result.durationMs,
            smokeOutputFirst200: result.smokeOutput.slice(0, 200),
          },
        }) + '\n',
      );
    } catch (err) {
      process.stdout.write(
        JSON.stringify({
          dir,
          error: err instanceof Error ? err.message : String(err),
        }) + '\n',
      );
    }
  }
}

main().catch((err) => {
  process.stderr.write(
    `run-gates fatal: ${err instanceof Error ? err.message : String(err)}\n`,
  );
  process.exit(1);
});
