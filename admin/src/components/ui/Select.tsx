import { type SelectHTMLAttributes } from "react";
import { cn } from "@/lib/cn";

interface Props extends SelectHTMLAttributes<HTMLSelectElement> {
  label?: string;
}

export function Select({ label, className, children, ...rest }: Props) {
  return (
    <label className="block">
      {label && <span className="mb-1.5 block text-sm font-bold text-ink">{label}</span>}
      <select
        className={cn(
          "h-11 w-full rounded-xl border border-line bg-bg px-3 text-sm text-ink outline-none transition focus:border-brand focus:ring-2 focus:ring-brand/20",
          className,
        )}
        {...rest}
      >
        {children}
      </select>
    </label>
  );
}
