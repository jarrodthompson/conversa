"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { LogoMark } from "@/components/brand/logo";
import { PRIMARY_NAV } from "@/components/app/nav-config";
import { can } from "@/lib/auth/roles";
import { cn } from "@/lib/utils";

export function PrimarySidebar({ role }: { role: string }) {
  const pathname = usePathname();
  const items = PRIMARY_NAV.filter((i) => can(role, i.capability));

  return (
    <nav
      className="flex w-16 shrink-0 flex-col items-center gap-1 bg-sidebar py-3"
      aria-label="Primary"
    >
      <Link
        href="/app/inbox"
        className="mb-3 flex size-10 items-center justify-center rounded-[12px] bg-sidebar-hover"
        aria-label="Conversa"
      >
        <LogoMark size={24} />
      </Link>

      {items.map((item) => {
        const active = pathname.startsWith(item.href);
        return (
          <Link
            key={item.href}
            href={item.href}
            title={item.label}
            aria-current={active ? "page" : undefined}
            className={cn(
              "group relative flex size-11 items-center justify-center rounded-[12px] transition-colors",
              active
                ? "bg-sidebar-active text-white"
                : "text-sidebar-muted hover:bg-sidebar-hover hover:text-sidebar-foreground",
            )}
          >
            <item.icon className="size-[20px]" />
            <span className="pointer-events-none absolute left-[110%] z-50 hidden whitespace-nowrap rounded-md bg-sidebar-deep px-2 py-1 text-xs text-white shadow-lg group-hover:block">
              {item.label}
            </span>
          </Link>
        );
      })}
    </nav>
  );
}
