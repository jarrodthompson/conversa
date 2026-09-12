import { Mail, MessageSquare, Building2 } from "lucide-react";

export default function ContactPage() {
  return (
    <div className="mx-auto max-w-3xl px-4 py-20 sm:px-6">
      <p className="text-xs font-semibold uppercase tracking-[0.18em] text-primary">Contact</p>
      <h1 className="mt-3 text-4xl font-extrabold tracking-tight">Get in touch</h1>
      <p className="mt-4 text-muted-foreground">
        Reach our team through any of the channels below.
      </p>
      <div className="mt-8 grid gap-4 sm:grid-cols-3">
        {[
          { icon: Mail, k: "Email", v: "hello@conversa.app" },
          { icon: MessageSquare, k: "Live chat", v: "Available in-app, 9–5" },
          { icon: Building2, k: "Office", v: "Remote-first" },
        ].map((x) => (
          <div key={x.k} className="rounded-[12px] border border-border bg-card p-5">
            <x.icon className="size-5 text-primary" />
            <h3 className="mt-3 font-semibold">{x.k}</h3>
            <p className="mt-1 text-sm text-muted-foreground">{x.v}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
