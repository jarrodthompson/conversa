"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Save } from "lucide-react";
import { upsertBusinessHoursAction } from "@/lib/settings/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

const DAYS: { key: string; label: string }[] = [
  { key: "mon", label: "Monday" }, { key: "tue", label: "Tuesday" }, { key: "wed", label: "Wednesday" },
  { key: "thu", label: "Thursday" }, { key: "fri", label: "Friday" }, { key: "sat", label: "Saturday" }, { key: "sun", label: "Sunday" },
];
const TIMEZONES = ["Europe/London", "Europe/Berlin", "America/New_York", "America/Los_Angeles", "Asia/Singapore", "Australia/Sydney", "UTC"];

interface Record0 { id: string | null; name: string; timezone: string; schedule: Record<string, [string, string][]> }

export function BusinessHoursManager({ record, canManage }: { record: Record0; canManage: boolean }) {
  const router = useRouter();
  const [name, setName] = useState(record.name);
  const [timezone, setTimezone] = useState(record.timezone);
  const [days, setDays] = useState(() =>
    Object.fromEntries(DAYS.map((d) => {
      const slot = record.schedule?.[d.key]?.[0];
      return [d.key, { open: !!slot, start: slot?.[0] ?? "09:00", end: slot?.[1] ?? "17:00" }];
    })),
  );
  const [pending, start] = useTransition();

  function save() {
    const schedule: Record<string, [string, string][]> = {};
    for (const d of DAYS) {
      const v = days[d.key];
      if (v.open) schedule[d.key] = [[v.start, v.end]];
    }
    start(async () => {
      const res = await upsertBusinessHoursAction(record.id, { name, timezone, schedule });
      if (res?.error) toast.error(res.error);
      else { toast.success("Business hours saved"); router.refresh(); }
    });
  }

  return (
    <div className="max-w-2xl space-y-4">
      <div className="grid gap-3 sm:grid-cols-2">
        <div><Label>Name</Label><Input className="mt-1" value={name} disabled={!canManage} onChange={(e) => setName(e.target.value)} /></div>
        <div><Label>Timezone</Label>
          <select className="mt-1 h-9 w-full rounded-[10px] border border-input bg-card px-2 text-sm outline-none focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/40" value={timezone} disabled={!canManage} onChange={(e) => setTimezone(e.target.value)}>
            {TIMEZONES.map((t) => <option key={t}>{t}</option>)}
          </select>
        </div>
      </div>

      <div className="overflow-hidden rounded-[12px] border border-border bg-card">
        <ul className="divide-y divide-border">
          {DAYS.map((d) => {
            const v = days[d.key];
            return (
              <li key={d.key} className="flex items-center gap-3 px-4 py-2.5">
                <label className="flex w-32 items-center gap-2 text-sm">
                  <input type="checkbox" checked={v.open} disabled={!canManage} onChange={(e) => setDays({ ...days, [d.key]: { ...v, open: e.target.checked } })} />
                  {d.label}
                </label>
                {v.open ? (
                  <div className="flex items-center gap-2 text-sm">
                    <input type="time" value={v.start} disabled={!canManage} onChange={(e) => setDays({ ...days, [d.key]: { ...v, start: e.target.value } })} className="h-8 rounded-[8px] border border-input bg-card px-2" />
                    <span className="text-muted-foreground">to</span>
                    <input type="time" value={v.end} disabled={!canManage} onChange={(e) => setDays({ ...days, [d.key]: { ...v, end: e.target.value } })} className="h-8 rounded-[8px] border border-input bg-card px-2" />
                  </div>
                ) : <span className="text-sm text-muted-foreground">Closed</span>}
              </li>
            );
          })}
        </ul>
      </div>

      {canManage && <Button onClick={save} disabled={pending}><Save className="size-4" /> Save business hours</Button>}
    </div>
  );
}
