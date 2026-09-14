import type { EmailEventData } from "@/lib/channels/email/types";

export interface ReceivedEmail {
  from?: EmailEventData["from"];
  to?: EmailEventData["to"];
  subject?: string;
  text?: string;
  html?: string;
  message_id?: string;
}

/**
 * Fetches the full content of a received (inbound) email. Resend's
 * `email.received` webhook is metadata-only — the body, headers and
 * attachments must be retrieved separately from the Receiving API:
 *   GET https://api.resend.com/emails/receiving/{id}
 * Returns null when no API key is configured or the fetch fails, so the
 * caller can fall back to whatever metadata the webhook carried.
 */
export async function fetchReceivedEmail(
  id: string,
  apiKey: string | undefined,
): Promise<ReceivedEmail | null> {
  if (!apiKey) return null;
  try {
    const res = await fetch(`https://api.resend.com/emails/receiving/${id}`, {
      headers: { Authorization: `Bearer ${apiKey}` },
    });
    if (!res.ok) return null;
    const d = (await res.json()) as ReceivedEmail;
    return {
      from: d.from,
      to: d.to,
      subject: d.subject,
      text: d.text,
      html: d.html,
      message_id: d.message_id,
    };
  } catch {
    return null;
  }
}
