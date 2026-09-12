import Link from "next/link";
import { Check } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function DemoPage() {
  return (
    <div className="mx-auto max-w-3xl px-4 py-20 sm:px-6">
      <p className="text-xs font-semibold uppercase tracking-[0.18em] text-primary">Book a demo</p>
      <h1 className="mt-3 text-4xl font-extrabold tracking-tight">See Conversa in action</h1>
      <p className="mt-4 text-lg text-muted-foreground">
        The fastest way to explore Conversa is to start a free demo workspace — it comes
        pre-loaded with example conversations, an AI agent, chatbots and reports.
      </p>
      <ul className="mt-8 space-y-3">
        {["Explore the shared inbox with live updates", "Try the AI agent and chatbot builder", "See consent-first broadcasts and analytics"].map((p) => (
          <li key={p} className="flex items-start gap-3"><Check className="mt-0.5 size-5 shrink-0 text-success" /><span className="text-sm">{p}</span></li>
        ))}
      </ul>
      <div className="mt-10 flex gap-3">
        <Link href="/register"><Button size="lg">Start free</Button></Link>
        <Link href="/login"><Button size="lg" variant="outline">Sign in</Button></Link>
      </div>
      <p className="mt-6 text-sm text-muted-foreground">A guided sales demo booking form would connect here in production.</p>
    </div>
  );
}
