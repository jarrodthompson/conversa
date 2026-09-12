import Link from "next/link";
import { Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

const plans = [
  { name: "Starter", price: "$0", suffix: "/mo", features: ["1 inbox", "3 team members", "Website chat", "Basic reports", "Limited AI resolutions"], featured: false },
  { name: "Growth", price: "$49", suffix: "/mo", features: ["Multiple channels", "10 team members", "AI agents & chatbots", "Broadcasts", "Advanced reports"], featured: true },
  { name: "Business", price: "$149", suffix: "/mo", features: ["Higher usage limits", "Multiple teams", "Advanced routing", "Custom roles", "API access", "Priority support"], featured: false },
  { name: "Enterprise", price: "Custom", suffix: "", features: ["Custom usage", "SSO", "Security review", "Dedicated support", "Custom data retention", "Advanced audit logs"], featured: false },
];

export default function PricingPage() {
  return (
    <div className="mx-auto max-w-6xl px-4 py-20 sm:px-6">
      <div className="mx-auto max-w-2xl text-center">
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-primary">Pricing</p>
        <h1 className="mt-3 text-4xl font-extrabold tracking-tight">Plans that grow with your team</h1>
        <p className="mt-3 text-muted-foreground">Demonstration pricing — configure real commercial plans before launch.</p>
      </div>
      <div className="mt-12 grid gap-4 md:grid-cols-4">
        {plans.map((p) => (
          <div key={p.name} className={`flex flex-col rounded-[12px] border bg-card p-6 shadow-sm ${p.featured ? "border-primary ring-1 ring-primary" : "border-border"}`}>
            {p.featured && <Badge variant="primary" className="mb-2 w-fit">Popular</Badge>}
            <h3 className="font-semibold">{p.name}</h3>
            <p className="mt-2 text-3xl font-bold">{p.price}<span className="text-sm font-normal text-muted-foreground">{p.suffix}</span></p>
            <ul className="mt-4 flex-1 space-y-2">
              {p.features.map((f) => (
                <li key={f} className="flex items-start gap-2 text-sm text-muted-foreground"><Check className="mt-0.5 size-4 shrink-0 text-success" />{f}</li>
              ))}
            </ul>
            <Link href="/register" className="mt-6"><Button className="w-full" variant={p.featured ? "primary" : "outline"}>Start free</Button></Link>
          </div>
        ))}
      </div>
      <p className="mt-6 text-center text-xs text-muted-foreground">Prices shown are demonstration data.</p>
    </div>
  );
}
