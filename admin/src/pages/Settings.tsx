import { Store, Truck, Bell } from "lucide-react";
import { PageHeader } from "@/components/ui/PageHeader";
import { Card } from "@/components/ui/Card";
import { Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";

function Section({
  icon: Icon,
  title,
  children,
}: {
  icon: typeof Store;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <Card className="p-5">
      <div className="mb-4 flex items-center gap-2">
        <span className="grid h-9 w-9 place-items-center rounded-lg bg-brand-soft text-brand-dark">
          <Icon className="h-4.5 w-4.5" />
        </span>
        <h3 className="font-bold text-ink">{title}</h3>
      </div>
      {children}
    </Card>
  );
}

export default function Settings() {
  return (
    <>
      <PageHeader
        title="الإعدادات"
        subtitle="إعدادات المتجر"
        action={
          <Button size="sm" disabled>
            حفظ التغييرات
          </Button>
        }
      />

      <div className="grid gap-4 lg:grid-cols-2">
        <Section icon={Store} title="معلومات المتجر">
          <div className="space-y-4">
            <Input label="اسم المتجر" defaultValue="Nakhwa Store" disabled />
            <Input label="رقم واتساب" defaultValue="+212624273714" disabled />
          </div>
        </Section>

        <Section icon={Truck} title="التوصيل">
          <div className="space-y-4">
            <Input label="ثمن التوصيل (درهم)" defaultValue="0" disabled />
            <Input label="مدة التوصيل" defaultValue="24-48 ساعة" disabled />
          </div>
        </Section>

        <Section icon={Bell} title="الإشعارات">
          <p className="text-sm text-muted">
            سيتم إضافة إعدادات الإشعارات هنا لاحقاً.
          </p>
        </Section>
      </div>
    </>
  );
}
