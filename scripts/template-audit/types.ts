/**
 * Template Audit — shared types and rule interface.
 *
 * The audit is a rule-based verdict engine over the 1,022-template corpus
 * under open-source-servers/. Every rule is a self-contained module that
 * carries its own known-good + known-bad fixtures so the meta-audit can
 * validate the rule itself before applying it to the corpus.
 *
 * Three layers:
 *   Layer 1 — Rules     : cheap/fast checks (structural, SDK, content, pollution,
 *                         metadata, manifest, originality) + stub for executable
 *                         (TSC/smoke) gates that delegate to existing infra.
 *   Layer 2 — Orchestrator: walks the corpus, invokes every rule on every
 *                         template, aggregates findings, assigns verdicts.
 *   Layer 3 — Meta-audit: validates Layer 1 + Layer 2 before trusting them.
 *                         Runs per-rule fixture checks, verdict-invariant
 *                         assertions, dead-rule detection, determinism checks.
 */

export type Severity = 'fatal' | 'high' | 'medium' | 'low';

export type Verdict = 'KEEP' | 'REVIEW' | 'REMOVE';

export interface RuleFinding {
  ruleId: string;
  severity: Severity;
  message: string;
  evidence?: RuleEvidence;
}

export interface RuleEvidence {
  file?: string;
  line?: number;
  snippet?: string;
  /** Arbitrary structured data for JSON reporters. */
  data?: Record<string, unknown>;
}

/**
 * Input handed to each rule. `files` is the pre-loaded content map keyed by
 * template-relative POSIX path. Rules may request additional files via
 * `readFile` but the orchestrator pre-loads the common set to minimize I/O.
 */
export interface TemplateInput {
  slug: string;
  absPath: string;
  files: Map<string, string>;
  /**
   * Corpus-wide lookups for cross-template rules (originality, collision).
   * Populated by the orchestrator before any rule runs.
   */
  corpus: CorpusIndex;
  /** Hash computed by the orchestrator for originality comparisons. */
  normalizedSourceHash: string;
  normalizedReadmeHash: string;
}

export interface CorpusIndex {
  /** Map of normalized-source-hash → list of slugs sharing that hash. */
  sourceHashIndex: Map<string, string[]>;
  /** Map of normalized-readme-hash → list of slugs sharing that hash. */
  readmeHashIndex: Map<string, string[]>;
  /** Slugs that carry a P2.6-shaped template.json (CANONICAL_20 membership). */
  canonicalSlugs: Set<string>;
  totalTemplates: number;
}

/**
 * A fixture is a fake template tree (file-map) that a rule MUST pass
 * (knownGood) or fail (knownBad). The meta-audit runs each rule against its
 * fixtures before the orchestrator trusts it with the real corpus.
 */
export interface Fixture {
  description: string;
  files: Record<string, string>;
  /**
   * For knownGood: expected findings from this rule MUST be 0 OR meet
   * `toleratedFindings` (defaults to 0).
   * For knownBad: expected findings from this rule MUST be >= `minFindings`
   * (defaults to 1).
   */
  minFindings?: number;
  maxFindings?: number;
}

export interface RuleFixtures {
  knownGood: Fixture;
  knownBad: Fixture;
}

export interface Rule {
  id: string;
  description: string;
  severity: Severity;
  /** Categorization for grouped reporting. */
  category: RuleCategory;
  fixtures: RuleFixtures;
  check(input: TemplateInput): Promise<RuleFinding[]>;
}

export type RuleCategory =
  | 'structural'
  | 'sdk-integration'
  | 'content-depth'
  | 'pollution'
  | 'metadata'
  | 'manifest'
  | 'originality'
  | 'executable';

export interface VerdictResult {
  slug: string;
  absPath: string;
  verdict: Verdict;
  confidence: number;
  findings: RuleFinding[];
  /** Human-readable bullets summarizing why this verdict was chosen. */
  reasons: string[];
  isCanonical: boolean;
}

export interface CorpusReport {
  runId: string;
  startedAt: string;
  completedAt: string;
  durationMs: number;
  totalTemplates: number;
  verdictCounts: Record<Verdict, number>;
  /** Per-rule activation counts across the corpus. */
  ruleActivations: Record<string, number>;
  /** Top 10 clusters of failures, grouped by ruleId. */
  topFailureClusters: Array<{ ruleId: string; count: number; severity: Severity }>;
  /** Per-template verdict records (path to on-disk per-template JSON is also emitted). */
  perTemplate: VerdictResult[];
  /** Meta-audit summary. */
  metaAudit: MetaAuditReport;
}

export interface MetaAuditReport {
  passed: boolean;
  ruleFixtureChecks: Array<{
    ruleId: string;
    knownGoodPassed: boolean;
    knownBadRejected: boolean;
    details?: string;
  }>;
  deadRules: string[];
  contradictions: Array<{ template: string; ruleAId: string; ruleBId: string; reason: string }>;
  determinism: { runTwicePassed: boolean; diffCount: number };
  verdictInvariant: {
    sumMatchesTotal: boolean;
    everyTemplateHasVerdict: boolean;
    duplicateSlugs: string[];
  };
}
