import { useState } from "react";
import { PublicLayout } from "@/components/layout/PublicLayout";
import { Target, Presentation, ChevronDown, ChevronRight, Cpu, FileSpreadsheet } from "lucide-react";
import { Button } from "@/components/ui/button";
import { StrategySlidesDialog } from "@/components/strategic/StrategySlidesDialog";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";

export default function PublicStrategicPlan() {
  const [slidesOpen, setSlidesOpen] = useState(false);
  const [strategy1Open, setStrategy1Open] = useState(false);

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

        {/* Strategy Menus */}
        <div className="max-w-3xl mx-auto space-y-3">
          <Collapsible open={strategy1Open} onOpenChange={setStrategy1Open}>
            <CollapsibleTrigger asChild>
              <Button
                variant="outline"
                className="w-full justify-between h-14 text-lg font-semibold border-2 border-primary/30 hover:border-primary hover:bg-primary/5"
              >
                <span className="flex items-center gap-3">
                  <Cpu className="h-6 w-6 text-primary" />
                  กลยุทธ์ที่ 1 : Smart Operation
                </span>
                {strategy1Open ? (
                  <ChevronDown className="h-5 w-5 text-muted-foreground" />
                ) : (
                  <ChevronRight className="h-5 w-5 text-muted-foreground" />
                )}
              </Button>
            </CollapsibleTrigger>
            <CollapsibleContent className="mt-1">
              <div className="ml-8 space-y-1">
                <Button
                  variant="ghost"
                  className="w-full justify-start h-12 text-base gap-3 hover:bg-primary/5"
                >
                  <FileSpreadsheet className="h-5 w-5 text-primary" />
                  แผนงบประมาณ R1- Datacenter
                </Button>
              </div>
            </CollapsibleContent>
          </Collapsible>
        </div>
      </div>

      <StrategySlidesDialog open={slidesOpen} onOpenChange={setSlidesOpen} />
    </PublicLayout>
  );
}
