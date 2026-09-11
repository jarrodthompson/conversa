"use client";

import * as React from "react";
import { cn } from "@/lib/utils";

interface MenuProps {
  trigger: React.ReactNode;
  children: React.ReactNode;
  align?: "start" | "end";
  className?: string;
}

/** Minimal accessible dropdown: toggles on click, closes on outside-click/Escape. */
export function Menu({ trigger, children, align = "end", className }: MenuProps) {
  const [open, setOpen] = React.useState(false);
  const ref = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    if (!open) return;
    function onClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", onClick);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onClick);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-haspopup="menu"
        aria-expanded={open}
        className="flex items-center outline-none"
      >
        {trigger}
      </button>
      {open && (
        <div
          role="menu"
          className={cn(
            "absolute z-50 mt-2 min-w-[200px] rounded-[12px] border border-border bg-popover p-1.5 shadow-lg",
            align === "end" ? "right-0" : "left-0",
            className,
          )}
          // Defer closing so an item's own action (e.g. a form submit / server
          // action) runs before the menu content unmounts.
          onClick={() => setTimeout(() => setOpen(false), 0)}
        >
          {children}
        </div>
      )}
    </div>
  );
}

export function MenuItem({
  className,
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      type="button"
      role="menuitem"
      className={cn(
        "flex w-full items-center gap-2 rounded-[8px] px-2.5 py-2 text-left text-sm text-foreground transition-colors hover:bg-muted [&_svg]:size-4 [&_svg]:text-muted-foreground",
        className,
      )}
      {...props}
    />
  );
}

export function MenuLabel({ children }: { children: React.ReactNode }) {
  return (
    <div className="px-2.5 py-1.5 text-xs font-medium text-muted-foreground">
      {children}
    </div>
  );
}

export function MenuSeparator() {
  return <div className="my-1 h-px bg-border" />;
}
