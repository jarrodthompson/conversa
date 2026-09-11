/** Minimal, dependency-free RFC-4180-ish CSV parser (handles quotes, escaped
 *  quotes, embedded commas and newlines, CRLF/LF). */
export function parseCSV(text: string): { headers: string[]; rows: string[][] } {
  const rows: string[][] = [];
  let field = "";
  let row: string[] = [];
  let inQuotes = false;
  // Strip a UTF-8 BOM if present.
  if (text.charCodeAt(0) === 0xfeff) text = text.slice(1);

  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (inQuotes) {
      if (c === '"') {
        if (text[i + 1] === '"') { field += '"'; i++; }
        else inQuotes = false;
      } else field += c;
    } else if (c === '"') {
      inQuotes = true;
    } else if (c === ",") {
      row.push(field); field = "";
    } else if (c === "\n") {
      row.push(field); rows.push(row); field = ""; row = [];
    } else if (c === "\r") {
      // handled by \n; ignore lone CR
    } else {
      field += c;
    }
  }
  // last field/row
  if (field.length > 0 || row.length > 0) { row.push(field); rows.push(row); }

  const nonEmpty = rows.filter((r) => r.some((v) => v.trim() !== ""));
  const headers = (nonEmpty.shift() ?? []).map((h) => h.trim());
  return { headers, rows: nonEmpty };
}

/** Target contact fields the importer can populate. */
export const CONTACT_FIELDS = [
  { key: "first_name", label: "First name" },
  { key: "last_name", label: "Last name" },
  { key: "email", label: "Email" },
  { key: "phone", label: "Phone" },
  { key: "whatsapp_number", label: "WhatsApp number" },
  { key: "company", label: "Company" },
  { key: "job_title", label: "Job title" },
  { key: "location", label: "Location" },
  { key: "language", label: "Language" },
  { key: "tags", label: "Tags (; or , separated)" },
] as const;

export type ContactFieldKey = (typeof CONTACT_FIELDS)[number]["key"];

const SYNONYMS: Record<ContactFieldKey, string[]> = {
  first_name: ["first name", "firstname", "first", "given name", "fname"],
  last_name: ["last name", "lastname", "last", "surname", "family name", "lname"],
  email: ["email", "e-mail", "email address", "mail"],
  phone: ["phone", "phone number", "mobile", "telephone", "tel", "cell"],
  whatsapp_number: ["whatsapp", "whatsapp number", "wa", "whatsapp no"],
  company: ["company", "organisation", "organization", "business", "account"],
  job_title: ["job title", "title", "role", "position"],
  location: ["location", "city", "country", "region"],
  language: ["language", "lang", "locale"],
  tags: ["tags", "labels", "segments", "tag"],
};

/** Best-effort auto-mapping of CSV headers to contact fields. */
export function guessMapping(headers: string[]): Record<ContactFieldKey, number> {
  const map = {} as Record<ContactFieldKey, number>;
  for (const f of CONTACT_FIELDS) map[f.key] = -1;
  headers.forEach((h, i) => {
    const norm = h.trim().toLowerCase();
    for (const f of CONTACT_FIELDS) {
      if (map[f.key] !== -1) continue;
      if (SYNONYMS[f.key].includes(norm)) map[f.key] = i;
    }
  });
  return map;
}

export function isValidEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}
