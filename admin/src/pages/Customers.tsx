import { Users } from "lucide-react";
import { PageHeader } from "@/components/ui/PageHeader";
import { DataTable, type Column } from "@/components/ui/DataTable";
import { EmptyState } from "@/components/ui/EmptyState";

const columns: Column[] = [
  { key: "name", header: "الاسم" },
  { key: "phone", header: "الهاتف" },
  { key: "city", header: "المدينة" },
  { key: "orders", header: "الطلبات" },
  { key: "since", header: "منذ" },
];

export default function Customers() {
  return (
    <>
      <PageHeader title="الزبناء" subtitle="قاعدة بيانات الزبناء" />
      <DataTable
        columns={columns}
        empty={
          <EmptyState
            icon={Users}
            title="لا يوجد زبناء بعد"
            description="سيتم عرض الزبناء هنا بمجرد ربط اللوحة بقاعدة البيانات."
          />
        }
      />
    </>
  );
}
