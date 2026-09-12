"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Building2, UserRound, Users, Inbox, Tag, Timer, Clock, CreditCard,
} from "lucide-react";
import { cn } from "@/lib/utils";

const ITEMS = [
  { href: "/app/settings", label: "General", icon: Building2, exact: true },
  { href: "/app/settings/profile", label: "My Profile", icon: UserRound },
  { href: "/app/settings/team", label: "Team & Roles", icon: Users },
  { href: "/app/settings/inboxes", label: "Inboxes", icon: Inbox },
  { href: "/app/settings/tags", label: "Tags", icon: Tag },
  { href: "/app/settings/sla", label: "SLA Policies", icon: Timer },
  { href: "/app/settings/business-hours", label: "Business Hours", icon: Clock },
  { href: "/app/settings/billing", label: "Billing", icon: CreditCard },
];

export function SettingsNav() {
  const pathname = usePathname();
  return (
    <aside className="hidden w-56 shrink-0 flex-col border-r border-border bg-card md:flex">
      <div className="px-4 py-3.5">
        <h2 className="text-sm font-semibold">Settings</h2>
      </div>
      <nav className="flex-1 space-y-0.5 overflow-y-auto px-2 pb-4">
        {ITEMS.map((i) => {
          const active = i.exact ? pathname === i.href : pathname.startsWith(i.href);
          return (
            <Link
              key={i.href}
              href={i.href}
              className={cn(
                "flex items-center gap-2.5 rounded-[8px] px-2.5 py-2 text-sm transition-colors",
                active ? "bg-secondary font-medium text-secondary-foreground" : "text-foreground hover:bg-muted",
              )}
            >
              <i.icon className={cn("size-4", active ? "text-primary" : "text-muted-foreground")} />
              {i.label}
            </Link>
          );
        })}
      </nav>
    </aside>
  );
}
