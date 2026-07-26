import { useState } from "react";
import { Save } from "lucide-react";
import { Card } from "@/components/ui/Card";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { Button } from "@/components/ui/Button";
import type { SettingsMap } from "../types";

export interface FieldSpec {
  key: string;
  label: string;
  type?: "text" | "email" | "tel" | "select";
  options?: { value: string; label: string }[];
  placeholder?: string;
  ltr?: boolean;
}

export function SettingsForm({
  title,
  fields,
  values,
  canEdit,
  onSave,
}: {
  title: string;
  fields: FieldSpec[];
  values: SettingsMap;
  canEdit: boolean;
  onSave: (patch: SettingsMap) => Promise<void>;
}) {
  const [form, setForm] = useState<SettingsMap>(() =>
    Object.fromEntries(fields.map((f) => [f.key, values[f.key] ?? ""])),
  );
  const [saving, setSaving] = useState(false);

  async function save() {
    setSaving(true);
    try {
      await onSave(form);
    } finally {
      setSaving(false);
    }
  }

  return (
    <Card className="p-5">
      <div className="mb-4 flex items-center justify-between">
        <h3 className="font-bold text-ink">{title}</h3>
        {canEdit && (
          <Button size="sm" onClick={save} disabled={saving}>
            <Save className="h-4 w-4" /> {saving ? "جارٍ الحفظ…" : "حفظ"}
          </Button>
        )}
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        {fields.map((f) =>
          f.type === "select" ? (
            <label key={f.key} className="block">
              <span className="mb-1.5 block text-sm font-bold text-ink">{f.label}</span>
              <Select
                value={form[f.key] ?? ""}
                disabled={!canEdit}
                onChange={(e) => setForm({ ...form, [f.key]: e.target.value })}
              >
                {(f.options ?? []).map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </Select>
            </label>
          ) : (
            <Input
              key={f.key}
              label={f.label}
              type={f.type ?? "text"}
              value={form[f.key] ?? ""}
              placeholder={f.placeholder}
              dir={f.ltr ? "ltr" : undefined}
              disabled={!canEdit}
              onChange={(e) => setForm({ ...form, [f.key]: e.target.value })}
            />
          ),
        )}
      </div>
      {!canEdit && <p className="mt-3 text-xs text-faint">ليست لديك صلاحية تعديل هذه الإعدادات.</p>}
    </Card>
  );
}
