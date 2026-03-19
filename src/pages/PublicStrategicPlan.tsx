import { useState } from "react";
import { PublicLayout } from "@/components/layout/PublicLayout";
import { Target, Presentation, Cpu, FileSpreadsheet } from "lucide-react";
import { Button } from "@/components/ui/button";
import { StrategySlidesDialog } from "@/components/strategic/StrategySlidesDialog";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { X } from "lucide-react";

export default function PublicStrategicPlan() {
  const [slidesOpen, setSlidesOpen] = useState(false);
  const [pricingOpen, setPricingOpen] = useState(false);

  return (
    <PublicLayout>
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
                onClick={() => setPricingOpen(true)}
              >
                <FileSpreadsheet className="h-5 w-5 text-primary" />
                แผนงบประมาณ R1- Datacenter
              </Button>
            </div>
          </div>
        </div>
      </div>

      <StrategySlidesDialog open={slidesOpen} onOpenChange={setSlidesOpen} />

      <Dialog open={pricingOpen} onOpenChange={setPricingOpen}>
        <DialogContent className="max-w-[95vw] w-[95vw] max-h-[95vh] h-[95vh] p-0 overflow-hidden border-0">
          <button
            onClick={() => setPricingOpen(false)}
            className="absolute right-4 top-4 z-50 rounded-full bg-black/50 p-2 text-white hover:bg-black/70 transition-colors"
          >
            <X className="h-5 w-5" />
          </button>
          <iframe
            src="/r1dc-pricing.html"
            className="w-full h-full border-0"
            title="แผนงบประมาณ R1- Datacenter"
          />
        </DialogContent>
      </Dialog>
    </PublicLayout>
  );
}
