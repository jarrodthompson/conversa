import { notFound } from "next/navigation";

const DOCS: Record<string, { title: string; intro: string; sections: { h: string; p: string }[] }> = {
  privacy: {
    title: "Privacy Policy",
    intro: "This policy explains how Conversa handles personal information. It is written to align with South Africa's POPIA and the EU/UK GDPR. It is provided for transparency and is not a substitute for your organisation's own legal advice.",
    sections: [
      { h: "Roles", p: "For customer conversations, contacts and messages inside a workspace, the organisation operating that workspace is the responsible party / data controller and Conversa acts as its operator / processor — processing that data only on the organisation's documented instructions. For the account and billing data of the organisation's own users, Conversa is the responsible party." },
      { h: "Information we process", p: "Account details (name, work email), organisation and membership records, customer contact records and consent status, conversation content across connected channels, delivery and engagement metadata, and technical/usage logs needed to operate and secure the service." },
      { h: "How we use it", p: "To provide the shared inbox, route and deliver messages, generate AI-assisted drafts, produce analytics, enforce consent and suppression, secure the platform, and meet legal obligations. We do not sell personal information." },
      { h: "Lawful basis & consent", p: "Processing relies on performance of the contract, legitimate interests in operating the service, and consent where required. Outbound marketing messaging requires a recorded consent or other lawful basis; opt-outs are captured and enforced through per-contact suppression lists." },
      { h: "Your rights", p: "Data subjects may request access, correction, deletion, restriction, objection and portability. Organisation administrators can export and delete/anonymise contact and conversation data from the workspace; requests to Conversa are routed to the relevant organisation where it acts as operator." },
      { h: "Data retention", p: "Personal information is retained while the workspace is active and as needed for the purposes above or to meet legal obligations, after which it is deleted or anonymised. Retention periods are configurable per organisation." },
      { h: "Sub-processors", p: "We use vetted sub-processors to run the service, including cloud hosting and database (Supabase), application hosting (Vercel), the messaging providers you connect (e.g. Resend for email, Meta for WhatsApp), and Peach Payments for billing. Each is bound by data-protection terms." },
      { h: "International transfers", p: "Some sub-processors may process data outside your country. Where that happens, transfers are made under appropriate safeguards (such as standard contractual clauses) consistent with POPIA and GDPR." },
      { h: "Security", p: "Data is isolated per organisation using row-level security, encrypted in transit, and production access is restricted. Provider secrets are held server-side and never exposed to the browser. No system is perfectly secure; we work to reduce risk and to notify affected parties of material incidents as required by law." },
      { h: "Contact", p: "For privacy questions or to exercise your rights, contact the organisation operating your workspace, or email hello@conversa.app." },
    ],
  },
  terms: {
    title: "Terms of Service",
    intro: "These terms govern use of the Conversa platform. They are a general template and should be reviewed and adapted with your own legal counsel before commercial use.",
    sections: [
      { h: "Agreement", p: "By creating a workspace or using the service you agree to these terms on behalf of your organisation. If you do not agree, do not use the service." },
      { h: "The service", p: "Conversa provides an omnichannel customer-service platform: a shared inbox, contacts, AI-assisted drafting, chatbots, automations, broadcasts, and analytics, with optional connections to third-party messaging providers." },
      { h: "Accounts & access", p: "You are responsible for the accuracy of account information, for the actions of users you invite, and for keeping credentials confidential. Roles and permissions are yours to administer." },
      { h: "Acceptable use", p: "You may not use the service for unlawful, abusive, deceptive or non-consensual messaging, to infringe others' rights, or to circumvent platform or provider policies. Connected channels must be used in line with their providers' rules (for example, WhatsApp Business and Meta policies)." },
      { h: "Customer data & responsibilities", p: "You retain ownership of your data. You are the responsible party for the personal information you process through the service and for obtaining any necessary consents. Conversa processes it as your operator under the Privacy Policy." },
      { h: "Fees", p: "Paid plans are billed in advance through Peach Payments at the prices shown for your selected plan. Taxes may apply. Except where required by law, fees for a period already started are non-refundable." },
      { h: "Availability & support", p: "We aim for high availability, but the service is provided on a commercially reasonable-efforts basis. Planned maintenance and support channels are communicated in-app or by email." },
      { h: "Warranties & liability", p: "The service is provided “as is” to the maximum extent permitted by law. To the extent permitted by law, Conversa's aggregate liability is limited to the fees paid in the three months preceding the claim, and neither party is liable for indirect or consequential loss." },
      { h: "Termination", p: "Either party may terminate as set out in the applicable plan. On termination you may export your data for a limited period, after which it is deleted or anonymised." },
      { h: "Governing law", p: "These terms are governed by the laws of the Republic of South Africa and disputes are subject to the jurisdiction of its courts, unless otherwise agreed in writing." },
    ],
  },
  cookies: {
    title: "Cookie Policy",
    intro: "This policy explains the cookies and similar technologies Conversa uses. It aligns with POPIA and GDPR expectations for transparency and consent.",
    sections: [
      { h: "What cookies are", p: "Cookies are small files stored on your device. We use a small number of first-party cookies and local storage to run the application; we do not use third-party advertising cookies." },
      { h: "Essential cookies", p: "Authentication and session cookies keep you signed in and remember your active organisation. These are strictly necessary and cannot be switched off in the product." },
      { h: "Preferences & local storage", p: "We store lightweight interface preferences (such as a remembered view or a collapsed panel) in your browser. These stay on your device and are not shared." },
      { h: "No advertising or cross-site tracking", p: "Conversa does not use advertising cookies or cross-site tracking. Any product analytics are limited to operating and improving the service." },
      { h: "Managing cookies", p: "You can clear or block cookies in your browser settings; blocking essential cookies will prevent sign-in. Where consent is required for non-essential cookies, we ask for it before they are set." },
    ],
  },
};

export function generateStaticParams() {
  return Object.keys(DOCS).map((slug) => ({ slug }));
}

export default async function LegalPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const doc = DOCS[slug];
  if (!doc) notFound();
  return (
    <div className="mx-auto max-w-3xl px-4 py-20 sm:px-6">
      <h1 className="text-3xl font-bold tracking-tight">{doc.title}</h1>
      <p className="mt-3 rounded-[10px] border border-border bg-secondary/50 px-3 py-2 text-sm text-muted-foreground">{doc.intro}</p>
      <div className="mt-8 space-y-6">
        {doc.sections.map((s) => (
          <section key={s.h}>
            <h2 className="text-lg font-semibold">{s.h}</h2>
            <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">{s.p}</p>
          </section>
        ))}
      </div>
    </div>
  );
}
