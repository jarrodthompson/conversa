/**
 * Runs the time-based automation sweep once, locally (bypasses the HTTP endpoint).
 *   npm run sweep
 */
import { config } from "dotenv";
config({ path: ".env.local" });
import { createClient } from "@supabase/supabase-js";
import { runTimeSweep } from "@/lib/automations/sweep";

async function main() {
  const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  const result = await runTimeSweep(db);
  console.log("Sweep complete:", JSON.stringify(result));
}

main().catch((e) => { console.error(e); process.exit(1); });
