import { useCallback, useEffect, useState } from "react";
import { loadFeatured, saveFeatured } from "./featured";

/**
 * Reads and mutates the featured-product set.
 *
 * Toggling is optimistic: the star flips immediately and the previous set is
 * restored if the write fails, so the UI never claims a change the server
 * rejected. `canManage` short-circuits writes for roles without
 * `manage_settings` — the server enforces the same rule.
 *
 * @param canManage - whether the signed-in admin may persist changes
 * @param onError - surfaced to the caller's toast host
 */
export function useFeatured(canManage: boolean, onError: (msg: string) => void) {
  const [featured, setFeatured] = useState<Set<string>>(() => new Set());
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    let alive = true;
    void (async () => {
      try {
        const ids = await loadFeatured();
        if (alive) setFeatured(ids);
      } catch {
        // A settings read failure must not blank the products page; the flag
        // simply renders as "not featured" until the next successful load.
      } finally {
        if (alive) setLoaded(true);
      }
    })();
    return () => {
      alive = false;
    };
  }, []);

  const toggle = useCallback(
    async (id: string) => {
      if (!canManage) return;

      const previous = featured;
      const next = new Set(previous);
      const willFeature = !next.has(id);
      if (willFeature) next.add(id);
      else next.delete(id);

      setFeatured(next); // optimistic
      try {
        await saveFeatured(next);
      } catch (e) {
        setFeatured(previous); // rollback
        onError(e instanceof Error ? e.message : "تعذّر حفظ التمييز.");
      }
    },
    [canManage, featured, onError],
  );

  return { featured, featuredLoaded: loaded, toggleFeatured: toggle };
}
