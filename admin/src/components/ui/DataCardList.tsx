import { type ReactNode } from "react";
import { Card } from "./Card";
import { cn } from "@/lib/cn";

export interface CardField {
  label: string;
  value: ReactNode;
}

/**
 * The mobile counterpart to a data table.
 *
 * Every admin list has the same problem below `lg`: seven to ten columns cannot
 * be read on a phone, and a horizontally scrolling table is a poor touch
 * target. Each list therefore renders its table with `hidden lg:block` and this
 * component underneath with `lg:hidden`.
 *
 * The shell — grid, staggered entrance, click affordance, the wrapped
 * label/value footer — lives here once. Callers supply only what differs: the
 * card's heading region and its list of fields. That keeps the four lists
 * (orders, customers, shipping, products) visually identical without four
 * copies of the same markup.
 */
export function DataCardList<T>({
  items,
  getKey,
  renderHead,
  getFields,
  onOpen,
  getCardClassName,
  className,
}: {
  items: T[];
  getKey: (item: T) => string;
  /** The card's top region — thumbnail/avatar, title, and any actions. */
  renderHead: (item: T) => ReactNode;
  /** Label/value pairs shown beneath the divider. */
  getFields: (item: T) => CardField[];
  onOpen?: (item: T) => void;
  /** Per-card classes — used to tint newly arrived rows, as the tables do. */
  getCardClassName?: (item: T) => string | undefined;
  className?: string;
}) {
  return (
    <ul className={cn("grid gap-3 lg:hidden", className)}>
      {items.map((item, i) => (
        <li
          key={getKey(item)}
          // Capped so a full page does not end on a visibly delayed row.
          style={{ animationDelay: `${Math.min(i, 12) * 30}ms` }}
          className="animate-row-in"
        >
          <Card
            onClick={onOpen ? () => onOpen(item) : undefined}
            className={cn(
              "p-4 transition",
              onOpen && "cursor-pointer hover:border-brand active:scale-[.995]",
              getCardClassName?.(item),
            )}
          >
            <div className="flex items-start gap-3">{renderHead(item)}</div>

            <dl className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-2 border-t border-line/70 pt-3 text-xs">
              {getFields(item).map((f) => (
                <div key={f.label} className="flex items-center gap-1.5">
                  <dt className="text-faint">{f.label}:</dt>
                  <dd className="min-w-0 truncate">{f.value}</dd>
                </div>
              ))}
            </dl>
          </Card>
        </li>
      ))}
    </ul>
  );
}
