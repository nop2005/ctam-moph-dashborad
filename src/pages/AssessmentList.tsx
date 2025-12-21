import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { Plus, FileText, Eye, Loader2 } from 'lucide-react';
import { format } from 'date-fns';
import { th } from 'date-fns/locale';
import type { Database } from '@/integrations/supabase/types';

type Assessment = Database['public']['Tables']['assessments']['Row'];
type Hospital = Database['public']['Tables']['hospitals']['Row'];

const statusLabels: Record<string, { label: string; className: string }> = {
  draft: { label: 'ร่าง', className: 'status-draft' },
  submitted: { label: 'รอตรวจสอบ', className: 'status-submitted' },
  approved_provincial: { label: 'สสจ.อนุมัติ', className: 'bg-info/10 text-info' },
  approved_regional: { label: 'เขตอนุมัติ', className: 'status-approved' },
  returned: { label: 'ตีกลับแก้ไข', className: 'status-returned' },
  completed: { label: 'เสร็จสิ้น', className: 'status-completed' },
};

export default function AssessmentList() {
  const navigate = useNavigate();
  const { profile } = useAuth();
  const { toast } = useToast();

  const [loading, setLoading] = useState(true);
  const [assessments, setAssessments] = useState<(Assessment & { hospitals?: Hospital })[]>([]);
  const [hospitals, setHospitals] = useState<Hospital[]>([]);
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [selectedHospital, setSelectedHospital] = useState<string>('');
  const [selectedYear, setSelectedYear] = useState<string>(new Date().getFullYear().toString());
  const [selectedPeriod, setSelectedPeriod] = useState<string>('Q1');
  const [creating, setCreating] = useState(false);

  const currentYear = new Date().getFullYear();
  const years = [currentYear - 1, currentYear, currentYear + 1];
  const periods = ['Q1', 'Q2', 'Q3', 'Q4'];

  useEffect(() => {
    if (profile) {
      loadData();
    }
  }, [profile]);

  const loadData = async () => {
    try {
      setLoading(true);

      // Load assessments
      const { data: assessmentsData, error: assessError } = await supabase
        .from('assessments')
        .select('*, hospitals(*)')
        .order('created_at', { ascending: false });

      if (assessError) throw assessError;
      setAssessments(assessmentsData || []);

      // Load hospitals for create dialog (hospital_it only sees own hospital)
      if (profile?.role === 'hospital_it' && profile.hospital_id) {
        const { data: hospitalData } = await supabase
          .from('hospitals')
          .select('*')
          .eq('id', profile.hospital_id);
        setHospitals(hospitalData || []);
        if (hospitalData?.[0]) {
          setSelectedHospital(hospitalData[0].id);
        }
      } else if (profile?.role === 'central_admin') {
        const { data: hospitalsData } = await supabase
          .from('hospitals')
          .select('*')
          .order('name');
        setHospitals(hospitalsData || []);
      }

    } catch (error: any) {
      console.error('Error loading data:', error);
      toast({ title: 'เกิดข้อผิดพลาด', description: error.message, variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  const handleCreateAssessment = async () => {
    if (!selectedHospital || !selectedYear || !selectedPeriod) {
      toast({ title: 'กรุณากรอกข้อมูลให้ครบ', variant: 'destructive' });
      return;
    }

    try {
      setCreating(true);

      // Check for duplicate assessment
      const { data: existing } = await supabase
        .from('assessments')
        .select('id')
        .eq('hospital_id', selectedHospital)
        .eq('fiscal_year', parseInt(selectedYear))
        .eq('assessment_period', selectedPeriod)
        .maybeSingle();

      if (existing) {
        toast({ 
          title: 'มีแบบประเมินซ้ำ', 
          description: `แบบประเมินปี ${selectedYear} ${selectedPeriod} มีอยู่แล้ว`,
          variant: 'destructive' 
        });
        return;
      }

      // Create assessment
      const { data: newAssessment, error: createError } = await supabase
        .from('assessments')
        .insert({
          hospital_id: selectedHospital,
          fiscal_year: parseInt(selectedYear),
          assessment_period: selectedPeriod,
          created_by: profile?.user_id,
          status: 'draft',
        })
        .select()
        .single();

      if (createError) throw createError;

      // Create assessment items for each category
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

  const canCreate = profile?.role === 'hospital_it' || profile?.role === 'central_admin';

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold">แบบประเมิน CTAM+</h1>
            <p className="text-muted-foreground">ประเมินความปลอดภัยไซเบอร์ 17 หมวด</p>
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
                    เลือกโรงพยาบาล ปีงบประมาณ และรอบการประเมิน
                  </DialogDescription>
                </DialogHeader>
                <div className="space-y-4 py-4">
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
                      <Label>รอบการประเมิน</Label>
                      <Select value={selectedPeriod} onValueChange={setSelectedPeriod}>
                        <SelectTrigger>
                          <SelectValue placeholder="เลือกรอบ" />
                        </SelectTrigger>
                        <SelectContent>
                          {periods.map(p => (
                            <SelectItem key={p} value={p}>{p}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
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
        </div>

        {/* Assessments Table */}
        <Card>
          <CardHeader>
            <CardTitle>รายการแบบประเมิน</CardTitle>
            <CardDescription>
              {assessments.length} รายการ
            </CardDescription>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
              </div>
            ) : assessments.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <FileText className="w-12 h-12 mx-auto mb-4 opacity-50" />
                <p>ยังไม่มีแบบประเมิน</p>
                {canCreate && (
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
                    <TableHead>ปี/รอบ</TableHead>
                    <TableHead>สถานะ</TableHead>
                    <TableHead>คะแนนรวม</TableHead>
                    <TableHead>วันที่สร้าง</TableHead>
                    <TableHead className="text-right">การดำเนินการ</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {assessments.map((assessment) => {
                    const status = statusLabels[assessment.status] || statusLabels.draft;
                    return (
                      <TableRow key={assessment.id}>
                        <TableCell className="font-medium">
                          {(assessment as any).hospitals?.name || '-'}
                        </TableCell>
                        <TableCell>
                          {assessment.fiscal_year + 543} / {assessment.assessment_period}
                        </TableCell>
                        <TableCell>
                          <Badge className={status.className}>{status.label}</Badge>
                        </TableCell>
                        <TableCell>
                          {assessment.total_score !== null 
                            ? `${Number(assessment.total_score).toFixed(1)}%`
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
      </div>
    </DashboardLayout>
  );
}