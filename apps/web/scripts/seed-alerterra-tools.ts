/**
 * Seed Script: Insert 15 Alerterra ecosystem tools into SettleGrid
 *
 * Usage:
 *   npx tsx apps/web/scripts/seed-alerterra-tools.ts
 *
 * Requires DATABASE_URL in .env.local or environment.
 * Inserts tools under the lexwhiting@gmail.com developer account.
 * Idempotent: uses ON CONFLICT (slug) DO UPDATE to upsert.
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
    if (
      (val.startsWith('"') && val.endsWith('"')) ||
      (val.startsWith("'") && val.endsWith("'"))
    ) {
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

function daysAgo(days: number): Date {
  const d = new Date();
  d.setDate(d.getDate() - days);
  return d;
}

// ── Alerterra Tool Definitions ──────────────────────────────────────────────

interface AlerterraTool {
  name: string;
  slug: string;
  description: string;
  category: string;
  pricingConfig: { defaultCostCents: number; methods: Record<string, number> };
  currentVersion: string;
  status: string;
  tags: string[];
  totalInvocations: number;
  totalRevenueCents: number;
}

const ALERTERRA_TOOLS: AlerterraTool[] = [
  {
    name: "Scrutera Sanctions Screening",
    slug: "scrutera-sanctions",
    description:
      "Screen any person, organization, or vessel against OFAC SDN, EU Consolidated, UN Security Council, and UK HMT sanctions lists. Uses 6 matching algorithms: Levenshtein, Jaro-Winkler, Soundex, Double Metaphone, token-set ratio, and country risk boost.",
    category: "security",
    pricingConfig: { defaultCostCents: 5, methods: { screen: 5 } },
    currentVersion: "2.1.0",
    status: "active",
    tags: ["sanctions", "compliance", "AML", "KYC", "OFAC"],
    totalInvocations: 15000,
    totalRevenueCents: 75000,
  },
  {
    name: "Tradana AI Tariff Classifier",
    slug: "tradana-tariff-classifier",
    description:
      "Classify any product into its correct Harmonized System (HS) tariff code using a 4-step agentic AI pipeline with RAG retrieval of HTS data, customs rulings, and classification notes.",
    category: "finance",
    pricingConfig: { defaultCostCents: 25, methods: { classify: 25 } },
    currentVersion: "1.4.0",
    status: "active",
    tags: ["tariff", "HS code", "trade compliance", "classification", "AI"],
    totalInvocations: 4200,
    totalRevenueCents: 105000,
  },
  {
    name: "Gradara Country Risk Intelligence",
    slug: "gradara-country-risk",
    description:
      "Get a comprehensive risk profile for any of 195 countries across 9 dimensions: political, security, economic, governance, social, environmental, health, infrastructure, and terrorism. Includes composite scores, trends, and confidence levels.",
    category: "data",
    pricingConfig: { defaultCostCents: 2, methods: { profile: 2, scores: 1 } },
    currentVersion: "3.0.0",
    status: "active",
    tags: ["country risk", "geopolitical", "intelligence", "risk score"],
    totalInvocations: 28000,
    totalRevenueCents: 56000,
  },
  {
    name: "Vigila AI Risk Analyst",
    slug: "vigila-risk-analyst",
    description:
      "Get a comprehensive AI-generated risk assessment for any location or country, powered by Claude with access to real-time signals, government advisories, and historical incident data.",
    category: "data",
    pricingConfig: { defaultCostCents: 15, methods: { analyze: 15 } },
    currentVersion: "2.0.0",
    status: "active",
    tags: ["risk analysis", "AI", "threat intelligence", "geopolitical"],
    totalInvocations: 3800,
    totalRevenueCents: 57000,
  },
  {
    name: "Tradana Duty & Landed Cost Calculator",
    slug: "tradana-duty-calculator",
    description:
      "Calculate import duty rates, tariff schedules, and full landed cost for any HTS code from any country of origin. Includes multi-country comparison for sourcing optimization across up to 5 markets.",
    category: "finance",
    pricingConfig: { defaultCostCents: 3, methods: { calculate: 3, compare: 5 } },
    currentVersion: "1.2.0",
    status: "active",
    tags: ["duty", "landed cost", "tariff", "import", "trade"],
    totalInvocations: 8500,
    totalRevenueCents: 25500,
  },
  {
    name: "RegSeal AI Risk Classifier",
    slug: "regseal-ai-classifier",
    description:
      "Classify any AI system against EU AI Act, Colorado AI Act, and NIST AI RMF frameworks simultaneously. Returns risk tier, applicable regulations, compliance requirements, and gap analysis.",
    category: "compliance",
    pricingConfig: { defaultCostCents: 10, methods: { classify: 10 } },
    currentVersion: "1.1.0",
    status: "active",
    tags: [
      "AI compliance",
      "EU AI Act",
      "NIST",
      "regulation",
      "risk classification",
    ],
    totalInvocations: 2100,
    totalRevenueCents: 21000,
  },
  {
    name: "Scrutera PEP Screening",
    slug: "scrutera-pep",
    description:
      "Screen individuals against Politically Exposed Persons databases with fuzzy name matching, country filtering, and risk multiplier calculation for enhanced due diligence.",
    category: "security",
    pricingConfig: { defaultCostCents: 3, methods: { screen: 3 } },
    currentVersion: "2.0.0",
    status: "active",
    tags: ["PEP", "KYC", "AML", "due diligence", "compliance"],
    totalInvocations: 12000,
    totalRevenueCents: 36000,
  },
  {
    name: "Scrutera FATF Compliance Check",
    slug: "scrutera-fatf",
    description:
      "Check any country's FATF grey/black list status instantly. Get current grey list and black list members, compliance impact assessment, and jurisdiction risk scoring.",
    category: "compliance",
    pricingConfig: { defaultCostCents: 1, methods: { check: 1, list: 1 } },
    currentVersion: "1.3.0",
    status: "active",
    tags: ["FATF", "AML", "compliance", "jurisdiction risk"],
    totalInvocations: 45000,
    totalRevenueCents: 45000,
  },
  {
    name: "Gradara Risk Forecast Engine",
    slug: "gradara-risk-forecast",
    description:
      "Get ML-powered risk forecasts for any country over 30, 90, or 180 day horizons using an ensemble of TFT neural network and statistical methods with confidence intervals.",
    category: "analytics",
    pricingConfig: { defaultCostCents: 5, methods: { forecast: 5 } },
    currentVersion: "1.0.0",
    status: "active",
    tags: ["forecast", "ML", "prediction", "country risk", "time series"],
    totalInvocations: 6200,
    totalRevenueCents: 31000,
  },
  {
    name: "Scrutera Crypto Compliance",
    slug: "scrutera-crypto",
    description:
      "Screen crypto wallet addresses across 10 blockchains (Bitcoin, Ethereum, Tron, Solana, Polygon, Avalanche, Arbitrum, Optimism, Base, BNB Chain) for sanctions exposure, DeFi risk, and exchange jurisdiction risk.",
    category: "security",
    pricingConfig: { defaultCostCents: 10, methods: { screen: 10 } },
    currentVersion: "1.5.0",
    status: "active",
    tags: ["crypto", "blockchain", "sanctions", "DeFi", "compliance"],
    totalInvocations: 5500,
    totalRevenueCents: 55000,
  },
  {
    name: "Tradana Trade Sanctions Check",
    slug: "tradana-sanctions",
    description:
      "Screen entities against OFAC and OpenSanctions databases for trade compliance with match scoring, list identification, and export control classification.",
    category: "security",
    pricingConfig: { defaultCostCents: 3, methods: { screen: 3 } },
    currentVersion: "1.1.0",
    status: "active",
    tags: ["sanctions", "trade compliance", "OFAC", "export control"],
    totalInvocations: 9800,
    totalRevenueCents: 29400,
  },
  {
    name: "RegSeal Framework Crosswalk",
    slug: "regseal-crosswalk",
    description:
      "Map compliance requirements across AI governance frameworks — EU AI Act to NIST AI RMF to ISO 42001. Find which requirements in one framework satisfy requirements in another.",
    category: "compliance",
    pricingConfig: { defaultCostCents: 2, methods: { crosswalk: 2, frameworks: 1 } },
    currentVersion: "1.0.0",
    status: "active",
    tags: ["compliance", "crosswalk", "EU AI Act", "NIST", "ISO 42001"],
    totalInvocations: 3400,
    totalRevenueCents: 6800,
  },
  {
    name: "Vigila Threat Predictor",
    slug: "vigila-threat-predictor",
    description:
      "Detect emerging threats, analyze incident patterns, and identify causal chains for any country with configurable time windows (24h to 30 days) and three analysis modes.",
    category: "analytics",
    pricingConfig: { defaultCostCents: 15, methods: { predict: 15, analyze: 10 } },
    currentVersion: "1.2.0",
    status: "active",
    tags: [
      "threat intelligence",
      "prediction",
      "incident analysis",
      "security",
    ],
    totalInvocations: 2800,
    totalRevenueCents: 42000,
  },
  {
    name: "Scrutera TBML Detector",
    slug: "scrutera-tbml",
    description:
      "Analyze trade invoices for indicators of trade-based money laundering including over/under-invoicing, phantom shipments, multiple invoicing, and counterparty risk patterns.",
    category: "finance",
    pricingConfig: { defaultCostCents: 8, methods: { detect: 8 } },
    currentVersion: "1.0.0",
    status: "active",
    tags: [
      "TBML",
      "money laundering",
      "trade finance",
      "AML",
      "invoice analysis",
    ],
    totalInvocations: 1200,
    totalRevenueCents: 9600,
  },
  {
    name: "Gradara Risk Contagion Model",
    slug: "gradara-contagion",
    description:
      "Model how risk propagates from one country to its neighbors and trading partners across configurable dimensions (security, economic, political) with forecast horizons up to 180 days.",
    category: "analytics",
    pricingConfig: { defaultCostCents: 5, methods: { forecast: 5 } },
    currentVersion: "1.0.0",
    status: "active",
    tags: ["contagion", "risk propagation", "network effects", "geopolitical"],
    totalInvocations: 4100,
    totalRevenueCents: 20500,
  },
];

// ═══════════════════════════════════════════════════════════════════════════
// MAIN
// ═══════════════════════════════════════════════════════════════════════════

async function main() {
  console.log("SettleGrid — Alerterra Ecosystem Tools Seed");
  console.log("══════════════════════════════════════════════════\n");

  // ── Step 1: Find developer ──────────────────────────────────────────────
  console.log("1. Looking up developer lexwhiting@gmail.com...");
  const devRows = await sql`
    SELECT id, email, name FROM developers WHERE email = 'lexwhiting@gmail.com' LIMIT 1
  `;
  if (devRows.length === 0) {
    console.error(
      "   ERROR: Developer lexwhiting@gmail.com not found. Run seed-admin.ts first."
    );
    process.exit(1);
  }
  const developerId = devRows[0].id;
  console.log(`   Found: ${devRows[0].name} (${developerId})\n`);

  // ── Step 2: Upsert 15 Alerterra tools ─────────────────────────────────
  console.log("2. Upserting 15 Alerterra ecosystem tools...\n");

  let totalInvocations = 0;
  let totalRevenueCents = 0;
  let insertedCount = 0;
  let updatedCount = 0;

  for (const tool of ALERTERRA_TOOLS) {
    const id = uuid();
    const pricingConfigJson = JSON.stringify(tool.pricingConfig);
    const tagsJson = JSON.stringify(tool.tags);
    const healthEndpoint = `https://api.settlegrid.ai/health/${tool.slug}`;
    const createdAt = daysAgo(Math.floor(Math.random() * 35) + 25).toISOString();
    const updatedAt = daysAgo(Math.floor(Math.random() * 3)).toISOString();

    // Check if tool already exists
    const existing = await sql`SELECT id FROM tools WHERE slug = ${tool.slug} LIMIT 1`;

    if (existing.length > 0) {
      // Update existing tool
      await sql`
        UPDATE tools SET
          developer_id = ${developerId},
          name = ${tool.name},
          description = ${tool.description},
          category = ${tool.category},
          tags = ${tagsJson}::jsonb,
          pricing_config = ${pricingConfigJson}::jsonb,
          status = ${tool.status},
          current_version = ${tool.currentVersion},
          health_endpoint = ${healthEndpoint},
          total_invocations = ${tool.totalInvocations},
          total_revenue_cents = ${tool.totalRevenueCents},
          updated_at = NOW()
        WHERE slug = ${tool.slug}
      `;
      updatedCount++;
    } else {
      // Insert new tool
      await sql`
        INSERT INTO tools (
          id, developer_id, name, slug, description, category, tags,
          pricing_config, status, current_version, health_endpoint,
          total_invocations, total_revenue_cents, created_at, updated_at
        ) VALUES (
          ${id}, ${developerId}, ${tool.name}, ${tool.slug}, ${tool.description},
          ${tool.category}, ${tagsJson}::jsonb, ${pricingConfigJson}::jsonb,
          ${tool.status}, ${tool.currentVersion}, ${healthEndpoint},
          ${tool.totalInvocations}, ${tool.totalRevenueCents},
          ${createdAt}::timestamptz, ${updatedAt}::timestamptz
        )
      `;
      insertedCount++;
    }

    totalInvocations += tool.totalInvocations;
    totalRevenueCents += tool.totalRevenueCents;

    const revenue = (tool.totalRevenueCents / 100).toFixed(2);
    const invocStr = tool.totalInvocations.toLocaleString();
    const costStr = (tool.pricingConfig.defaultCostCents / 100).toFixed(2);
    const action = existing.length > 0 ? "updated" : "inserted";
    console.log(
      `   [${action}] ${tool.name} (${tool.slug}) — $${costStr}/call, ${invocStr} invocations, $${revenue} revenue`
    );
  }

  // ── Summary ─────────────────────────────────────────────────────────────
  console.log("\n══════════════════════════════════════════════════");
  console.log("Seed complete!");
  console.log(`  ${insertedCount} tools inserted, ${updatedCount} tools updated`);
  console.log(`  ${ALERTERRA_TOOLS.length} total Alerterra tools`);
  console.log(
    `  ${totalInvocations.toLocaleString()} total invocations across all tools`
  );
  console.log(`  $${(totalRevenueCents / 100).toFixed(2)} total revenue`);
  console.log("══════════════════════════════════════════════════");

  await sql.end();
  process.exit(0);
}

main().catch((err) => {
  console.error("\nSeed failed:", err.message);
  console.error(err.stack);
  sql.end().then(() => process.exit(1));
});
