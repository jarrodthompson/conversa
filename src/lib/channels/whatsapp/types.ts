/** Minimal shape of a WhatsApp Business Cloud API webhook payload. */
export interface WhatsAppWebhookPayload {
  object?: string;
  entry?: WhatsAppEntry[];
}
export interface WhatsAppEntry {
  id?: string;
  changes?: WhatsAppChange[];
}
export interface WhatsAppChange {
  field?: string;
  value?: WhatsAppValue;
}
export interface WhatsAppValue {
  messaging_product?: string;
  metadata?: { display_phone_number?: string; phone_number_id?: string };
  contacts?: { profile?: { name?: string }; wa_id?: string }[];
  messages?: WhatsAppMessage[];
  statuses?: WhatsAppStatus[];
}
export interface WhatsAppMessage {
  from?: string;
  id?: string;
  timestamp?: string;
  type?: string;
  text?: { body?: string };
  image?: { caption?: string };
  button?: { text?: string };
  interactive?: { button_reply?: { title?: string }; list_reply?: { title?: string } };
}
export interface WhatsAppStatus {
  id?: string;
  status?: string; // sent | delivered | read | failed
  timestamp?: string;
  recipient_id?: string;
}
