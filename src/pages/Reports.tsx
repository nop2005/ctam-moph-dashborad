import { useEffect, useState } from 'react';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { SearchableSelect } from '@/components/ui/searchable-select';
import { 
  Table, 
  TableBody, 
  TableCell, 
  TableHead, 
  TableHeader, 
  TableRow 
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { BarChart3, FileText, Building2, MapPin } from 'lucide-react';
import { toast } from 'sonner';

interface HealthRegion {
  id: string;
  name: string;
  region_number: number;
}

interface Province {
  id: string;
  name: string;
  health_region_id: string;
}

interface Hospital {
  id: string;
  name: string;
  code: string;
  province_id: string;
}

interface Assessment {
  id: string;
  hospital_id: string;
  status: string;
  fiscal_year: number;
  assessment_period: string;
  total_score: number | null;
  quantitative_score: number | null;
  qualitative_score: number | null;
  impact_score: number | null;
}

interface HospitalReport {
  hospital: Hospital;
  province: Province;
  assessment: Assessment | null;
}

const statusLabels: Record<string, { label: string; variant: 'default' | 'secondary' | 'destructive' | 'outline' }> = {
  'draft': { label: 'ร่าง', variant: 'secondary' },
  'submitted': { label: 'รอ สสจ. ตรวจสอบ', variant: 'outline' },
  'returned': { label: 'ต้องแก้ไข', variant: 'destructive' },
  'approved_provincial': { label: 'รอเขตสุขภาพตรวจสอบ', variant: 'outline' },
  'approved_regional': { label: 'ผ่านการประเมิน', variant: 'default' },
  'completed': { label: 'เสร็จสิ้น', variant: 'default' },
};

export default function Reports() {
  const { profile } = useAuth();
  const [loading, setLoading] = useState(true);
  const [healthRegions, setHealthRegions] = useState<HealthRegion[]>([]);
  const [provinces, setProvinces] = useState<Province[]>([]);
  const [hospitals, setHospitals] = useState<Hospital[]>([]);
  const [assessments, setAssessments] = useState<Assessment[]>([]);
  
  const [selectedRegion, setSelectedRegion] = useState<string>('all');
  const [selectedProvince, setSelectedProvince] = useState<string>('all');
  const [reports, setReports] = useState<HospitalReport[]>([]);

  // Fetch initial data
  useEffect(() => {
    const fetchData = async () => {
      try {
        const [regionsRes, provincesRes, hospitalsRes, assessmentsRes] = await Promise.all([
          supabase.from('health_regions').select('*').order('region_number'),
          supabase.from('provinces').select('*').order('name'),
          supabase.from('hospitals').select('*').order('name'),
          supabase.from('assessments').select('*'),
        ]);

        if (regionsRes.error) throw regionsRes.error;
        if (provincesRes.error) throw provincesRes.error;
        if (hospitalsRes.error) throw hospitalsRes.error;
        if (assessmentsRes.error) throw assessmentsRes.error;

        setHealthRegions(regionsRes.data || []);
        setProvinces(provincesRes.data || []);
        setHospitals(hospitalsRes.data || []);
        setAssessments(assessmentsRes.data || []);

        // Set default filter based on user role
        if (profile?.role === 'regional' && profile.health_region_id) {
          setSelectedRegion(profile.health_region_id);
        } else if (profile?.role === 'provincial' && profile.province_id) {
          const province = provincesRes.data?.find(p => p.id === profile.province_id);
          if (province) {
            setSelectedRegion(province.health_region_id);
            setSelectedProvince(province.id);
          }
        }
      } catch (error) {
        console.error('Error fetching data:', error);
        toast.error('เกิดข้อผิดพลาดในการโหลดข้อมูล');
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [profile]);

  // Filter and generate reports
  useEffect(() => {
    let filteredHospitals = [...hospitals];
    let filteredProvinces = [...provinces];

    // Filter by region
    if (selectedRegion !== 'all') {
      filteredProvinces = provinces.filter(p => p.health_region_id === selectedRegion);
      filteredHospitals = hospitals.filter(h => 
        filteredProvinces.some(p => p.id === h.province_id)
      );
    }

    // Filter by province
    if (selectedProvince !== 'all') {
      filteredHospitals = filteredHospitals.filter(h => h.province_id === selectedProvince);
    }

    // Generate reports
    const hospitalReports: HospitalReport[] = filteredHospitals.map(hospital => {
      const province = provinces.find(p => p.id === hospital.province_id);
      const assessment = assessments.find(a => a.hospital_id === hospital.id);
      
      return {
        hospital,
        province: province!,
        assessment: assessment || null,
      };
    });

    setReports(hospitalReports);
  }, [hospitals, provinces, assessments, selectedRegion, selectedProvince]);

  // Get filtered provinces for dropdown
  const filteredProvinces = selectedRegion === 'all' 
    ? provinces 
    : provinces.filter(p => p.health_region_id === selectedRegion);

  // Calculate statistics
  const stats = {
    totalHospitals: reports.length,
    withAssessment: reports.filter(r => r.assessment).length,
    completed: reports.filter(r => r.assessment?.status === 'approved_regional' || r.assessment?.status === 'completed').length,
    pending: reports.filter(r => r.assessment?.status === 'submitted' || r.assessment?.status === 'approved_provincial').length,
  };

  const regionOptions = [
    { value: 'all', label: 'ทุกเขตสุขภาพ' },
    ...healthRegions.map(r => ({ value: r.id, label: `เขตสุขภาพที่ ${r.region_number}` }))
  ];

  const provinceOptions = [
    { value: 'all', label: 'ทุกจังหวัด' },
    ...filteredProvinces.map(p => ({ value: p.id, label: p.name }))
  ];

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold">รายงานและสถิติ</h1>
            <p className="text-muted-foreground">สรุปผลการประเมินตามจังหวัดและเขตสุขภาพ</p>
          </div>
        </div>

        {/* Filters */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <MapPin className="w-5 h-5" />
              ตัวกรอง
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="text-sm font-medium mb-2 block">เขตสุขภาพ</label>
                <SearchableSelect
                  options={regionOptions}
                  value={selectedRegion}
                  onValueChange={(value) => {
                    setSelectedRegion(value);
                    setSelectedProvince('all');
                  }}
                  placeholder="เลือกเขตสุขภาพ"
                />
              </div>
              <div>
                <label className="text-sm font-medium mb-2 block">จังหวัด</label>
                <SearchableSelect
                  options={provinceOptions}
                  value={selectedProvince}
                  onValueChange={setSelectedProvince}
                  placeholder="เลือกจังหวัด"
                />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Statistics */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Card>
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-2xl font-bold">{stats.totalHospitals}</p>
                  <p className="text-sm text-muted-foreground">โรงพยาบาลทั้งหมด</p>
                </div>
                <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center">
                  <Building2 className="w-6 h-6 text-primary" />
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-2xl font-bold">{stats.withAssessment}</p>
                  <p className="text-sm text-muted-foreground">มีแบบประเมิน</p>
                </div>
                <div className="w-12 h-12 rounded-xl bg-accent/10 flex items-center justify-center">
                  <FileText className="w-6 h-6 text-accent" />
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-2xl font-bold">{stats.completed}</p>
                  <p className="text-sm text-muted-foreground">ผ่านการประเมิน</p>
                </div>
                <div className="w-12 h-12 rounded-xl bg-success/10 flex items-center justify-center">
                  <BarChart3 className="w-6 h-6 text-success" />
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-2xl font-bold">{stats.pending}</p>
                  <p className="text-sm text-muted-foreground">รอตรวจสอบ</p>
                </div>
                <div className="w-12 h-12 rounded-xl bg-warning/10 flex items-center justify-center">
                  <FileText className="w-6 h-6 text-warning" />
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Reports Table */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <BarChart3 className="w-5 h-5" />
              รายงานผลการประเมินรายโรงพยาบาล
            </CardTitle>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="text-center py-8 text-muted-foreground">กำลังโหลด...</div>
            ) : reports.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">ไม่พบข้อมูล</div>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>รหัส</TableHead>
                      <TableHead>โรงพยาบาล</TableHead>
                      <TableHead>จังหวัด</TableHead>
                      <TableHead>สถานะ</TableHead>
                      <TableHead className="text-right">คะแนนรวม</TableHead>
                      <TableHead className="text-right">Quantitative</TableHead>
                      <TableHead className="text-right">Qualitative</TableHead>
                      <TableHead className="text-right">Impact</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {reports.map((report) => (
                      <TableRow key={report.hospital.id}>
                        <TableCell className="font-mono text-sm">
                          {report.hospital.code}
                        </TableCell>
                        <TableCell className="font-medium">
                          {report.hospital.name}
                        </TableCell>
                        <TableCell>{report.province?.name || '-'}</TableCell>
                        <TableCell>
                          {report.assessment ? (
                            <Badge variant={statusLabels[report.assessment.status]?.variant || 'secondary'}>
                              {statusLabels[report.assessment.status]?.label || report.assessment.status}
                            </Badge>
                          ) : (
                            <Badge variant="outline">ยังไม่มีข้อมูล</Badge>
                          )}
                        </TableCell>
                        <TableCell className="text-right font-medium">
                          {report.assessment?.total_score?.toFixed(2) || '-'}
                        </TableCell>
                        <TableCell className="text-right">
                          {report.assessment?.quantitative_score?.toFixed(2) || '-'}
                        </TableCell>
                        <TableCell className="text-right">
                          {report.assessment?.qualitative_score?.toFixed(2) || '-'}
                        </TableCell>
                        <TableCell className="text-right">
                          {report.assessment?.impact_score?.toFixed(2) || '-'}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}
