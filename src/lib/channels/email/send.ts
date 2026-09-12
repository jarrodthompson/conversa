export interface EmailSendOptions {
  apiKey?: string;
  from?: string;
  to: string;
  subject: string;
  text: string;
  replyTo?: string;
}

export interface EmailSendResult {
  externalId: string;
  /** true when no live provider is configured — nothing was actually sent. */
  demo: boolean;
}

/**
 * Sends an email via Resend. When no API key or from-address is configured,
 * returns a clearly-labelled demo result without contacting any provider.
 */
export async function sendEmail(opts: EmailSendOptions): Promise<EmailSendResult> {
  const { apiKey, from, to, subject, text, replyTo } = opts;

  if (!apiKey || !from) {
    return { externalId: `email_DEMO_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`, demo: true };
  }

  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "content-type": "application/json" },
    body: JSON.stringify({ from, to: [to], subject, text, reply_to: replyTo }),
  });

  if (!res.ok) {
    const detail = await res.text().catch(() => "");
    throw new Error(`Email send failed (${res.status}): ${detail.slice(0, 300)}`);
  }

  const data = (await res.json()) as { id?: string };
  return { externalId: data.id ?? `email_SENT_${Date.now()}`, demo: false };
}
