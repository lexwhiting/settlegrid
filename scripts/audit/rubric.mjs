/**
 * CANONICAL_50 rubric (P1.6)
 *
 * Pure scoring functions — zero I/O, fully deterministic, unit-testable.
 * Each function takes pre-parsed template material and returns an integer
 * score. The orchestrator (canonical-50.mjs) reads files from disk, parses
 * them, calls these functions, and writes outputs.
 *
 * Total: 100 points across 8 dimensions.
 *   readme       15
 *   tools        10
 *   schema       15
 *   gates        25
 *   deps         10
 *   docker       10
 *   category      5
 *   novelty      10
 */

// ---------------------------------------------------------------------------
// Dimension 1: README completeness (15 pts)
// ---------------------------------------------------------------------------

/**
 * Score README markdown completeness.
 *
 * @param {string | undefined | null} readme - README.md contents
 * @returns {{ score: number; reasons: string[] }}
 */
export function scoreReadme(readme) {
  const reasons = [];
  if (!readme || typeof readme !== 'string') {
    return { score: 0, reasons: ['README missing or unreadable'] };
  }

  let score = 0;

  // Required headings present (5 pts — 1 each for 5 standard sections)
  const headings = [
    /^#\s+settlegrid-/im, // H1 title with slug
    /^##\s+(Methods|Tools)\b/im, // methods/tools section
    /^##\s+(Parameters|Inputs|Arguments)\b/im, // parameters section
    /^##\s+(Environment Variables|Env Vars|Configuration)\b/im, // env section
    /^##\s+(Deploy|Installation|Getting Started|Quick Start)\b/im, // deploy section
  ];
  for (const heading of headings) {
    if (heading.test(readme)) score += 1;
    else reasons.push(`missing heading: ${String(heading)}`);
  }

  // SDK snippet present — fenced code block mentioning settlegrid.init
  // or the settlegrid package (5 pts)
  const sdkSnippet = /```[\s\S]*?(settlegrid\.init|@settlegrid\/mcp|sg\.wrap)[\s\S]*?```/i;
  if (sdkSnippet.test(readme)) {
    score += 5;
  } else {
    // Fall back: at least a fenced code block with a bash install command
    if (/```[\s\S]*?(npm install|npm run)[\s\S]*?```/.test(readme)) {
      score += 3;
    } else {
      reasons.push('no SDK snippet or install block in README');
    }
  }

  // Env vars documented (3 pts) — table or list mentioning SETTLEGRID_API_KEY
  if (/SETTLEGRID_API_KEY/.test(readme)) {
    score += 3;
  } else {
    reasons.push('SETTLEGRID_API_KEY not documented in README');
  }

  // Example request/response or parameter rows (2 pts)
  // Detect via markdown table rows with at least one `| ... | ... |` pattern
  // that looks like parameter documentation.
  const tableRow = /^\|[^|\n]+\|[^|\n]+\|/m;
  if (tableRow.test(readme)) {
    score += 2;
  } else {
    reasons.push('no parameter/example table in README');
  }

  return { score, reasons };
}

// ---------------------------------------------------------------------------
// Dimension 2: Tool count (10 pts)
// ---------------------------------------------------------------------------

/**
 * Score based on how many tools the template exposes. Counts `sg.wrap(...)`
 * occurrences in server.ts as the ground-truth tool list.
 *
 * @param {string | undefined | null} serverSource - src/server.ts contents
 * @returns {{ score: number; toolCount: number; reasons: string[] }}
 */
