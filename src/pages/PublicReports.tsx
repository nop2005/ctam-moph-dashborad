import { useEffect, useState, useMemo } from 'react';
import { PublicLayout } from '@/components/layout/PublicLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { supabase } from '@/integrations/supabase/client';
import { ScoreChart, DrillLevel } from '@/components/reports/ScoreChart';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { BarChart3, FileText, Building2, Filter } from 'lucide-react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from 'sonner';
import { usePublicReportAccessPolicy } from '@/hooks/usePublicReportAccessPolicy';

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

interface HealthOffice {
  id: string;
  name: string;
  code: string;
  province_id: string | null;
  health_region_id: string;
  office_type: string;
}

interface Assessment {
  id: string;
  hospital_id: string | null;
  health_office_id: string | null;
  status: string;
  fiscal_year: number;
  assessment_period: string;
  total_score: number | null;
  quantitative_score: number | null;
  qualitative_score: number | null;
  impact_score: number | null;
  created_at: string;
}

const getCurrentFiscalYear = (): number => {
  const now = new Date();
  const month = now.getMonth();
  const year = now.getFullYear();
  return month >= 9 ? year + 1 : year;
};

const generateFiscalYears = (assessments: Assessment[]): number[] => {
  const years = new Set<number>();
  const currentFiscalYear = getCurrentFiscalYear();
  years.add(currentFiscalYear);
  assessments.forEach(a => {
    if (a.fiscal_year) years.add(a.fiscal_year);
  });
  return Array.from(years).sort((a, b) => b - a);
};

const getLatestAssessmentPerUnit = (allAssessments: Assessment[]): Assessment[] => {
  const latestMap = new Map<string, Assessment>();
  for (const assessment of allAssessments) {
    const unitId = assessment.hospital_id || assessment.health_office_id;
    if (!unitId) continue;
    const existing = latestMap.get(unitId);
    if (!existing) {
      latestMap.set(unitId, assessment);
    } else {
      if (assessment.fiscal_year > existing.fiscal_year || 
          (assessment.fiscal_year === existing.fiscal_year && assessment.assessment_period > existing.assessment_period)) {
        latestMap.set(unitId, assessment);
      }
    }
  }
  return Array.from(latestMap.values());
};

