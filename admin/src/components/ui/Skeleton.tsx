import { cn } from "@/lib/cn";

/** Reusable shimmer placeholder used by loading states. */
export function Skeleton({ className }: { className?: string }) {
  return <div className={cn("animate-pulse rounded-lg bg-line/70", className)} />;
}