export function scoreToolCount(serverSource) {
  if (!serverSource || typeof serverSource !== 'string') {
    return { score: 0, toolCount: 0, reasons: ['server source missing'] };
  }
  // sg.wrap(...) or settlegrid.wrap(...) — match the wrap function call
  const wrapMatches = serverSource.match(/\bsg\.wrap\s*\(/g) || [];
  const toolCount = wrapMatches.length;
  let score;
  let reasons = [];
  if (toolCount >= 3) {
    score = 10;
  } else if (toolCount >= 1) {
    score = 5;
    reasons.push(`only ${toolCount} tool(s) — expected 3+`);
  } else {
    score = 0;
    reasons.push('zero tools defined (no sg.wrap calls)');
  }
  return { score, toolCount, reasons };
}

// ---------------------------------------------------------------------------
// Dimension 3: Schema completeness (15 pts)
// ---------------------------------------------------------------------------

/**
 * Score whether every tool has an input type and a displayName.
 *
 * Conventions:
 *   - Each tool's inputs are described by a TypeScript `interface XInput { ... }`
 *     or `type XInput = { ... }` declaration.
 *   - Each tool's `sg.wrap(fn, { method: '...', displayName: '...' })` options
 *     may include a displayName.
 *   - The settlegrid.init({ pricing: { methods: { foo: { displayName: '...' } } } })
 *     block is the more common place for displayName.
 *
 * Points:
 *   - 5 pts: every sg.wrap call has a typed args parameter ( `(args: XInput)` )
 *   - 5 pts: every method in settlegrid.init's pricing.methods has a displayName
 *   - 5 pts: server.ts has explicit `interface` or `type` declarations for each
 *     tool input (≥ toolCount interface declarations)
 *
 * @param {string | undefined | null} serverSource
 * @param {number} toolCount
 * @returns {{ score: number; reasons: string[] }}
 */
export function scoreSchemaCompleteness(serverSource, toolCount) {
  if (!serverSource || typeof serverSource !== 'string') {
    return { score: 0, reasons: ['server source missing'] };
  }
  if (toolCount === 0) {
    return { score: 0, reasons: ['no tools to check schema for'] };
  }

  let score = 0;
  const reasons = [];

  // Every sg.wrap must have a typed args parameter.
  // Match: sg.wrap(async (args: SomeInput) => ... or sg.wrap((args: SomeInput) => ...
  const typedWraps = (
    serverSource.match(/\bsg\.wrap\s*\(\s*async\s*\([^)]*:\s*[A-Z][A-Za-z0-9_<>]+[^)]*\)/g) || []
  ).length
    + (
      serverSource.match(/\bsg\.wrap\s*\(\s*\([^)]*:\s*[A-Z][A-Za-z0-9_<>]+[^)]*\)/g) || []
    ).length;
  if (typedWraps >= toolCount) {
    score += 5;
  } else {
    reasons.push(
      `only ${typedWraps}/${toolCount} tool handlers have a typed args parameter`,
    );
    // Partial credit proportional to coverage
    score += Math.round((5 * typedWraps) / toolCount);
  }

  // Every tool should have a displayName in pricing.methods. Heuristic:
  // count `displayName:` occurrences anywhere in the file; require ≥ toolCount.
  // Parsing the nested pricing.methods block with regex is brittle (variable
  // indentation, inline vs. multi-line); a global count is a good-enough
  // proxy that Templater-generated templates already satisfy.
  const displayNames = (serverSource.match(/\bdisplayName\s*:/g) || []).length;
  if (displayNames >= toolCount) {
    score += 5;
  } else {
    reasons.push(
      `only ${displayNames}/${toolCount} tools have a displayName`,
    );
    score += Math.round((5 * displayNames) / toolCount);
  }

  // Interface / type alias declarations: a rough "takes schemas seriously"
  // proxy. Require ≥ toolCount explicit type declarations in the file.
  // We don't insist on an `Input` suffix — some templates use `XArgs`,
  // `XParams`, or bare `X`.
  const interfaces = (serverSource.match(/\binterface\s+[A-Z]\w*/g) || []).length;
  const typeAliases = (serverSource.match(/\btype\s+[A-Z]\w*\s*=/g) || []).length;
  const declared = interfaces + typeAliases;
  if (declared >= toolCount) {
    score += 5;
  } else {
    reasons.push(
      `only ${declared}/${toolCount} tool input types declared`,
    );
    score += Math.round((5 * declared) / toolCount);
  }

  return { score, reasons };
}

// ---------------------------------------------------------------------------
// Dimension 4: Quality gates pass (25 pts)
// ---------------------------------------------------------------------------

/**
 * Map a QualityGateResult (from agents/shared/quality-gates.ts) to a 0–25
 * score. Partial credit:
 *   - all three gates pass        →  25
 *   - two gates pass              →  17
 *   - one gate passes             →   8
 *   - zero gates pass             →   0
 *
 * Low-severity security findings are advisory, so securityPass=true does not
 * depend on finding count. runQualityGates has already made that call.
 *
 * @param {{ tscPass: boolean; smokePass: boolean; securityPass: boolean } | null} gateResult
 * @returns {{ score: number; reasons: string[] }}
 */
export function scoreQualityGates(gateResult) {
  if (!gateResult) {
    return { score: 0, reasons: ['quality gates did not run'] };
  }
  const passes = [gateResult.tscPass, gateResult.smokePass, gateResult.securityPass]
    .filter(Boolean).length;
  const reasons = [];
  if (!gateResult.tscPass) reasons.push('tsc gate failed');
  if (!gateResult.smokePass) reasons.push('smoke gate failed');
  if (!gateResult.securityPass) reasons.push('security gate failed');
  // Scoring table: 3→25, 2→17, 1→8, 0→0
  const score = [0, 8, 17, 25][passes];
  return { score, reasons };
}

