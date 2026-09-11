"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import { Check } from "lucide-react";
import { createOrganisationAction, type OnboardingState } from "@/lib/onboarding/actions";
import { LogoWordmark } from "@/components/brand/logo";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

const STEPS = [
  "Create organisation", "Select industry", "Invite team members", "Connect a channel",
  "Import contacts", "Add knowledge", "Configure AI agent", "Install widget", "Send a test",
];

const INDUSTRIES = ["Retail & E-commerce", "SaaS & Technology", "Financial Services", "Healthcare", "Travel & Hospitality", "Education", "Other"];

function SubmitButton() {
  const { pending } = useFormStatus();
  return <Button type="submit" className="w-full" disabled={pending}>{pending ? "Creating…" : "Create workspace"}</Button>;
}

export default function OnboardingPage() {
  const [state, formAction] = useActionState<OnboardingState, FormData>(createOrganisationAction, undefined);

  return (
    <div className="grid min-h-screen lg:grid-cols-[1fr_380px]">
      <div className="flex flex-col justify-center px-6 py-10 sm:px-16">
        <LogoWordmark />
        <div className="mt-10 max-w-md">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-primary">Step 1 of 9</p>
          <h1 className="mt-2 text-3xl font-bold tracking-tight">Create your organisation</h1>
          <p className="mt-2 text-muted-foreground">This is your workspace — you can invite your team and connect channels next.</p>

          <form action={formAction} className="mt-8 space-y-4">
            {state?.error && (
              <p className="rounded-[10px] border border-error/30 bg-error/10 px-3 py-2 text-sm text-error">{state.error}</p>
            )}
            <div className="space-y-1.5">
              <Label htmlFor="name">Organisation name</Label>
              <Input id="name" name="name" placeholder="Grovefield Supplies" required />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="industry">Industry</Label>
              <select
                id="industry"
                name="industry"
                className="flex h-9 w-full rounded-[10px] border border-input bg-card px-3 text-sm outline-none focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/40"
              >
                {INDUSTRIES.map((i) => <option key={i}>{i}</option>)}
              </select>
            </div>
            <SubmitButton />
          </form>
        </div>
      </div>

      <aside className="hidden bg-sidebar p-10 lg:block">
        <h2 className="text-sm font-semibold text-white">Getting set up</h2>
        <ul className="mt-6 space-y-3">
          {STEPS.map((s, i) => (
            <li key={s} className="flex items-center gap-3 text-sm">
              <span className={`flex size-6 items-center justify-center rounded-full text-xs ${i === 0 ? "bg-primary text-white" : "border border-sidebar-muted/40 text-sidebar-muted"}`}>
                {i === 0 ? <Check className="size-3.5" /> : i + 1}
              </span>
              <span className={i === 0 ? "text-white" : "text-sidebar-muted"}>{s}</span>
            </li>
          ))}
        </ul>
        <p className="mt-8 text-xs text-sidebar-muted">Remaining steps open inside the app once your workspace exists.</p>
      </aside>
    </div>
  );
}
