import { Link } from "react-router-dom";
import { Button } from "@/components/ui/Button";

export default function NotFound() {
  return (
    <div className="grid min-h-full place-items-center bg-bg p-6 text-center">
      <div className="flex flex-col items-center gap-3">
        <p className="text-6xl font-black text-brand-dark">404</p>
        <h1 className="text-lg font-bold text-ink">الصفحة غير موجودة</h1>
        <p className="max-w-sm text-sm text-muted">
          الرابط الذي تحاولين فتحه غير موجود في لوحة التحكم.
        </p>
        <Link to="/dashboard">
          <Button className="mt-2">العودة إلى لوحة القيادة</Button>
        </Link>
      </div>
    </div>
  );
}
