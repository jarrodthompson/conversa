import Link from "next/link";
import { LogoWordmark } from "@/components/brand/logo";

const groups = [
  {
    title: "Product",
    links: [
      { href: "/features/ai-agents", label: "AI Agents" },
      { href: "/features/inbox", label: "Shared Inbox" },
      { href: "/features/chatbots", label: "Chatbots" },
      { href: "/features/broadcasts", label: "Broadcasts" },
      { href: "/features/live-chat", label: "Live Chat" },
      { href: "/features/integrations", label: "Integrations" },
    ],
  },
  {
    title: "Company",
    links: [
      { href: "/about", label: "About" },
      { href: "/pricing", label: "Pricing" },
      { href: "/contact", label: "Contact" },
      { href: "/demo", label: "Book a demo" },
    ],
  },
  {
    title: "Legal",
    links: [
      { href: "/legal/privacy", label: "Privacy Policy" },
      { href: "/legal/terms", label: "Terms" },
      { href: "/legal/cookies", label: "Cookie Policy" },
    ],
  },
];

export function SiteFooter() {
  return (
    <footer className="border-t border-border bg-card">
      <div className="mx-auto grid max-w-6xl gap-10 px-4 py-14 sm:px-6 md:grid-cols-[1.5fr_repeat(3,1fr)]">
        <div className="max-w-xs">
          <LogoWordmark />
          <p className="mt-3 text-sm text-muted-foreground">
            Every conversation. One intelligent workspace. Bring customer
            messages, support teams and AI agents together.
          </p>
        </div>
        {groups.map((g) => (
          <div key={g.title}>
            <h4 className="mb-3 text-sm font-semibold text-foreground">{g.title}</h4>
            <ul className="space-y-2">
              {g.links.map((l) => (
                <li key={l.href}>
                  <Link
                    href={l.href}
                    className="text-sm text-muted-foreground transition-colors hover:text-foreground"
                  >
                    {l.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
      <div className="border-t border-border">
        <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-2 px-4 py-6 text-xs text-muted-foreground sm:flex-row sm:px-6">
          <p>© {new Date().getFullYear()} Conversa. Demonstration product.</p>
          <p>Built as an original platform — not affiliated with any other brand.</p>
        </div>
      </div>
    </footer>
  );
}
