import { notFound } from "next/navigation";
import Link from "next/link";
import { Inbox, Bot, Workflow, Megaphone, MessageSquare, Plug, Check, type LucideIcon } from "lucide-react";
import { Button } from "@/components/ui/button";

interface Feature { title: string; eyebrow: string; icon: LucideIcon; blurb: string; points: string[] }

const FEATURES: Record<string, Feature> = {
  "ai-agents": { title: "AI Agents", eyebrow: "Grounded automation", icon: Bot, blurb: "AI that answers only from your approved knowledge — with confidence scoring and safe human hand-off.", points: ["Answers only from approved knowledge sources", "Confidence threshold with automatic escalation", "Never invents pricing, policy or order details", "Every AI action recorded for audit"] },
  inbox: { title: "Shared Inbox", eyebrow: "One workspace", icon: Inbox, blurb: "Every message from every channel in one collaborative, real-time queue.", points: ["WhatsApp, email, web chat and social in one thread", "Assign, tag, snooze, prioritise and set SLAs", "Internal notes, @mentions and full audit history", "Live updates as your team works together"] },
  chatbots: { title: "Chatbots", eyebrow: "No-code flows", icon: Workflow, blurb: "Design conversation flows visually, test them, and publish with confidence.", points: ["Drag-and-drop nodes with branching", "Knowledge search and AI response steps", "Versioned definitions with a testing simulator", "Human hand-off built in"] },
  broadcasts: { title: "Broadcasts", eyebrow: "Consent-first", icon: Megaphone, blurb: "Reach the right people with consent and opt-out enforcement built in.", points: ["Approved templates and audience segments", "Consent enforcement and suppression lists", "Time-zone-aware scheduling", "Delivery, read and reply tracking"] },
  "live-chat": { title: "Live Chat", eyebrow: "On your site", icon: MessageSquare, blurb: "An embeddable widget that hands off between AI and your team seamlessly.", points: ["Customisable colours, logo and greeting", "Pre-chat form and consent notice", "Online / offline and business hours", "Conversation continuation"] },
  integrations: { title: "Integrations", eyebrow: "Official APIs", icon: Plug, blurb: "Connect the channels your customers already use, via official APIs.", points: ["WhatsApp Business Cloud API", "Email via Resend", "Facebook Messenger & Instagram (adapters)", "Signed, idempotent webhooks"] },
};

export function generateStaticParams() {
  return Object.keys(FEATURES).map((slug) => ({ slug }));
}

export default async function FeaturePage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const f = FEATURES[slug];
  if (!f) notFound();
  const Icon = f.icon;

  return (
    <div className="mx-auto max-w-4xl px-4 py-20 sm:px-6">
      <p className="text-xs font-semibold uppercase tracking-[0.18em] text-primary">{f.eyebrow}</p>
      <div className="mt-3 flex items-center gap-3">
        <span className="flex size-12 items-center justify-center rounded-[12px] bg-secondary text-primary"><Icon className="size-6" /></span>
        <h1 className="text-4xl font-extrabold tracking-tight">{f.title}</h1>
      </div>
      <p className="mt-4 max-w-2xl text-lg text-muted-foreground">{f.blurb}</p>
      <ul className="mt-8 grid gap-3 sm:grid-cols-2">
        {f.points.map((p) => (
          <li key={p} className="flex items-start gap-3 rounded-[12px] border border-border bg-card p-4">
            <Check className="mt-0.5 size-5 shrink-0 text-success" />
            <span className="text-sm text-foreground">{p}</span>
          </li>
        ))}
      </ul>
      <div className="mt-10 flex gap-3">
        <Link href="/register"><Button size="lg">Start free</Button></Link>
        <Link href="/demo"><Button size="lg" variant="outline">Book a demo</Button></Link>
      </div>
    </div>
  );
}
