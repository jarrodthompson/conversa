"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Mail, CheckCircle2, AlertTriangle, Send, PlugZap, Unplug } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import {
  connectEmailAction,
  disconnectEmailAction,
  sendTestEmailAction,
  type EmailConnectPayload,
} from "@/lib/channels/email/connect-actions";

interface Props {
  connected: boolean;
  providerConfigured: boolean;
  config: { sender_name?: string | null; from_address?: string | null; inbound_address?: string | null; reply_to?: string | null };
  canManage: boolean;
  defaultTestTo: string;
  webhookUrl: string;
}

export function EmailConnectForm({ connected, providerConfigured, config, canManage, defaultTestTo, webhookUrl }: Props) {
  const router = useRouter();
  const [form, setForm] = useState<EmailConnectPayload>({
    senderName: config.sender_name ?? "",
    fromAddress: config.from_address ?? "",
    inboundAddress: config.inbound_address ?? "",
    replyTo: config.reply_to ?? "",
  });
  const [testTo, setTestTo] = useState(defaultTestTo);
  const [saving, startSave] = useTransition();
  const [testing, startTest] = useTransition();
  const [disc, startDisc] = useTransition();

  const set = (k: keyof EmailConnectPayload) => (e: React.ChangeEvent<HTMLInputElement>) => setForm({ ...form, [k]: e.target.value });

  function save() {
    startSave(async () => {
      const res = await connectEmailAction(form);
      if (res?.error) toast.error(res.error);
      else { toast.success("Email channel connected"); router.refresh(); }
    });
  }

  function disconnect() {
    startDisc(async () => {
      const res = await disconnectEmailAction();
      if (res?.error) toast.error(res.error);
      else { toast.success("Email channel disconnected"); router.refresh(); }
    });
  }

  function test() {
    startTest(async () => {
      const res = await sendTestEmailAction(testTo, form.fromAddress);
      if (res?.error) toast.error(res.error);
      else if (res.simulated) toast.warning(res.message);
      else toast.success(res.message ?? "Test email sent");
    });
  }

  return (
    <div className="max-w-2xl space-y-5">
      {/* Provider status */}
      <Card>
        <CardContent className="flex items-start gap-3 p-4">
          {providerConfigured ? <CheckCircle2 className="mt-0.5 size-5 shrink-0 text-success" /> : <AlertTriangle className="mt-0.5 size-5 shrink-0 text-warning" />}
          <div className="text-sm">
            <p className="font-medium">
              {providerConfigured ? "Resend API key detected on the server" : "No Resend API key configured"}
            </p>
            <p className="mt-0.5 text-muted-foreground">
              {providerConfigured
                ? "Outbound email will be delivered through Resend. The key is stored server-side only — never in the browser or database."
                : "Add RESEND_API_KEY to the server environment (.env.local locally, Project → Settings → Environment Variables on Vercel) and redeploy, then reconnect."}
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Connection form */}
      <Card>
        <CardContent className="space-y-4 p-5">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Mail className="size-5 text-primary" />
              <h2 className="font-semibold">Email (Resend)</h2>
            </div>
            {connected ? <Badge variant="success">Connected</Badge> : <Badge variant="warning">Simulated</Badge>}
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <Label htmlFor="senderName">Sender name</Label>
              <Input id="senderName" className="mt-1" value={form.senderName} onChange={set("senderName")} placeholder="Grovefield Support" disabled={!canManage} />
            </div>
            <div>
              <Label htmlFor="from">From address</Label>
              <Input id="from" className="mt-1" value={form.fromAddress} onChange={set("fromAddress")} placeholder="support@yourdomain.com" disabled={!canManage} />
              <p className="mt-1 text-xs text-muted-foreground">Must be on a domain you&apos;ve verified in Resend.</p>
            </div>
            <div>
              <Label htmlFor="inbound">Inbound address</Label>
              <Input id="inbound" className="mt-1" value={form.inboundAddress} onChange={set("inboundAddress")} placeholder="support@yourdomain.com" disabled={!canManage} />
              <p className="mt-1 text-xs text-muted-foreground">Incoming mail to this address is routed into your inbox.</p>
            </div>
            <div>
              <Label htmlFor="replyTo">Reply-to (optional)</Label>
              <Input id="replyTo" className="mt-1" value={form.replyTo} onChange={set("replyTo")} placeholder="Defaults to the inbound address" disabled={!canManage} />
            </div>
          </div>

          {canManage && (
            <div className="flex flex-wrap gap-2 pt-1">
              <Button onClick={save} disabled={saving}>
                <PlugZap className="size-4" /> {connected ? "Save changes" : "Save & connect"}
              </Button>
              {connected && (
                <Button variant="outline" onClick={disconnect} disabled={disc}>
                  <Unplug className="size-4" /> Disconnect
                </Button>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Test send */}
      <Card>
        <CardContent className="space-y-3 p-5">
          <h2 className="font-semibold">Send a test email</h2>
          <p className="text-sm text-muted-foreground">Delivers a real message through Resend so you can confirm the From address and API key work end-to-end.</p>
          <div className="flex flex-wrap items-end gap-2">
            <div className="flex-1 min-w-[220px]">
              <Label htmlFor="testTo">Recipient</Label>
              <Input id="testTo" className="mt-1" value={testTo} onChange={(e) => setTestTo(e.target.value)} placeholder="you@example.com" />
            </div>
            <Button variant="outline" onClick={test} disabled={testing}>
              <Send className="size-4" /> Send test
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Inbound webhook */}
      <Card>
        <CardContent className="space-y-2 p-5">
          <h2 className="font-semibold">Inbound webhook</h2>
          <p className="text-sm text-muted-foreground">
            In Resend, point your inbound/webhook endpoint at the URL below and set the signing secret as <code className="rounded bg-secondary px-1">RESEND_WEBHOOK_SECRET</code> on the server.
          </p>
          <code className="block break-all rounded-[10px] border border-border bg-secondary/50 px-3 py-2 text-xs">{webhookUrl}</code>
        </CardContent>
      </Card>
    </div>
  );
}
