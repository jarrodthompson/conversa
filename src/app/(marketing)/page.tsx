import Link from "next/link";
import {
  Inbox,
  Bot,
  Workflow,
  Megaphone,
  BarChart3,
  Plug,
  MessageSquare,
  MessageCircle,
  Mail,
  Camera,
  Phone,
  ShieldCheck,
  ArrowRight,
  Check,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { InboxPreview } from "@/components/marketing/inbox-preview";

export default function HomePage() {
  return (
    <>
      {/* 1. Announcement bar */}
      <div className="bg-sidebar-deep text-center text-sm text-sidebar-foreground">
        <div className="mx-auto flex max-w-6xl items-center justify-center gap-2 px-4 py-2.5">
          <Badge variant="primary" className="hidden sm:inline-flex">
            New
          </Badge>
          <span>
            Conversa now routes conversations across six channels into one AI-assisted inbox.
          </span>
          <Link href="/features/inbox" className="inline-flex items-center gap-1 font-medium text-cyan-400 hover:underline">
            Explore <ArrowRight className="size-3.5" />
          </Link>
        </div>
      </div>

      {/* 3. Hero */}
      <section className="mx-auto max-w-6xl px-4 pt-16 text-center sm:px-6 sm:pt-24">
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-primary">
          AI-Powered Customer Service
        </p>
        <h1 className="mx-auto mt-5 max-w-3xl text-balance text-4xl font-extrabold leading-[1.08] tracking-tight text-foreground sm:text-6xl">
          Every conversation.{" "}
          <span className="text-primary">One intelligent workspace.</span>
        </h1>
        <p className="mx-auto mt-5 max-w-xl text-pretty text-lg text-muted-foreground">
          Bring customer messages, support teams and AI agents together in one
          powerful platform.
        </p>
        <div className="mt-8 flex items-center justify-center gap-3">
          <Link href="/register">
            <Button size="lg">Start free</Button>
          </Link>
          <Link href="/demo">
            <Button size="lg" variant="outline">
              Book a demo
            </Button>
          </Link>
        </div>
        <p className="mt-4 text-xs text-muted-foreground">
          No credit card required
        </p>
      </section>

      {/* 4. Product interface preview */}
      <section className="mx-auto mt-14 max-w-6xl px-4 sm:px-6">
        <InboxPreview />
      </section>

      {/* 5. Trusted-business placeholder */}
      <section className="mx-auto mt-16 max-w-6xl px-4 sm:px-6">
        <p className="text-center text-xs font-medium uppercase tracking-widest text-muted-foreground">
          Trusted by fast-moving support teams
        </p>
        <div className="mt-6 grid grid-cols-2 items-center gap-6 opacity-60 sm:grid-cols-3 md:grid-cols-6">
          {["Northwind", "Grovefield", "Lumen", "Acre & Co", "Bluewave", "Tanka"].map((n) => (
            <div key={n} className="text-center text-sm font-semibold text-secondary-foreground">
              {n}
            </div>
          ))}
        </div>
      </section>

      {/* 6. Main benefits */}
      <section className="mx-auto mt-24 max-w-6xl px-4 sm:px-6">
        <SectionHeading
          eyebrow="Why Conversa"
          title="One platform for every customer moment"
          subtitle="Stop switching tabs. Route, resolve and report on every conversation from a single, calm workspace."
        />
        <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {benefits.map((b) => (
            <div key={b.title} className="rounded-[12px] border border-border bg-card p-6 shadow-sm">
              <div className="flex size-10 items-center justify-center rounded-[10px] bg-secondary text-primary">
                <b.icon className="size-5" />
              </div>
              <h3 className="mt-4 font-semibold">{b.title}</h3>
              <p className="mt-1.5 text-sm text-muted-foreground">{b.body}</p>
            </div>
          ))}
        </div>
      </section>

      {/* 7–11. Feature spotlights */}
      <FeatureSplit
        eyebrow="AI Agents"
        title="AI that answers only from your approved knowledge"
        points={[
          "Cites its source internally and shows a confidence score",
          "Escalates to a human when unsure, angry or off-topic",
          "Never invents pricing, policy or order details",
        ]}
        icon={Bot}
      />
      <FeatureSplit
        eyebrow="Omnichannel Inbox"
        title="WhatsApp, email, web chat and social — in one thread"
        points={[
          "Assign, tag, snooze and set SLAs across every channel",
          "Internal notes, @mentions and full audit history",
          "Realtime updates as your team works together",
        ]}
        icon={Inbox}
        reverse
      />
      <FeatureSplit
        eyebrow="Chatbot Builder"
        title="Design flows visually, publish with confidence"
        points={[
          "Drag-and-drop nodes: questions, conditions, AI search, handoff",
          "Versioned JSON definitions with a testing simulator",
          "Execution logs so you can see exactly what ran",
        ]}
        icon={Workflow}
      />
      <FeatureSplit
        eyebrow="Broadcasts"
        title="Reach the right people — with consent built in"
        points={[
          "Approved templates, segments and time-zone-aware sending",
          "Opt-out enforcement and suppression lists by default",
          "Delivery, read and reply tracking per campaign",
        ]}
        icon={Megaphone}
        reverse
      />
      <FeatureSplit
        eyebrow="Analytics"
        title="Know your response times, SLAs and AI containment"
        points={[
          "First response, resolution time and reopen rate",
          "AI vs human resolution and handoff rate",
          "Export to CSV and PDF for stakeholders",
        ]}
        icon={BarChart3}
      />

      {/* 12. Integrations */}
      <section className="mx-auto mt-24 max-w-6xl px-4 sm:px-6">
        <SectionHeading
          eyebrow="Integrations"
          title="Connect the channels your customers already use"
          subtitle="Official APIs and an adapter pattern — with a clearly-labelled simulated mode when credentials aren't set."
        />
        <div className="mt-10 flex flex-wrap items-center justify-center gap-3">
          {channels.map((c) => (
            <div
              key={c.label}
              className="flex items-center gap-2 rounded-[10px] border border-border bg-card px-4 py-2.5 text-sm font-medium shadow-sm"
            >
              <c.icon className="size-4" style={{ color: c.color }} />
              {c.label}
            </div>
          ))}
        </div>
      </section>

      {/* 13. Testimonials (clearly fictional) */}
      <section className="mx-auto mt-24 max-w-6xl px-4 sm:px-6">
        <SectionHeading eyebrow="Loved by teams" title="What customers say" subtitle="Hear from support leaders who run on Conversa every day." />
        <div className="mt-10 grid gap-4 md:grid-cols-3">
          {testimonials.map((t) => (
            <figure key={t.name} className="rounded-[12px] border border-border bg-card p-6 shadow-sm">
              <blockquote className="text-sm text-foreground">“{t.quote}”</blockquote>
              <figcaption className="mt-4 text-sm">
                <span className="font-semibold">{t.name}</span>
                <span className="text-muted-foreground"> · {t.role}</span>
              </figcaption>
            </figure>
          ))}
        </div>
      </section>

      {/* 14. Pricing preview */}
      <section className="mx-auto mt-24 max-w-6xl px-4 sm:px-6">
        <SectionHeading eyebrow="Pricing" title="Plans that grow with your team" subtitle="Simple, transparent pricing for teams of every size." />
        <div className="mt-10 grid gap-4 md:grid-cols-4">
          {plans.map((p) => (
            <div
              key={p.name}
              className={`rounded-[12px] border bg-card p-6 shadow-sm ${p.featured ? "border-primary ring-1 ring-primary" : "border-border"}`}
            >
              {p.featured && <Badge variant="primary" className="mb-2">Popular</Badge>}
              <h3 className="font-semibold">{p.name}</h3>
              <p className="mt-2 text-2xl font-bold">
                {p.price}
                <span className="text-sm font-normal text-muted-foreground">{p.suffix}</span>
              </p>
              <ul className="mt-4 space-y-2">
                {p.features.map((f) => (
                  <li key={f} className="flex items-start gap-2 text-sm text-muted-foreground">
                    <Check className="mt-0.5 size-4 shrink-0 text-success" />
                    {f}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
        <p className="mt-4 text-center text-xs text-muted-foreground">
          Prices exclude applicable taxes.
        </p>
      </section>

      {/* 15. Final CTA */}
      <section className="mx-auto mt-24 max-w-6xl px-4 pb-24 sm:px-6">
        <div className="overflow-hidden rounded-[14px] border border-border bg-sidebar px-8 py-14 text-center">
          <ShieldCheck className="mx-auto size-8 text-cyan-400" />
          <h2 className="mx-auto mt-4 max-w-2xl text-3xl font-bold text-white">
            Give every customer a faster, kinder answer
          </h2>
          <p className="mx-auto mt-3 max-w-lg text-sidebar-foreground">
            Start with the shared inbox and add AI agents when you’re ready.
          </p>
          <div className="mt-7 flex items-center justify-center gap-3">
            <Link href="/register">
              <Button size="lg">Start free</Button>
            </Link>
            <Link href="/demo">
              <Button size="lg" variant="secondary">
                Book a demo
              </Button>
            </Link>
          </div>
        </div>
      </section>
    </>
  );
}

function SectionHeading({ eyebrow, title, subtitle }: { eyebrow: string; title: string; subtitle?: string }) {
  return (
    <div className="mx-auto max-w-2xl text-center">
      <p className="text-xs font-semibold uppercase tracking-[0.18em] text-primary">{eyebrow}</p>
      <h2 className="mt-3 text-3xl font-bold tracking-tight text-foreground">{title}</h2>
      {subtitle && <p className="mt-3 text-muted-foreground">{subtitle}</p>}
    </div>
  );
}

function FeatureSplit({
  eyebrow,
  title,
  points,
  icon: Icon,
  reverse,
}: {
  eyebrow: string;
  title: string;
  points: string[];
  icon: React.ComponentType<{ className?: string }>;
  reverse?: boolean;
}) {
  return (
    <section className="mx-auto mt-24 max-w-6xl px-4 sm:px-6">
      <div className={`grid items-center gap-10 md:grid-cols-2 ${reverse ? "md:[&>*:first-child]:order-2" : ""}`}>
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-primary">{eyebrow}</p>
          <h2 className="mt-3 text-3xl font-bold tracking-tight text-foreground">{title}</h2>
          <ul className="mt-6 space-y-3">
            {points.map((p) => (
              <li key={p} className="flex items-start gap-3">
                <span className="mt-0.5 flex size-5 items-center justify-center rounded-full bg-success/12 text-success">
                  <Check className="size-3.5" />
                </span>
                <span className="text-sm text-foreground">{p}</span>
              </li>
            ))}
          </ul>
        </div>
        <div className="flex aspect-[4/3] items-center justify-center rounded-[14px] border border-border bg-gradient-to-br from-secondary to-card">
          <Icon className="size-16 text-primary/70" />
        </div>
      </div>
    </section>
  );
}

const benefits = [
  { icon: Inbox, title: "Shared omnichannel inbox", body: "Every message from every channel in one collaborative queue." },
  { icon: Bot, title: "Grounded AI agents", body: "Answers drawn only from your knowledge base, with confidence and handoff." },
  { icon: Workflow, title: "Visual chatbot builder", body: "Design, test and version conversation flows without code." },
  { icon: Megaphone, title: "Consent-first broadcasts", body: "Template campaigns with opt-out enforcement built in." },
  { icon: BarChart3, title: "Actionable analytics", body: "SLA compliance, response times and AI containment at a glance." },
  { icon: Plug, title: "Official integrations", body: "WhatsApp Cloud API, email, web chat and social via adapters." },
];

const channels = [
  { icon: MessageSquare, label: "WhatsApp", color: "#25D366" },
  { icon: Mail, label: "Email", color: "#06B6D4" },
  { icon: MessageSquare, label: "Web Chat", color: "#06B6D4" },
  { icon: MessageCircle, label: "Messenger", color: "#1877F2" },
  { icon: Camera, label: "Instagram", color: "#E1306C" },
  { icon: Phone, label: "SMS", color: "#647985" },
];

const testimonials = [
  { quote: "We cut first-response time in half and finally see every channel in one place.", name: "Priya Nadella", role: "Head of Support, Grovefield" },
  { quote: "The AI drafts save my team hours a day and it never guesses at policy.", name: "Marcus Bell", role: "CX Lead, Bluewave" },
  { quote: "Setting up broadcasts with built-in consent gave our legal team confidence.", name: "Ana Ruiz", role: "Marketing Manager, Tanka" },
];

const plans = [
  { name: "Starter", price: "R0", suffix: "/mo", features: ["1 inbox", "3 team members", "Website chat", "Basic reports"], featured: false },
  { name: "Growth", price: "R900", suffix: "/mo", features: ["Multiple channels", "10 team members", "AI agents & chatbots", "Advanced reports"], featured: true },
  { name: "Business", price: "R2 700", suffix: "/mo", features: ["Higher limits", "Multiple teams", "Advanced routing", "API access"], featured: false },
  { name: "Enterprise", price: "Custom", suffix: "", features: ["SSO", "Security review", "Dedicated support", "Audit logs"], featured: false },
];
