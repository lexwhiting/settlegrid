import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import {
  scoreReadme,
  scoreToolCount,
  scoreSchemaCompleteness,
  scoreQualityGates,
  scoreDependencyFreshness,
  scoreDockerAndVercel,
  scoreDiscoverability,
  scoreNovelty,
  scoreNonGateDimensions,
  classifyTemplate,
  CATEGORY_KEYWORDS,
  RUBRIC_VERSION,
} from '../rubric.mjs';

// ---------------------------------------------------------------------------
// Fixtures — cribbed from the real settlegrid-500px template shape
// ---------------------------------------------------------------------------

const GOOD_README = `# settlegrid-500px

500px Photos MCP Server with per-call billing via [SettleGrid](https://settlegrid.ai).

## Quick Start

\`\`\`bash
npm install
cp .env.example .env
npm run dev
\`\`\`

\`\`\`ts
import { settlegrid } from '@settlegrid/mcp';
const sg = settlegrid.init({ toolSlug: '500px', pricing: { defaultCostCents: 1 } });
\`\`\`

## Methods

| Method | Description | Cost |
|--------|-------------|------|
| \`search_500px_photos(query, limit?)\` | Search photos | 1¢ |

## Parameters

### search_500px_photos
- \`query\` (string, required) — Search query

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| \`SETTLEGRID_API_KEY\` | Yes | Your SettleGrid API key |

## Deploy

\`\`\`bash
docker build -t settlegrid-500px .
\`\`\`
`;

const GOOD_SERVER_TS = `
import { settlegrid } from '@settlegrid/mcp'

interface SearchInput { query: string; limit?: number }
interface PopularInput { feature?: string; limit?: number }
interface TrendingInput { region?: string }

const sg = settlegrid.init({
  toolSlug: '500px',
  pricing: {
    defaultCostCents: 1,
    methods: {
      search_500px_photos: { costCents: 1, displayName: 'Search 500px Photos' },
      get_popular_photos: { costCents: 1, displayName: 'Popular 500px Photos' },
      get_trending_photos: { costCents: 1, displayName: 'Trending 500px Photos' },
    },
  },
})

const search = sg.wrap(async (args: SearchInput) => ({ q: args.query }), { method: 'search_500px_photos' })
const popular = sg.wrap(async (args: PopularInput) => ({ f: args.feature }), { method: 'get_popular_photos' })
const trending = sg.wrap(async (args: TrendingInput) => ({ r: args.region }), { method: 'get_trending_photos' })
`;

const GOOD_PKG = {
  name: 'settlegrid-500px',
  description: 'MCP server for 500px photo exploration with SettleGrid billing.',
  type: 'module',
  dependencies: { '@settlegrid/mcp': '^0.1.1' },
  devDependencies: { tsx: '^4.0.0', typescript: '^5.0.0' },
  keywords: ['settlegrid', 'mcp', 'ai', '500px', 'photos', 'photography', 'images'],
};

const GOOD_DOCKERFILE = `FROM node:20-alpine AS builder
WORKDIR /app
COPY package.json package-lock.json* ./
RUN npm ci
COPY tsconfig.json ./
COPY src/ ./src/
RUN npm run build

FROM node:20-alpine
WORKDIR /app
COPY package.json package-lock.json* ./
RUN npm ci --omit=dev
COPY --from=builder /app/dist ./dist
ENV NODE_ENV=production
ENV PORT=3000
EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=5s CMD node -e "process.exit(0)"
CMD ["node", "dist/server.js"]
`;

const GOOD_VERCEL = JSON.stringify({
  builds: [{ src: 'dist/server.js', use: '@vercel/node' }],
  routes: [{ src: '/(.*)', dest: 'dist/server.js' }],
});

// ---------------------------------------------------------------------------
// scoreReadme
// ---------------------------------------------------------------------------

