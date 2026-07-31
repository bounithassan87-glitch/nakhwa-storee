import { useEffect, useState } from "react";
import { ScrollText } from "lucide-react";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { Skeleton } from "@/components/ui/Skeleton";
import { Pagination } from "@/components/ui/Pagination";
import { useDebouncedValue } from "@/lib/useDebounce";
import { formatDate } from "@/lib/format";
import { getAudit } from "../api";
import type { AuditEntry } from "../types";

const field = "h-10 rounded-xl border border-line bg-bg px-3 text-sm outline-none focus:border-brand";
const PAGE_SIZE = 20;

function actionTone(a: string) {
  if (a.includes("login") && a.includes("failed")) return "danger" as const;
  if (a === "DELETE") return "danger" as const;
  if (a === "login" || a === "POST") return "success" as const;
  if (a === "logout") return "neutral" as const;
  return "brand" as const;
}

export function AuditSection({ notify }: { notify: (m: string) => void }) {
  const [actor, setActor] = useState("");
  const [entity, setEntity] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [page, setPage] = useState(1);
  const [rows, setRows] = useState<AuditEntry[] | null>(null);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(1);

  const dActor = useDebouncedValue(actor);
  const dEntity = useDebouncedValue(entity);

  useEffect(() => {
    setPage(1);
  }, [dActor, dEntity, dateFrom]);

  useEffect(() => {
    const ac = new AbortController();
    void (async () => {
      try {
        const res = await getAudit(
          { page, pageSize: PAGE_SIZE, actor: dActor, action: "", entity: dEntity, dateFrom, dateTo: "" },
          ac.signal,
        );
        setRows(res.data);
        setTotal(res.total);
        setTotalPages(res.totalPages);
      } catch (e) {
        if ((e as Error).name !== "AbortError") notify("تعذّر تحميل السجل");
      }
    })();
    return () => ac.abort();
  }, [page, dActor, dEntity, dateFrom, notify]);

  return (
    <Card className="p-5">
      <h3 className="mb-4 flex items-center gap-2 font-bold text-ink">
        <ScrollText className="h-4 w-4 text-brand" /> سجل النشاط {total ? `(${total})` : ""}
      </h3>

      <div className="mb-4 grid gap-2 sm:grid-cols-3">
        <input value={actor} onChange={(e) => setActor(e.target.value)} placeholder="بحث بالمستخدم" className={field} aria-label="بحث بالمستخدم" />
        <input value={entity} onChange={(e) => setEntity(e.target.value)} placeholder="النوع (orders, products…)" className={field} dir="ltr" aria-label="النوع" />
        <input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} className={field} aria-label="من تاريخ" />
      </div>

      {!rows ? (
        <div className="space-y-2">{Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-10" />)}</div>
      ) : rows.length === 0 ? (
        <p className="py-8 text-center text-sm text-faint">لا توجد سجلات مطابقة.</p>
      ) : (
        <div className="overflow-x-auto">
          {/* `table-stack` collapses the rows to labelled lines below `lg` —
              see admin/src/styles/index.css. */}
          <table className="table-stack w-full text-right text-sm">
            <thead>
              <tr className="border-b border-line text-muted">
                <th className="px-3 py-2 font-bold">التاريخ</th>
                <th className="px-3 py-2 font-bold">المستخدم</th>
                <th className="px-3 py-2 font-bold">الإجراء</th>
                <th className="px-3 py-2 font-bold">النوع</th>
                <th className="px-3 py-2 font-bold">التفاصيل</th>
                <th className="px-3 py-2 font-bold">IP</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id} className="border-b border-line/70 last:border-0">
                  <td data-label="التاريخ" className="whitespace-nowrap px-3 py-2 text-xs text-muted">{formatDate(r.createdAt)}</td>
                  <td data-label="المستخدم" className="px-3 py-2" dir="ltr">{r.actor}</td>
                  <td data-label="الإجراء" className="px-3 py-2"><Badge tone={actionTone(r.action)}>{r.action}</Badge></td>
                  <td data-label="النوع" className="px-3 py-2 text-muted">{r.entity ?? "—"}</td>
                  <td data-label="التفاصيل" className="px-3 py-2 text-xs text-muted" dir="ltr">{r.details ?? "—"}</td>
                  <td data-label="IP" className="px-3 py-2 text-xs text-faint" dir="ltr">{r.ip ?? "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {rows && rows.length > 0 && (
        <Pagination page={page} totalPages={totalPages} total={total} onPage={setPage} noun="سجل" />
      )}
    </Card>
  );
}
