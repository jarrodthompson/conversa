import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

/** Merge conditional class names, de-duplicating Tailwind conflicts. */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/** Initials for an avatar fallback, e.g. "Sophie Elwood" → "SE". */
export function initials(name?: string | null) {
  if (!name) return "?";
  return name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase() ?? "")
    .join("");
}

/** Deterministic pastel from a string — used for avatar backgrounds. */
export function stringToColor(input: string) {
  const palette = [
    "#06B6D4", "#22D3EE", "#0EA5E9", "#6366F1", "#8B5CF6",
    "#EC4899", "#F59E0B", "#10B981", "#14B8A6", "#F97316",
  ];
  let hash = 0;
  for (let i = 0; i < input.length; i++) {
    hash = input.charCodeAt(i) + ((hash << 5) - hash);
  }
  return palette[Math.abs(hash) % palette.length];
}
