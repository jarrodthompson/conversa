import * as React from "react";
import { cn, initials, stringToColor } from "@/lib/utils";

interface AvatarProps {
  name?: string | null;
  src?: string | null;
  size?: number;
  className?: string;
}

/** Image avatar with a deterministic coloured initials fallback. */
export function Avatar({ name, src, size = 36, className }: AvatarProps) {
  const label = name ?? "";
  return (
    <span
      className={cn(
        "inline-flex shrink-0 items-center justify-center overflow-hidden rounded-full font-semibold text-white select-none",
        className,
      )}
      style={{
        width: size,
        height: size,
        fontSize: size * 0.4,
        backgroundColor: src ? undefined : stringToColor(label || "?"),
      }}
      aria-label={label || undefined}
    >
      {src ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={src} alt={label} className="h-full w-full object-cover" />
      ) : (
        initials(label)
      )}
    </span>
  );
}
