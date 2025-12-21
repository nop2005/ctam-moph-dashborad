import { useAuth } from '@/contexts/AuthContext';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { 
  FileText, 
  CheckCircle2, 
  Clock, 
  AlertTriangle,
  BarChart3,
} from 'lucide-react';

export default function Dashboard() {
  const { user, profile } = useAuth();

  // Placeholder stats
  const stats = [
    { 
      label: 'แบบประเมินทั้งหมด', 
      value: '0', 
      icon: FileText, 
      color: 'text-primary',
      bgColor: 'bg-primary/10'
    },
    { 
      label: 'รอตรวจสอบ', 
      value: '0', 
      icon: Clock, 
      color: 'text-warning',
      bgColor: 'bg-warning/10'
    },
    { 
      label: 'ผ่านการประเมิน', 
      value: '0', 
      icon: CheckCircle2, 
      color: 'text-success',
      bgColor: 'bg-success/10'
    },
    { 
      label: 'ต้องแก้ไข', 
      value: '0', 
      icon: AlertTriangle, 
      color: 'text-destructive',
      bgColor: 'bg-destructive/10'
    },
  ];

  return (
    <DashboardLayout>
      {/* Welcome Section */}
      <div className="mb-8">
        <h2 className="text-2xl font-bold mb-2">
          สวัสดี, {profile?.full_name || 'ผู้ใช้งาน'}
        </h2>
        <p className="text-muted-foreground">
          ยินดีต้อนรับสู่ระบบประเมินความปลอดภัยไซเบอร์ CTAM+
        </p>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        {stats.map((stat, index) => (
          <Card key={index} className="card-hover">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-2xl font-bold">{stat.value}</p>
                  <p className="text-sm text-muted-foreground">{stat.label}</p>
                </div>
                <div className={`w-12 h-12 rounded-xl ${stat.bgColor} flex items-center justify-center`}>
                  <stat.icon className={`w-6 h-6 ${stat.color}`} />
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Quick Actions */}
      <div className="grid md:grid-cols-2 gap-6">
        {/* Assessment Card */}
        <Card className="card-hover">
          <CardHeader>
            <div className="w-12 h-12 bg-primary/10 rounded-xl flex items-center justify-center mb-4">
              <FileText className="w-6 h-6 text-primary" />
            </div>
            <CardTitle>แบบประเมิน CTAM+</CardTitle>
            <CardDescription>
              กรอกแบบประเมินความปลอดภัยไซเบอร์ 17 หมวด
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button className="w-full" disabled>
              เริ่มประเมิน (เร็วๆ นี้)
            </Button>
          </CardContent>
        </Card>

        {/* Reports Card */}
        <Card className="card-hover">
          <CardHeader>
            <div className="w-12 h-12 bg-accent/10 rounded-xl flex items-center justify-center mb-4">
              <BarChart3 className="w-6 h-6 text-accent" />
            </div>
            <CardTitle>รายงานและสถิติ</CardTitle>
            <CardDescription>
              ดูภาพรวมผลการประเมินและ Dashboard
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button variant="secondary" className="w-full" disabled>
              ดูรายงาน (เร็วๆ นี้)
            </Button>
          </CardContent>
        </Card>
      </div>

      {/* Setup Notice for new users */}
      {profile?.role === 'hospital_it' && !profile.hospital_id && (
        <Card className="mt-8 border-warning/50 bg-warning/5">
          <CardContent className="p-6">
            <div className="flex items-start gap-4">
              <div className="w-10 h-10 bg-warning/20 rounded-lg flex items-center justify-center flex-shrink-0">
                <AlertTriangle className="w-5 h-5 text-warning" />
              </div>
              <div>
                <h3 className="font-semibold mb-1">ยังไม่ได้เชื่อมโยงกับโรงพยาบาล</h3>
                <p className="text-sm text-muted-foreground">
                  กรุณาติดต่อผู้ดูแลระบบ (Admin) เพื่อเชื่อมโยงบัญชีของคุณกับโรงพยาบาลที่สังกัด
                  ก่อนที่จะเริ่มกรอกแบบประเมิน
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </DashboardLayout>
  );
}
