import { useState } from "react";
import { Plus, Trash2, ChevronUp, ChevronDown, Star, Video, ImageOff } from "lucide-react";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Select } from "@/components/ui/Select";
import { addMedia, updateMedia, deleteMedia, reorderMedia } from "../api";
import type { MediaType, ProductMedia } from "../types";

export function MediaManager({
  productId,
  media,
  onChanged,
  notify,
}: {
  productId: string;
  media: ProductMedia[];
  onChanged: () => void;
  notify: (msg: string) => void;
}) {
  const [url, setUrl] = useState("");
  const [type, setType] = useState<MediaType>("IMAGE");
  const [busy, setBusy] = useState(false);

  async function run(fn: () => Promise<unknown>, msg: string) {
    setBusy(true);
    try {
      await fn();
      onChanged();
      if (msg) notify(msg);
    } catch (e) {
      const m = (e as Error).message;
      notify(m === "validation_error" ? "رابط غير صالح." : "تعذّرت العملية.");
    } finally {
      setBusy(false);
    }
  }

  async function onAdd() {
    if (!url.trim()) return;
    await run(() => addMedia(productId, { url: url.trim(), type }), "تمت إضافة الوسائط");
    setUrl("");
  }

  function move(index: number, dir: -1 | 1) {
    const next = [...media];
    const j = index + dir;
    if (j < 0 || j >= next.length) return;
    [next[index], next[j]] = [next[j], next[index]];
    run(() => reorderMedia(productId, next.map((m) => m.id)), "");
  }

  return (
    <Card className="p-5">
      <h3 className="mb-1 font-bold text-ink">الوسائط ({media.length})</h3>
      <p className="mb-4 text-xs text-faint">الصورة الرئيسية، معرض الصور، والفيديو. تُضاف عبر الرابط (URL).</p>

      <div className="mb-4 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
        {media.map((m, i) => (
          <div key={m.id} className="overflow-hidden rounded-xl border border-line bg-bg">
            <div className="relative grid aspect-square place-items-center bg-line/30">
              {m.type === "VIDEO" ? (
                <Video className="h-8 w-8 text-muted" />
              ) : (
                <img
                  src={m.url}
                  alt=""
                  className="h-full w-full object-cover"
                  onError={(e) => {
                    const el = e.currentTarget as HTMLImageElement;
                    el.style.display = "none";
                    el.parentElement?.querySelector(".fallback")?.classList.remove("hidden");
                  }}
                />
              )}
              <span className="fallback hidden absolute inset-0 grid place-items-center text-faint">
                <ImageOff className="h-6 w-6" />
              </span>
              {m.isMain && (
                <span className="absolute start-1 top-1 flex items-center gap-1 rounded bg-gold/90 px-1.5 py-0.5 text-[10px] font-bold text-sidebar">
                  <Star className="h-3 w-3" /> رئيسية
                </span>
              )}
            </div>
            <div className="flex items-center justify-between gap-1 px-2 py-1.5">
              <div className="flex">
                <button onClick={() => move(i, -1)} disabled={busy || i === 0} className="grid h-7 w-7 place-items-center rounded text-muted hover:bg-brand-soft disabled:opacity-30" aria-label="أعلى">
                  <ChevronUp className="h-4 w-4" />
                </button>
                <button onClick={() => move(i, 1)} disabled={busy || i === media.length - 1} className="grid h-7 w-7 place-items-center rounded text-muted hover:bg-brand-soft disabled:opacity-30" aria-label="أسفل">
                  <ChevronDown className="h-4 w-4" />
                </button>
              </div>
              <div className="flex">
                {m.type === "IMAGE" && !m.isMain && (
                  <button
                    onClick={() => run(() => updateMedia(productId, m.id, { isMain: true }), "تم تعيين الصورة الرئيسية")}
                    disabled={busy}
                    className="grid h-7 w-7 place-items-center rounded text-muted hover:bg-brand-soft"
                    aria-label="تعيين كرئيسية"
                    title="تعيين كرئيسية"
                  >
                    <Star className="h-4 w-4" />
                  </button>
                )}
                <button
                  onClick={() => run(() => deleteMedia(productId, m.id), "تم حذف الوسائط")}
                  disabled={busy}
                  className="grid h-7 w-7 place-items-center rounded text-muted hover:bg-danger-soft hover:text-danger"
                  aria-label="حذف"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            </div>
          </div>
        ))}
        {media.length === 0 && (
          <div className="col-span-full py-6 text-center text-sm text-faint">لا توجد وسائط بعد.</div>
        )}
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <div className="w-28">
          <Select value={type} onChange={(e) => setType(e.target.value as MediaType)} aria-label="نوع الوسائط">
            <option value="IMAGE">صورة</option>
            <option value="VIDEO">فيديو</option>
          </Select>
        </div>
        <input
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && onAdd()}
          placeholder="https://…"
          dir="ltr"
          className="h-10 min-w-0 flex-1 rounded-xl border border-line bg-bg px-3 text-sm outline-none focus:border-brand"
          aria-label="رابط الوسائط"
        />
        <Button size="sm" onClick={onAdd} disabled={busy || !url.trim()}>
          <Plus className="h-4 w-4" /> إضافة
        </Button>
      </div>
    </Card>
  );
}
