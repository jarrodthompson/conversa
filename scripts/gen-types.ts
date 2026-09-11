/**
 * Generates fully-typed Supabase types from the live schema into
 * src/lib/supabase/types.ts, replacing the permissive placeholder.
 * Uses the Supabase CLI via npx (no global install needed).
 *
 *   npm run db:types
 */
import { config } from "dotenv";
config({ path: ".env.local" });
config();
import { execFileSync } from "node:child_process";
import { writeFileSync } from "node:fs";
import { join } from "node:path";

const dbUrl = process.env.SUPABASE_DB_URL;
if (!dbUrl) {
  console.error("✖ SUPABASE_DB_URL is not set in .env.local");
  process.exit(1);
}

try {
  const out = execFileSync(
    "npx",
    ["--yes", "supabase", "gen", "types", "typescript", "--db-url", dbUrl],
    { encoding: "utf8", shell: true, maxBuffer: 20 * 1024 * 1024 },
  );
  const target = join(process.cwd(), "src", "lib", "supabase", "types.ts");
  writeFileSync(target, out, "utf8");
  console.log(`✓ Wrote ${target}`);
} catch (err) {
  console.error("✖ Failed to generate types:", err instanceof Error ? err.message : err);
  process.exit(1);
}