describe('scoreReadme', () => {
  test('full-featured README scores 15/15', () => {
    const { score, reasons } = scoreReadme(GOOD_README);
    assert.equal(score, 15);
    assert.equal(reasons.length, 0);
  });

  test('empty README scores 0 with a reason', () => {
    const { score, reasons } = scoreReadme('');
    assert.equal(score, 0);
    assert.ok(reasons.length > 0);
  });

  test('null README scores 0', () => {
    const { score } = scoreReadme(null);
    assert.equal(score, 0);
  });

  test('README with headings but no code block loses 5 points for SDK snippet', () => {
    const minimal = `# settlegrid-x

## Methods
Some text.

## Parameters
Some text.

## Environment Variables
SETTLEGRID_API_KEY documented.

## Deploy
Some text.

| Variable | Value |
|----------|-------|
| A        | B     |
`;
    const { score } = scoreReadme(minimal);
    // 5 headings + 0 SDK + 3 envvar + 2 table = 10
    assert.equal(score, 10);
  });

  test('README with install block but no SDK snippet falls back to 3 points', () => {
    const fallback = GOOD_README.replace(
      /```ts[\s\S]*?```/,
      '```bash\nnpm install\n```',
    );
    const { score } = scoreReadme(fallback);
    // 5 headings + 3 fallback + 3 envvar + 2 table = 13
    assert.equal(score, 13);
  });

  test('README with no SETTLEGRID_API_KEY loses 3 envvar points', () => {
    const noKey = GOOD_README.replace(/SETTLEGRID_API_KEY/g, 'SOME_OTHER_KEY');
    const { score, reasons } = scoreReadme(noKey);
    assert.equal(score, 15 - 3);
    assert.ok(reasons.some((r) => r.includes('SETTLEGRID_API_KEY')));
  });
});

// ---------------------------------------------------------------------------
// scoreToolCount
// ---------------------------------------------------------------------------

describe('scoreToolCount', () => {
  test('3+ tools scores full 10', () => {
    const { score, toolCount } = scoreToolCount(GOOD_SERVER_TS);
    assert.equal(score, 10);
    assert.equal(toolCount, 3);
  });

  test('1 tool scores 5', () => {
    const src = 'const a = sg.wrap(async () => {}, { method: "x" })';
    const { score, toolCount } = scoreToolCount(src);
    assert.equal(toolCount, 1);
    assert.equal(score, 5);
  });

  test('2 tools scores 5', () => {
    const src = 'sg.wrap(fn1, { method: "a" }); sg.wrap(fn2, { method: "b" });';
    const { score, toolCount } = scoreToolCount(src);
    assert.equal(toolCount, 2);
    assert.equal(score, 5);
  });

  test('0 tools scores 0', () => {
    const { score } = scoreToolCount('import { settlegrid } from "@settlegrid/mcp";');
    assert.equal(score, 0);
  });

  test('null source returns 0 with a reason', () => {
    const { score, reasons, toolCount } = scoreToolCount(null);
    assert.equal(score, 0);
    assert.equal(toolCount, 0);
    assert.ok(reasons.length > 0);
  });
});

// ---------------------------------------------------------------------------
// scoreSchemaCompleteness
// ---------------------------------------------------------------------------

describe('scoreSchemaCompleteness', () => {
  test('well-formed template scores 15/15', () => {
    const { score } = scoreSchemaCompleteness(GOOD_SERVER_TS, 3);
    assert.equal(score, 15);
  });

  test('untyped wrap handlers lose typed-args points', () => {
    const untyped = `
interface Foo { x: number }
const sg = settlegrid.init({ toolSlug: 'x', pricing: { defaultCostCents: 1, methods: { a: { costCents: 1, displayName: 'A' }, b: { costCents: 1, displayName: 'B' }, c: { costCents: 1, displayName: 'C' } } } })
sg.wrap(async (args) => {}, { method: 'a' })
sg.wrap(async (args) => {}, { method: 'b' })
sg.wrap(async (args) => {}, { method: 'c' })
`;
    const { score, reasons } = scoreSchemaCompleteness(untyped, 3);
    // 0 typed / 3 methods with displayName / 1 interface declared
    // typed: 0, display: 5, interfaces: round(5*1/3) = 2. Total: 7
    assert.equal(score, 7);
    assert.ok(reasons.some((r) => r.includes('typed args')));
  });

  test('missing displayNames loses partial display points', () => {
    const noDisplay = `
interface AInput { x: number }
interface BInput { y: number }
const sg = settlegrid.init({ toolSlug: 'x', pricing: { defaultCostCents: 1, methods: { a: { costCents: 1 }, b: { costCents: 1 } } } })
const a = sg.wrap(async (args: AInput) => ({ x: args.x }), { method: 'a' })
const b = sg.wrap(async (args: BInput) => ({ y: args.y }), { method: 'b' })
`;
    const { score } = scoreSchemaCompleteness(noDisplay, 2);
    // typed: 5, display: 0/2 (round to 0), interfaces: 5. Total: 10
    assert.equal(score, 10);
  });

  test('zero tools returns 0', () => {
    const { score } = scoreSchemaCompleteness(GOOD_SERVER_TS, 0);
    assert.equal(score, 0);
  });

  test('null server source returns 0', () => {
    const { score } = scoreSchemaCompleteness(null, 3);
    assert.equal(score, 0);
  });
});

