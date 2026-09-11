import type { SupabaseClient } from "@supabase/supabase-js";

export interface Segment {
  tags?: string[];          // contact must have ANY of these tags
  requireConsent?: boolean; // require consent_status = opted_in (default true)
  company?: string;         // substring match on company
  search?: string;          // substring on name/email
}

export interface AudienceContact {
  id: string;
  first_name: string | null;
  last_name: string | null;
  email: string | null;
  whatsapp_number: string | null;
  phone: string | null;
  company: string | null;
  identifier: string;       // the address for the chosen channel
}

export interface AudienceResult {
  eligible: AudienceContact[];
  counts: {
    total: number;
    eligible: number;
    noIdentifier: number;
    noConsent: number;
    suppressed: number;
  };
}

function channelIdentifier(
  c: { email: string | null; whatsapp_number: string | null; phone: string | null },
  channel: string,
): string | null {
  switch (channel) {
    case "email": return c.email;
    case "whatsapp": return c.whatsapp_number ?? c.phone;
    case "sms": return c.phone;
    default: return c.email ?? c.phone;
  }
}

/**
 * Resolves the eligible audience for a broadcast, enforcing consent and the
 * suppression list. Contacts without a usable channel identifier, without
 * consent (when required), or on the suppression list are excluded and counted.
 *
 * Resolved in-app over a capped fetch — fine for demo volumes; a production
 * build would push this to SQL and paginate.
 */
export async function resolveAudience(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: SupabaseClient<any>,
  orgId: string,
  channel: string,
  segment: Segment,
): Promise<AudienceResult> {
  const requireConsent = segment.requireConsent !== false;

  const { data: contactRows } = await supabase
    .from("contacts")
    .select("id, first_name, last_name, email, whatsapp_number, phone, company, consent_status, is_blocked, contact_tags(tag:tags(name))")
    .eq("organisation_id", orgId)
    .is("deleted_at", null)
    .eq("is_blocked", false)
    .limit(1000);

  const { data: suppRows } = await supabase
    .from("suppression_entries")
    .select("identifier")
    .eq("organisation_id", orgId)
    .eq("channel_type", channel);
  const suppressed = new Set((suppRows ?? []).map((s: { identifier: string }) => s.identifier));

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const contacts = (contactRows ?? []) as any[];
  const counts = { total: contacts.length, eligible: 0, noIdentifier: 0, noConsent: 0, suppressed: 0 };
  const eligible: AudienceContact[] = [];

  const wantTags = (segment.tags ?? []).map((t) => t.toLowerCase());
  const company = segment.company?.toLowerCase();
  const search = segment.search?.toLowerCase();

  for (const c of contacts) {
    // Segment filters
    if (wantTags.length) {
      const names = (c.contact_tags ?? []).map((ct: { tag?: { name?: string } }) => ct.tag?.name?.toLowerCase()).filter(Boolean);
      if (!wantTags.some((t) => names.includes(t))) continue;
    }
    if (company && !(c.company ?? "").toLowerCase().includes(company)) continue;
    if (search) {
      const hay = `${c.first_name ?? ""} ${c.last_name ?? ""} ${c.email ?? ""}`.toLowerCase();
      if (!hay.includes(search)) continue;
    }

    const id = channelIdentifier(c, channel);
    if (!id) { counts.noIdentifier++; continue; }
    if (requireConsent && c.consent_status !== "opted_in") { counts.noConsent++; continue; }
    if (suppressed.has(id)) { counts.suppressed++; continue; }

    eligible.push({
      id: c.id, first_name: c.first_name, last_name: c.last_name,
      email: c.email, whatsapp_number: c.whatsapp_number, phone: c.phone,
      company: c.company, identifier: id,
    });
  }

  counts.eligible = eligible.length;
  return { eligible, counts };
}
