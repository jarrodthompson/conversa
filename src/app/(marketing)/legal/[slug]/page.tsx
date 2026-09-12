import { notFound } from "next/navigation";

const DOCS: Record<string, { title: string; intro: string; sections: { h: string; p: string }[] }> = {
  privacy: {
    title: "Privacy Policy",
    intro: "This is demonstration content for the Conversa sample product and is not legal advice.",
    sections: [
      { h: "Data we process", p: "Conversa processes customer conversations, contact records and usage data on behalf of the organisation operating the workspace, who is the data controller." },
      { h: "Lawful basis & consent", p: "Outbound messaging requires a recorded consent or other lawful basis; opt-outs are enforced through suppression lists." },
      { h: "Your rights", p: "Data export and deletion/anonymisation workflows are available to organisation administrators. Retention is configurable." },
      { h: "Security", p: "Data is isolated per organisation with row-level security; secrets are never exposed to the browser." },
    ],
  },
  terms: {
    title: "Terms of Service",
    intro: "Demonstration terms for the Conversa sample product.",
    sections: [
      { h: "Use of the service", p: "The service is provided for evaluation. You are responsible for the lawful use of messaging channels connected to your workspace." },
      { h: "Acceptable use", p: "No unlawful, abusive or non-consensual messaging. WhatsApp usage must follow the official Meta Business policies." },
      { h: "Availability", p: "This demonstration environment is provided as-is without warranty." },
    ],
  },
  cookies: {
    title: "Cookie Policy",
    intro: "Demonstration cookie policy for the Conversa sample product.",
    sections: [
      { h: "Essential cookies", p: "We use a session cookie to keep you signed in and to remember your active organisation." },
      { h: "No advertising cookies", p: "This demonstration does not use advertising or cross-site tracking cookies." },
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
      <p className="mt-3 rounded-[10px] border border-warning/30 bg-warning/5 px-3 py-2 text-sm text-warning">{doc.intro}</p>
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