// ---------------------------------------------------------------------------
// scoreQualityGates
// ---------------------------------------------------------------------------

describe('scoreQualityGates', () => {
  test('all three gates pass → 25', () => {
    const { score } = scoreQualityGates({
      tscPass: true, smokePass: true, securityPass: true,
    });
    assert.equal(score, 25);
  });

  test('two gates pass → 17', () => {
    const { score, reasons } = scoreQualityGates({
      tscPass: true, smokePass: false, securityPass: true,
    });
    assert.equal(score, 17);
    assert.deepEqual(reasons, ['smoke gate failed']);
  });

  test('one gate passes → 8', () => {
    const { score } = scoreQualityGates({
      tscPass: true, smokePass: false, securityPass: false,
    });
    assert.equal(score, 8);
  });

  test('zero gates pass → 0', () => {
    const { score } = scoreQualityGates({
      tscPass: false, smokePass: false, securityPass: false,
    });
    assert.equal(score, 0);
  });

  test('null result → 0 with reason', () => {
    const { score, reasons } = scoreQualityGates(null);
    assert.equal(score, 0);
    assert.ok(reasons[0].includes('did not run'));
  });
});

// ---------------------------------------------------------------------------
// scoreDependencyFreshness
// ---------------------------------------------------------------------------

describe('scoreDependencyFreshness', () => {
  test('clean package.json scores 10/10', () => {
    const { score } = scoreDependencyFreshness(GOOD_PKG);
    assert.equal(score, 10);
  });

  test('unpinned "*" dependency loses 4 points', () => {
    const pkg = { ...GOOD_PKG, dependencies: { '@settlegrid/mcp': '^0.1.1', lodash: '*' } };
    const { score, reasons } = scoreDependencyFreshness(pkg);
    assert.equal(score, 6);
    assert.ok(reasons.some((r) => r.includes('unpinned')));
  });

  test('unpinned "latest" loses 4 points', () => {
    const pkg = {
      ...GOOD_PKG,
      dependencies: { '@settlegrid/mcp': '^0.1.1' },
      devDependencies: { tsx: 'latest' },
    };
    const { score } = scoreDependencyFreshness(pkg);
    assert.equal(score, 6);
  });

  test('missing @settlegrid/mcp loses 3 points', () => {
    const pkg = { ...GOOD_PKG, dependencies: {} };
    const { score, reasons } = scoreDependencyFreshness(pkg);
    assert.equal(score, 7);
    assert.ok(reasons.some((r) => r.includes('@settlegrid/mcp missing')));
  });

  test('deprecated package loses 3 points', () => {
    const pkg = {
      ...GOOD_PKG,
      dependencies: { '@settlegrid/mcp': '^0.1.1', request: '^2.88.0' },
    };
    const { score, reasons } = scoreDependencyFreshness(pkg);
    assert.equal(score, 7);
    assert.ok(reasons.some((r) => r.includes('deprecated')));
  });

  test('null package returns 0 with reason', () => {
    const { score } = scoreDependencyFreshness(null);
    assert.equal(score, 0);
  });
});

// ---------------------------------------------------------------------------
// scoreDockerAndVercel
// ---------------------------------------------------------------------------

