import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { 
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { 
  FileText, 
  CheckCircle2, 
  Clock, 
  AlertTriangle,
  Plus,
  Eye,
  Loader2,
} from 'lucide-react';
import { format } from 'date-fns';
import { th } from 'date-fns/locale';
import type { Database } from '@/integrations/supabase/types';

type Assessment = Database['public']['Tables']['assessments']['Row'];
type Hospital = Database['public']['Tables']['hospitals']['Row'];
type HealthOffice = Database['public']['Tables']['health_offices']['Row'];

interface AssessmentStats {
  total: number;
  draft: number;
  waitingProvincial: number;
  waitingRegional: number;
  approved: number;
  returned: number;
}

const statusLabels: Record<string, { label: string; className: string }> = {
  draft: { label: 'ร่าง', className: 'status-draft' },
  submitted: { label: 'รอตรวจสอบ', className: 'status-submitted' },
  approved_provincial: { label: 'สสจ.อนุมัติ', className: 'bg-info/10 text-info' },
  approved_regional: { label: 'เขตอนุมัติ', className: 'status-approved' },
  returned: { label: 'ตีกลับแก้ไข', className: 'status-returned' },
  completed: { label: 'เสร็จสิ้น', className: 'status-completed' },
};

// คำนวณปีงบประมาณปัจจุบัน (ถ้าเดือน >= ตุลาคม จะเป็นปีงบถัดไป)
const getCurrentFiscalYear = () => {
  const now = new Date();
  const month = now.getMonth(); // 0-11
  const year = now.getFullYear();
  return month >= 9 ? year + 1 : year; // ตุลาคมขึ้นไป = ปีงบถัดไป
};

export default function Dashboard() {
  const navigate = useNavigate();
  const { user, profile } = useAuth();
  const { toast } = useToast();
  
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

  // Assessment list state
  const [assessments, setAssessments] = useState<(Assessment & { hospitals?: Hospital; health_offices?: HealthOffice })[]>([]);
  const [hospitals, setHospitals] = useState<Hospital[]>([]);
  const [healthOffice, setHealthOffice] = useState<HealthOffice | null>(null);
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [selectedHospital, setSelectedHospital] = useState<string>('');
  const [selectedYear, setSelectedYear] = useState<string>(new Date().getFullYear().toString());
  const [creating, setCreating] = useState(false);
  const [nextPeriod, setNextPeriod] = useState<string>('1');
  const [statusFilter, setStatusFilter] = useState<string | null>(null);

  const currentYear = new Date().getFullYear();
  const years = [currentYear - 1, currentYear, currentYear + 1];

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
    const fetchData = async () => {
      if (!profile) return;
      
      try {
        setLoading(true);

        // Build query for stats
        let statsQuery = supabase
          .from('assessments')
          .select('id, status, fiscal_year');

        // Filter by fiscal year if not "all"
        if (selectedFiscalYear !== 'all') {
          statsQuery = statsQuery.eq('fiscal_year', parseInt(selectedFiscalYear));
        }

        const { data: statsData, error: statsError } = await statsQuery;

        if (statsError) {
          console.error('Error fetching stats:', statsError);
        } else if (statsData) {
          const total = statsData.length;
          const draft = statsData.filter(a => a.status === 'draft').length;
          const waitingProvincial = statsData.filter(a => a.status === 'submitted').length;
          const waitingRegional = statsData.filter(a => a.status === 'approved_provincial').length;
          const approved = statsData.filter(a => a.status === 'approved_regional' || a.status === 'completed').length;
          const returned = statsData.filter(a => a.status === 'returned').length;
          setStats({ total, draft, waitingProvincial, waitingRegional, approved, returned });
        }

        // Load assessments list
        const { data: assessmentsData, error: assessError } = await supabase
          .from('assessments')
          .select('*, hospitals(*), health_offices(*)')
          .order('created_at', { ascending: false });

        if (assessError) {
          console.error('Error loading assessments:', assessError);
        } else {
          setAssessments(assessmentsData || []);
        }

        // Load hospitals for create dialog
        if (profile?.role === 'hospital_it' && profile.hospital_id) {
          const { data: hospitalData } = await supabase
            .from('hospitals')
            .select('*')
            .eq('id', profile.hospital_id);
          setHospitals(hospitalData || []);
          if (hospitalData?.[0]) {
            setSelectedHospital(hospitalData[0].id);
            const hospitalAssessments = (assessmentsData || []).filter(
              a => a.hospital_id === hospitalData[0].id && 
                   a.fiscal_year === parseInt(selectedYear)
            );
            setNextPeriod((hospitalAssessments.length + 1).toString());
          }
        } else if (profile?.role === 'health_office' && profile.health_office_id) {
          const { data: healthOfficeData } = await supabase
            .from('health_offices')
            .select('*')
            .eq('id', profile.health_office_id)
            .maybeSingle();
          setHealthOffice(healthOfficeData);
          
          if (healthOfficeData) {
            const healthOfficeAssessments = (assessmentsData || []).filter(
              a => a.health_office_id === healthOfficeData.id && 
                   a.fiscal_year === parseInt(selectedYear)
            );
            setNextPeriod((healthOfficeAssessments.length + 1).toString());
          }
        } else if (profile?.role === 'central_admin') {
          const { data: hospitalsData } = await supabase
            .from('hospitals')
            .select('*')
            .order('name');
          setHospitals(hospitalsData || []);
        }

      } catch (error) {
        console.error('Error:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [profile, selectedFiscalYear]);

  // Calculate next assessment period when hospital or year changes
  useEffect(() => {
    if (profile?.role === 'health_office' && healthOffice && selectedYear) {
      const healthOfficeAssessments = assessments.filter(
        a => a.health_office_id === healthOffice.id && 
             a.fiscal_year === parseInt(selectedYear)
      );
      setNextPeriod((healthOfficeAssessments.length + 1).toString());
    } else if (selectedHospital && selectedYear) {
      const hospitalAssessments = assessments.filter(
        a => a.hospital_id === selectedHospital && 
             a.fiscal_year === parseInt(selectedYear)
      );
      setNextPeriod((hospitalAssessments.length + 1).toString());
    }
  }, [selectedHospital, selectedYear, assessments, healthOffice, profile?.role]);

  const handleCreateAssessment = async () => {
    const isHealthOfficeUser = profile?.role === 'health_office';
    if (!isHealthOfficeUser && !selectedHospital) {
      toast({ title: 'กรุณากรอกข้อมูลให้ครบ', variant: 'destructive' });
      return;
    }
    if (isHealthOfficeUser && !healthOffice) {
      toast({ title: 'ไม่พบข้อมูลหน่วยงาน', variant: 'destructive' });
      return;
    }
    if (!selectedYear) {
      toast({ title: 'กรุณาเลือกปีงบประมาณ', variant: 'destructive' });
      return;
    }

    try {
      setCreating(true);

      const insertData: any = {
        fiscal_year: parseInt(selectedYear),
        assessment_period: nextPeriod,
        created_by: profile?.id,
        status: 'draft',
      };

      if (isHealthOfficeUser && healthOffice) {
        insertData.health_office_id = healthOffice.id;
      } else {
        insertData.hospital_id = selectedHospital;
      }

      const { data: newAssessment, error: createError } = await supabase
        .from('assessments')
        .insert(insertData)
        .select()
        .single();

      if (createError) throw createError;

      const { data: categories } = await supabase
        .from('ctam_categories')
        .select('id')
        .order('order_number');

      if (categories) {
        const items = categories.map(cat => ({
          assessment_id: newAssessment.id,
          category_id: cat.id,
          status: 'fail' as const,
          score: 0,
        }));

        const { error: itemsError } = await supabase
          .from('assessment_items')
          .insert(items);

        if (itemsError) throw itemsError;
      }

      toast({ title: 'สร้างแบบประเมินสำเร็จ' });
      setCreateDialogOpen(false);
      navigate(`/assessment/${newAssessment.id}`);

    } catch (error: any) {
      console.error('Error creating assessment:', error);
      toast({ title: 'เกิดข้อผิดพลาด', description: error.message, variant: 'destructive' });
    } finally {
      setCreating(false);
    }
  };

  const canCreate = profile?.role === 'hospital_it' || profile?.role === 'central_admin' || profile?.role === 'health_office';

  const statsDisplay = [
    { 
      label: 'แบบประเมินทั้งหมด', 
      value: loading ? '-' : stats.total.toString(), 
      icon: FileText, 
      color: 'text-primary',
      bgColor: 'bg-primary/10',
      filterValue: null, // Show all
    },
    { 
      label: 'ร่าง', 
      value: loading ? '-' : stats.draft.toString(), 
      icon: FileText, 
      color: 'text-muted-foreground',
      bgColor: 'bg-muted',
      filterValue: 'draft',
    },
    { 
      label: 'รอ สสจ. ตรวจสอบ', 
      value: loading ? '-' : stats.waitingProvincial.toString(), 
      icon: Clock, 
      color: 'text-warning',
      bgColor: 'bg-warning/10',
      filterValue: 'submitted',
    },
    { 
      label: 'รอ เขตสุขภาพ ตรวจสอบ', 
      value: loading ? '-' : stats.waitingRegional.toString(), 
      icon: Clock, 
      color: 'text-primary',
      bgColor: 'bg-primary/10',
      filterValue: 'approved_provincial',
    },
    { 
      label: 'อนุมัติแล้ว', 
      value: loading ? '-' : stats.approved.toString(), 
      icon: CheckCircle2, 
      color: 'text-success',
      bgColor: 'bg-success/10',
      filterValue: 'approved',
    },
    { 
      label: 'ต้องแก้ไข', 
      value: loading ? '-' : stats.returned.toString(), 
      icon: AlertTriangle, 
      color: 'text-destructive',
      bgColor: 'bg-destructive/10',
      filterValue: 'returned',
    },
  ];

  // Filter assessments based on statusFilter
  const filteredAssessments = assessments.filter(assessment => {
    // Apply fiscal year filter first
    if (selectedFiscalYear !== 'all' && assessment.fiscal_year !== parseInt(selectedFiscalYear)) {
      return false;
    }
    // Then apply status filter
    if (!statusFilter) return true;
    if (statusFilter === 'approved') {
      return assessment.status === 'approved_regional' || assessment.status === 'completed';
    }
    return assessment.status === statusFilter;
  });

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
            className={`card-hover cursor-pointer transition-all ${
              statusFilter === stat.filterValue 
                ? 'ring-2 ring-primary ring-offset-2' 
                : ''
            }`}
            onClick={() => setStatusFilter(stat.filterValue)}
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

      {/* Assessments Table */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0">
          <div>
            <CardTitle>
              รายการแบบประเมิน
              {statusFilter && (
                <Badge variant="secondary" className="ml-2 font-normal">
                  {statsDisplay.find(s => s.filterValue === statusFilter)?.label}
                </Badge>
              )}
            </CardTitle>
            <CardDescription>
              {filteredAssessments.length} รายการ
            </CardDescription>
          </div>
          {canCreate && (
            <Dialog open={createDialogOpen} onOpenChange={setCreateDialogOpen}>
              <DialogTrigger asChild>
                <Button>
                  <Plus className="w-4 h-4 mr-2" />
                  สร้างแบบประเมินใหม่
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>สร้างแบบประเมินใหม่</DialogTitle>
                  <DialogDescription>
                    {profile?.role === 'health_office' 
                      ? 'สร้างแบบประเมินสำหรับหน่วยงานของคุณ'
                      : 'เลือกโรงพยาบาล และปีงบประมาณ'
                    }
                  </DialogDescription>
                </DialogHeader>
                <div className="space-y-4 py-4">
                  {profile?.role === 'health_office' && healthOffice && (
                    <div className="space-y-2">
                      <Label>หน่วยงาน</Label>
                      <div className="h-10 px-3 py-2 border rounded-md bg-muted text-muted-foreground flex items-center">
                        {healthOffice.name}
                      </div>
                    </div>
                  )}
                  {profile?.role === 'central_admin' && (
                    <div className="space-y-2">
                      <Label>โรงพยาบาล</Label>
                      <Select value={selectedHospital} onValueChange={setSelectedHospital}>
                        <SelectTrigger>
                          <SelectValue placeholder="เลือกโรงพยาบาล" />
                        </SelectTrigger>
                        <SelectContent>
                          {hospitals.map(h => (
                            <SelectItem key={h.id} value={h.id}>{h.name}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  )}
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>ปีงบประมาณ</Label>
                      <Select value={selectedYear} onValueChange={setSelectedYear}>
                        <SelectTrigger>
                          <SelectValue placeholder="เลือกปี" />
                        </SelectTrigger>
                        <SelectContent>
                          {years.map(y => (
                            <SelectItem key={y} value={y.toString()}>{y + 543}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label>ครั้งที่ประเมิน</Label>
                      <div className="h-10 px-3 py-2 border rounded-md bg-muted text-muted-foreground flex items-center">
                        ครั้งที่ {nextPeriod}/{parseInt(selectedYear) + 543}
                      </div>
                    </div>
                  </div>
                </div>
                <DialogFooter>
                  <Button variant="outline" onClick={() => setCreateDialogOpen(false)}>
                    ยกเลิก
                  </Button>
                  <Button onClick={handleCreateAssessment} disabled={creating}>
                    {creating && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                    สร้างแบบประเมิน
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          )}
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
            </div>
          ) : filteredAssessments.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <FileText className="w-12 h-12 mx-auto mb-4 opacity-50" />
              <p>{statusFilter ? 'ไม่มีรายการตามเงื่อนไขที่เลือก' : 'ยังไม่มีแบบประเมิน'}</p>
              {statusFilter && (
                <Button 
                  variant="outline" 
                  className="mt-4"
                  onClick={() => setStatusFilter(null)}
                >
                  ดูทั้งหมด
                </Button>
              )}
              {!statusFilter && canCreate && (
                <Button 
                  variant="outline" 
                  className="mt-4"
                  onClick={() => setCreateDialogOpen(true)}
                >
                  <Plus className="w-4 h-4 mr-2" />
                  สร้างแบบประเมินแรก
                </Button>
              )}
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>โรงพยาบาล</TableHead>
                  <TableHead>ครั้งที่ประเมิน</TableHead>
                  <TableHead>สถานะ</TableHead>
                  <TableHead>คะแนนรวม (10)</TableHead>
                  <TableHead>วันที่สร้าง</TableHead>
                  <TableHead className="text-right">การดำเนินการ</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredAssessments.map((assessment) => {
                  const status = statusLabels[assessment.status] || statusLabels.draft;
                  return (
                    <TableRow key={assessment.id}>
                      <TableCell className="font-medium">
                        {(assessment as any).hospitals?.name || (assessment as any).health_offices?.name || '-'}
                      </TableCell>
                      <TableCell>
                        {assessment.assessment_period}/{assessment.fiscal_year + 543}
                      </TableCell>
                      <TableCell>
                        <Badge className={status.className}>{status.label}</Badge>
                      </TableCell>
                      <TableCell>
                        {assessment.total_score !== null 
                          ? Number(assessment.total_score).toFixed(1)
                          : '-'}
                      </TableCell>
                      <TableCell>
                        {format(new Date(assessment.created_at), 'd MMM yyyy', { locale: th })}
                      </TableCell>
                      <TableCell className="text-right">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => navigate(`/assessment/${assessment.id}`)}
                        >
                          <Eye className="w-4 h-4 mr-2" />
                          {assessment.status === 'draft' ? 'แก้ไข' : 'ดู'}
                        </Button>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

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
