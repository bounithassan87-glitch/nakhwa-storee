import { Badge } from "@/components/ui/Badge";
import { TAG_META } from "../tags";
import type { CustomerTag } from "../types";

export function CustomerTagBadge({ tag }: { tag: CustomerTag }) {
  const meta = TAG_META[tag];
  return <Badge tone={meta.tone}>{meta.label}</Badge>;
}