describe('scoreDockerAndVercel', () => {
  test('full-featured stack scores 10/10', () => {
    const { score } = scoreDockerAndVercel(GOOD_DOCKERFILE, GOOD_VERCEL);
    assert.equal(score, 10);
  });

  test('Dockerfile without HEALTHCHECK loses 2 points', () => {
    const noHealth = GOOD_DOCKERFILE.replace(/HEALTHCHECK[^\n]*\n/, '');
    const { score, reasons } = scoreDockerAndVercel(noHealth, GOOD_VERCEL);
    assert.equal(score, 8);
    assert.ok(reasons.some((r) => r.includes('HEALTHCHECK')));
  });

  test('single-stage Dockerfile loses multi-stage points', () => {
    const single = 'FROM node:20\nWORKDIR /app\nENV PORT=3000\nHEALTHCHECK CMD true\nCMD ["node","x.js"]';
    const { score } = scoreDockerAndVercel(single, GOOD_VERCEL);
    // exists:2 + multi:0 + ENV PORT:2 + HEALTHCHECK:2 + vercel:2 = 8
    assert.equal(score, 8);
  });

  test('Dockerfile with only EXPOSE (no ENV PORT) loses port points', () => {
    const exposeOnly = `FROM node:20 AS builder\nFROM node:20\nEXPOSE 3000\nHEALTHCHECK CMD true\nCMD ["node","x.js"]`;
    const { score, reasons } = scoreDockerAndVercel(exposeOnly, GOOD_VERCEL);
    // exists:2 + multi:2 + ENV PORT:0 + HEALTHCHECK:2 + vercel:2 = 8
    assert.equal(score, 8);
    assert.ok(reasons.some((r) => r.includes('ENV PORT')));
  });

  test('missing Dockerfile still scores vercel points', () => {
    const { score } = scoreDockerAndVercel(null, GOOD_VERCEL);
    assert.equal(score, 2);
  });

  test('invalid vercel.json loses 2 points', () => {
    const { score, reasons } = scoreDockerAndVercel(GOOD_DOCKERFILE, 'not valid json {');
    assert.equal(score, 8);
    assert.ok(reasons.some((r) => r.includes('vercel')));
  });
});

// ---------------------------------------------------------------------------
// scoreDiscoverability
// ---------------------------------------------------------------------------

describe('scoreDiscoverability', () => {
  test('rich keywords + description scores 5/5', () => {
    const { score } = scoreDiscoverability(GOOD_PKG);
    assert.equal(score, 5);
  });

  test('keywords with only boilerplate scores partial', () => {
    const pkg = { ...GOOD_PKG, keywords: ['settlegrid', 'mcp', 'ai'] };
    const { score, reasons } = scoreDiscoverability(pkg);
    // keywords non-empty:2 + only boilerplate:0 + desc:1 = 3
    assert.equal(score, 3);
    assert.ok(reasons.some((r) => r.includes('boilerplate')));
  });

  test('missing description loses 1 point', () => {
    const pkg = { ...GOOD_PKG, description: 'x' };
    const { score } = scoreDiscoverability(pkg);
    assert.equal(score, 4);
  });

  test('no keywords scores 0 for those two buckets', () => {
    const pkg = { ...GOOD_PKG, keywords: [] };
    const { score } = scoreDiscoverability(pkg);
    // 0 + 0 + 1 = 1
    assert.equal(score, 1);
  });
});

// ---------------------------------------------------------------------------
// classifyTemplate
// ---------------------------------------------------------------------------

describe('classifyTemplate', () => {
  test('crypto template classifies as crypto', () => {
    const pkg = {
      description: 'Cryptocurrency prices and exchange rates from Coinbase',
      keywords: ['settlegrid', 'mcp', 'ai', 'coinbase', 'crypto', 'bitcoin', 'prices'],
    };
    assert.equal(classifyTemplate(pkg), 'crypto');
  });

  test('weather template classifies as weather', () => {
    const pkg = {
      description: 'Weather forecast API for Brazil',
      keywords: ['settlegrid', 'mcp', 'ai', 'weather', 'forecast', 'brazil'],
    };
    assert.equal(classifyTemplate(pkg), 'weather');
  });

  test('template with no category keywords falls back to "other"', () => {
    const pkg = {
      description: 'Totally generic thing',
      keywords: ['settlegrid', 'mcp', 'ai', 'xyz'],
    };
    assert.equal(classifyTemplate(pkg), 'other');
  });

  test('multi-match picks the category with the most hits', () => {
    const pkg = {
      description: 'Stock trading and forex markets',
      keywords: ['settlegrid', 'mcp', 'ai', 'stocks', 'trading', 'forex', 'market'],
    };
    assert.equal(classifyTemplate(pkg), 'finance');
  });

  test('taxonomy includes at least 10 distinct categories', () => {
    assert.ok(Object.keys(CATEGORY_KEYWORDS).length >= 10);
  });
});

