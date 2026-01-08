import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { HardDrive, Cpu, MemoryStick, Database, Server, Activity } from "lucide-react";

// Mock data for demonstration - In production, this would come from backend APIs
const systemStats = {
  storage: {
    used: 45.2,
    total: 100,
    unit: "GB",
  },
  cpu: {
    used: 32,
    total: 100,
    unit: "%",
  },
  memory: {
    used: 6.4,
    total: 16,
    unit: "GB",
  },
  database: {
    used: 2.8,
    total: 8,
    unit: "GB",
  },
};

const StatCard = ({
  title,
  icon: Icon,
  used,
  total,
  unit,
  color,
}: {
  title: string;
  icon: React.ElementType;
  used: number;
  total: number;
  unit: string;
  color: string;
}) => {
  const percentage = (used / total) * 100;
  const remaining = total - used;

  return (
    <Card className="overflow-hidden">
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base font-medium">{title}</CardTitle>
          <div className={`p-2 rounded-lg ${color}`}>
            <Icon className="w-5 h-5 text-white" />
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">ใช้งาน</span>
            <span className="font-medium">
              {used} {unit}
            </span>
          </div>
          <Progress value={percentage} className="h-2" />
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">คงเหลือ</span>
            <span className="font-medium text-green-600">
              {remaining.toFixed(1)} {unit}
            </span>
          </div>
        </div>
        <div className="pt-2 border-t">
          <div className="flex justify-between items-center">
            <span className="text-xs text-muted-foreground">ทั้งหมด</span>
            <span className="text-sm font-semibold">
              {total} {unit}
            </span>
          </div>
          <div className="flex justify-between items-center mt-1">
            <span className="text-xs text-muted-foreground">การใช้งาน</span>
            <span
              className={`text-sm font-semibold ${
                percentage > 80 ? "text-red-500" : percentage > 60 ? "text-yellow-500" : "text-green-500"
              }`}
            >
              {percentage.toFixed(1)}%
            </span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

const SystemDashboard = () => {
  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center gap-3">
          <div className="p-3 bg-primary/10 rounded-xl">
            <Server className="w-6 h-6 text-primary" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-foreground">แดชบอร์ดระบบ</h1>
            <p className="text-muted-foreground">ภาพรวมการใช้ทรัพยากรของระบบ</p>
          </div>
        </div>

        {/* System Status */}
        <Card className="bg-gradient-to-r from-primary/5 to-primary/10 border-primary/20">
          <CardContent className="py-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-green-500/20 rounded-full">
                <Activity className="w-5 h-5 text-green-500" />
              </div>
              <div>
                <p className="font-medium text-foreground">สถานะระบบ: ปกติ</p>
                <p className="text-sm text-muted-foreground">
                  อัปเดตล่าสุด: {new Date().toLocaleString("th-TH")}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Resource Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <StatCard
            title="Storage"
            icon={HardDrive}
            used={systemStats.storage.used}
            total={systemStats.storage.total}
            unit={systemStats.storage.unit}
            color="bg-blue-500"
          />
          <StatCard
            title="CPU"
            icon={Cpu}
            used={systemStats.cpu.used}
            total={systemStats.cpu.total}
            unit={systemStats.cpu.unit}
            color="bg-orange-500"
          />
          <StatCard
            title="Memory (RAM)"
            icon={MemoryStick}
            used={systemStats.memory.used}
            total={systemStats.memory.total}
            unit={systemStats.memory.unit}
            color="bg-purple-500"
          />
          <StatCard
            title="Database"
            icon={Database}
            used={systemStats.database.used}
            total={systemStats.database.total}
            unit={systemStats.database.unit}
            color="bg-green-500"
          />
        </div>

        {/* Note */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">หมายเหตุ</CardTitle>
            <CardDescription>
              ข้อมูลนี้เป็นข้อมูลจำลองสำหรับการแสดงผล ในระบบจริงจะดึงข้อมูลจาก Backend API
            </CardDescription>
          </CardHeader>
        </Card>
      </div>
    </DashboardLayout>
  );
};

export default SystemDashboard;
