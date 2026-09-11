"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import { resetPasswordAction, type AuthState } from "@/lib/auth/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" className="w-full" disabled={pending}>
      {pending ? "Updating…" : "Update password"}
    </Button>
  );
}

export default function ResetPasswordPage() {
  const [state, formAction] = useActionState<AuthState, FormData>(
    resetPasswordAction,
    undefined,
  );

  return (
    <div>
      <h1 className="text-2xl font-bold tracking-tight">Choose a new password</h1>
      <p className="mt-1.5 text-sm text-muted-foreground">
        Enter a new password for your account.
      </p>

      <form action={formAction} className="mt-8 space-y-4">
        {state?.error && (
          <p className="rounded-[10px] border border-error/30 bg-error/10 px-3 py-2 text-sm text-error">
            {state.error}
          </p>
        )}
        <div className="space-y-1.5">
          <Label htmlFor="password">New password</Label>
          <Input id="password" name="password" type="password" autoComplete="new-password" required />
          <p className="text-xs text-muted-foreground">
            At least 8 characters, with a letter and a number.
          </p>
        </div>
        <SubmitButton />
      </form>
    </div>
  );
}
