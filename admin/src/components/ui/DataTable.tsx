import { type ReactNode } from "react";
import { cn } from "@/lib/cn";
import { Card } from "./Card";

export interface Column {
  key: string;
  header: string;
  className?: string;
}

/** Reusable table shell. Pass rows as children (<tr>…), or `empty` to render an
 *  empty state when there are no rows. */
export function DataTable({
  columns,
  children,
  empty,
}: {
  columns: Column[];
  children?: ReactNode;
  empty?: ReactNode;
}) {
  const hasRows = Boolean(children);
  return (
    <Card className="overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full text-right text-sm">
          <thead>
            <tr className="border-b border-line bg-brand-soft/40 text-muted">
              {columns.map((c) => (
                <th key={c.key} className={cn("whitespace-nowrap px-4 py-3 font-bold", c.className)}>
                  {c.header}
                </th>
              ))}
            </tr>
          </thead>
          {hasRows && <tbody>{children}</tbody>}
        </table>
      </div>
      {!hasRows && empty}
    </Card>
  );
}
