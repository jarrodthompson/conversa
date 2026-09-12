import { Skeleton } from "@/components/ui/skeleton";

export default function InboxLoading() {
  return (
    <div className="grid h-full grid-cols-1 md:grid-cols-[210px_320px_1fr] xl:grid-cols-[210px_340px_1fr_300px]">
      <aside className="hidden flex-col gap-2 border-r border-border bg-card p-3 md:flex">
        {Array.from({ length: 8 }).map((_, i) => <Skeleton key={i} className="h-8 w-full" />)}
      </aside>
      <section className="border-r border-border bg-card p-4">
        {Array.from({ length: 7 }).map((_, i) => (
          <div key={i} className="mb-4 flex gap-3">
            <Skeleton className="size-9 rounded-full" />
            <div className="flex-1 space-y-2">
              <Skeleton className="h-3 w-2/3" />
              <Skeleton className="h-3 w-full" />
            </div>
          </div>
        ))}
      </section>
      <section className="hidden flex-col gap-4 p-6 md:flex">
        <Skeleton className="h-10 w-1/3" />
        <Skeleton className="h-24 w-3/4" />
        <Skeleton className="ml-auto h-16 w-2/3" />
        <Skeleton className="h-24 w-3/4" />
      </section>
      <aside className="hidden flex-col gap-3 border-l border-border bg-card p-5 xl:flex">
        {Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-4 w-full" />)}
      </aside>
    </div>
  );
}
