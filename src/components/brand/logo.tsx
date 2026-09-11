import { cn } from "@/lib/utils";

/**
 * Conversa logo mark — an original abstract cyan glyph: two interlocking
 * conversation nodes forming an infinite/continuous loop, suggesting many
 * channels converging into one thread. No resemblance to any existing brand.
 */
export function LogoMark({
  size = 28,
  className,
}: {
  size?: number;
  className?: string;
}) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 32 32"
      fill="none"
      className={className}
      aria-hidden="true"
    >
      <defs>
        <linearGradient id="conversa-mark" x1="4" y1="4" x2="28" y2="28" gradientUnits="userSpaceOnUse">
          <stop stopColor="#22D3EE" />
          <stop offset="1" stopColor="#06B6D4" />
        </linearGradient>
      </defs>
      <path
        d="M16 3C9.373 3 4 7.7 4 13.5c0 3.02 1.46 5.74 3.8 7.65-.2 1.98-1 3.6-2.2 4.85 2.5-.2 4.6-1 6.2-2.3 1.32.4 2.74.6 4.2.6"
        stroke="url(#conversa-mark)"
        strokeWidth="2.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M16 29c6.627 0 12-4.7 12-10.5 0-5.523-4.9-10.06-11.1-10.47"
        stroke="url(#conversa-mark)"
        strokeWidth="2.6"
        strokeLinecap="round"
        strokeLinejoin="round"
        opacity="0.55"
      />
      <circle cx="12" cy="13.5" r="1.7" fill="#06B6D4" />
      <circle cx="19.5" cy="18.5" r="1.7" fill="#22D3EE" />
    </svg>
  );
}

export function LogoWordmark({
  className,
  markSize = 28,
}: {
  className?: string;
  markSize?: number;
}) {
  return (
    <span className={cn("inline-flex items-center gap-2", className)}>
      <LogoMark size={markSize} />
      <span className="text-lg font-bold tracking-tight text-foreground">
        {process.env.NEXT_PUBLIC_APP_NAME ?? "Conversa"}
      </span>
    </span>
  );
}
