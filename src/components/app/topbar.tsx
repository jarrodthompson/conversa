"use client";

import { useRouter } from "next/navigation";
import Link from "next/link";
import { useTransition } from "react";
import {
  Search,
  Plus,
  Bell,
  HelpCircle,
  ChevronsUpDown,
  Check,
  Building2,
  LogOut,
  User,
  Settings,
} from "lucide-react";
import { Avatar } from "@/components/ui/avatar";
import { Menu, MenuItem, MenuLabel, MenuSeparator } from "@/components/ui/menu";
import { switchOrgAction } from "@/lib/auth/org-actions";
import { signOutAction } from "@/lib/auth/actions";
import { ROLE_LABELS, type Role } from "@/lib/auth/roles";
import type { Membership } from "@/lib/auth/context";

interface TopbarProps {
  orgName: string;
  orgId: string;
  memberships: Membership[];
  userName: string;
  userEmail: string;
  avatarUrl: string | null;
  role: string;
}

export function Topbar({
  orgName,
  orgId,
  memberships,
  userName,
  userEmail,
  avatarUrl,
  role,
}: TopbarProps) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  function switchOrg(id: string) {
    if (id === orgId) return;
    startTransition(async () => {
      await switchOrgAction(id);
      router.refresh();
    });
  }

  return (
    <header className="flex h-14 shrink-0 items-center gap-3 border-b border-border bg-card px-4">
      {/* Global search */}
      <div className="relative hidden max-w-md flex-1 sm:block">
        <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
        <input
          type="search"
          placeholder="Search conversations, contacts…"
          className="h-9 w-full rounded-[10px] border border-input bg-background pl-9 pr-3 text-sm outline-none focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/40"
        />
      </div>

      <div className="ml-auto flex items-center gap-1">
        {/* Create */}
        <Menu
          align="end"
          trigger={
            <span className="inline-flex h-9 items-center gap-1.5 rounded-[10px] bg-primary px-3 text-sm font-medium text-primary-foreground hover:bg-cyan-600">
              <Plus className="size-4" /> Create
            </span>
          }
        >
          <MenuLabel>Create new</MenuLabel>
          <Link href="/app/contacts?new=1"><MenuItem>New contact</MenuItem></Link>
          <Link href="/app/broadcasts?new=1"><MenuItem>New broadcast</MenuItem></Link>
          <Link href="/app/ai-agents?new=1"><MenuItem>New AI agent</MenuItem></Link>
          <Link href="/app/knowledge?new=1"><MenuItem>New article</MenuItem></Link>
        </Menu>

        {/* Notifications */}
        <Link
          href="/app/notifications"
          className="relative flex size-9 items-center justify-center rounded-[10px] text-muted-foreground hover:bg-muted"
          aria-label="Notifications"
        >
          <Bell className="size-[18px]" />
          <span className="absolute right-2 top-2 size-1.5 rounded-full bg-error" />
        </Link>

        {/* Help */}
        <Link
          href="/legal/privacy"
          className="flex size-9 items-center justify-center rounded-[10px] text-muted-foreground hover:bg-muted"
          aria-label="Help"
        >
          <HelpCircle className="size-[18px]" />
        </Link>

        {/* Org switcher */}
        <Menu
          align="end"
          trigger={
            <span className="ml-1 inline-flex h-9 items-center gap-2 rounded-[10px] border border-border bg-background px-2.5 text-sm font-medium hover:bg-muted">
              <Building2 className="size-4 text-primary" />
              <span className="hidden max-w-[140px] truncate sm:inline">{orgName}</span>
              <ChevronsUpDown className="size-3.5 text-muted-foreground" />
            </span>
          }
        >
          <MenuLabel>Organisations</MenuLabel>
          {memberships.map((m) => (
            <MenuItem
              key={m.organisation_id}
              onClick={() => switchOrg(m.organisation_id)}
              disabled={pending}
            >
              <Building2 />
              <span className="flex-1 truncate">{m.organisation.name}</span>
              {m.organisation_id === orgId && <Check className="text-primary" />}
            </MenuItem>
          ))}
          <MenuSeparator />
          <Link href="/onboarding"><MenuItem><Plus /> New organisation</MenuItem></Link>
        </Menu>

        {/* User menu */}
        <Menu
          align="end"
          trigger={<Avatar name={userName} src={avatarUrl} size={34} className="ml-1" />}
        >
          <div className="px-2.5 py-2">
            <p className="truncate text-sm font-semibold">{userName}</p>
            <p className="truncate text-xs text-muted-foreground">{userEmail}</p>
            <p className="mt-1 text-xs text-primary">{ROLE_LABELS[role as Role] ?? role}</p>
          </div>
          <MenuSeparator />
          <Link href="/app/settings/profile"><MenuItem><User /> My profile</MenuItem></Link>
          <Link href="/app/settings"><MenuItem><Settings /> Settings</MenuItem></Link>
          <MenuSeparator />
          <form action={signOutAction}>
            <MenuItem type="submit" className="text-error hover:bg-error/10">
              <LogOut /> Sign out
            </MenuItem>
          </form>
        </Menu>
      </div>
    </header>
  );
}
