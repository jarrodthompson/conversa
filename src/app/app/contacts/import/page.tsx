"use client";

import { useMemo, useRef, useState, useTransition } from "react";
import Link from "next/link";
import { toast } from "sonner";
import {
  ArrowLeft, UploadCloud, FileSpreadsheet, CheckCircle2, ShieldCheck, AlertTriangle, Users,
} from "lucide-react";
import { parseCSV, guessMapping, isValidEmail, CONTACT_FIELDS, type ContactFieldKey } from "@/lib/contacts/csv";
import { importContactsAction, type MappedRow, type ImportSummary } from "@/lib/contacts/import-actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

const selectCls = "h-9 w-full rounded-[10px] border border-input bg-card px-2 text-sm outline-none focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/40";
const MAX_BYTES = 5 * 1024 * 1024;

export default function ImportPage() {
  const [step, setStep] = useState<"upload" | "map" | "done">("upload");
  const [fileName, setFileName] = useState("");
  const [headers, setHeaders] = useState<string[]>([]);
  const [rows, setRows] = useState<string[][]>([]);
  const [mapping, setMapping] = useState<Record<ContactFieldKey, number>>({} as Record<ContactFieldKey, number>);
  const [consent, setConsent] = useState<"opted_in" | "unknown">("unknown");
  const [consentSource, setConsentSource] = useState("");
  const [summary, setSummary] = useState<ImportSummary | null>(null);
  const [pending, start] = useTransition();
  const fileInput = useRef<HTMLInputElement>(null);

  async function onFile(file: File) {
    if (!/\.csv$/i.test(file.name) && file.type !== "text/csv") { toast.error("Please choose a .csv file"); return; }
    if (file.size > MAX_BYTES) { toast.error("File is larger than 5 MB"); return; }
    const text = await file.text();
    const { headers, rows } = parseCSV(text);
    if (headers.length === 0 || rows.length === 0) { toast.error("No data rows found in that file"); return; }
    setFileName(file.name);
    setHeaders(headers);
    setRows(rows);
    setMapping(guessMapping(headers));
    setStep("map");
  }

  const stats = useMemo(() => {
    const emailIdx = mapping.email ?? -1;
    const phoneIdx = mapping.phone ?? -1;
    let valid = 0, invalidEmail = 0, noIdentifier = 0;
    const seenEmail = new Set<string>();
    let dupInFile = 0;
    for (const r of rows) {
      const email = emailIdx >= 0 ? (r[emailIdx] ?? "").trim().toLowerCase() : "";
      const phone = phoneIdx >= 0 ? (r[phoneIdx] ?? "").trim() : "";
      const emailOk = email ? isValidEmail(email) : false;
      if (email && !emailOk) invalidEmail++;
      if (!(emailOk || phone)) { noIdentifier++; continue; }
      if (emailOk) { if (seenEmail.has(email)) dupInFile++; else seenEmail.add(email); }
      valid++;
    }
    return { total: rows.length, valid, invalidEmail, noIdentifier, dupInFile };
  }, [rows, mapping]);

  function buildRows(): MappedRow[] {
    return rows.map((r) => {
      const out: MappedRow = {};
      for (const f of CONTACT_FIELDS) {
        const idx = mapping[f.key];
        if (idx >= 0) (out as Record<string, string>)[f.key] = (r[idx] ?? "").trim();
      }
      return out;
    });
  }

  function runImport() {
    start(async () => {
      const res = await importContactsAction(buildRows(), { consent, consentSource: consentSource.trim() || undefined });
      if (res.error) { toast.error(res.error); return; }
      setSummary(res);
      setStep("done");
      toast.success(`Imported: ${res.created} new, ${res.updated} updated`);
    });
  }

  return (
    <div className="h-full overflow-y-auto p-6">
      <div className="mx-auto max-w-3xl">
        <Link href="/app/contacts" className="mb-4 inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground">
          <ArrowLeft className="size-4" /> Back to contacts
        </Link>

        <Steps step={step} />

        {step === "upload" && (
          <div
            onDragOver={(e) => e.preventDefault()}
            onDrop={(e) => { e.preventDefault(); if (e.dataTransfer.files[0]) onFile(e.dataTransfer.files[0]); }}
            className="mt-6 flex flex-col items-center justify-center rounded-[14px] border-2 border-dashed border-border bg-card px-6 py-16 text-center"
          >
            <div className="flex size-14 items-center justify-center rounded-full bg-secondary text-primary"><UploadCloud className="size-7" /></div>
            <h2 className="mt-4 text-lg font-semibold">Import contacts from CSV</h2>
            <p className="mt-1 max-w-md text-sm text-muted-foreground">
              Drag a .csv file here, or choose one. The first row should be column headers
              (name, email, phone, company, tags…). Up to 5 MB.
            </p>
            <input ref={fileInput} type="file" accept=".csv,text/csv" hidden onChange={(e) => e.target.files?.[0] && onFile(e.target.files[0])} />
            <Button className="mt-5" onClick={() => fileInput.current?.click()}><FileSpreadsheet className="size-4" /> Choose file</Button>
          </div>
        )}

        {step === "map" && (
          <div className="mt-6 space-y-4">
            <div className="flex items-center gap-2 rounded-[10px] border border-border bg-card px-4 py-2.5 text-sm">
              <FileSpreadsheet className="size-4 text-primary" />
              <span className="font-medium">{fileName}</span>
              <span className="text-muted-foreground">· {rows.length} rows · {headers.length} columns</span>
            </div>

            {/* Mapping */}
            <div className="rounded-[12px] border border-border bg-card p-5">
              <h3 className="text-sm font-semibold">Map columns</h3>
              <p className="mt-1 text-xs text-muted-foreground">We guessed these from your headers — adjust as needed. Email or phone is required per contact.</p>
              <div className="mt-4 grid gap-3 sm:grid-cols-2">
                {CONTACT_FIELDS.map((f) => (
                  <div key={f.key} className="flex items-center gap-2">
                    <Label className="w-32 shrink-0">{f.label}</Label>
                    <select
                      value={mapping[f.key] ?? -1}
                      onChange={(e) => setMapping({ ...mapping, [f.key]: Number(e.target.value) })}
                      className={selectCls}
                    >
                      <option value={-1}>— Ignore —</option>
                      {headers.map((h, i) => <option key={i} value={i}>{h}</option>)}
                    </select>
                  </div>
                ))}
              </div>
            </div>

            {/* Stats */}
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              <StatCard icon={CheckCircle2} label="Ready to import" value={stats.valid} tone="text-success" />
              <StatCard icon={AlertTriangle} label="Invalid email" value={stats.invalidEmail} tone="text-warning" />
              <StatCard icon={AlertTriangle} label="No email/phone" value={stats.noIdentifier} tone="text-error" />
              <StatCard icon={Users} label="Duplicates in file" value={stats.dupInFile} tone="text-muted-foreground" />
            </div>

            {/* Preview */}
            <div className="overflow-hidden rounded-[12px] border border-border bg-card">
              <div className="border-b border-border px-4 py-2.5 text-sm font-semibold">Preview (first 5)</div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-muted/40 text-left text-xs uppercase tracking-wide text-muted-foreground">
                      {CONTACT_FIELDS.filter((f) => (mapping[f.key] ?? -1) >= 0).map((f) => <th key={f.key} className="px-3 py-2 font-medium">{f.label}</th>)}
                    </tr>
                  </thead>
                  <tbody>
                    {rows.slice(0, 5).map((r, i) => (
                      <tr key={i} className="border-t border-border">
                        {CONTACT_FIELDS.filter((f) => (mapping[f.key] ?? -1) >= 0).map((f) => (
                          <td key={f.key} className="px-3 py-2 text-muted-foreground">{r[mapping[f.key]] ?? ""}</td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Consent */}
            <div className="rounded-[12px] border border-border bg-card p-5">
              <h3 className="flex items-center gap-1.5 text-sm font-semibold"><ShieldCheck className="size-4 text-primary" /> Consent</h3>
              <p className="mt-1 text-xs text-muted-foreground">Only import contacts you have a lawful basis to message. Consent is recorded per contact.</p>
              <div className="mt-3 space-y-2">
                <label className="flex items-start gap-2 text-sm">
                  <input type="radio" name="consent" checked={consent === "unknown"} onChange={() => setConsent("unknown")} className="mt-0.5" />
                  <span><strong>Unknown</strong> — import without marketing consent (they will not receive broadcasts until they opt in).</span>
                </label>
                <label className="flex items-start gap-2 text-sm">
                  <input type="radio" name="consent" checked={consent === "opted_in"} onChange={() => setConsent("opted_in")} className="mt-0.5" />
                  <span><strong>Opted in</strong> — I confirm these contacts have consented to be contacted.</span>
                </label>
                {consent === "opted_in" && (
                  <div className="pl-6">
                    <Label>Consent source</Label>
                    <Input className="mt-1 max-w-sm" value={consentSource} onChange={(e) => setConsentSource(e.target.value)} placeholder="e.g. website sign-up form, event registration" />
                  </div>
                )}
              </div>
            </div>

            <div className="flex items-center justify-between">
              <Button variant="outline" onClick={() => setStep("upload")}>Choose a different file</Button>
              <Button onClick={runImport} disabled={pending || stats.valid === 0}>
                {pending ? "Importing…" : `Import ${stats.valid} contacts`}
              </Button>
            </div>
          </div>
        )}

        {step === "done" && summary && (
          <div className="mt-6 rounded-[14px] border border-border bg-card p-8 text-center">
            <div className="mx-auto flex size-14 items-center justify-center rounded-full bg-success/12 text-success"><CheckCircle2 className="size-7" /></div>
            <h2 className="mt-4 text-lg font-semibold">Import complete</h2>
            <div className="mx-auto mt-5 grid max-w-lg grid-cols-2 gap-3 sm:grid-cols-4">
              <StatCard label="Created" value={summary.created} tone="text-success" />
              <StatCard label="Updated" value={summary.updated} tone="text-primary" />
              <StatCard label="Skipped" value={summary.invalid} tone="text-muted-foreground" />
              <StatCard label="Tags linked" value={summary.tagsLinked} tone="text-foreground" />
            </div>
            <div className="mt-6 flex items-center justify-center gap-2">
              <Link href="/app/contacts"><Button>View contacts</Button></Link>
              <Button variant="outline" onClick={() => { setStep("upload"); setSummary(null); setRows([]); setHeaders([]); }}>Import another</Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function Steps({ step }: { step: "upload" | "map" | "done" }) {
  const items = [{ k: "upload", l: "Upload" }, { k: "map", l: "Map & review" }, { k: "done", l: "Done" }];
  const idx = items.findIndex((i) => i.k === step);
  return (
    <div className="flex items-center gap-2">
      {items.map((it, i) => (
        <div key={it.k} className="flex items-center gap-2">
          <span className={cn("flex size-6 items-center justify-center rounded-full text-xs font-semibold", i <= idx ? "bg-primary text-white" : "bg-muted text-muted-foreground")}>{i + 1}</span>
          <span className={cn("text-sm", i <= idx ? "font-medium text-foreground" : "text-muted-foreground")}>{it.l}</span>
          {i < items.length - 1 && <span className="mx-1 h-px w-8 bg-border" />}
        </div>
      ))}
    </div>
  );
}

function StatCard({ icon: Icon, label, value, tone }: { icon?: typeof Users; label: string; value: number; tone: string }) {
  return (
    <div className="rounded-[10px] border border-border bg-card p-3 text-center">
      {Icon && <Icon className={cn("mx-auto mb-1 size-4", tone)} />}
      <p className={cn("text-2xl font-bold", tone)}>{value}</p>
      <p className="text-xs text-muted-foreground">{label}</p>
    </div>
  );
}