// ---------------------------------------------------------------------------
// Dimension 5: Dependency freshness (10 pts)
// ---------------------------------------------------------------------------

// Versions of @settlegrid/mcp considered current. The template is fine if it
// pins to any of these major/minor ranges.
const CURRENT_SDK_RANGES = [
  /^\^0\.1\./, // ^0.1.x
  /^~0\.1\./, // ~0.1.x
];

// Packages we know to be deprecated or unwanted in templates.
const DEPRECATED_PACKAGES = new Set([
  'request', // archived
  'node-uuid', // replaced by uuid / crypto.randomUUID
  'left-pad', // community joke
  'jade', // renamed to pug
]);

/**
 * @param {Record<string, unknown> | null} pkgJson - parsed package.json
 * @returns {{ score: number; reasons: string[] }}
 */
export function scoreDependencyFreshness(pkgJson) {
  if (!pkgJson || typeof pkgJson !== 'object') {
    return { score: 0, reasons: ['package.json missing or malformed'] };
  }
  let score = 0;
  const reasons = [];

  const deps = /** @type {Record<string, string>} */ (
    pkgJson['dependencies'] || {}
  );
  const devDeps = /** @type {Record<string, string>} */ (
    pkgJson['devDependencies'] || {}
  );
  const allDeps = { ...deps, ...devDeps };

  // (4 pts) No unpinned "*" or "latest" anywhere
  const unpinned = Object.entries(allDeps).filter(
    ([, v]) => v === '*' || v === 'latest',
  );
  if (unpinned.length === 0) {
    score += 4;
  } else {
    reasons.push(
      `${unpinned.length} unpinned deps: ${unpinned.map(([k]) => k).join(', ')}`,
    );
  }

  // (3 pts) @settlegrid/mcp pinned to a current range
  const sdkVersion = deps['@settlegrid/mcp'];
  if (typeof sdkVersion === 'string' && CURRENT_SDK_RANGES.some((r) => r.test(sdkVersion))) {
    score += 3;
  } else if (typeof sdkVersion === 'string') {
    reasons.push(`@settlegrid/mcp range "${sdkVersion}" is not current`);
  } else {
    reasons.push('@settlegrid/mcp missing from dependencies');
  }

  // (3 pts) No deprecated packages
  const deprecated = Object.keys(allDeps).filter((k) => DEPRECATED_PACKAGES.has(k));
  if (deprecated.length === 0) {
    score += 3;
  } else {
    reasons.push(`deprecated deps present: ${deprecated.join(', ')}`);
  }

  return { score, reasons };
}

// ---------------------------------------------------------------------------
// Dimension 6: Dockerfile + vercel.json (10 pts)
// ---------------------------------------------------------------------------

/**
 * @param {string | undefined | null} dockerfile
 * @param {string | undefined | null} vercelJson - raw JSON string
 * @returns {{ score: number; reasons: string[] }}
 */
export function scoreDockerAndVercel(dockerfile, vercelJson) {
  let score = 0;
  const reasons = [];

  if (typeof dockerfile === 'string' && dockerfile.length > 0) {
    score += 2; // exists
    if (/FROM [^\s]+ AS builder/i.test(dockerfile)) {
      score += 2; // multi-stage
    } else {
      reasons.push('Dockerfile is not multi-stage (no "FROM ... AS builder")');
    }
    // Spec P1.6 literally says "PORT env" — require the `ENV PORT` directive.
    // `EXPOSE <port>` is not an env var, it's a port-metadata declaration.
    if (/^\s*ENV\s+PORT\b/im.test(dockerfile)) {
      score += 2;
    } else {
      reasons.push('Dockerfile has no ENV PORT directive');
    }
    if (/^\s*HEALTHCHECK\b/im.test(dockerfile)) {
      score += 2;
    } else {
      reasons.push('Dockerfile has no HEALTHCHECK directive');
    }
  } else {
    reasons.push('Dockerfile missing');
  }

  if (typeof vercelJson === 'string' && vercelJson.length > 0) {
    try {
      const parsed = JSON.parse(vercelJson);
      if (parsed && typeof parsed === 'object') {
        score += 2;
      } else {
        reasons.push('vercel.json is not a JSON object');
      }
    } catch {
      reasons.push('vercel.json is not valid JSON');
    }
  } else {
    reasons.push('vercel.json missing');
  }

  return { score, reasons };
}

// ---------------------------------------------------------------------------
// Dimension 7: Category + discoverability (5 pts)
// ---------------------------------------------------------------------------

