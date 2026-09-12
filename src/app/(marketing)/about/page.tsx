export default function AboutPage() {
  return (
    <div className="mx-auto max-w-3xl px-4 py-20 sm:px-6">
      <p className="text-xs font-semibold uppercase tracking-[0.18em] text-primary">About</p>
      <h1 className="mt-3 text-4xl font-extrabold tracking-tight">Customer service, minus the chaos</h1>
      <p className="mt-5 text-lg text-muted-foreground">
        Conversa brings every customer message, your support team and AI agents into one
        calm workspace — so people get faster, kinder answers and teams stop switching tabs.
      </p>
      <div className="mt-10 grid gap-6 sm:grid-cols-3">
        {[
          { k: "Omnichannel", v: "WhatsApp, email, web chat and social in one thread." },
          { k: "AI with guardrails", v: "Grounded answers, confidence scoring and human hand-off." },
          { k: "Built for teams", v: "Roles, routing, SLAs and analytics out of the box." },
        ].map((x) => (
          <div key={x.k} className="rounded-[12px] border border-border bg-card p-5">
            <h3 className="font-semibold">{x.k}</h3>
            <p className="mt-1 text-sm text-muted-foreground">{x.v}</p>
          </div>
        ))}
      </div>
      <p className="mt-10 text-sm text-muted-foreground">
        Conversa is an original product and is not affiliated with any other brand.
      </p>
    </div>
  );
}
