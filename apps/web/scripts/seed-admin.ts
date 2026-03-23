/**
 * Seed Script: Create enterprise developer account for SettleGrid (Supabase auth)
 *
 * Usage:
 *   SUPABASE_USER_ID='uuid-xxx' pnpm -F web exec tsx scripts/seed-admin.ts
 *
 * Requires DATABASE_URL in .env.local or environment.
 * Creates developer with enterprise tier linked to the given Supabase user.
 */

import { db } from "../src/lib/db";
import { developers } from "../src/lib/db/schema";
import { eq } from "drizzle-orm";

async function main() {
  const email = "lexwhiting@gmail.com";
  const supabaseUserId = process.env.SUPABASE_USER_ID;

  if (!supabaseUserId) {
    console.error("Error: SUPABASE_USER_ID environment variable is required.");
    console.error("Usage: SUPABASE_USER_ID='uuid-xxx' pnpm -F web exec tsx scripts/seed-admin.ts");
    process.exit(1);
  }

  // Check if developer already exists
  const existing = await db
    .select({ id: developers.id })
    .from(developers)
    .where(eq(developers.email, email))
    .limit(1);

  if (existing.length > 0) {
    console.log(`Developer ${email} already exists (id: ${existing[0].id}). Updating supabaseUserId and slug.`);
    await db
      .update(developers)
      .set({ supabaseUserId, slug: "lexwhiting" })
      .where(eq(developers.email, email));
    console.log("supabaseUserId and slug updated.");
    process.exit(0);
  }

  // Create enterprise developer
  const [dev] = await db
    .insert(developers)
    .values({
      email,
      name: "Lex Whiting",
      slug: "lexwhiting",
      supabaseUserId,
      tier: "enterprise",
      revenueSharePct: 97,
      publicProfile: true,
      publicBio: "Founder, Alerterra",
    })
    .returning({
      id: developers.id,
      email: developers.email,
      tier: developers.tier,
    });

  console.log(`Created developer: ${dev.email} (id: ${dev.id}, tier: ${dev.tier})`);
  console.log("\nEnterprise developer account ready. Sign in via Supabase at /login");

  process.exit(0);
}

main().catch((err) => {
  console.error("Seed failed:", err.message);
  process.exit(1);
});
