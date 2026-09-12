import Link from "next/link";
import { LogoWordmark } from "@/components/brand/logo";

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="grid min-h-screen lg:grid-cols-2">
      {/* Form side */}
      <div className="flex flex-col px-6 py-8 sm:px-12">
        <Link href="/" className="w-fit">
          <LogoWordmark />
        </Link>
        <div className="flex flex-1 items-center justify-center py-10">
          <div className="w-full max-w-sm">{children}</div>
        </div>
        <p className="text-center text-xs text-muted-foreground">
          Not affiliated with any other brand
        </p>
      </div>

      {/* Brand side */}
      <div className="relative hidden overflow-hidden bg-sidebar lg:block">
        <div className="flex h-full flex-col justify-center px-14 text-white">
          <h2 className="max-w-md text-3xl font-bold leading-tight">
            Every conversation. One intelligent workspace.
          </h2>
          <p className="mt-4 max-w-md text-sidebar-foreground">
            Bring customer messages, support teams and AI agents together — across
            WhatsApp, email, web chat and social.
          </p>
          <ul className="mt-8 space-y-3 text-sm text-sidebar-foreground">
            {[
              "Shared omnichannel inbox with SLAs",
              "AI agents grounded in your knowledge base",
              "Visual chatbot builder & automation rules",
            ].map((f) => (
              <li key={f} className="flex items-center gap-3">
                <span className="size-1.5 rounded-full bg-cyan-400" />
                {f}
              </li>
            ))}
          </ul>
        </div>
        <div
          className="pointer-events-none absolute -right-24 -top-24 size-96 rounded-full opacity-20"
          style={{ background: "radial-gradient(circle,#22D3EE,transparent 70%)" }}
        />
      </div>
    </div>
  );
}
