import { useState, type MouseEvent } from "react";
import { MessageCircle, Phone, Copy, Check } from "lucide-react";
import { toWhatsApp } from "@/lib/format";

export function OrderActions({ phone, orderNumber }: { phone: string; orderNumber?: string }) {
  const [copied, setCopied] = useState(false);
  const wa =
    `https://wa.me/${toWhatsApp(phone)}` +
    (orderNumber ? `?text=${encodeURIComponent("بخصوص طلبك رقم " + orderNumber)}` : "");
  const btn = "grid h-9 w-9 place-items-center rounded-lg transition";

  async function copy(e: MouseEvent) {
    e.stopPropagation();
    try {
      await navigator.clipboard.writeText(phone);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      /* clipboard unavailable */
    }
  }

  return (
    <div className="flex items-center gap-1.5" onClick={(e) => e.stopPropagation()}>
      <a
        href={wa}
        target="_blank"
        rel="noopener"
        className={`${btn} bg-success-soft text-success hover:brightness-95`}
        title="واتساب"
        aria-label="واتساب"
      >
        <MessageCircle className="h-4 w-4" />
      </a>
      <a
        href={`tel:${phone}`}
        className={`${btn} bg-brand-soft text-brand-dark hover:brightness-95`}
        title="اتصال"
        aria-label="اتصال"
      >
        <Phone className="h-4 w-4" />
      </a>
      <button
        onClick={copy}
        className={`${btn} bg-line/50 text-muted hover:bg-line`}
        title="نسخ رقم الهاتف"
        aria-label="نسخ رقم الهاتف"
      >
        {copied ? <Check className="h-4 w-4 text-success" /> : <Copy className="h-4 w-4" />}
      </button>
    </div>
  );
}
