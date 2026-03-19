import { PublicLayout } from "@/components/layout/PublicLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Target } from "lucide-react";

export default function PublicStrategicPlan() {
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

        <Card>
          <CardHeader>
            <CardTitle>แผนยุทธศาสตร์</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
              <Target className="h-16 w-16 mb-4 opacity-30" />
              <p className="text-lg font-medium">อยู่ระหว่างการพัฒนา</p>
              <p className="text-sm">เนื้อหาแผนยุทธศาสตร์จะแสดงที่นี่</p>
            </div>
          </CardContent>
        </Card>
      </div>
    </PublicLayout>
  );
}