/**
 * @param {Record<string, unknown> | null} pkgJson
 * @returns {{ score: number; reasons: string[] }}
 */
export function scoreDiscoverability(pkgJson) {
  if (!pkgJson || typeof pkgJson !== 'object') {
    return { score: 0, reasons: ['package.json missing'] };
  }
  let score = 0;
  const reasons = [];

  const keywords = Array.isArray(pkgJson['keywords']) ? pkgJson['keywords'] : [];
  // (2 pts) keywords non-empty
  if (keywords.length > 0) {
    score += 2;
  } else {
    reasons.push('keywords empty');
  }
  // (2 pts) more than just the 3 boilerplate keywords (settlegrid, mcp, ai)
  const nonBoilerplate = keywords.filter(
    (k) => typeof k === 'string' && !['settlegrid', 'mcp', 'ai'].includes(k),
  );
  if (nonBoilerplate.length >= 2) {
    score += 2;
  } else {
    reasons.push('fewer than 2 descriptive keywords beyond boilerplate');
  }
  // (1 pt) description is non-trivial (> 20 chars, not a copy of the slug)
  const desc = typeof pkgJson['description'] === 'string' ? pkgJson['description'] : '';
  if (desc.length > 20 && !/^settlegrid-\w+$/i.test(desc)) {
    score += 1;
  } else {
    reasons.push('description missing or too short');
  }

  return { score, reasons };
}

// ---------------------------------------------------------------------------
// Category classification (used for novelty scoring)
// ---------------------------------------------------------------------------

/**
 * Broad category taxonomy. Keyword-based matching: whichever category has
 * the most keyword hits (across package.json keywords + description text)
 * wins. Ties broken by the order of entries below.
 *
 * Keep this list stable across runs — it feeds into the rubric hash and
 * novelty scoring. Adding a new category retroactively renames templates.
 */
export const CATEGORY_KEYWORDS = {
  payments: ['payment', 'payments', 'billing', 'invoice', 'checkout', 'stripe', 'paypal', 'braintree'],
  crypto: ['crypto', 'cryptocurrency', 'bitcoin', 'ethereum', 'blockchain', 'nft', 'web3', 'token', 'defi', 'coin', 'wallet'],
  finance: ['finance', 'financial', 'banking', 'stocks', 'stock', 'trading', 'forex', 'market', 'fintech', 'earnings', 'sec-filings'],
  weather: ['weather', 'climate', 'forecast', 'meteorology', 'meteo', 'rainfall', 'temperature'],
  news: ['news', 'journalism', 'headlines', 'articles', 'publications', 'press-release'],
  'ai-ml': ['llm', 'gpt', 'anthropic', 'openai', 'huggingface', 'ml-model', 'ml'],
  maps: ['maps', 'geolocation', 'geocoding', 'routing', 'openstreetmap', 'osm', 'places', 'navigation'],
  social: ['social', 'twitter', 'reddit', 'facebook', 'instagram', 'linkedin', 'mastodon', 'threads', 'bluesky'],
  science: ['science', 'research', 'arxiv', 'pubmed', 'biology', 'chemistry', 'physics', 'astronomy', 'genomics'],
  health: ['health', 'medical', 'medicine', 'fitness', 'nutrition', 'hospital', 'patient', 'clinical'],
  government: ['government', 'civic', 'census', 'tax', 'irs', 'voting', 'politics', 'regulation', 'public-records'],
  data: ['data', 'dataset', 'database', 'analytics', 'open-data', 'public-data', 'bigquery', 'statistics'],
  travel: ['travel', 'flight', 'hotel', 'airline', 'tourism', 'booking', 'amtrak', 'transit', 'airport'],
  sports: ['sports', 'nba', 'nfl', 'mlb', 'nhl', 'soccer', 'football', 'basketball', 'baseball', 'tennis', 'golf', 'cricket'],
  entertainment: ['movie', 'music', 'game', 'tv', 'streaming', 'show', 'film', 'anime', 'manga', 'podcast', 'spotify', 'netflix'],
  security: ['security', 'vulnerability', 'cve', 'malware', 'threat', 'abuse', 'phishing', 'osint', 'infosec'],
  developer: ['github', 'gitlab', 'bitbucket', 'npm-registry', 'pypi', 'package-index', 'docker-hub', 'ci-cd'],
  photos: ['photo', 'photos', 'photography', 'unsplash', 'flickr', 'pexels', 'image-search', 'stock-photos'],
  food: ['food', 'recipe', 'restaurant', 'cuisine', 'cooking', 'spoonacular', 'edamam'],
  environment: ['environment', 'air-quality', 'emissions', 'pollution', 'carbon', 'sustainability', 'energy'],
  language: ['translation', 'language', 'dictionary', 'nlp', 'lexicon', 'wiktionary'],
  education: ['education', 'learning', 'university', 'college', 'course', 'student', 'scholarship'],
};

