import { useEffect, useState } from "react";
import { StickyNote, Check } from "lucide-react";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { getNote, saveNote } from "../notes";

/** Internal free-text notes for a customer. Persisted locally (see notes.ts). */
export function CustomerNotes({ customerId }: { customerId: string }) {
  const [value, setValue] = useState("");
  const [saved, setSaved] = useState("");
  const [justSaved, setJustSaved] = useState(false);

  useEffect(() => {
    const n = getNote(customerId);
    setValue(n);
    setSaved(n);
    setJustSaved(false);
  }, [customerId]);

  const dirty = value.trim() !== saved.trim();

  function onSave() {
    saveNote(customerId, value);
    setSaved(value.trim());
    setJustSaved(true);
    setTimeout(() => setJustSaved(false), 1800);
  }

  return (
    <Card className="p-5">
      <div className="mb-3 flex items-center gap-2">
        <StickyNote className="h-4 w-4 text-brand" />
        <h3 className="font-bold text-ink">ملاحظات داخلية</h3>
      </div>
      <textarea
        value={value}
        onChange={(e) => setValue(e.target.value)}
        rows={5}
        placeholder="أضيفي ملاحظات حول هذا الزبون (مرئية للفريق فقط)…"
        className="w-full resize-y rounded-xl border border-line bg-bg p-3 text-sm text-ink outline-none transition placeholder:text-faint focus:border-brand focus:ring-2 focus:ring-brand/20"
      />
      <div className="mt-3 flex items-center justify-between">
        <span className="text-xs text-faint">تُحفظ على هذا المتصفح.</span>
        <Button size="sm" onClick={onSave} disabled={!dirty}>
          {justSaved ? (
            <>
              <Check className="h-4 w-4" /> تم الحفظ
            </>
          ) : (
            "حفظ الملاحظة"
          )}
        </Button>
      </div>
    </Card>
  );
}
