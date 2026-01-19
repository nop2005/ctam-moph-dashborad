import { useEffect, useState, useMemo } from 'react';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { ScoreChart, DrillLevel } from '@/components/reports/ScoreChart';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { BarChart3, FileText, Building2, Filter } from 'lucide-react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from 'sonner';
import { useReportAccessPolicy } from '@/hooks/useReportAccessPolicy';
import { getLatestAssessmentsByUnit, isApprovedAssessmentStatus } from '@/lib/assessment-latest';

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
  health_region_id?: string;
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
  qualitative_score?: number | null;
  impact_score: number | null;
  created_at: string;
  health_region_id?: string | null;
  province_id?: string | null;
}

interface InternalReportSummary {
  health_regions: HealthRegion[];
  provinces: Province[];
  hospitals: Hospital[];
  health_offices: HealthOffice[];
  region_stats: {
    id: string;
    name: string;
    region_number: number;
    total_units: number;
    with_assessment: number;
    completed: number;
    pending: number;
  }[];
  province_stats: {
    id: string;
    name: string;
    health_region_id: string;
    total_units: number;
    with_assessment: number;
    completed: number;
    pending: number;
  }[];
  assessments: Assessment[];
  fiscal_years: number[];
}

// Helper function to get current fiscal year (Oct 1 - Sep 30)
const getCurrentFiscalYear = (): number => {
  const now = new Date();
  const month = now.getMonth(); // 0-11
  const year = now.getFullYear();
  return month >= 9 ? year + 1 : year;
};

const statusLabels: Record<string, {
  label: string;
  variant: 'default' | 'secondary' | 'destructive' | 'outline';
}> = {
  'draft': { label: 'ร่าง', variant: 'secondary' },
  'submitted': { label: 'รอ สสจ. ตรวจสอบ', variant: 'outline' },
  'returned': { label: 'ต้องแก้ไข', variant: 'destructive' },
  'approved_provincial': { label: 'รอเขตสุขภาพตรวจสอบ', variant: 'outline' },
  'approved_regional': { label: 'ผ่านการประเมิน', variant: 'default' },
  'completed': { label: 'เสร็จสิ้น', variant: 'default' }
};

