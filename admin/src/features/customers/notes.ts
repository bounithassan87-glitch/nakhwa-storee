// Internal per-customer notes.
//
// The production DB schema must not change for this phase, and Customer has no
// notes column — so notes persist in localStorage, keyed by customer id. This is
// deliberately abstracted behind get/save so that swapping to a server store
// later (a Customer.notes column, or Cloudflare KV) is a one-file change with no
// call-site edits. Limitation: notes are per-browser, not shared across devices
// or admins. Documented in admin/CUSTOMERS-MODULE.md.

const KEY = "nakhwa.admin.customerNotes";

type NotesMap = Record<string, string>;

function readAll(): NotesMap {
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? (JSON.parse(raw) as NotesMap) : {};
  } catch {
    return {};
  }
}

export function getNote(customerId: string): string {
  return readAll()[customerId] ?? "";
}

export function saveNote(customerId: string, note: string): void {
  const all = readAll();
  const trimmed = note.trim();
  if (trimmed) all[customerId] = trimmed;
  else delete all[customerId];
  try {
    localStorage.setItem(KEY, JSON.stringify(all));
  } catch {
    /* storage full / unavailable — ignore */
  }
}