export default function PublicReports() {
  const [loading, setLoading] = useState(true);
  const [healthRegions, setHealthRegions] = useState<HealthRegion[]>([]);
  const [provinces, setProvinces] = useState<Province[]>([]);
  const [hospitals, setHospitals] = useState<Hospital[]>([]);
  const [healthOffices, setHealthOffices] = useState<HealthOffice[]>([]);
  const [assessments, setAssessments] = useState<Assessment[]>([]);
  const [selectedFiscalYear, setSelectedFiscalYear] = useState<string>(getCurrentFiscalYear().toString());
  const [chartDrillLevel, setChartDrillLevel] = useState<DrillLevel>('region');
  const [chartRegionId, setChartRegionId] = useState<string | null>(null);
  const [chartProvinceId, setChartProvinceId] = useState<string | null>(null);

  const fiscalYears = useMemo(() => generateFiscalYears(assessments), [assessments]);

  const filteredAssessments = useMemo(() => {
    if (selectedFiscalYear === 'all') return assessments;
    return assessments.filter(a => a.fiscal_year === parseInt(selectedFiscalYear));
  }, [assessments, selectedFiscalYear]);

  const { canDrillToProvince, canDrillToHospital } = usePublicReportAccessPolicy('overview');

  const handleDrillChange = (level: DrillLevel, regionId: string | null, provinceId: string | null) => {
    // Public users cannot drill to hospital level
    if (level === 'hospital') {
      toast.info('กรุณาเข้าสู่ระบบเพื่อดูรายละเอียดรายโรงพยาบาล');
      return;
    }
    setChartDrillLevel(level);
    setChartRegionId(regionId);
    setChartProvinceId(provinceId);
  };

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [regionsRes, provincesRes, hospitalsRes, healthOfficesRes, assessmentsRes] = await Promise.all([
          supabase.from('health_regions').select('*').order('region_number'),
          supabase.from('provinces').select('*').order('name'),
          supabase.from('hospitals').select('*').order('name'),
          supabase.from('health_offices').select('*').order('name'),
          supabase.from('assessments').select('id, hospital_id, health_office_id, status, fiscal_year, assessment_period, total_score, quantitative_score, qualitative_score, impact_score, created_at')
        ]);
        
        if (regionsRes.error) throw regionsRes.error;
        if (provincesRes.error) throw provincesRes.error;
        if (hospitalsRes.error) throw hospitalsRes.error;
        if (healthOfficesRes.error) throw healthOfficesRes.error;
        if (assessmentsRes.error) throw assessmentsRes.error;
        
        setHealthRegions(regionsRes.data || []);
        setProvinces(provincesRes.data || []);
        setHospitals(hospitalsRes.data || []);
        setHealthOffices(healthOfficesRes.data || []);
        setAssessments(assessmentsRes.data || []);
      } catch (error) {
        console.error('Error fetching data:', error);
        toast.error('เกิดข้อผิดพลาดในการโหลดข้อมูล');
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, []);

  const latestAssessments = useMemo(() => getLatestAssessmentPerUnit(filteredAssessments), [filteredAssessments]);

  const drillStats = (() => {
    let filteredHospitals: Hospital[] = [];
    let filteredHealthOffices: HealthOffice[] = [];
    let filteredAssessmentsLocal: Assessment[] = [];
    
    if (chartDrillLevel === 'region') {
      filteredHospitals = hospitals;
      filteredHealthOffices = healthOffices;
      filteredAssessmentsLocal = latestAssessments;
    } else if (chartDrillLevel === 'province' && chartRegionId) {
      const regionProvinces = provinces.filter(p => p.health_region_id === chartRegionId);
      filteredHospitals = hospitals.filter(h => regionProvinces.some(p => p.id === h.province_id));
      filteredHealthOffices = healthOffices.filter(ho => ho.health_region_id === chartRegionId);
      filteredAssessmentsLocal = latestAssessments.filter(a => 
        filteredHospitals.some(h => h.id === a.hospital_id) || 
        filteredHealthOffices.some(ho => ho.id === a.health_office_id)
      );
    }
    
    const totalUnits = filteredHospitals.length + filteredHealthOffices.length;
    return {
      totalHospitals: totalUnits,
      withAssessment: filteredAssessmentsLocal.length,
      completed: filteredAssessmentsLocal.filter(a => a.status === 'approved_regional' || a.status === 'completed').length,
      pending: filteredAssessmentsLocal.filter(a => a.status === 'submitted' || a.status === 'approved_provincial').length
    };
  })();

  return (
    <PublicLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold">รายงานภาพรวม</h1>
            <p className="text-muted-foreground">สรุปผลการประเมินตามจังหวัดและเขตสุขภาพ (สำหรับผู้ใช้ทั่วไป)</p>
          </div>
          <div className="flex items-center gap-2">
            <Filter className="w-4 h-4 text-muted-foreground" />
            <Select value={selectedFiscalYear} onValueChange={setSelectedFiscalYear}>
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="ปีงบประมาณ" />
              </SelectTrigger>
              <SelectContent className="bg-background z-50">
                <SelectItem value="all">ทุกปีงบประมาณ</SelectItem>
                {fiscalYears.map(year => (
                  <SelectItem key={year} value={year.toString()}>
                    ปีงบประมาณ {year + 543}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Statistics */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Card>
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-2xl font-bold">{drillStats.totalHospitals}</p>
                  <p className="text-sm text-muted-foreground">สถานบริการทั้งหมด</p>
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
                  <p className="text-2xl font-bold">{drillStats.withAssessment}</p>
                  <p className="text-sm text-muted-foreground">ส่งแบบประเมินเเล้ว</p>
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
                  <p className="text-2xl font-bold">{drillStats.completed}</p>
                  <p className="text-sm text-muted-foreground">ตรวจสอบเเล้ว</p>
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
                  <p className="text-2xl font-bold">{drillStats.pending}</p>
                  <p className="text-sm text-muted-foreground">รอตรวจสอบ</p>
                </div>
                <div className="w-12 h-12 rounded-xl bg-warning/10 flex items-center justify-center">
                  <FileText className="w-6 h-6 text-warning" />
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Score Chart - Public users can only drill to province level */}
        <ScoreChart 
          healthRegions={healthRegions} 
          provinces={provinces} 
          hospitals={hospitals} 
          healthOffices={healthOffices} 
          assessments={filteredAssessments} 
          onDrillChange={handleDrillChange} 
          selectedFiscalYear={selectedFiscalYear} 
          canDrillToProvince={canDrillToProvince} 
          canDrillToHospital={canDrillToHospital} 
        />

        {/* Table */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <BarChart3 className="w-5 h-5" />
              {chartDrillLevel === 'region' && 'รายงานสรุปรายเขตสุขภาพ'}
              {chartDrillLevel === 'province' && `รายงานสรุปรายจังหวัด - เขตสุขภาพที่ ${healthRegions.find(r => r.id === chartRegionId)?.region_number || ''}`}
            </CardTitle>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="text-center py-8 text-muted-foreground">กำลังโหลด...</div>
            ) : chartDrillLevel === 'region' ? (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>เขตสุขภาพ</TableHead>
                      <TableHead className="text-right">จำนวนสถานบริการ</TableHead>
                      <TableHead className="text-right">มีแบบประเมิน</TableHead>
                      <TableHead className="text-right">อนุมัติแล้ว</TableHead>
                      <TableHead className="text-right">คะแนนเฉลี่ย</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {healthRegions.map(region => {
                      const regionProvinces = provinces.filter(p => p.health_region_id === region.id);
                      const regionHospitals = hospitals.filter(h => regionProvinces.some(p => p.id === h.province_id));
                      const regionHealthOffices = healthOffices.filter(ho => ho.health_region_id === region.id);
                      const totalUnits = regionHospitals.length + regionHealthOffices.length;
                      const regionLatestAssessments = latestAssessments.filter(a => 
                        regionHospitals.some(h => h.id === a.hospital_id) || 
                        regionHealthOffices.some(ho => ho.id === a.health_office_id)
                      );
                      const completedCount = regionLatestAssessments.filter(a => a.status === 'approved_regional' || a.status === 'completed').length;
                      const totalScoreSum = regionLatestAssessments.filter(a => a.total_score !== null).reduce((sum, a) => sum + (a.total_score || 0), 0);
                      const scoreCount = regionLatestAssessments.filter(a => a.total_score !== null).length;
                      
                      return (
                        <TableRow 
                          key={region.id} 
                          className="cursor-pointer hover:bg-muted/50 transition-colors"
                          onClick={() => handleDrillChange('province', region.id, null)}
                        >
                          <TableCell className="font-medium text-primary underline">
                            เขตสุขภาพที่ {region.region_number}
                          </TableCell>
                          <TableCell className="text-right">{totalUnits}</TableCell>
                          <TableCell className="text-right">{regionLatestAssessments.length}</TableCell>
                          <TableCell className="text-right">{completedCount}</TableCell>
                          <TableCell className="text-right font-medium">
                            {scoreCount > 0 ? (totalScoreSum / scoreCount).toFixed(2) : '-'}
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>
            ) : chartDrillLevel === 'province' && chartRegionId ? (
              <div className="overflow-x-auto">
                <div className="mb-4">
                  <button
                    onClick={() => handleDrillChange('region', null, null)}
                    className="text-sm text-primary hover:underline"
                  >
                    ← กลับไปยังเขตสุขภาพ
                  </button>
                </div>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>จังหวัด</TableHead>
                      <TableHead className="text-right">จำนวนสถานบริการ</TableHead>
                      <TableHead className="text-right">มีแบบประเมิน</TableHead>
                      <TableHead className="text-right">อนุมัติแล้ว</TableHead>
                      <TableHead className="text-right">คะแนนเฉลี่ย</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {provinces
                      .filter(p => p.health_region_id === chartRegionId)
                      .map(province => {
                        const provinceHospitals = hospitals.filter(h => h.province_id === province.id);
                        const provinceHealthOffices = healthOffices.filter(ho => ho.province_id === province.id);
                        const totalUnits = provinceHospitals.length + provinceHealthOffices.length;
                        const provinceLatestAssessments = latestAssessments.filter(a => 
                          provinceHospitals.some(h => h.id === a.hospital_id) || 
                          provinceHealthOffices.some(ho => ho.id === a.health_office_id)
                        );
                        const completedCount = provinceLatestAssessments.filter(a => a.status === 'approved_regional' || a.status === 'completed').length;
                        const totalScoreSum = provinceLatestAssessments.filter(a => a.total_score !== null).reduce((sum, a) => sum + (a.total_score || 0), 0);
                        const scoreCount = provinceLatestAssessments.filter(a => a.total_score !== null).length;
                        
                        return (
                          <TableRow key={province.id} className="opacity-50">
                            <TableCell className="font-medium">{province.name}</TableCell>
                            <TableCell className="text-right">{totalUnits}</TableCell>
                            <TableCell className="text-right">{provinceLatestAssessments.length}</TableCell>
                            <TableCell className="text-right">{completedCount}</TableCell>
                            <TableCell className="text-right font-medium">
                              {scoreCount > 0 ? (totalScoreSum / scoreCount).toFixed(2) : '-'}
                            </TableCell>
                          </TableRow>
                        );
                      })}
                  </TableBody>
                </Table>
              </div>
            ) : null}
          </CardContent>
        </Card>
      </div>
    </PublicLayout>
  );
}
