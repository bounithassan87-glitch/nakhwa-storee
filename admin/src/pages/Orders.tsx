import { ShoppingBag, Filter } from "lucide-react";
import { PageHeader } from "@/components/ui/PageHeader";
import { Button } from "@/components/ui/Button";
import { DataTable, type Column } from "@/components/ui/DataTable";
import { EmptyState } from "@/components/ui/EmptyState";

const columns: Column[] = [
  { key: "num", header: "رقم الطلب" },
  { key: "customer", header: "الزبون" },
  { key: "total", header: "المجموع" },
  { key: "status", header: "الحالة" },
  { key: "date", header: "التاريخ" },
];

export default function Orders() {
  return (
    <>
      <PageHeader
        title="الطلبات"
        subtitle="إدارة طلبات الزبناء"
        action={
          <Button variant="secondary" size="sm" disabled>
            <Filter className="h-4 w-4" /> تصفية
          </Button>
        }
      />
      <DataTable
        columns={columns}
        empty={
          <EmptyState
            icon={ShoppingBag}
            title="لا توجد طلبات بعد"
            description="ستظهر الطلبات هنا بعد ربط اللوحة بالـ API."
          />
        }
      />
    </>
  );
}
