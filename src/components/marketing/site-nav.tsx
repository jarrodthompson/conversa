import Link from "next/link";
import { LogoWordmark } from "@/components/brand/logo";
import { Button } from "@/components/ui/button";

const links = [
  { href: "/features/ai-agents", label: "AI Agents" },
  { href: "/features/inbox", label: "Shared Inbox" },
  { href: "/features/chatbots", label: "Chatbots" },
  { href: "/features/broadcasts", label: "Broadcasts" },
  { href: "/pricing", label: "Pricing" },
  { href: "/about", label: "About" },
];

export function SiteNav() {
  return (
    <header className="sticky top-0 z-50 border-b border-border bg-background/85 backdrop-blur">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4 sm:px-6">
        <div className="flex items-center gap-8">
          <Link href="/" aria-label="Conversa home">
            <LogoWordmark />
          </Link>
          <nav className="hidden items-center gap-1 md:flex">
            {links.map((l) => (
              <Link
                key={l.href}
                href={l.href}
                className="rounded-[8px] px-3 py-2 text-sm font-medium text-secondary-foreground/80 transition-colors hover:bg-muted hover:text-foreground"
              >
                {l.label}
              </Link>
            ))}
          </nav>
        </div>
        <div className="flex items-center gap-2">
          <Link href="/login">
            <Button variant="ghost" size="sm">
              Sign in
            </Button>
          </Link>
          <Link href="/register">
            <Button size="sm">Start free</Button>
          </Link>
        </div>
      </div>
    </header>
  );
}
