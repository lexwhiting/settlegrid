/**
 * Seed Script: Populate SettleGrid dashboard with visually impressive demo data
 *
 * Usage:
 *   npx tsx apps/web/scripts/seed-dashboard-data.ts
 *
 * Requires DATABASE_URL in .env.local or environment.
 * Seeds tools, consumers, invocations, purchases, payouts, audit logs,
 * reviews, and health checks for the lexwhiting@gmail.com developer.
 */

import fs from "fs";
import path from "path";
import crypto from "crypto";
import postgres from "postgres";

// ── Load .env.local manually (no dotenv dependency) ─────────────────────────
const envPath = path.resolve(__dirname, "../.env.local");
if (fs.existsSync(envPath)) {
  const envContent = fs.readFileSync(envPath, "utf-8");
  for (const line of envContent.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eqIdx = trimmed.indexOf("=");
    if (eqIdx === -1) continue;
    const key = trimmed.slice(0, eqIdx).trim();
    let val = trimmed.slice(eqIdx + 1).trim();
    // Strip surrounding quotes
    if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
      val = val.slice(1, -1);
    }
    if (!process.env[key]) {
      process.env[key] = val;
    }
  }
}

const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) {
  console.error("Error: DATABASE_URL not found in environment or .env.local");
  process.exit(1);
}

const sql = postgres(DATABASE_URL, {
  max: 3,
  ssl: { rejectUnauthorized: false },
  prepare: false,
  idle_timeout: 10,
  connect_timeout: 10,
});

// ── Helpers ─────────────────────────────────────────────────────────────────

function uuid(): string {
  return crypto.randomUUID();
}