/**
 * @param {{ keywords?: unknown; description?: unknown }} pkgJson
 * @returns {string} category name
 */
export function classifyTemplate(pkgJson) {
  const keywords = Array.isArray(pkgJson?.keywords)
    ? pkgJson.keywords.filter((k) => typeof k === 'string')
    : [];
  const description = typeof pkgJson?.description === 'string' ? pkgJson.description : '';
  const text = [...keywords, description].join(' ').toLowerCase();

  let bestCategory = 'other';
  let bestScore = 0;
  for (const [cat, terms] of Object.entries(CATEGORY_KEYWORDS)) {
    const matches = terms.filter((t) => text.includes(t)).length;
    if (matches > bestScore) {
      bestScore = matches;
      bestCategory = cat;
    }
  }
  return bestCategory;
}

// ---------------------------------------------------------------------------
// Dimension 8: Novelty (10 pts)
// ---------------------------------------------------------------------------

/**
 * Novelty penalty — categories with MORE than 20 entries are penalized
 * (spec P1.6: "penalize categories with > 20 existing entries").
 *
 *   category size ≤ 20  → 10 pts (full)
 *   21 ≤ size ≤ 50      → linear fade, count=21 → 9, count=50 → 2
 *   size > 50           → 0 pts (category is saturated)
 *
 * The linear segment uses `Math.floor` (not round) so the very first
 * over-20 count produces a visible penalty rather than rounding back
 * up to 10 — important because the spec's boundary is strict (>, not ≥).
 *
 * @param {string} category
 * @param {Record<string, number>} categoryCounts - count of templates per category
 * @returns {{ score: number; reasons: string[] }}
 */
export function scoreNovelty(category, categoryCounts) {
  const count = categoryCounts[category] ?? 0;
  if (count <= 20) {
    return { score: 10, reasons: [] };
  }
  if (count > 50) {
    return {
      score: 0,
      reasons: [`category "${category}" has ${count} templates — saturated`],
    };
  }
  // Linear fade: size=21 → 9, size=50 → 2. Math.floor ensures count=21
  // produces a strict penalty.
  const faded = Math.floor(10 - ((count - 20) * 8) / 30);
  return {
    score: Math.max(2, Math.min(10, faded)),
    reasons: [`category "${category}" has ${count} templates — partial novelty credit`],
  };
}

// ---------------------------------------------------------------------------
// Aggregate scorer
// ---------------------------------------------------------------------------

/**
 * Sum the non-gate dimensions (readme + tools + schema + deps + docker +
 * category + novelty). Gates are computed separately because they require
 * running the child process. Pre-gate max = 75.
 *
 * @param {{
 *   readme: string | null;
 *   serverSource: string | null;
 *   pkgJson: Record<string, unknown> | null;
 *   dockerfile: string | null;
 *   vercelJson: string | null;
 *   category: string;
 *   categoryCounts: Record<string, number>;
 * }} input
 */
export function scoreNonGateDimensions(input) {
  const readme = scoreReadme(input.readme);
  const tools = scoreToolCount(input.serverSource);
  const schema = scoreSchemaCompleteness(input.serverSource, tools.toolCount);
  const deps = scoreDependencyFreshness(input.pkgJson);
  const docker = scoreDockerAndVercel(input.dockerfile, input.vercelJson);
  const disc = scoreDiscoverability(input.pkgJson);
  const novelty = scoreNovelty(input.category, input.categoryCounts);
  return {
    breakdown: {
      readme: readme.score,
      tools: tools.score,
      schema: schema.score,
      deps: deps.score,
      docker: docker.score,
      category: disc.score,
      novelty: novelty.score,
    },
    toolCount: tools.toolCount,
    reasons: [
      ...readme.reasons,
      ...tools.reasons,
      ...schema.reasons,
      ...deps.reasons,
      ...docker.reasons,
      ...disc.reasons,
      ...novelty.reasons,
    ],
    total:
      readme.score + tools.score + schema.score + deps.score + docker.score
        + disc.score + novelty.score,
  };
}

// ---------------------------------------------------------------------------
// Rubric hash — used for output reproducibility
// ---------------------------------------------------------------------------

/**
 * A version string that embeds the rubric structure. If the rubric changes,
 * the version must change so downstream consumers can detect stale results.
 */
export const RUBRIC_VERSION = '1.0.0';
