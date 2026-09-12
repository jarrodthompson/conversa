import { SettingsNav } from "@/components/app/settings-nav";

export default function SettingsLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex h-full">
      <SettingsNav />
      <div className="min-w-0 flex-1 overflow-y-auto">{children}</div>
    </div>
  );
}
