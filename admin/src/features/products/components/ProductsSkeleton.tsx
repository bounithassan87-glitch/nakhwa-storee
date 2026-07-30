import { Card } from "@/components/ui/Card";
import { Skeleton } from "@/components/ui/Skeleton";

/**
 * Loading placeholder that mirrors the real layout at both breakpoints — table
 * rows on `lg`, cards below — so the page does not visibly reflow once data
 * arrives.
 */
export function ProductsSkeleton({ rows = 6 }: { rows?: number }) {
  return (
    <>
      {/* Desktop: table rows */}
      <Card className="hidden overflow-hidden lg:block">
        <div className="border-b border-line bg-brand-soft/40 px-4 py-4">
          <Skeleton className="h-4 w-40" />
        </div>
        {Array.from({ length: rows }).map((_, i) => (
          <div key={i} className="flex items-center gap-4 border-b border-line/70 px-4 py-3.5 last:border-0">
            <Skeleton className="h-11 w-11 shrink-0 rounded-xl" />
            <div className="min-w-0 flex-1 space-y-2">
              <Skeleton className="h-3.5 w-48" />
              <Skeleton className="h-3 w-32" />
            </div>
            <Skeleton className="h-6 w-20 rounded-full" />
            <Skeleton className="h-3.5 w-20" />
            <Skeleton className="h-6 w-16 rounded-full" />
            <Skeleton className="h-6 w-16 rounded-full" />
            <Skeleton className="h-9 w-9 rounded-xl" />
          </div>
        ))}
      </Card>

      {/* Mobile: cards */}
      <div className="grid gap-3 lg:hidden">
        {Array.from({ length: Math.min(rows, 4) }).map((_, i) => (
          <Card key={i} className="p-4">
            <div className="flex items-start gap-3">
              <Skeleton className="h-14 w-14 shrink-0 rounded-xl" />
              <div className="min-w-0 flex-1 space-y-2">
                <Skeleton className="h-4 w-2/3" />
                <Skeleton className="h-3 w-1/2" />
                <Skeleton className="h-4 w-24" />
              </div>
              <Skeleton className="h-9 w-9 shrink-0 rounded-xl" />
            </div>
            <div className="mt-3 flex gap-3 border-t border-line/70 pt-3">
              <Skeleton className="h-5 w-20 rounded-full" />
              <Skeleton className="h-5 w-20 rounded-full" />
              <Skeleton className="h-5 w-24 rounded-full" />
            </div>
          </Card>
        ))}
      </div>
    </>
  );
}
