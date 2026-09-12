import { config } from "dotenv";
import { Client } from "pg";

config({ path: ".env.local" });

/**
 * Enables row-level security on the migration bookkeeping table. It holds no
 * customer data, but it lives in the `public` schema exposed to PostgREST, so
 * Supabase's security advisor flags it. Enabling RLS with no policies makes it
 * inaccessible via the API (anon/authenticated) while the migration runner,
 * which connects as the database owner, continues to bypass RLS.
 */
async function main() {
  const connectionString = process.env.SUPABASE_DB_URL;
  if (!connectionString) throw new Error("SUPABASE_DB_URL missing in .env.local");

  const client = new Client({ connectionString });
  await client.connect();
  try {
    const { rows } = await client.query(
      "select tablename from pg_tables where schemaname = 'public' and tablename = '_migrations'",
    );
    if (rows.length === 0) {
      console.log("public._migrations not found — nothing to do.");
      return;
    }
    await client.query("alter table public._migrations enable row level security");
    // Belt-and-braces: revoke direct grants from the API roles.
    await client.query("revoke all on public._migrations from anon, authenticated");
    const { rows: check } = await client.query(
      "select relrowsecurity from pg_class where oid = 'public._migrations'::regclass",
    );
    console.log("RLS enabled on public._migrations:", check[0]?.relrowsecurity === true);
  } finally {
    await client.end();
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
