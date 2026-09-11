"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getAppContext } from "@/lib/auth/context";
import { can } from "@/lib/auth/roles";
import { isValidEmail } from "@/lib/contacts/csv";

export interface MappedRow {
  first_name?: string;
  last_name?: string;
  email?: string;
  phone?: string;
  whatsapp_number?: string;
  company?: string;
  job_title?: string;
  location?: string;
  language?: string;
  tags?: string;
}

export interface ImportOptions {
  consent: "opted_in" | "unknown";
  consentSource?: string;
}

export interface ImportSummary {
  created: number;
  updated: number;
  invalid: number;
  tagsLinked: number;
  error?: string;
}

const norm = (s?: string) => (s ?? "").trim();
const lower = (s?: string) => norm(s).toLowerCase();

export async function importContactsAction(
  rows: MappedRow[],
  options: ImportOptions,
): Promise<ImportSummary> {
  const c = await getAppContext();
  if (!can(c.role, "contacts.manage")) return { created: 0, updated: 0, invalid: 0, tagsLinked: 0, error: "Not authorised to manage contacts" };
  const supabase = await createClient();
  const orgId = c.org.id;

  if (rows.length === 0) return { created: 0, updated: 0, invalid: 0, tagsLinked: 0, error: "No rows to import" };
  if (rows.length > 5000) return { created: 0, updated: 0, invalid: 0, tagsLinked: 0, error: "Please import at most 5000 rows at a time" };

  // Keep rows that have at least one usable identifier.
  const clean = rows
    .map((r) => ({
      first_name: norm(r.first_name) || null,
      last_name: norm(r.last_name) || null,
      email: isValidEmail(lower(r.email)) ? lower(r.email) : null,
      phone: norm(r.phone) || null,
      whatsapp_number: norm(r.whatsapp_number) || norm(r.phone) || null,
      company: norm(r.company) || null,
      job_title: norm(r.job_title) || null,
      location: norm(r.location) || null,
      language: norm(r.language) || null,
      tags: norm(r.tags),
    }))
    .filter((r) => r.email || r.phone);
  const invalid = rows.length - clean.length;

  // Existing contacts for dedupe (by email / phone).
  const { data: existingRows } = await supabase
    .from("contacts")
    .select("id, email, phone")
    .eq("organisation_id", orgId)
    .is("deleted_at", null)
    .limit(20000);
  const byEmail = new Map<string, string>();
  const byPhone = new Map<string, string>();
  for (const e of (existingRows ?? []) as { id: string; email: string | null; phone: string | null }[]) {
    if (e.email) byEmail.set(e.email.toLowerCase(), e.id);
    if (e.phone) byPhone.set(e.phone, e.id);
  }

  let created = 0;
  let updated = 0;
  const consentPatch: Record<string, string> = options.consent === "opted_in"
    ? { consent_status: "opted_in", consent_source: options.consentSource || "csv_import" }
    : {};

  // Map of identifier → resolved contact id, for tag/consent linking afterwards.
  const resolved: { id: string; row: (typeof clean)[number] }[] = [];
  const toInsert: (typeof clean) = [];

  for (const r of clean) {
    const existingId = (r.email && byEmail.get(r.email)) || (r.phone && byPhone.get(r.phone)) || null;
    if (existingId) {
      // Merge only provided, non-null fields.
      const patch: Record<string, string> = { ...consentPatch };
      for (const k of ["first_name", "last_name", "email", "phone", "whatsapp_number", "company", "job_title", "location", "language"] as const) {
        if (r[k]) patch[k] = r[k];
      }
      const { error } = await supabase.from("contacts").update(patch).eq("id", existingId).eq("organisation_id", orgId);
      if (!error) { updated++; resolved.push({ id: existingId, row: r }); }
    } else {
      toInsert.push(r);
    }
  }

  // Batch insert new contacts.
  if (toInsert.length) {
    const payload = toInsert.map((r) => ({
      organisation_id: orgId,
      first_name: r.first_name, last_name: r.last_name, email: r.email,
      phone: r.phone, whatsapp_number: r.whatsapp_number, company: r.company,
      job_title: r.job_title, location: r.location, language: r.language || "en",
      owner_id: c.userId,
      consent_status: options.consent === "opted_in" ? "opted_in" : "unknown",
      consent_source: options.consent === "opted_in" ? (options.consentSource || "csv_import") : null,
    }));
    const { data: inserted, error } = await supabase.from("contacts").insert(payload).select("id, email, phone");
    if (error) return { created, updated, invalid, tagsLinked: 0, error: error.message };
    created = inserted?.length ?? 0;

    // Match inserted rows back to their source rows by email/phone for tagging.
    const insEmail = new Map<string, string>();
    const insPhone = new Map<string, string>();
    for (const ins of (inserted ?? []) as { id: string; email: string | null; phone: string | null }[]) {
      if (ins.email) insEmail.set(ins.email.toLowerCase(), ins.id);
      if (ins.phone) insPhone.set(ins.phone, ins.id);
    }
    for (const r of toInsert) {
      const id = (r.email && insEmail.get(r.email)) || (r.phone && insPhone.get(r.phone));
      if (id) resolved.push({ id, row: r });
    }
  }

  // Tags: ensure tags exist, then link.
  let tagsLinked = 0;
  const allTagNames = new Set<string>();
  for (const { row } of resolved) {
    if (row.tags) row.tags.split(/[;,]/).map((t) => t.trim()).filter(Boolean).forEach((t) => allTagNames.add(t));
  }
  if (allTagNames.size) {
    await supabase.from("tags").upsert(
      [...allTagNames].map((name) => ({ organisation_id: orgId, name })),
      { onConflict: "organisation_id,name", ignoreDuplicates: true },
    );
    const { data: tagRows } = await supabase.from("tags").select("id, name").eq("organisation_id", orgId);
    const tagId = new Map<string, string>();
    for (const t of (tagRows ?? []) as { id: string; name: string }[]) tagId.set(t.name.toLowerCase(), t.id);

    const links: { contact_id: string; tag_id: string }[] = [];
    for (const { id, row } of resolved) {
      if (!row.tags) continue;
      for (const name of row.tags.split(/[;,]/).map((t) => t.trim()).filter(Boolean)) {
        const tid = tagId.get(name.toLowerCase());
        if (tid) links.push({ contact_id: id, tag_id: tid });
      }
    }
    if (links.length) {
      const { error } = await supabase.from("contact_tags").upsert(links, { onConflict: "contact_id,tag_id", ignoreDuplicates: true });
      if (!error) tagsLinked = links.length;
    }
  }

  // Consent records when opted-in.
  if (options.consent === "opted_in" && resolved.length) {
    const consentRows = resolved.map(({ id, row }) => ({
      organisation_id: orgId,
      contact_id: id,
      channel_type: row.email ? "email" : row.whatsapp_number ? "whatsapp" : "sms",
      status: "opted_in",
      source: options.consentSource || "csv_import",
      basis: "explicit",
    }));
    await supabase.from("consent_records").insert(consentRows);
  }

  revalidatePath("/app/contacts");
  return { created, updated, invalid, tagsLinked };
}
