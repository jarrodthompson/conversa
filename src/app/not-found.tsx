import Link from "next/link";
import { LogoWordmark } from "@/components/brand/logo";
import { Button } from "@/components/ui/button";

export default function NotFound() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-background px-6 text-center">
      <LogoWordmark />
      <p className="text-6xl font-bold tracking-tight text-primary">404</p>
      <h1 className="text-xl font-semibold text-foreground">Page not found</h1>
      <p className="max-w-sm text-sm text-muted-foreground">
        The page you’re looking for doesn’t exist or may have moved.
      </p>
      <div className="mt-2 flex items-center gap-2">
        <Link href="/"><Button variant="outline">Home</Button></Link>
        <Link href="/app/inbox"><Button>Go to app</Button></Link>
      </div>
    </div>
  );
}
