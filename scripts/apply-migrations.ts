/**
 * Applies every SQL file in supabase/migrations (in filename order) to the
 * database at SUPABASE_DB_URL. Idempotent-friendly: each migration is wrapped in
 * a transaction and recorded in public._migrations so re-runs skip applied files.
 *
 *   npm run db:push
 */
import { config } from "dotenv";
config({ path: ".env.local" });
config();
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { Client } from "pg";

const connectionString = process.env.SUPABASE_DB_URL;
if (!connectionString) {
  console.error("✖ SUPABASE_DB_URL is not set in .env.local");
  process.exit(1);
}

const dir = join(process.cwd(), "supabase", "migrations");

async function main() {
  const client = new Client({ connectionString, ssl: { rejectUnauthorized: false } });
  await client.connect();

  await client.query(`
    create table if not exists public._migrations (
      name text primary key,
      applied_at timestamptz not null default now()
    );
  `);
  // This bookkeeping table lives in the API-exposed `public` schema; enable RLS
  // (no policies) so it isn't readable via PostgREST. The migration runner
  // connects as the DB owner and bypasses RLS, so this does not affect it.
  await client.query("alter table public._migrations enable row level security");
  await client.query("revoke all on public._migrations from anon, authenticated");

  const files = readdirSync(dir).filter((f) => f.endsWith(".sql")).sort();
  for (const file of files) {
    const { rows } = await client.query("select 1 from public._migrations where name = $1", [file]);
    if (rows.length > 0) {
      console.log(`• skip   ${file} (already applied)`);
      continue;
    }
    const sql = readFileSync(join(dir, file), "utf8");
    try {
      await client.query("begin");
      await client.query(sql);
      await client.query("insert into public._migrations(name) values ($1)", [file]);
      await client.query("commit");
      console.log(`✓ apply  ${file}`);
    } catch (err) {
      await client.query("rollback");
      console.error(`✖ failed ${file}\n`, err instanceof Error ? err.message : err);
      await client.end();
      process.exit(1);
    }
  }

  await client.end();
  console.log("\n✔ Migrations complete.");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
