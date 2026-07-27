/**
 * Maps product-API error codes to user-facing Arabic messages.
 *
 * Lives in its own module (rather than inside a component file) so that both
 * ColorsManager and SizesManager can import it without coupling one component
 * to another, and so component files export components only — which keeps Fast
 * Refresh reliable during development.
 *
 * @param code - the `error` field returned by the admin products API
 * @returns a translated message safe to show in the UI
 */
export function errorMsg(code: string): string {
  switch (code) {
    case "duplicate_color":
      return "هذا اللون موجود مسبقاً.";
    case "duplicate_size":
      return "هذا المقاس موجود مسبقاً.";
    default:
      return "تعذّرت العملية.";
  }
}
