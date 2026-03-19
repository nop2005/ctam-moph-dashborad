import { useState } from "react";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { Target, Presentation } from "lucide-react";
import { Button } from "@/components/ui/button";
import { StrategySlidesDialog } from "@/components/strategic/StrategySlidesDialog";

export default function StrategicPlan() {
  const [slidesOpen, setSlidesOpen] = useState(false);

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex items-center gap-3">
          <Target className="h-8 w-8 text-primary" />
          <div>
            <h1 className="text-2xl font-bold">แผนยุทธศาสตร์ประจำปี</h1>
            <p className="text-muted-foreground">แผนยุทธศาสตร์และเป้าหมายการดำเนินงานประจำปี</p>
          </div>
        </div>

        <div className="flex justify-center py-12">
          <Button
            size="lg"
            onClick={() => setSlidesOpen(true)}
            className="h-20 px-12 text-xl gap-4 rounded-xl shadow-lg hover:shadow-xl transition-shadow"
          >
            <Presentation className="h-8 w-8" />
            แผนกลยุทธ์
          </Button>
        </div>
      </div>

      <StrategySlidesDialog open={slidesOpen} onOpenChange={setSlidesOpen} />
    </DashboardLayout>
  );
}
