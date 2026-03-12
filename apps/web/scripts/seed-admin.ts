/**
 * Seed Script: Create enterprise developer account for SettleGrid
 *
 * Usage:
 *   pnpm -F web exec tsx scripts/seed-admin.ts
 *
 * Requires DATABASE_URL in .env.local or environment.
 * Creates developer with enterprise tier.
 */

import { db } from "../src/lib/db";
import { developers } from "../src/lib/db/schema";
import { eq } from "drizzle-orm";
import bcrypt from "bcryptjs";

const BCRYPT_ROUNDS = 12;

async function main() {
  const email = "lexwhiting@gmail.com";
  const password = process.env.SEED_PASSWORD;

  if (!password) {
    console.error("Error: SEED_PASSWORD environment variable is required.");
    console.error("Usage: SEED_PASSWORD='yourpassword' pnpm -F web exec tsx scripts/seed-admin.ts");
    process.exit(1);
  }

  // Check if developer already exists
  const existing = await db
    .select({ id: developers.id })
    .from(developers)
    .where(eq(developers.email, email))
    .limit(1);

  if (existing.length > 0) {
    console.log(`Developer ${email} already exists (id: ${existing[0].id}). Skipping.`);
    process.exit(0);
  }

  const passwordHash = await bcrypt.hash(password, BCRYPT_ROUNDS);

  // Create enterprise developer
  const [dev] = await db
    .insert(developers)
    .values({
      email,
      name: "Lex Whiting",
      passwordHash,
      tier: "enterprise",
      revenueSharePct: 90,
      publicProfile: true,
      publicBio: "Founder, Alerterra",
    })
    .returning({
      id: developers.id,
      email: developers.email,
      tier: developers.tier,
    });

  console.log(`Created developer: ${dev.email} (id: ${dev.id}, tier: ${dev.tier})`);
  console.log("\nEnterprise developer account ready. Login at /login");

  process.exit(0);
}

main().catch((err) => {
  console.error("Seed failed:", err.message);
  process.exit(1);
});