// ---------------------------------------------------------------------------
// scoreNovelty
// ---------------------------------------------------------------------------

describe('scoreNovelty', () => {
  test('small category gets full 10 points', () => {
    const { score } = scoreNovelty('payments', { payments: 5 });
    assert.equal(score, 10);
  });

  test('category of exactly 20 still gets full 10', () => {
    const { score } = scoreNovelty('weather', { weather: 20 });
    assert.equal(score, 10);
  });

  test('category of 21 gets a strict penalty below 10', () => {
    // Spec: "penalize categories with > 20 existing entries". The fade
    // must fire at count=21, not at count=22.
    const { score, reasons } = scoreNovelty('weather', { weather: 21 });
    assert.ok(score < 10, `expected score < 10 at count=21, got ${score}`);
    assert.ok(reasons.some((r) => r.includes('partial novelty credit')));
  });

  test('category of 30 gets partial credit', () => {
    const { score } = scoreNovelty('weather', { weather: 30 });
    // 10 - (10 * 8 / 30) = 10 - 2.67 ≈ 7
    assert.ok(score >= 6 && score <= 8);
  });

  test('category of 50 gets minimum 2', () => {
    const { score } = scoreNovelty('weather', { weather: 50 });
    assert.equal(score, 2);
  });

  test('saturated category (>50) gets 0', () => {
    const { score, reasons } = scoreNovelty('weather', { weather: 300 });
    assert.equal(score, 0);
    assert.ok(reasons.some((r) => r.includes('saturated')));
  });

  test('unknown category gets full credit (not in counts → 0 existing)', () => {
    const { score } = scoreNovelty('nonexistent', {});
    assert.equal(score, 10);
  });
});

// ---------------------------------------------------------------------------
// scoreNonGateDimensions — end-to-end aggregator
// ---------------------------------------------------------------------------

describe('scoreNonGateDimensions', () => {
  test('fully-featured template yields max non-gate total of 75', () => {
    const result = scoreNonGateDimensions({
      readme: GOOD_README,
      serverSource: GOOD_SERVER_TS,
      pkgJson: GOOD_PKG,
      dockerfile: GOOD_DOCKERFILE,
      vercelJson: GOOD_VERCEL,
      category: 'photos',
      categoryCounts: { photos: 3 },
    });
    assert.equal(result.total, 75);
    assert.equal(result.breakdown.readme, 15);
    assert.equal(result.breakdown.tools, 10);
    assert.equal(result.breakdown.schema, 15);
    assert.equal(result.breakdown.deps, 10);
    assert.equal(result.breakdown.docker, 10);
    assert.equal(result.breakdown.category, 5);
    assert.equal(result.breakdown.novelty, 10);
  });

  test('empty inputs yield total of 0 for the non-gate dimensions', () => {
    const result = scoreNonGateDimensions({
      readme: null,
      serverSource: null,
      pkgJson: null,
      dockerfile: null,
      vercelJson: null,
      category: 'other',
      categoryCounts: {},
    });
    // readme 0, tools 0, schema 0, deps 0, docker 0, category 0, novelty 10
    assert.equal(result.total, 10);
  });

  test('reasons are collected across all dimensions', () => {
    const result = scoreNonGateDimensions({
      readme: null,
      serverSource: null,
      pkgJson: null,
      dockerfile: null,
      vercelJson: null,
      category: 'saturated',
      categoryCounts: { saturated: 100 },
    });
    assert.ok(result.reasons.length > 0);
    assert.ok(result.reasons.some((r) => r.includes('README')));
    assert.ok(result.reasons.some((r) => r.includes('saturated')));
  });
});

// ---------------------------------------------------------------------------
// Rubric version constant
// ---------------------------------------------------------------------------

describe('rubric metadata', () => {
  test('RUBRIC_VERSION is a semver string', () => {
    assert.match(RUBRIC_VERSION, /^\d+\.\d+\.\d+$/);
  });
});