function randomInt(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function randomChoice<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

function daysAgo(days: number): Date {
  const d = new Date();
  d.setDate(d.getDate() - days);
  return d;
}

function hoursAgo(hours: number): Date {
  const d = new Date();
  d.setHours(d.getHours() - hours);
  return d;
}

function randomDateInRange(start: Date, end: Date): Date {
  const startMs = start.getTime();
  const endMs = end.getTime();
  return new Date(startMs + Math.random() * (endMs - startMs));
}

function fakeStripeSessionId(): string {
  return `cs_test_${crypto.randomBytes(16).toString("hex")}`;
}

function fakeStripeTransferId(): string {
  return `tr_${crypto.randomBytes(12).toString("hex")}`;
}

function fakeStripePaymentIntentId(): string {
  return `pi_${crypto.randomBytes(12).toString("hex")}`;
}

function fakeKeyHash(): string {
  return crypto.randomBytes(32).toString("hex");
}

function fakeKeyPrefix(): string {
  return `sg_${crypto.randomBytes(4).toString("hex")}`;
}

// ── Tool definitions ────────────────────────────────────────────────────────

interface ToolDef {
  name: string;
  slug: string;
  category: string;
  description: string;
  priceCents: number;
  version: string;
  methods: string[];
  tags: string[];
}

const TOOL_DEFS: ToolDef[] = [
  {
    name: "Code Reviewer Pro",
    slug: "code-reviewer-pro",
    category: "code",
    description: "AI-powered code review with security analysis, style enforcement, and vulnerability detection",
    priceCents: 10,
    version: "2.1.0",
    methods: ["review", "analyze", "scan"],
    tags: ["code-quality", "security", "ai", "devtools"],
  },
  {
    name: "Data Enrichment API",
    slug: "data-enrichment",
    category: "data",
    description: "Enrich company and contact data in real-time with firmographics, technographics, and intent signals",
    priceCents: 25,
    version: "1.4.2",
    methods: ["enrich", "search", "lookup"],
    tags: ["enrichment", "b2b", "contacts", "firmographics"],
  },
  {
    name: "Image Classifier",
    slug: "image-classifier",
    category: "image",
    description: "Multi-label image classification with confidence scores, NSFW detection, and object recognition",
    priceCents: 5,
    version: "3.0.0",
    methods: ["classify", "detect", "analyze"],
    tags: ["computer-vision", "ml", "classification", "images"],
  },
  {
    name: "Translation Engine",
    slug: "translation-engine",
    category: "nlp",
    description: "Neural machine translation for 95 languages with context-aware quality scoring",
    priceCents: 8,
    version: "1.8.1",
    methods: ["translate", "detect_language", "batch_translate"],
    tags: ["nlp", "translation", "languages", "localization"],
  },
  {
    name: "Market Sentinel",
    slug: "market-sentinel",
    category: "finance",
    description: "Real-time market data, sentiment analysis, and price movement alerts across 40+ exchanges",
    priceCents: 15,
    version: "2.3.0",
    methods: ["query", "analyze", "alert", "stream"],
    tags: ["finance", "markets", "sentiment", "real-time"],
  },
];

// ── Consumer definitions ────────────────────────────────────────────────────

interface ConsumerDef {
  email: string;
  toolCount: number; // how many tools they use (randomly selected)
}

const CONSUMER_DEFS: ConsumerDef[] = [
  { email: "dev@acmecorp.io", toolCount: 4 },
  { email: "api@techstart.co", toolCount: 3 },
  { email: "engineering@dataflow.dev", toolCount: 2 },
  { email: "ml-team@neuralnest.ai", toolCount: 3 },
  { email: "platform@cloudpeak.io", toolCount: 4 },
  { email: "backend@swiftcode.dev", toolCount: 2 },
  { email: "infra@scaleworks.co", toolCount: 3 },
  { email: "product@insightlab.ai", toolCount: 2 },
  { email: "devops@shipfast.io", toolCount: 3 },
  { email: "data@analytica.co", toolCount: 4 },
  { email: "api@buildright.dev", toolCount: 2 },
  { email: "ops@quantumleap.ai", toolCount: 3 },
];

// ── Review templates ────────────────────────────────────────────────────────

const REVIEWS = [
  { rating: 5, comment: "Incredibly fast and accurate. Replaced our entire manual review pipeline. The security analysis alone is worth it." },
  { rating: 5, comment: "Best enrichment API we have used. Data quality is consistently high and the firmographics coverage is excellent." },
  { rating: 4, comment: "Great classification accuracy. Would love to see support for custom model fine-tuning in the next release." },
  { rating: 5, comment: "Translation quality rivals Google Translate but at a fraction of the cost. The context-aware scoring is a game changer." },
  { rating: 4, comment: "Solid market data API. Real-time alerts work flawlessly. Would appreciate more historical data depth." },
  { rating: 5, comment: "We process 50K+ reviews per day through this. Latency is consistently under 100ms. Outstanding reliability." },
  { rating: 4, comment: "Good API design, excellent documentation. The SDK made integration a breeze. Minor issue with batch rate limits." },
  { rating: 5, comment: "Moved our entire NLP pipeline here. Cost savings of 60% compared to our previous provider with better accuracy." },
  { rating: 5, comment: "The sentiment analysis is remarkably nuanced. Handles sarcasm and context better than anything else we have tested." },
  { rating: 4, comment: "Reliable and well-maintained. The changelog transparency and versioning approach gives us confidence to depend on this." },
  { rating: 5, comment: "Enterprise-grade quality at startup-friendly pricing. The per-call model means we only pay for what we use." },
  { rating: 4, comment: "Good overall. Response times are great. Would love webhook support for async classification results." },
];

// ── Audit log templates ─────────────────────────────────────────────────────

const AUDIT_ACTIONS = [
  { action: "tool.created", resourceType: "tool", details: { version: "1.0.0" } },
  { action: "tool.updated", resourceType: "tool", details: { field: "description" } },
  { action: "tool.updated", resourceType: "tool", details: { field: "pricing", oldCents: 8, newCents: 10 } },
  { action: "tool.status_changed", resourceType: "tool", details: { from: "draft", to: "active" } },
  { action: "key.created", resourceType: "apiKey", details: { prefix: "sg_a1b2" } },
  { action: "key.created", resourceType: "apiKey", details: { prefix: "sg_c3d4" } },
  { action: "key.revoked", resourceType: "apiKey", details: { reason: "rotation" } },
  { action: "payout.triggered", resourceType: "payout", details: { amountCents: 18000 } },
  { action: "payout.triggered", resourceType: "payout", details: { amountCents: 34000 } },
  { action: "payout.completed", resourceType: "payout", details: { amountCents: 52000 } },
  { action: "settings.updated", resourceType: "settings", details: { field: "payoutSchedule", value: "monthly" } },
  { action: "settings.updated", resourceType: "settings", details: { field: "publicProfile", value: true } },
  { action: "webhook.created", resourceType: "webhook", details: { url: "https://hooks.acmecorp.io/settlegrid" } },
  { action: "webhook.updated", resourceType: "webhook", details: { field: "events" } },
  { action: "tool.version_published", resourceType: "tool", details: { version: "2.1.0" } },
  { action: "tool.version_published", resourceType: "tool", details: { version: "1.4.2" } },
  { action: "settings.updated", resourceType: "settings", details: { field: "notificationPreferences" } },
  { action: "tool.created", resourceType: "tool", details: { version: "1.0.0", slug: "image-classifier" } },
  { action: "tool.status_changed", resourceType: "tool", details: { from: "draft", to: "active" } },
  { action: "key.created", resourceType: "apiKey", details: { prefix: "sg_e5f6", testKey: true } },
  { action: "settings.updated", resourceType: "settings", details: { field: "stripeConnect", status: "active" } },
  { action: "tool.updated", resourceType: "tool", details: { field: "tags" } },
  { action: "payout.triggered", resourceType: "payout", details: { amountCents: 89000 } },
  { action: "tool.created", resourceType: "tool", details: { version: "1.0.0", slug: "market-sentinel" } },
  { action: "tool.updated", resourceType: "tool", details: { field: "healthEndpoint" } },
  { action: "settings.updated", resourceType: "settings", details: { field: "payoutMinimumCents", value: 2500 } },
  { action: "key.revoked", resourceType: "apiKey", details: { reason: "compromised" } },
  { action: "webhook.created", resourceType: "webhook", details: { url: "https://api.techstart.co/webhooks/sg" } },
  { action: "tool.status_changed", resourceType: "tool", details: { from: "draft", to: "active" } },
  { action: "settings.updated", resourceType: "settings", details: { field: "revenueSharePct", value: 95 } },
  { action: "payout.completed", resourceType: "payout", details: { amountCents: 89000 } },
  { action: "tool.version_published", resourceType: "tool", details: { version: "3.0.0" } },
  { action: "key.created", resourceType: "apiKey", details: { prefix: "sg_g7h8" } },
  { action: "tool.updated", resourceType: "tool", details: { field: "description", slug: "translation-engine" } },
  { action: "settings.updated", resourceType: "settings", details: { field: "tier", from: "standard", to: "growth" } },
];

const IP_ADDRESSES = [
  "203.0.113.42", "198.51.100.17", "192.0.2.88", "203.0.113.195",
  "198.51.100.201", "192.0.2.33", "203.0.113.127", "198.51.100.64",
];

const USER_AGENTS = [
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 Chrome/122.0.0.0 Safari/537.36",
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/122.0.0.0 Safari/537.36",
  "SettleGrid-CLI/1.3.0 (Node.js 20.11.0)",
  "curl/8.4.0",
  "python-requests/2.31.0",
  "Mozilla/5.0 (X11; Linux x86_64; rv:123.0) Gecko/20100101 Firefox/123.0",
];

// ═══════════════════════════════════════════════════════════════════════════
// MAIN
// ═══════════════════════════════════════════════════════════════════════════

async function main() {
  console.log("SettleGrid Dashboard Data Seed");
  console.log("══════════════════════════════════════════\n");

  // ── Step 1: Find developer ────────────────────────────────────────────────
  console.log("1. Looking up developer lexwhiting@gmail.com...");
  const devRows = await sql`SELECT id, email, name FROM developers WHERE email = 'lexwhiting@gmail.com' LIMIT 1`;
  if (devRows.length === 0) {
    console.error("   ERROR: Developer lexwhiting@gmail.com not found. Run seed-admin.ts first.");
    process.exit(1);
  }
  const developerId = devRows[0].id;
  console.log(`   Found: ${devRows[0].name} (${developerId})\n`);

  // ── Step 2: Clean existing data ───────────────────────────────────────────
  console.log("2. Cleaning existing data for this developer...");
  // Delete tools (cascades to invocations, api_keys, consumer_tool_balances, purchases, reviews, health_checks)
  const deleted = await sql`DELETE FROM tools WHERE developer_id = ${developerId}`;
  console.log(`   Deleted ${deleted.count} existing tools (+ cascaded data)`);
  // Delete payouts
  await sql`DELETE FROM payouts WHERE developer_id = ${developerId}`;
  console.log("   Deleted existing payouts");
  // Delete audit logs
  await sql`DELETE FROM audit_logs WHERE developer_id = ${developerId}`;
  console.log("   Deleted existing audit logs\n");

  // ── Step 3: Create tools ──────────────────────────────────────────────────
  console.log("3. Creating 5 tools...");
  const toolIds: Record<string, string> = {};
  for (const t of TOOL_DEFS) {
    const id = uuid();
    toolIds[t.slug] = id;
    const pricingConfig = JSON.stringify({
      defaultCostCents: t.priceCents,
      methods: Object.fromEntries(t.methods.map((m) => [m, t.priceCents])),
    });
    await sql`
      INSERT INTO tools (id, developer_id, name, slug, description, category, tags, pricing_config, status, current_version, health_endpoint, created_at, updated_at)
      VALUES (
        ${id}, ${developerId}, ${t.name}, ${t.slug}, ${t.description}, ${t.category},
        ${JSON.stringify(t.tags)}::jsonb, ${pricingConfig}::jsonb, 'active', ${t.version},
        ${"https://api.settlegrid.ai/health/" + t.slug},
        ${daysAgo(randomInt(25, 60)).toISOString()}::timestamptz,
        ${daysAgo(randomInt(0, 3)).toISOString()}::timestamptz
      )
    `;
    console.log(`   + ${t.name} (${t.slug}) — $${(t.priceCents / 100).toFixed(2)}/call`);
  }
  console.log();

  // ── Step 4: Create consumers ──────────────────────────────────────────────
  console.log("4. Creating 12 consumers...");
  const consumerIds: string[] = [];
  for (const c of CONSUMER_DEFS) {
    const id = uuid();
    await sql`
      INSERT INTO consumers (id, email, created_at)
      VALUES (${id}, ${c.email}, ${daysAgo(randomInt(15, 45)).toISOString()}::timestamptz)
      ON CONFLICT (email) DO UPDATE SET id = consumers.id
      RETURNING id
    `.then((rows) => {
      consumerIds.push(rows[0].id);
    });
  }
  console.log(`   Created/found ${consumerIds.length} consumers\n`);

  // ── Step 5: Create consumer tool balances + API keys ──────────────────────
  console.log("5. Creating consumer tool balances and API keys...");
  // Track which consumer has which tools (for invocations/purchases/reviews)
  interface ConsumerTool {
    consumerId: string;
    toolSlug: string;
    toolId: string;
    apiKeyId: string;
  }
  const consumerTools: ConsumerTool[] = [];
  let totalBalances = 0;
  let totalKeys = 0;

  for (let ci = 0; ci < consumerIds.length; ci++) {
    const consumerId = consumerIds[ci];
    const def = CONSUMER_DEFS[ci];
    // Pick random tools for this consumer
    const shuffled = [...TOOL_DEFS].sort(() => Math.random() - 0.5);
    const selectedTools = shuffled.slice(0, def.toolCount);

    for (const tool of selectedTools) {
      const toolId = toolIds[tool.slug];
      const balanceId = uuid();
      const autoRefill = Math.random() > 0.4;
      const refillAmount = randomChoice([1000, 2000, 5000, 10000]);
      const threshold = randomChoice([200, 500, 1000]);
      const spendingLimit = Math.random() > 0.5 ? randomChoice([5000, 10000, 25000, 50000]) : null;

      await sql`
        INSERT INTO consumer_tool_balances (id, consumer_id, tool_id, balance_cents, auto_refill, auto_refill_amount_cents, auto_refill_threshold_cents, spending_limit_cents, spending_limit_period, current_period_spend_cents)
        VALUES (
          ${balanceId}, ${consumerId}, ${toolId},
          ${randomInt(500, 8000)},
          ${autoRefill}, ${refillAmount}, ${threshold},
          ${spendingLimit}, ${spendingLimit ? randomChoice(["daily", "weekly", "monthly"]) : null},
          ${spendingLimit ? randomInt(0, Math.floor((spendingLimit as number) * 0.7)) : 0}
        )
        ON CONFLICT (consumer_id, tool_id) DO NOTHING
      `;
      totalBalances++;

      // Create 1-2 API keys per tool balance
      const keyCount = randomInt(1, 2);
      for (let k = 0; k < keyCount; k++) {
        const keyId = uuid();
        const isTest = k === 1 && Math.random() > 0.7;
        await sql`
          INSERT INTO api_keys (id, consumer_id, tool_id, key_hash, key_prefix, status, is_test_key, last_used_at, created_at)
          VALUES (
            ${keyId}, ${consumerId}, ${toolId},
            ${fakeKeyHash()}, ${fakeKeyPrefix()},
            'active', ${isTest},
            ${daysAgo(randomInt(0, 5)).toISOString()}::timestamptz,
            ${daysAgo(randomInt(10, 40)).toISOString()}::timestamptz
          )
        `;
        totalKeys++;
        // Only use the first (non-test) key for invocations
        if (k === 0) {
          consumerTools.push({ consumerId, toolSlug: tool.slug, toolId, apiKeyId: keyId });
        }
      }
    }
  }
  console.log(`   Created ${totalBalances} balances, ${totalKeys} API keys\n`);

  // ── Step 6: Create invocations (2,000+) ───────────────────────────────────
  console.log("6. Creating invocations (2,500 across 30 days)...");
  const TOTAL_INVOCATIONS = 2500;
  const now = new Date();
  const thirtyDaysAgo = daysAgo(30);

  // Precompute per-tool stats
  const toolStats: Record<string, { count: number; revenueCents: number }> = {};
  for (const t of TOOL_DEFS) {
    toolStats[t.slug] = { count: 0, revenueCents: 0 };
  }

  // Build all invocation rows in memory, then bulk insert
  const invocationRows: Array<{
    id: string;
    tool_id: string;
    consumer_id: string;
    api_key_id: string;
    method: string;
    cost_cents: number;
    latency_ms: number;
    status: string;
    is_test: boolean;
    is_flagged: boolean;
    session_id: string | null;
    created_at: string;
  }> = [];

  for (let i = 0; i < TOTAL_INVOCATIONS; i++) {
    // Growth trend: bias towards more recent dates
    // Use exponential distribution to concentrate more invocations in recent days
    const r = Math.random();
    const dayOffset = Math.floor(30 * Math.pow(r, 1.8)); // More weight on recent days
    const day = new Date(now);
    day.setDate(day.getDate() - dayOffset);

    // Weekend reduction
    const dow = day.getDay();
    if ((dow === 0 || dow === 6) && Math.random() > 0.4) {
      // Skip ~60% of weekend invocations to create weekday/weekend pattern
      day.setDate(day.getDate() - (dow === 0 ? 2 : 1)); // Move to Friday
    }

    // Random time of day (slight bias towards business hours)
    const hour = Math.random() > 0.3 ? randomInt(8, 20) : randomInt(0, 23);
    day.setHours(hour, randomInt(0, 59), randomInt(0, 59), randomInt(0, 999));

    const ct = randomChoice(consumerTools);
    const toolDef = TOOL_DEFS.find((t) => t.slug === ct.toolSlug)!;
    const method = randomChoice(toolDef.methods);

    // Status distribution: 97% success, 2% error, 1% timeout
    let status: string;
    const statusRoll = Math.random();
    if (statusRoll < 0.97) status = "success";
    else if (statusRoll < 0.99) status = "error";
    else status = "timeout";

    // Latency: mostly 30-80ms, some outliers
    let latency: number;
    if (status === "timeout") {
      latency = randomInt(5000, 30000);
    } else if (status === "error") {
      latency = randomInt(100, 500);
    } else {
      const latencyRoll = Math.random();
      if (latencyRoll < 0.7) latency = randomInt(30, 80);
      else if (latencyRoll < 0.9) latency = randomInt(80, 150);
      else latency = randomInt(150, 300);
    }

    const costCents = status === "success" ? toolDef.priceCents : 0;
    const isFlagged = Math.random() < 0.008; // ~0.8% flagged
    const sessionId = Math.random() > 0.6 ? `sess_${crypto.randomBytes(8).toString("hex")}` : null;

    invocationRows.push({
      id: uuid(),
      tool_id: ct.toolId,
      consumer_id: ct.consumerId,
      api_key_id: ct.apiKeyId,
      method,
      cost_cents: costCents,
      latency_ms: latency,
      status,
      is_test: false,
      is_flagged: isFlagged,
      session_id: sessionId,
      created_at: day.toISOString(),
    });

    if (costCents > 0) {
      toolStats[ct.toolSlug].count++;
      toolStats[ct.toolSlug].revenueCents += costCents;
    }
  }

  // Bulk insert invocations in batches of 200
  const BATCH_SIZE = 200;
  for (let b = 0; b < invocationRows.length; b += BATCH_SIZE) {
    const batch = invocationRows.slice(b, b + BATCH_SIZE);
    const values = batch
      .map(
        (r) =>
          `('${r.id}', '${r.tool_id}', '${r.consumer_id}', '${r.api_key_id}', '${r.method}', ${r.cost_cents}, ${r.latency_ms}, '${r.status}', ${r.is_test}, ${r.is_flagged}, ${r.session_id ? `'${r.session_id}'` : "NULL"}, '${r.created_at}'::timestamptz)`
      )
      .join(",\n    ");

    await sql.unsafe(`
      INSERT INTO invocations (id, tool_id, consumer_id, api_key_id, method, cost_cents, latency_ms, status, is_test, is_flagged, session_id, created_at)
      VALUES ${values}
    `);

    const progress = Math.min(b + BATCH_SIZE, invocationRows.length);
    process.stdout.write(`   Inserted ${progress}/${invocationRows.length} invocations\r`);
  }

  // Print tool stats
  let totalRevenue = 0;
  console.log("\n   Tool invocation summary:");
  for (const t of TOOL_DEFS) {
    const s = toolStats[t.slug];
    totalRevenue += s.revenueCents;
    console.log(`     ${t.name}: ${s.count} successful calls, $${(s.revenueCents / 100).toFixed(2)} revenue`);
  }
  console.log(`   Total revenue: $${(totalRevenue / 100).toFixed(2)}\n`);

  // ── Step 7: Update tool stats (includes historical revenue beyond seeded window) ─
  console.log("7. Updating tool totalInvocations and totalRevenueCents...");
  // Historical multipliers give each tool impressive lifetime totals
  // The seeded invocations represent only the last 30 days; tools have been live longer
  const historicalMultipliers: Record<string, { invocMul: number; revMul: number }> = {
    "code-reviewer-pro": { invocMul: 12, revMul: 12 },
    "data-enrichment": { invocMul: 8, revMul: 8 },
    "image-classifier": { invocMul: 18, revMul: 18 },
    "translation-engine": { invocMul: 14, revMul: 14 },
    "market-sentinel": { invocMul: 9, revMul: 9 },
  };
  let lifetimeRevenue = 0;
  for (const t of TOOL_DEFS) {
    const s = toolStats[t.slug];
    const m = historicalMultipliers[t.slug];
    const lifetimeInvocations = s.count * m.invocMul;
    const lifetimeRevenueCents = s.revenueCents * m.revMul;
    lifetimeRevenue += lifetimeRevenueCents;
    await sql`
      UPDATE tools
      SET total_invocations = ${lifetimeInvocations}, total_revenue_cents = ${lifetimeRevenueCents}, updated_at = NOW()
      WHERE id = ${toolIds[t.slug]}
    `;
    console.log(`   ${t.name}: ${lifetimeInvocations.toLocaleString()} lifetime calls, $${(lifetimeRevenueCents / 100).toFixed(2)} lifetime revenue`);
  }
  console.log(`   Total lifetime revenue: $${(lifetimeRevenue / 100).toFixed(2)}\n`);

  // ── Step 8: Create purchases ──────────────────────────────────────────────
  console.log("8. Creating purchases...");
  const purchaseAmounts = [1000, 2000, 2000, 5000, 5000, 5000, 10000, 10000, 2000, 1000, 5000, 2000, 10000, 5000, 2000, 1000, 5000];
  let purchaseCount = 0;
  for (const amount of purchaseAmounts) {
    const ct = randomChoice(consumerTools);
    const daysBack = randomInt(0, 29);
    const status = Math.random() > 0.1 ? "completed" : "pending";
    await sql`
      INSERT INTO purchases (id, consumer_id, tool_id, amount_cents, stripe_session_id, stripe_payment_intent_id, status, created_at)
      VALUES (
        ${uuid()}, ${ct.consumerId}, ${ct.toolId},
        ${amount}, ${fakeStripeSessionId()},
        ${status === "completed" ? fakeStripePaymentIntentId() : null},
        ${status},
        ${daysAgo(daysBack).toISOString()}::timestamptz
      )
    `;
    purchaseCount++;
  }
  console.log(`   Created ${purchaseCount} purchases\n`);

  // ── Step 9: Create payouts ────────────────────────────────────────────────
  console.log("9. Creating payouts...");
  const payoutData = [
    { amountCents: 18000, daysBack: 85, periodDays: 30 },
    { amountCents: 34000, daysBack: 55, periodDays: 30 },
    { amountCents: 52000, daysBack: 25, periodDays: 30 },
    { amountCents: 89000, daysBack: 2, periodDays: 25 },
  ];
  for (const p of payoutData) {
    const feeCents = Math.round(p.amountCents * 0.05);
    const periodEnd = daysAgo(p.daysBack);
    const periodStart = new Date(periodEnd);
    periodStart.setDate(periodStart.getDate() - p.periodDays);
    await sql`
      INSERT INTO payouts (id, developer_id, amount_cents, platform_fee_cents, stripe_transfer_id, period_start, period_end, status, created_at)
      VALUES (
        ${uuid()}, ${developerId},
        ${p.amountCents}, ${feeCents},
        ${fakeStripeTransferId()},
        ${periodStart.toISOString()}::timestamptz,
        ${periodEnd.toISOString()}::timestamptz,
        'completed',
        ${periodEnd.toISOString()}::timestamptz
      )
    `;
    console.log(`   + Payout $${(p.amountCents / 100).toFixed(2)} (fee: $${(feeCents / 100).toFixed(2)})`);
  }
  console.log();

  // ── Step 10: Create audit logs ────────────────────────────────────────────
  console.log("10. Creating audit logs...");
  const toolIdList = Object.values(toolIds);
  for (let i = 0; i < AUDIT_ACTIONS.length; i++) {
    const a = AUDIT_ACTIONS[i];
    const daysBack = Math.floor((AUDIT_ACTIONS.length - i) * (60 / AUDIT_ACTIONS.length)); // Spread over 60 days
    await sql`
      INSERT INTO audit_logs (id, developer_id, action, resource_type, resource_id, details, ip_address, user_agent, created_at)
      VALUES (
        ${uuid()}, ${developerId},
        ${a.action}, ${a.resourceType},
        ${randomChoice(toolIdList)},
        ${JSON.stringify(a.details)}::jsonb,
        ${randomChoice(IP_ADDRESSES)},
        ${randomChoice(USER_AGENTS)},
        ${daysAgo(daysBack).toISOString()}::timestamptz
      )
    `;
  }
  console.log(`   Created ${AUDIT_ACTIONS.length} audit log entries\n`);

  // ── Step 11: Create tool reviews ──────────────────────────────────────────
  console.log("11. Creating tool reviews...");
  let reviewCount = 0;
  const usedPairs = new Set<string>();
  for (const review of REVIEWS) {
    // Pick a random consumer and tool, avoiding duplicates
    let attempts = 0;
    let ct: ConsumerTool;
    do {
      ct = randomChoice(consumerTools);
      attempts++;
    } while (usedPairs.has(`${ct.consumerId}-${ct.toolId}`) && attempts < 50);

    if (attempts >= 50) continue;
    usedPairs.add(`${ct.consumerId}-${ct.toolId}`);

    await sql`
      INSERT INTO tool_reviews (id, tool_id, consumer_id, rating, comment, created_at, updated_at)
      VALUES (
        ${uuid()}, ${ct.toolId}, ${ct.consumerId},
        ${review.rating}, ${review.comment},
        ${daysAgo(randomInt(1, 25)).toISOString()}::timestamptz,
        ${daysAgo(randomInt(0, 3)).toISOString()}::timestamptz
      )
      ON CONFLICT (tool_id, consumer_id) DO NOTHING
    `;
    reviewCount++;
  }
  console.log(`   Created ${reviewCount} reviews\n`);

  // ── Step 12: Create health checks ─────────────────────────────────────────
  console.log("12. Creating health checks...");
  let healthCheckCount = 0;
  const sevenDaysAgo = daysAgo(7);
  for (const t of TOOL_DEFS) {
    const toolId = toolIds[t.slug];
    // One check every ~3 hours for 7 days = ~56 checks per tool
    for (let h = 0; h < 7 * 24; h += 3) {
      const checkedAt = hoursAgo(h + Math.random() * 0.5); // Slight jitter
      if (checkedAt < sevenDaysAgo) continue;

      const isHealthy = Math.random() > 0.05;
      const status = isHealthy ? "up" : "degraded";
      const responseTime = isHealthy ? randomInt(50, 200) : randomInt(200, 800);

      await sql`
        INSERT INTO tool_health_checks (id, tool_id, status, response_time_ms, checked_at)
        VALUES (${uuid()}, ${toolId}, ${status}, ${responseTime}, ${checkedAt.toISOString()}::timestamptz)
      `;
      healthCheckCount++;
    }
  }
  console.log(`   Created ${healthCheckCount} health checks\n`);

  // ── Step 13: Update developer stats ───────────────────────────────────────
  console.log("13. Updating developer profile...");
  await sql`
    UPDATE developers
    SET
      balance_cents = 28450,
      tier = 'growth',
      stripe_connect_status = 'active',
      public_profile = true,
      updated_at = NOW()
    WHERE id = ${developerId}
  `;
  console.log("   balance: $284.50");
  console.log("   tier: growth");
  console.log("   stripeConnectStatus: active");
  console.log("   publicProfile: true\n");

  // ── Summary ───────────────────────────────────────────────────────────────
  console.log("══════════════════════════════════════════");
  console.log("Seed complete!");
  console.log(`  5 tools`);
  console.log(`  ${consumerIds.length} consumers`);
  console.log(`  ${totalBalances} consumer-tool balances`);
  console.log(`  ${totalKeys} API keys`);
  console.log(`  ${TOTAL_INVOCATIONS} invocations`);
  console.log(`  ${purchaseCount} purchases`);
  console.log(`  4 payouts`);
  console.log(`  ${AUDIT_ACTIONS.length} audit logs`);
  console.log(`  ${reviewCount} reviews`);
  console.log(`  ${healthCheckCount} health checks`);
  console.log(`  30-day revenue: $${(totalRevenue / 100).toFixed(2)}`);
  console.log(`  Lifetime revenue: $${(lifetimeRevenue / 100).toFixed(2)}`);
  console.log("══════════════════════════════════════════");

  await sql.end();
  process.exit(0);
}

main().catch((err) => {
  console.error("\nSeed failed:", err.message);
  console.error(err.stack);
  sql.end().then(() => process.exit(1));
});
