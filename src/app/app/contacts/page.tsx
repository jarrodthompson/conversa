import Link from "next/link";
import { Users, Upload, Download, Plus } from "lucide-react";
import { getAppContext } from "@/lib/auth/context";
import { createClient } from "@/lib/supabase/server";
import { PageHeader } from "@/components/app/page-header";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar } from "@/components/ui/avatar";
import { EmptyState } from "@/components/app/empty-state";

interface Contact {
  id: string; first_name: string | null; last_name: string | null;
  email: string | null; phone: string | null; company: string | null;
  consent_status: string | null; last_contacted_at: string | null;
}

export default async function ContactsPage() {
  const { org } = await getAppContext();
  const supabase = await createClient();
  const { data } = await supabase
    .from("contacts")
    .select("id, first_name, last_name, email, phone, company, consent_status, last_contacted_at")
    .eq("organisation_id", org.id)
    .is("deleted_at", null)
    .order("created_at", { ascending: false })
    .limit(100);
  const contacts = (data ?? []) as unknown as Contact[];

  return (
    <div className="h-full overflow-y-auto p-6">
      <PageHeader
        title="Contacts"
        description="Your unified customer database across every channel."
        actions={
          <>
            <Link href="/app/contacts/import"><Button variant="outline" size="sm"><Upload className="size-4" /> Import CSV</Button></Link>
            <Button variant="outline" size="sm"><Download className="size-4" /> Export</Button>
            <Button size="sm"><Plus className="size-4" /> New contact</Button>
          </>
        }
      />

      <div className="mt-6 overflow-hidden rounded-[12px] border border-border bg-card">
        {contacts.length === 0 ? (
          <div className="p-6">
            <EmptyState icon={Users} title="No contacts yet" description="Import a CSV or add your first contact to get started." />
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-muted/40 text-left text-xs uppercase tracking-wide text-muted-foreground">
                <th className="px-4 py-3 font-medium">Name</th>
                <th className="px-4 py-3 font-medium">Email</th>
                <th className="px-4 py-3 font-medium">Phone</th>
                <th className="px-4 py-3 font-medium">Company</th>
                <th className="px-4 py-3 font-medium">Consent</th>
              </tr>
            </thead>
            <tbody>
              {contacts.map((c) => {
                const name = [c.first_name, c.last_name].filter(Boolean).join(" ") || "—";
                return (
                  <tr key={c.id} className="border-b border-border last:border-0 hover:bg-muted/30">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2.5">
                        <Avatar name={name} size={30} />
                        <span className="font-medium">{name}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">{c.email ?? "—"}</td>
                    <td className="px-4 py-3 text-muted-foreground">{c.phone ?? "—"}</td>
                    <td className="px-4 py-3 text-muted-foreground">{c.company ?? "—"}</td>
                    <td className="px-4 py-3">
                      <Badge variant={c.consent_status === "opted_in" ? "success" : c.consent_status === "opted_out" ? "error" : "muted"}>
                        {c.consent_status ?? "unknown"}
                      </Badge>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>
      <p className="mt-3 text-xs text-muted-foreground">
        Showing {contacts.length} contacts. CSV import/export and merge are part of the contacts module build-out.
      </p>
    </div>
  );
}
