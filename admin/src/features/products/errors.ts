/**
 * Maps product-API error codes to user-facing Arabic messages.
 *
 * Lives in its own module (rather than inside a component file) so that every
 * consumer — the managers, the products page, the create form — can import it
 * without coupling one component to another, and so component files export
 * components only, which keeps Fast Refresh reliable during development.
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
    case "duplicate_slug_or_sku":
      return "الرابط أو رمز SKU مستعمل من طرف منتج آخر.";
    case "product_has_orders":
      return "لا يمكن الحذف النهائي: هذا المنتج مرتبط بطلبات سابقة. استعمل الأرشفة بدلاً من ذلك.";
    case "validation_error":
      return "تحقّق من الحقول المدخلة.";
    case "forbidden":
      return "لا تملك صلاحية إدارة المنتجات.";
    case "not_found":
      return "المنتج غير موجود.";
    default:
      return "تعذّرت العملية.";
  }
}
