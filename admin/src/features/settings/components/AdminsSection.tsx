import { useEffect, useState } from "react";
import { Plus, KeyRound, ShieldCheck } from "lucide-react";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Skeleton } from "@/components/ui/Skeleton";
import { formatDate } from "@/lib/format";
import { getAdmins, addAdmin, editAdmin, setAdminPassword } from "../api";
import { ROLE_LABEL } from "../permissions";
import type { AdminRole, AdminUser } from "../types";

const ROLES: AdminRole[] = ["OWNER", "ADMIN", "STAFF"];

export function AdminsSection({ notify }: { notify: (m: string) => void }) {
  const [rows, setRows] = useState<AdminUser[] | null>(null);
  const [busy, setBusy] = useState(false);
  const [f, setF] = useState({ email: "", name: "", password: "", role: "STAFF" as AdminRole });
  const [pwFor, setPwFor] = useState<string | null>(null);
  const [pw, setPw] = useState("");

  async function load() {
    try {
      setRows((await getAdmins()).data);
    } catch {
      notify("تعذّر تحميل المديرين");
    }
  }
  useEffect(() => {
    void load();
    // Mount-only fetch. `load` is redeclared each render, so listing it would
    // refetch on every render; subsequent refreshes go through `run()`.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function run(fn: () => Promise<unknown>, msg: string) {
    setBusy(true);
    try {
      await fn();
      await load();
      if (msg) notify(msg);
    } catch (e) {
      const m = (e as Error).message;
      notify(m === "duplicate_email" ? "البريد مستخدم مسبقاً." : m === "last_owner" ? "لا يمكن تعطيل/تخفيض آخر مالك." : "تعذّرت العملية.");
    } finally {
      setBusy(false);
    }
  }

  async function onAdd() {
    if (!f.email.trim() || f.password.length < 8) {
      notify("البريد وكلمة مرور (٨ أحرف+) مطلوبان.");
      return;
    }
    await run(() => addAdmin({ email: f.email.trim(), name: f.name.trim() || undefined, password: f.password, role: f.role }), "تمت إضافة المدير");
    setF({ email: "", name: "", password: "", role: "STAFF" });
  }

  async function savePw(id: string) {
    if (pw.length < 8) {
      notify("كلمة المرور ٨ أحرف على الأقل.");
      return;
    }
    await run(() => setAdminPassword(id, pw), "تم تغيير كلمة المرور");
    setPwFor(null);
    setPw("");
  }

  if (!rows) return <Skeleton className="h-64" />;

  return (
    <Card className="p-5">
      <h3 className="mb-4 flex items-center gap-2 font-bold text-ink">
        <ShieldCheck className="h-4 w-4 text-brand" /> المديرون ({rows.length})
      </h3>

      {/* `table-stack` collapses the rows to labelled lines below `lg` — see
          admin/src/styles/index.css. */}
      <div className="mb-4 overflow-x-auto">
        <table className="table-stack w-full text-right text-sm">
          <thead>
            <tr className="border-b border-line text-muted">
              <th className="px-3 py-2 font-bold">البريد</th>
              <th className="px-3 py-2 font-bold">الاسم</th>
              <th className="px-3 py-2 font-bold">الدور</th>
              <th className="px-3 py-2 font-bold">آخر دخول</th>
              <th className="px-3 py-2 font-bold">الحالة</th>
              <th className="px-3 py-2"></th>
            </tr>
          </thead>
          <tbody>
            {rows.map((a) => (
              <tr key={a.id} className="border-b border-line/70 last:border-0">
                <td data-label="البريد" className="px-3 py-2 font-medium text-ink" dir="ltr">{a.email}</td>
                <td data-label="الاسم" className="px-3 py-2">{a.name || "—"}</td>
                <td data-label="الدور" className="px-3 py-2">
                  <select
                    value={a.role}
                    disabled={busy}
                    onChange={(e) => run(() => editAdmin(a.id, { role: e.target.value as AdminRole }), "تم تغيير الدور")}
                    className="rounded-lg border border-line bg-bg px-2 py-1 text-xs outline-none focus:border-brand"
                    aria-label="الدور"
                  >
                    {ROLES.map((r) => (
                      <option key={r} value={r}>{ROLE_LABEL[r]}</option>
                    ))}
                  </select>
                </td>
                <td data-label="آخر دخول" className="px-3 py-2 text-xs text-muted">{a.lastLoginAt ? formatDate(a.lastLoginAt) : "—"}</td>
                <td data-label="الحالة" className="px-3 py-2">
                  <button
                    onClick={() => run(() => editAdmin(a.id, { isActive: !a.isActive }), "")}
                    disabled={busy}
                    className={`rounded-lg px-2 py-1 text-xs font-bold ${a.isActive ? "bg-success-soft text-success" : "bg-line/60 text-muted"}`}
                  >
                    {a.isActive ? "مفعّل" : "معطّل"}
                  </button>
                </td>
                <td className="px-3 py-2">
                  {pwFor === a.id ? (
                    <span className="flex items-center gap-1">
                      <input
                        type="password"
                        value={pw}
                        onChange={(e) => setPw(e.target.value)}
                        placeholder="كلمة مرور جديدة"
                        className="h-8 w-36 rounded-lg border border-line bg-bg px-2 text-xs outline-none focus:border-brand"
                      />
                      <Button size="sm" onClick={() => savePw(a.id)} disabled={busy}>حفظ</Button>
                    </span>
                  ) : (
                    <button onClick={() => { setPwFor(a.id); setPw(""); }} className="grid h-7 w-7 place-items-center rounded text-muted hover:bg-brand-soft" title="تغيير كلمة المرور" aria-label="تغيير كلمة المرور">
                      <KeyRound className="h-4 w-4" />
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="grid gap-2 sm:grid-cols-5">
        <input value={f.email} onChange={(e) => setF({ ...f, email: e.target.value })} placeholder="البريد" type="email" dir="ltr" className="h-10 rounded-xl border border-line bg-bg px-3 text-sm outline-none focus:border-brand" aria-label="بريد المدير الجديد" />
        <input value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} placeholder="الاسم" className="h-10 rounded-xl border border-line bg-bg px-3 text-sm outline-none focus:border-brand" />
        <input value={f.password} onChange={(e) => setF({ ...f, password: e.target.value })} placeholder="كلمة المرور" type="password" className="h-10 rounded-xl border border-line bg-bg px-3 text-sm outline-none focus:border-brand" />
        <select value={f.role} onChange={(e) => setF({ ...f, role: e.target.value as AdminRole })} className="h-10 rounded-xl border border-line bg-bg px-3 text-sm outline-none focus:border-brand" aria-label="دور المدير الجديد">
          {ROLES.map((r) => <option key={r} value={r}>{ROLE_LABEL[r]}</option>)}
        </select>
        <Button size="sm" onClick={onAdd} disabled={busy}>
          <Plus className="h-4 w-4" /> إضافة مدير
        </Button>
      </div>
    </Card>
  );
}
