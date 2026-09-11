import { config } from "dotenv";
config({ path: ".env.local" });
import { Client } from "pg";

const text = process.argv[2] ?? "Just checking in — is there any update on my request?";

async function main() {
  const client = new Client({ connectionString: process.env.SUPABASE_DB_URL, ssl: { rejectUnauthorized: false } });
  await client.connect();
  const { rows } = await client.query(
    `select id, organisation_id, contact_id from public.conversations
     where deleted_at is null order by last_message_at desc nulls last limit 1`,
  );
  const conv = rows[0];
  await client.query(
    `insert into public.messages (organisation_id, conversation_id, direction, author_type, contact_id, body, delivery_status)
     values ($1,$2,'inbound','contact',$3,$4,'delivered')`,
    [conv.organisation_id, conv.id, conv.contact_id, text],
  );
  await client.query(
    `update public.conversations set last_message_at = now(), last_message_preview = $2, unread_count = unread_count + 1 where id = $1`,
    [conv.id, text.slice(0, 80)],
  );
  console.log(`Emitted inbound message to conversation ${conv.id}`);
  await client.end();
}
main();
