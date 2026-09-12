export interface SendOptions {
  phoneNumberId?: string;
  accessToken?: string;
  to: string; // recipient wa id / phone in international format, no leading +
  body: string;
  apiVersion?: string;
}

export interface SendResult {
  externalId: string;
  /** true when no live provider is configured — nothing was actually sent. */
  demo: boolean;
}

/**
 * Sends a WhatsApp text message via the Meta Graph API. When no access token or
 * phone number id is configured, returns a clearly-labelled demo result without
 * contacting any provider (so the app works end-to-end in demo mode).
 */
export async function sendWhatsAppText(opts: SendOptions): Promise<SendResult> {
  const { phoneNumberId, accessToken, to, body, apiVersion = "v21.0" } = opts;

  if (!accessToken || !phoneNumberId) {
    return { externalId: `wamid.DEMO_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`, demo: true };
  }

  const res = await fetch(`https://graph.facebook.com/${apiVersion}/${phoneNumberId}/messages`, {
    method: "POST",
    headers: { Authorization: `Bearer ${accessToken}`, "content-type": "application/json" },
    body: JSON.stringify({ messaging_product: "whatsapp", recipient_type: "individual", to, type: "text", text: { preview_url: false, body } }),
  });

  if (!res.ok) {
    const detail = await res.text().catch(() => "");
    throw new Error(`WhatsApp send failed (${res.status}): ${detail.slice(0, 300)}`);
  }

  const data = (await res.json()) as { messages?: { id?: string }[] };
  return { externalId: data.messages?.[0]?.id ?? `wamid.SENT_${Date.now()}`, demo: false };
}
