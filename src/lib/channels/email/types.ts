/** Loose shape of a Resend webhook event (inbound email or delivery status). */
export interface EmailWebhookPayload {
  type?: string; // e.g. "email.delivered", "email.opened", "inbound.email"
  created_at?: string;
  data?: EmailEventData;
}

export interface EmailEventData {
  // Delivery events
  email_id?: string;
  // Inbound / common
  message_id?: string;
  from?: string | { address?: string; name?: string };
  to?: string | string[] | { address?: string }[];
  subject?: string;
  text?: string;
  html?: string;
}
