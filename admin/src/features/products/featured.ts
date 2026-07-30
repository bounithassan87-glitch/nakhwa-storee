/**
 * Featured-products store.
 *
 * `Product` has no `featured` column, and this milestone must not touch the
 * schema or add a migration. The flag set therefore lives in the existing
 * `Setting` key/value table under `featured_product_ids` (a JSON array of
 * product ids) and travels over the existing `/api/admin/settings` endpoint —
 * no new API route, no schema change.
 *
 * Every caller goes through the three functions below, so replacing this with a
 * real `Product.featured` boolean later is a single-file change: reimplement
 * `loadFeatured` / `saveFeatured` against the products API and delete the rest.
 *
 * Writing requires `manage_products`, not `manage_settings`: the settings
 * endpoint authorizes `featured_product_ids` as catalog data precisely because
 * it is a product flag that happens to be stored there. The UI mirrors that
 * check so a `staff` admin sees the flag read-only rather than discovering the
 * 403 on click — see `ProductsTable`.
 */
import { getSettings, saveSettings } from "@/features/settings/api";

const KEY = "featured_product_ids";

/**
 * The settings endpoint truncates every value at 2000 characters. A silently
 * truncated array would deserialize as corrupt JSON and drop the whole list, so
 * both the count and the serialized length are checked before any write.
 */
const MAX_SERIALIZED = 2000;

/** Hard cap on flagged products. ~28 chars per id keeps 60 well inside 2000. */
export const MAX_FEATURED = 60;

/** Parse the stored JSON defensively — never throw into the render path. */
function parseIds(raw: string | undefined): string[] {
  if (!raw) return [];
  try {
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((v): v is string => typeof v === "string" && v.length > 0);
  } catch {
    return [];
  }
}

/** Current featured ids, as a Set for O(1) lookups while rendering rows. */
export async function loadFeatured(): Promise<Set<string>> {
  const res = await getSettings();
  return new Set(parseIds(res.data[KEY]));
}

/** Raised when a write would exceed the storage budget. Carries an Arabic message. */
export class FeaturedLimitError extends Error {
  constructor() {
    super(`لا يمكن تمييز أكثر من ${MAX_FEATURED} منتج.`);
    this.name = "FeaturedLimitError";
  }
}

/**
 * Persist the full featured set.
 *
 * @throws {FeaturedLimitError} if the set exceeds the count or byte budget.
 */
export async function saveFeatured(ids: Set<string>): Promise<void> {
  const list = [...ids];
  const serialized = JSON.stringify(list);
  if (list.length > MAX_FEATURED || serialized.length > MAX_SERIALIZED) {
    throw new FeaturedLimitError();
  }
  await saveSettings({ [KEY]: serialized });
}
