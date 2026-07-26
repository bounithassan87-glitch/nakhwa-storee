import { useEffect, useMemo, useState } from "react";
import { Store, Cog, ShieldCheck, Truck, MapPin, ScrollText } from "lucide-react";
import { PageHeader } from "@/components/ui/PageHeader";
import { Skeleton } from "@/components/ui/Skeleton";
import { cn } from "@/lib/cn";
import { useAuth } from "@/auth/AuthContext";
import { roleCan, type Permission } from "@/features/settings/permissions";
import { SettingsForm, type FieldSpec } from "@/features/settings/components/SettingsForm";
import { AdminsSection } from "@/features/settings/components/AdminsSection";
import { CompaniesSection } from "@/features/settings/components/CompaniesSection";
import { CitiesSection } from "@/features/settings/components/CitiesSection";
import { AuditSection } from "@/features/settings/components/AuditSection";
import { getSettings, saveSettings } from "@/features/settings/api";
import type { SettingsMap } from "@/features/settings/types";

const CURRENCIES = [{ value: "MAD", label: "درهم (MAD)" }, { value: "EUR", label: "يورو (EUR)" }, { value: "USD", label: "دولار (USD)" }];
const LANGS = [{ value: "ar", label: "العربية" }, { value: "fr", label: "الفرنسية" }];
const DATE_FORMATS = [{ value: "dd/MM/yyyy", label: "31/12/2026" }, { value: "yyyy-MM-dd", label: "2026-12-31" }, { value: "dd MMM yyyy", label: "31 دجنبر 2026" }];

const STORE_FIELDS: FieldSpec[] = [
  { key: "store_name", label: "اسم المتجر" },
  { key: "email", label: "البريد الإلكتروني", type: "email", ltr: true },
  { key: "phone", label: "رقم الهاتف", type: "tel", ltr: true },
  { key: "whatsapp", label: "رقم واتساب", type: "tel", ltr: true },
  { key: "address", label: "العنوان" },
  { key: "logo_url", label: "رابط الشعار", ltr: true, placeholder: "https://…" },
  { key: "currency", label: "العملة", type: "select", options: CURRENCIES },
  { key: "timezone", label: "المنطقة الزمنية", ltr: true, placeholder: "Africa/Casablanca" },
  { key: "language", label: "اللغة", type: "select", options: LANGS },
  { key: "date_format", label: "صيغة التاريخ", type: "select", options: DATE_FORMATS },
];

const SYSTEM_FIELDS: FieldSpec[] = [
  { key: "order_prefix", label: "بادئة رقم الطلب", ltr: true, placeholder: "NK" },
  { key: "default_currency", label: "العملة الافتراضية", type: "select", options: CURRENCIES },
  { key: "default_country", label: "الدولة الافتراضية" },
  { key: "default_language", label: "اللغة الافتراضية", type: "select", options: LANGS },
  { key: "default_timezone", label: "المنطقة الزمنية الافتراضية", ltr: true, placeholder: "Africa/Casablanca" },
];

type TabKey = "store" | "system" | "admins" | "shipping" | "cities" | "audit";
interface Tab { key: TabKey; label: string; icon: typeof Store; perm?: Permission }

const TABS: Tab[] = [
  { key: "store", label: "المتجر", icon: Store },
  { key: "system", label: "النظام", icon: Cog },
  { key: "admins", label: "المديرون", icon: ShieldCheck, perm: "manage_admins" },
  { key: "shipping", label: "شركات الشحن", icon: Truck },
  { key: "cities", label: "المدن", icon: MapPin },
  { key: "audit", label: "سجل النشاط", icon: ScrollText, perm: "view_audit" },
];

export default function Settings() {
  const { user } = useAuth();
  const role = user?.role;
  const tabs = useMemo(() => TABS.filter((t) => !t.perm || roleCan(role, t.perm)), [role]);
  const [tab, setTab] = useState<TabKey>("store");
  const [settings, setSettings] = useState<SettingsMap | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  function notify(msg: string) {
    setToast(msg);
    setTimeout(() => setToast(null), 2400);
  }

  useEffect(() => {
    (async () => {
      try {
        setSettings((await getSettings()).data);
      } catch {
        notify("تعذّر تحميل الإعدادات");
        setSettings({});
      }
    })();
  }, []);

  async function saveSubset(patch: SettingsMap) {
    try {
      const res = await saveSettings(patch);
      setSettings(res.data);
      notify("تم حفظ الإعدادات");
    } catch (e) {
      notify((e as Error).message === "forbidden" ? "ليست لديك صلاحية." : "تعذّر الحفظ");
    }
  }

  const canEditSettings = roleCan(role, "manage_settings");

  return (
    <>
      <PageHeader title="الإعدادات" subtitle="مركز التحكم بالمنصة" />

      <div className="mb-5 flex flex-wrap gap-2">
        {tabs.map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={cn(
              "inline-flex items-center gap-2 rounded-xl border px-4 py-2 text-sm font-bold transition",
              tab === t.key ? "border-brand bg-brand text-white" : "border-line bg-surface text-muted hover:bg-brand-soft",
            )}
          >
            <t.icon className="h-4 w-4" /> {t.label}
          </button>
        ))}
      </div>

      {tab === "store" &&
        (settings ? (
          <SettingsForm title="إعدادات المتجر" fields={STORE_FIELDS} values={settings} canEdit={canEditSettings} onSave={saveSubset} />
        ) : (
          <Skeleton className="h-96" />
        ))}

      {tab === "system" &&
        (settings ? (
          <SettingsForm title="إعدادات النظام" fields={SYSTEM_FIELDS} values={settings} canEdit={canEditSettings} onSave={saveSubset} />
        ) : (
          <Skeleton className="h-72" />
        ))}

      {tab === "admins" && roleCan(role, "manage_admins") && <AdminsSection notify={notify} />}
      {tab === "shipping" && <CompaniesSection canManage={roleCan(role, "manage_shipping_settings")} notify={notify} />}
      {tab === "cities" && <CitiesSection canManage={roleCan(role, "manage_cities")} notify={notify} />}
      {tab === "audit" && roleCan(role, "view_audit") && <AuditSection notify={notify} />}

      {toast && (
        <div className="fixed bottom-5 left-1/2 z-[70] -translate-x-1/2 rounded-xl bg-sidebar px-4 py-2 text-sm font-bold text-white shadow-lg">
          {toast}
        </div>
      )}
    </>
  );
}
