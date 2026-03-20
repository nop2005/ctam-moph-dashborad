import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { Target, Presentation, Cpu, FileSpreadsheet, Network } from "lucide-react";
import { Button } from "@/components/ui/button";
import { StrategySlidesDialog } from "@/components/strategic/StrategySlidesDialog";

export default function StrategicPlan() {
  const [slidesOpen, setSlidesOpen] = useState(false);
  const navigate = useNavigate();

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

        <div className="flex justify-center py-8">
          <Button
            size="lg"
            onClick={() => setSlidesOpen(true)}
            className="h-20 px-12 text-xl gap-4 rounded-xl shadow-lg hover:shadow-xl transition-shadow"
          >
            <Presentation className="h-8 w-8" />
            แผนกลยุทธ์
          </Button>
        </div>

        <div className="max-w-3xl mx-auto space-y-3">
          <div className="border-2 border-primary/30 rounded-lg overflow-hidden">
            <div className="flex items-center gap-3 px-5 py-4 bg-primary/5 font-semibold text-lg">
              <Cpu className="h-6 w-6 text-primary" />
              กลยุทธ์ที่ 1 : Smart Operation
            </div>
            <div className="ml-8 py-2">
              <Button
                variant="ghost"
                className="w-full justify-start h-12 text-base gap-3 hover:bg-primary/5"
                onClick={() => navigate("/public/strategic-plan/pricing")}
              >
                <FileSpreadsheet className="h-5 w-5 text-primary" />
                แผนงบประมาณ R1- Datacenter
              </Button>
              <Button
                variant="ghost"
                className="w-full justify-start h-12 text-base gap-3 hover:bg-primary/5"
                onClick={() => navigate("/public/strategic-plan/architecture")}
              >
                <Network className="h-5 w-5 text-primary" />
                สถาปัตยกรรม R1- Datacenter
              </Button>
            </div>
          </div>
        </div>
      </div>

      <StrategySlidesDialog open={slidesOpen} onOpenChange={setSlidesOpen} />
    </DashboardLayout>
  );
}
