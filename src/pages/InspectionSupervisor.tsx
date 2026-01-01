import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { FileSearch } from 'lucide-react';

export default function InspectionSupervisor() {
  return (
    <DashboardLayout>
      <div className="mb-6">
        <h1 className="text-2xl font-bold">รายงานผู้นิเทศ</h1>
        <p className="text-muted-foreground">รายงานการตรวจราชการสำหรับผู้นิเทศ</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileSearch className="h-5 w-5" />
            รายงานผู้นิเทศ
          </CardTitle>
          <CardDescription>
            ข้อมูลรายงานการตรวจราชการสำหรับผู้นิเทศ
          </CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground">กำลังพัฒนา...</p>
        </CardContent>
      </Card>
    </DashboardLayout>
  );
}
