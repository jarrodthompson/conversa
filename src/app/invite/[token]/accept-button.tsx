"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Check } from "lucide-react";
import { acceptInviteAction } from "@/lib/team/invite-actions";
import { Button } from "@/components/ui/button";

export function AcceptButton({ token, orgName }: { token: string; orgName: string }) {
  const router = useRouter();
  const [pending, start] = useTransition();

  function accept() {
    start(async () => {
      const res = await acceptInviteAction(token);
      if (res?.error) toast.error(res.error);
      else {
        toast.success(`You've joined ${orgName}`);
        router.push("/app/inbox");
      }
    });
  }

  return (
    <Button size="lg" className="w-full" onClick={accept} disabled={pending}>
      <Check className="size-4" /> {pending ? "Joining…" : `Accept & join ${orgName}`}
    </Button>
  );
}