export default function Reports() {
  const { profile } = useAuth();
  const [loading, setLoading] = useState(true);
  const [healthRegions, setHealthRegions] = useState<HealthRegion[]>([]);
  const [provinces, setProvinces] = useState<Province[]>([]);
  const [hospitals, setHospitals] = useState<Hospital[]>([]);
  const [healthOffices, setHealthOffices] = useState<HealthOffice[]>([]);
  const [assessments, setAssessments] = useState<Assessment[]>([]);
  const [fiscalYears, setFiscalYears] = useState<number[]>([]);

  // Fiscal year filter
  const [selectedFiscalYear, setSelectedFiscalYear] = useState<string>(getCurrentFiscalYear().toString());

  // Chart drill state for syncing table
  const [chartDrillLevel, setChartDrillLevel] = useState<DrillLevel>('region');
  const [chartRegionId, setChartRegionId] = useState<string | null>(null);
  const [chartProvinceId, setChartProvinceId] = useState<string | null>(null);

  // Filter assessments by fiscal year
  const filteredAssessments = useMemo(() => {
    if (selectedFiscalYear === 'all') return assessments;
    return assessments.filter(a => a.fiscal_year === parseInt(selectedFiscalYear));
  }, [assessments, selectedFiscalYear]);

  // Report access policy
  const {
    canDrillToProvince,
    canDrillToHospital,
    canViewSameProvinceHospitals,
  } = useReportAccessPolicy('overview', provinces, healthOffices);

  const handleDrillChange = (level: DrillLevel, regionId: string | null, provinceId: string | null) => {
    if (level === 'province' && regionId && !canDrillToProvince(regionId)) {
      return;
    }
    if (level === 'hospital' && provinceId && !canDrillToHospital(provinceId)) {
      return;
    }
    setChartDrillLevel(level);
    setChartRegionId(regionId);
    setChartProvinceId(provinceId);
  };

  // Fetch data using RPC function (single query instead of 5 separate queries)
  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);
        
        // Use RPC function for optimized single-query fetch
        const fiscalYearParam = selectedFiscalYear === 'all' ? null : parseInt(selectedFiscalYear);
        
        const { data, error } = await supabase.rpc('get_internal_report_summary', {
          p_fiscal_year: fiscalYearParam
        });

        if (error) {
          console.error('RPC error:', error);
          throw error;
        }

        const summary = data as unknown as InternalReportSummary;
        
        setHealthRegions(summary.health_regions || []);
        setProvinces(summary.provinces || []);
        setHospitals(summary.hospitals || []);
        setHealthOffices(summary.health_offices || []);
        setAssessments(summary.assessments || []);
        setFiscalYears(summary.fiscal_years || [getCurrentFiscalYear()]);
        
      } catch (error) {
        console.error('Error fetching data:', error);
        toast.error('เกิดข้อผิดพลาดในการโหลดข้อมูล');
      } finally {
        setLoading(false);
      }
    };
    
    fetchData();
  }, [selectedFiscalYear]);

  // Get latest assessments only (one per hospital/health_office) from filtered assessments
  const latestByUnit = useMemo(() => getLatestAssessmentsByUnit(filteredAssessments), [filteredAssessments]);
  const latestAssessments = useMemo(() => Array.from(latestByUnit.values()), [latestByUnit]);

  // Latest assessments per unit, but only counting the most recent *approved* one
  const approvedAssessments = useMemo(
    () => filteredAssessments.filter(a => isApprovedAssessmentStatus(a.status)),
    [filteredAssessments]
  );
  const latestApprovedByUnit = useMemo(
    () => getLatestAssessmentsByUnit(approvedAssessments),
    [approvedAssessments]
  );
  const latestApprovedAssessments = useMemo(
    () => Array.from(latestApprovedByUnit.values()),
    [latestApprovedByUnit]
  );

  // Calculate statistics based on drill level (including health offices)
  // Use latestApprovedAssessments for "completed" count to be consistent with Dashboard
  const drillStats = useMemo(() => {
    let filteredHospitals: Hospital[] = [];
    let filteredHealthOffices: HealthOffice[] = [];
    let drillFilteredAssessments: Assessment[] = [];
    let drillFilteredApprovedAssessments: Assessment[] = [];
    
    if (chartDrillLevel === 'region') {
      filteredHospitals = hospitals;
      filteredHealthOffices = healthOffices;
      drillFilteredAssessments = latestAssessments;
      drillFilteredApprovedAssessments = latestApprovedAssessments;
    } else if (chartDrillLevel === 'province' && chartRegionId) {
      const regionProvinces = provinces.filter(p => p.health_region_id === chartRegionId);
      filteredHospitals = hospitals.filter(h => regionProvinces.some(p => p.id === h.province_id));
      filteredHealthOffices = healthOffices.filter(ho => ho.health_region_id === chartRegionId);
      drillFilteredAssessments = latestAssessments.filter(a => 
        filteredHospitals.some(h => h.id === a.hospital_id) || 
        filteredHealthOffices.some(ho => ho.id === a.health_office_id)
      );
      drillFilteredApprovedAssessments = latestApprovedAssessments.filter(a => 
        filteredHospitals.some(h => h.id === a.hospital_id) || 
        filteredHealthOffices.some(ho => ho.id === a.health_office_id)
      );
    } else if (chartDrillLevel === 'hospital' && chartProvinceId) {
      filteredHospitals = hospitals.filter(h => h.province_id === chartProvinceId);
      filteredHealthOffices = healthOffices.filter(ho => ho.province_id === chartProvinceId);
      drillFilteredAssessments = latestAssessments.filter(a => 
        filteredHospitals.some(h => h.id === a.hospital_id) || 
        filteredHealthOffices.some(ho => ho.id === a.health_office_id)
      );
      drillFilteredApprovedAssessments = latestApprovedAssessments.filter(a => 
        filteredHospitals.some(h => h.id === a.hospital_id) || 
        filteredHealthOffices.some(ho => ho.id === a.health_office_id)
      );
    }
    
    const totalUnits = filteredHospitals.length + filteredHealthOffices.length;
    // Use approved assessments count for "completed" to match Dashboard
    return {
      totalHospitals: totalUnits,
      withAssessment: drillFilteredAssessments.length,
      completed: drillFilteredApprovedAssessments.length,
      pending: drillFilteredAssessments.filter(a => a.status === 'submitted' || a.status === 'approved_provincial').length
    };
  }, [chartDrillLevel, chartRegionId, chartProvinceId, hospitals, healthOffices, provinces, latestAssessments, latestApprovedAssessments]);

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold">รายงานและสถิติ</h1>
            <p className="text-muted-foreground">สรุปผลการประเมินตามจังหวัดและเขตสุขภาพ</p>
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

        {/* Statistics - based on drill level */}
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

        {/* Score Chart */}
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

        {/* Dynamic Reports Table based on drill level */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <BarChart3 className="w-5 h-5" />
              {chartDrillLevel === 'region' && 'รายงานสรุปรายเขตสุขภาพ'}
              {chartDrillLevel === 'province' && `รายงานสรุปรายจังหวัด - เขตสุขภาพที่ ${healthRegions.find(r => r.id === chartRegionId)?.region_number || ''}`}
              {chartDrillLevel === 'hospital' && `คะแนนรายสถานบริการ - ${provinces.find(p => p.id === chartProvinceId)?.name || ''}`}
            </CardTitle>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="text-center py-8 text-muted-foreground">กำลังโหลด...</div>
            ) : chartDrillLevel === 'region' ? (
              // Region level table
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>เขตสุขภาพ</TableHead>
                      <TableHead className="text-right">จำนวนสถานบริการ</TableHead>
                      <TableHead className="text-right">ประเมินแล้ว</TableHead>
                      <TableHead className="text-right">คะแนนเชิงปริมาณ</TableHead>
                      <TableHead className="text-right">คะแนนเชิงผลกระทบ</TableHead>
                      <TableHead className="text-right">คะแนนรวม</TableHead>
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
                      const regionLatestApprovedAssessments = latestApprovedAssessments.filter(a => 
                        regionHospitals.some(h => h.id === a.hospital_id) || 
                        regionHealthOffices.some(ho => ho.id === a.health_office_id)
                      );

                      const completedCount = regionLatestAssessments.filter(a => 
                        a.status === 'approved_regional' || a.status === 'completed'
                      ).length;

                      const quantitativeScores = regionLatestApprovedAssessments.filter(a => a.quantitative_score !== null);
                      const avgQuantitative = quantitativeScores.length > 0 
                        ? quantitativeScores.reduce((sum, a) => sum + (a.quantitative_score || 0), 0) / quantitativeScores.length 
                        : null;
                      const impactScores = regionLatestApprovedAssessments.filter(a => a.impact_score !== null);
                      const avgImpact = impactScores.length > 0 
                        ? impactScores.reduce((sum, a) => sum + (a.impact_score || 0), 0) / impactScores.length 
                        : null;

                      const totalScoreSum = regionLatestApprovedAssessments.filter(a => a.total_score !== null)
                        .reduce((sum, a) => sum + (a.total_score || 0), 0);
                      const scoreCount = regionLatestApprovedAssessments.filter(a => a.total_score !== null).length;
                      const canDrill = canDrillToProvince(region.id);
                      
                      return (
                        <TableRow 
                          key={region.id} 
                          className={canDrill ? "cursor-pointer hover:bg-muted/50 transition-colors" : "opacity-50"} 
                          onClick={() => canDrill && handleDrillChange('province', region.id, null)}
                        >
                          <TableCell className={canDrill ? "font-medium text-primary underline" : "font-medium"}>
                            เขตสุขภาพที่ {region.region_number}
                          </TableCell>
                          <TableCell className="text-right">{totalUnits}</TableCell>
                          <TableCell className="text-right">{completedCount}</TableCell>
                          <TableCell className="text-right">
                            {avgQuantitative !== null ? avgQuantitative.toFixed(2) : '-'}
                          </TableCell>
                          <TableCell className="text-right">
                            {avgImpact !== null ? avgImpact.toFixed(2) : '-'}
                          </TableCell>
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
              // Province level table
              <div className="overflow-x-auto">
                <div className="mb-4">
                  <Button variant="outline" size="sm" onClick={() => handleDrillChange('region', null, null)}>
                    ← กลับไปดูเขตสุขภาพทั้งหมด
                  </Button>
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
                    {provinces.filter(p => p.health_region_id === chartRegionId).map(province => {
                      const provinceHospitals = hospitals.filter(h => h.province_id === province.id);
                      const provinceHealthOffices = healthOffices.filter(ho => ho.province_id === province.id);
                      const totalUnits = provinceHospitals.length + provinceHealthOffices.length;
                      
                      const provinceLatestAssessments = latestAssessments.filter(a => 
                        provinceHospitals.some(h => h.id === a.hospital_id) || 
                        provinceHealthOffices.some(ho => ho.id === a.health_office_id)
                      );
                      const provinceLatestApprovedAssessments = latestApprovedAssessments.filter(a => 
                        provinceHospitals.some(h => h.id === a.hospital_id) || 
                        provinceHealthOffices.some(ho => ho.id === a.health_office_id)
                      );

                      const completedCount = provinceLatestAssessments.filter(a => 
                        a.status === 'approved_regional' || a.status === 'completed'
                      ).length;

                      const totalScoreSum = provinceLatestApprovedAssessments.filter(a => a.total_score !== null)
                        .reduce((sum, a) => sum + (a.total_score || 0), 0);
                      const scoreCount = provinceLatestApprovedAssessments.filter(a => a.total_score !== null).length;
                      const canDrill = canDrillToHospital(province.id);
                      
                      return (
                        <TableRow 
                          key={province.id} 
                          className={canDrill ? "cursor-pointer hover:bg-muted/50 transition-colors" : "opacity-50"} 
                          onClick={() => canDrill && handleDrillChange('hospital', chartRegionId, province.id)}
                        >
                          <TableCell className={canDrill ? "font-medium text-primary underline" : "font-medium"}>
                            {province.name}
                          </TableCell>
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
            ) : chartDrillLevel === 'hospital' && chartProvinceId ? (
              // Hospital level table
              <div className="overflow-x-auto">
                <div className="mb-4 flex gap-2">
                  <Button variant="outline" size="sm" onClick={() => handleDrillChange('region', null, null)}>
                    ← เขตสุขภาพทั้งหมด
                  </Button>
                  <Button variant="outline" size="sm" onClick={() => handleDrillChange('province', chartRegionId, null)}>
                    ← กลับไปดูจังหวัด
                  </Button>
                </div>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>รหัส</TableHead>
                      <TableHead>สถานบริการ</TableHead>
                      <TableHead>ประเภท</TableHead>
                      <TableHead>ครั้งที่ประเมิน</TableHead>
                      <TableHead>สถานะ</TableHead>
                      <TableHead className="text-right">เชิงปริมาณ</TableHead>
                      <TableHead className="text-right">ผลกระทบ</TableHead>
                      <TableHead className="text-right">คะแนนรวม</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {/* Render hospitals */}
                    {hospitals.filter(h => {
                      if (h.province_id !== chartProvinceId) return false;
                      if (profile?.role === 'hospital_it' && !canViewSameProvinceHospitals()) {
                        return h.id === profile.hospital_id;
                      }
                      return true;
                    }).map(hospital => {
                      // Prioritize showing approved assessment if exists, otherwise show latest for status info
                      const approvedAssessment = latestApprovedByUnit.get(hospital.id);
                      const latestAssessment = latestByUnit.get(hospital.id);
                      // For scores, always use approved assessment
                      const scoreAssessment = approvedAssessment;
                      // For status display, show approved if exists, otherwise show latest
                      const displayAssessment = approvedAssessment || latestAssessment;
                      
                      return (
                        <TableRow key={hospital.id}>
                          <TableCell className="font-mono text-sm">{hospital.code}</TableCell>
                          <TableCell className="font-medium">{hospital.name}</TableCell>
                          <TableCell>
                            <Badge variant="secondary">โรงพยาบาล</Badge>
                          </TableCell>
                          <TableCell>
                            {displayAssessment ? (
                              <span className="text-sm">
                                {displayAssessment.assessment_period}/{displayAssessment.fiscal_year + 543}
                              </span>
                            ) : '-'}
                          </TableCell>
                          <TableCell>
                            {displayAssessment ? (
                              <Badge variant={statusLabels[displayAssessment.status]?.variant || 'secondary'}>
                                {statusLabels[displayAssessment.status]?.label || displayAssessment.status}
                              </Badge>
                            ) : (
                              <Badge variant="outline">ยังไม่มีข้อมูล</Badge>
                            )}
                          </TableCell>
                          <TableCell className="text-right">
                            {scoreAssessment?.quantitative_score?.toFixed(2) || '-'}
                          </TableCell>
                          <TableCell className="text-right">
                            {scoreAssessment?.impact_score?.toFixed(2) || '-'}
                          </TableCell>
                          <TableCell className="text-right font-medium">
                            {scoreAssessment?.total_score?.toFixed(2) || '-'}
                          </TableCell>
                        </TableRow>
                      );
                    })}
                    {/* Render health offices */}
                    {healthOffices.filter(ho => {
                      if (ho.province_id !== chartProvinceId) return false;
                      if (profile?.role === 'health_office' && !canViewSameProvinceHospitals()) {
                        return ho.id === profile.health_office_id;
                      }
                      return true;
                    }).map(office => {
                      // Prioritize showing approved assessment if exists, otherwise show latest for status info
                      const approvedAssessment = latestApprovedByUnit.get(office.id);
                      const latestAssessment = latestByUnit.get(office.id);
                      // For scores, always use approved assessment
                      const scoreAssessment = approvedAssessment;
                      // For status display, show approved if exists, otherwise show latest
                      const displayAssessment = approvedAssessment || latestAssessment;
                      
                      return (
                        <TableRow key={office.id}>
                          <TableCell className="font-mono text-sm">{office.code}</TableCell>
                          <TableCell className="font-medium">{office.name}</TableCell>
                          <TableCell>
                            <Badge variant="outline">{office.office_type}</Badge>
                          </TableCell>
                          <TableCell>
                            {displayAssessment ? (
                              <span className="text-sm">
                                {displayAssessment.assessment_period}/{displayAssessment.fiscal_year + 543}
                              </span>
                            ) : '-'}
                          </TableCell>
                          <TableCell>
                            {displayAssessment ? (
                              <Badge variant={statusLabels[displayAssessment.status]?.variant || 'secondary'}>
                                {statusLabels[displayAssessment.status]?.label || displayAssessment.status}
                              </Badge>
                            ) : (
                              <Badge variant="outline">ยังไม่มีข้อมูล</Badge>
                            )}
                          </TableCell>
                          <TableCell className="text-right">
                            {scoreAssessment?.quantitative_score?.toFixed(2) || '-'}
                          </TableCell>
                          <TableCell className="text-right">
                            {scoreAssessment?.impact_score?.toFixed(2) || '-'}
                          </TableCell>
                          <TableCell className="text-right font-medium">
                            {scoreAssessment?.total_score?.toFixed(2) || '-'}
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>
            ) : (
              <div className="text-center py-8 text-muted-foreground">ไม่พบข้อมูล</div>
            )}
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}
