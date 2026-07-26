/** Money is stored as integer centimes — render as MAD. */
export function formatMoney(centimes: number): string {
  const value = centimes / 100;
  return new Intl.NumberFormat("ar-MA", { maximumFractionDigits: 0 }).format(value) + " درهم";
}

export function formatDate(iso: string): string {
  try {
    return new Intl.DateTimeFormat("ar-MA", { dateStyle: "medium", timeStyle: "short" }).format(
      new Date(iso),
    );
  } catch {
    return iso;
  }
}

/** Date only (no time) — used for first/last order dates in the CRM. */
export function formatDateOnly(iso: string | null): string {
  if (!iso) return "—";
  try {
    return new Intl.DateTimeFormat("ar-MA", { dateStyle: "medium" }).format(new Date(iso));
  } catch {
    return iso;
  }
}

/** 06XXXXXXXX → 2126XXXXXXXX (for wa.me links). */
export function toWhatsApp(phone: string): string {
  const digits = phone.replace(/\D/g, "");
  return digits.startsWith("0") ? "212" + digits.slice(1) : digits;
}
