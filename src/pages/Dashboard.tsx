import { useEffect, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { supabase } from '@/integrations/supabase/client';
import { 
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { 
  FileText, 
  CheckCircle2, 
  Clock, 
  BarChart3,
  AlertTriangle,
} from 'lucide-react';

interface AssessmentStats {
  total: number;
  draft: number;
  waitingProvincial: number;
  waitingRegional: number;
  approved: number;
  returned: number;
}

// คำนวณปีงบประมาณปัจจุบัน (ถ้าเดือน >= ตุลาคม จะเป็นปีงบถัดไป)
const getCurrentFiscalYear = () => {
  const now = new Date();
  const month = now.getMonth(); // 0-11
  const year = now.getFullYear();
  return month >= 9 ? year + 1 : year; // ตุลาคมขึ้นไป = ปีงบถัดไป
};

export default function Dashboard() {
  const { user, profile } = useAuth();
  const [stats, setStats] = useState<AssessmentStats>({
    total: 0,
    draft: 0,
    waitingProvincial: 0,
    waitingRegional: 0,
    approved: 0,
    returned: 0,
  });
  const [loading, setLoading] = useState(true);
  const [selectedFiscalYear, setSelectedFiscalYear] = useState<string>(
    getCurrentFiscalYear().toString()
  );
  const [fiscalYears, setFiscalYears] = useState<number[]>([]);

  // Fetch available fiscal years
  useEffect(() => {
    const fetchFiscalYears = async () => {
      const { data, error } = await supabase
        .from('assessments')
        .select('fiscal_year');

      if (!error && data) {
        const uniqueYears = [...new Set(data.map(a => a.fiscal_year))].sort((a, b) => b - a);
        setFiscalYears(uniqueYears);
      }
    };

    fetchFiscalYears();
  }, []);

  useEffect(() => {
    const fetchStats = async () => {
      if (!profile) return;
      
      try {
        // Build query
        let query = supabase
          .from('assessments')
          .select('id, status, fiscal_year');

        // Filter by fiscal year if not "all"
        if (selectedFiscalYear !== 'all') {
          query = query.eq('fiscal_year', parseInt(selectedFiscalYear));
        }

        const { data: assessments, error } = await query;

        if (error) {
          console.error('Error fetching assessments:', error);
          return;
        }

        if (assessments) {
          const total = assessments.length;
          const draft = assessments.filter(a => 
            a.status === 'draft'
          ).length;
          const waitingProvincial = assessments.filter(a => 
            a.status === 'submitted'
          ).length;
          const waitingRegional = assessments.filter(a => 
            a.status === 'approved_provincial'
          ).length;
          const approved = assessments.filter(a => 
            a.status === 'approved_regional' || a.status === 'completed'
          ).length;
          const returned = assessments.filter(a => 
            a.status === 'returned'
          ).length;

          setStats({ total, draft, waitingProvincial, waitingRegional, approved, returned });
        }
      } catch (error) {
        console.error('Error:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchStats();
  }, [profile, selectedFiscalYear]);

  const statsDisplay = [
    { 
      label: 'แบบประเมินทั้งหมด', 
      value: loading ? '-' : stats.total.toString(), 
      icon: FileText, 
      color: 'text-primary',
      bgColor: 'bg-primary/10',
      href: '/assessments'
    },
    { 
      label: 'ร่าง', 
      value: loading ? '-' : stats.draft.toString(), 
      icon: FileText, 
      color: 'text-muted-foreground',
      bgColor: 'bg-muted',
      href: '/assessments'
    },
    { 
      label: 'รอ สสจ. ตรวจสอบ', 
      value: loading ? '-' : stats.waitingProvincial.toString(), 
      icon: Clock, 
      color: 'text-warning',
      bgColor: 'bg-warning/10',
      href: '/assessments'
    },
    { 
      label: 'รอ เขตสุขภาพ ตรวจสอบ', 
      value: loading ? '-' : stats.waitingRegional.toString(), 
      icon: Clock, 
      color: 'text-primary',
      bgColor: 'bg-primary/10',
      href: '/assessments'
    },
    { 
      label: 'อนุมัติแล้ว', 
      value: loading ? '-' : stats.approved.toString(), 
      icon: CheckCircle2, 
      color: 'text-success',
      bgColor: 'bg-success/10',
      href: '/assessments'
    },
    { 
      label: 'ต้องแก้ไข', 
      value: loading ? '-' : stats.returned.toString(), 
      icon: AlertTriangle, 
      color: 'text-destructive',
      bgColor: 'bg-destructive/10',
      href: '/assessments'
    },
  ];

  return (
    <DashboardLayout>
      {/* Welcome Section */}
      <div className="mb-8 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold mb-2">
            สวัสดี, {profile?.full_name || 'ผู้ใช้งาน'}
          </h2>
          <p className="text-muted-foreground">
            ยินดีต้อนรับสู่ระบบประเมินความปลอดภัยไซเบอร์ CTAM+
          </p>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-sm text-muted-foreground whitespace-nowrap">ปีงบประมาณ:</span>
          <Select value={selectedFiscalYear} onValueChange={setSelectedFiscalYear}>
            <SelectTrigger className="w-[140px]">
              <SelectValue placeholder="เลือกปีงบ" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">ทุกปีงบประมาณ</SelectItem>
              {fiscalYears.map(year => (
                <SelectItem key={year} value={year.toString()}>
                  พ.ศ. {year + 543}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4 mb-8">
        {statsDisplay.map((stat, index) => (
          <Card 
            key={index} 
            className="card-hover cursor-pointer transition-transform hover:scale-[1.02]"
            onClick={() => window.location.href = stat.href}
          >
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
            <Button className="w-full" onClick={() => window.location.href = '/assessments'}>
              เริ่มประเมิน
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
            <Button variant="secondary" className="w-full" onClick={() => window.location.href = '/reports'}>
              ดูรายงาน
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
