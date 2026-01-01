import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { FileCheck } from 'lucide-react';

export default function InspectionSupervisee() {
  return (
    <DashboardLayout>
      <div className="mb-6">
        <h1 className="text-2xl font-bold">รายงานผู้รับนิเทศ</h1>
        <p className="text-muted-foreground">รายงานการตรวจราชการสำหรับผู้รับนิเทศ</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileCheck className="h-5 w-5" />
            รายงานผู้รับนิเทศ
          </CardTitle>
          <CardDescription>
            ข้อมูลรายงานการตรวจราชการสำหรับผู้รับนิเทศ
          </CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground">กำลังพัฒนา...</p>
        </CardContent>
      </Card>
    </DashboardLayout>
  );
}
