"use client";

import Link from "next/link";
import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import { signUpAction, type AuthState } from "@/lib/auth/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" className="w-full" disabled={pending}>
      {pending ? "Creating account…" : "Create account"}
    </Button>
  );
}

export default function RegisterPage() {
  const [state, formAction] = useActionState<AuthState, FormData>(
    signUpAction,
    undefined,
  );

  return (
    <div>
      <h1 className="text-2xl font-bold tracking-tight">Start free</h1>
      <p className="mt-1.5 text-sm text-muted-foreground">
        Create your account and set up your first workspace.
      </p>

      <form action={formAction} className="mt-8 space-y-4">
        {state?.error && (
          <p className="rounded-[10px] border border-error/30 bg-error/10 px-3 py-2 text-sm text-error">
            {state.error}
          </p>
        )}
        {state?.message && (
          <p className="rounded-[10px] border border-success/30 bg-success/10 px-3 py-2 text-sm text-success">
            {state.message}
          </p>
        )}
        <div className="space-y-1.5">
          <Label htmlFor="fullName">Full name</Label>
          <Input id="fullName" name="fullName" autoComplete="name" placeholder="Jane Cooper" required />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="email">Work email</Label>
          <Input id="email" name="email" type="email" autoComplete="email" placeholder="you@company.com" required />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="password">Password</Label>
          <Input id="password" name="password" type="password" autoComplete="new-password" required />
          <p className="text-xs text-muted-foreground">
            At least 8 characters, with a letter and a number.
          </p>
        </div>
        <SubmitButton />
      </form>

      <p className="mt-6 text-center text-sm text-muted-foreground">
        Already have an account?{" "}
        <Link href="/login" className="font-medium text-primary hover:underline">
          Sign in
        </Link>
      </p>
    </div>
  );
}
