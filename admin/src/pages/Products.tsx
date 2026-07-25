import { Package, Plus } from "lucide-react";
import { PageHeader } from "@/components/ui/PageHeader";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/EmptyState";

export default function Products() {
  return (
    <>
      <PageHeader
        title="المنتجات"
        subtitle="إدارة الكتالوج"
        action={
          <Button size="sm" disabled>
            <Plus className="h-4 w-4" /> إضافة منتج
          </Button>
        }
      />
      <Card>
        <EmptyState
          icon={Package}
          title="لا توجد منتجات بعد"
          description="سيتم إدارة المنتجات، الألوان والمقاسات هنا بعد ربط اللوحة بقاعدة البيانات."
        />
      </Card>
    </>
  );
}
