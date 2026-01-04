import { useEffect, useState, useMemo } from 'react';
import { PublicLayout } from '@/components/layout/PublicLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { supabase } from '@/integrations/supabase/client';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Progress } from '@/components/ui/progress';
import { TrendingUp, Filter, Building2, MapPin } from 'lucide-react';
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
  quantitative_score: number | null;
  total_score: number | null;
  impact_score: number | null;
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

// Helper function to get the latest assessment for each hospital or health office
const getLatestAssessmentPerUnit = (allAssessments: Assessment[]): Assessment[] => {
  const latestMap = new Map<string, Assessment>();
  for (const assessment of allAssessments) {
    const unitId = assessment.hospital_id || assessment.health_office_id;
    if (!unitId) continue;
    const existing = latestMap.get(unitId);
    if (!existing) {
      latestMap.set(unitId, assessment);
    } else {
      if (
        assessment.fiscal_year > existing.fiscal_year ||
        (assessment.fiscal_year === existing.fiscal_year && assessment.assessment_period > existing.assessment_period)
      ) {
        latestMap.set(unitId, assessment);
      }
    }
  }
  return Array.from(latestMap.values());
};

export default function PublicReportsQuantitative() {
  const [loading, setLoading] = useState(true);
  const [healthRegions, setHealthRegions] = useState<HealthRegion[]>([]);
  const [provinces, setProvinces] = useState<Province[]>([]);
  const [hospitals, setHospitals] = useState<Hospital[]>([]);
  const [healthOffices, setHealthOffices] = useState<HealthOffice[]>([]);
  const [assessments, setAssessments] = useState<Assessment[]>([]);
  const [selectedRegion, setSelectedRegion] = useState<string>('all');
  const [selectedFiscalYear, setSelectedFiscalYear] = useState<string>(getCurrentFiscalYear().toString());

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [regionsRes, provincesRes, hospitalsRes, healthOfficesRes, assessmentsRes] = await Promise.all([
          supabase.from('health_regions').select('*').order('region_number'),
          supabase.from('provinces').select('*').order('name'),
          supabase.from('hospitals').select('*').order('name'),
          supabase.from('health_offices').select('*').order('name'),
          supabase.from('assessments').select('id, hospital_id, health_office_id, status, fiscal_year, assessment_period, quantitative_score, total_score, impact_score')
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

  const fiscalYears = useMemo(() => generateFiscalYears(assessments), [assessments]);

  // Filter assessments by fiscal year
  const filteredAssessments = useMemo(() => {
    if (selectedFiscalYear === 'all') return assessments;
    return assessments.filter(a => a.fiscal_year === parseInt(selectedFiscalYear));
  }, [assessments, selectedFiscalYear]);

  // Get latest assessments only (one per hospital/health_office)
  const latestAssessments = useMemo(() => getLatestAssessmentPerUnit(filteredAssessments), [filteredAssessments]);

  // Region level table data
  const regionTableData = useMemo(() => {
    return healthRegions.map(region => {
      const regionProvinces = provinces.filter(p => p.health_region_id === region.id);
      const regionHospitals = hospitals.filter(h => regionProvinces.some(p => p.id === h.province_id));
      const regionHealthOffices = healthOffices.filter(ho => ho.health_region_id === region.id);
      const totalUnits = regionHospitals.length + regionHealthOffices.length;

      // Get latest assessments for this region
      const regionLatestAssessments = latestAssessments.filter(a =>
        regionHospitals.some(h => h.id === a.hospital_id) ||
        regionHealthOffices.some(ho => ho.id === a.health_office_id)
      );

      // Count completed (passed) assessments - same logic as Reports.tsx
      const completedCount = regionLatestAssessments.filter(
        a => a.status === 'approved_regional' || a.status === 'completed'
      ).length;

      return {
        id: region.id,
        name: `เขตสุขภาพที่ ${region.region_number}`,
        totalUnits,
        completedCount,
        percentage: totalUnits > 0 ? (completedCount / totalUnits) * 100 : 0
      };
    });
  }, [healthRegions, provinces, hospitals, healthOffices, latestAssessments]);

  // Province level table data
  const provinceTableData = useMemo(() => {
    if (selectedRegion === 'all') return [];

    const regionProvinces = provinces.filter(p => p.health_region_id === selectedRegion);
    return regionProvinces.map(province => {
      const provinceHospitals = hospitals.filter(h => h.province_id === province.id);
      const provinceHealthOffices = healthOffices.filter(ho => ho.province_id === province.id);
      const totalUnits = provinceHospitals.length + provinceHealthOffices.length;

      // Get latest assessments for this province
      const provinceLatestAssessments = latestAssessments.filter(a =>
        provinceHospitals.some(h => h.id === a.hospital_id) ||
        provinceHealthOffices.some(ho => ho.id === a.health_office_id)
      );

      // Count completed (passed) assessments
      const completedCount = provinceLatestAssessments.filter(
        a => a.status === 'approved_regional' || a.status === 'completed'
      ).length;

      // Calculate average scores
      const quantitativeScores = provinceLatestAssessments.filter(a => a.quantitative_score !== null);
      const avgQuantitative = quantitativeScores.length > 0
        ? quantitativeScores.reduce((sum, a) => sum + (a.quantitative_score || 0), 0) / quantitativeScores.length
        : null;

      const impactScores = provinceLatestAssessments.filter(a => a.impact_score !== null);
      const avgImpact = impactScores.length > 0
        ? impactScores.reduce((sum, a) => sum + (a.impact_score || 0), 0) / impactScores.length
        : null;

      const totalScoreSum = provinceLatestAssessments.filter(a => a.total_score !== null).reduce((sum, a) => sum + (a.total_score || 0), 0);
      const scoreCount = provinceLatestAssessments.filter(a => a.total_score !== null).length;

      return {
        id: province.id,
        name: province.name,
        totalUnits,
        avgQuantitative,
        avgImpact,
        avgTotal: scoreCount > 0 ? totalScoreSum / scoreCount : null
      };
    });
  }, [selectedRegion, provinces, hospitals, healthOffices, latestAssessments]);

  const handleRegionClick = (regionId: string) => {
    setSelectedRegion(regionId);
  };

  const handleBackToRegions = () => {
    setSelectedRegion('all');
  };

  return (
    <PublicLayout>
      <div className="space-y-6">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-2">
              <TrendingUp className="w-6 h-6" />
              รายงานเชิงปริมาณ
            </h1>
            <p className="text-muted-foreground">
              สรุปผลการประเมินเชิงปริมาณตาม 17 หมวดหมู่ (สำหรับผู้ใช้ทั่วไป)
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Filter className="w-4 h-4 text-muted-foreground" />
            <Select value={selectedFiscalYear} onValueChange={setSelectedFiscalYear}>
              <SelectTrigger className="w-[160px]">
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

        {/* Breadcrumb navigation */}
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <button
            onClick={handleBackToRegions}
            className={`hover:text-primary ${selectedRegion === 'all' ? 'font-medium text-foreground' : ''}`}
          >
            ทุกเขตสุขภาพ
          </button>
          {selectedRegion !== 'all' && (
            <>
              <span>/</span>
              <span className="font-medium text-foreground">
                {healthRegions.find(r => r.id === selectedRegion)?.name || 'เขตสุขภาพ'}
              </span>
            </>
          )}
        </div>

        {/* Table */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              {selectedRegion === 'all' ? (
                <>
                  <Building2 className="w-5 h-5" /> รายงานรายเขตสุขภาพ
                </>
              ) : (
                <>
                  <MapPin className="w-5 h-5" /> รายงานสรุปรายจังหวัด - เขตสุขภาพที่{' '}
                  {healthRegions.find(r => r.id === selectedRegion)?.region_number}
                </>
              )}
            </CardTitle>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="text-center py-8 text-muted-foreground">กำลังโหลด...</div>
            ) : selectedRegion === 'all' ? (
              // Region level table
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="sticky left-0 bg-background z-10">เขตสุขภาพ</TableHead>
                      <TableHead className="text-center">จำนวนหน่วยงานทั้งหมด</TableHead>
                      <TableHead className="text-center">ประเมินแล้ว</TableHead>
                      <TableHead className="text-center min-w-[180px]">ผ่านร้อยละ</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {regionTableData.map(row => (
                      <TableRow
                        key={row.id}
                        className="cursor-pointer hover:bg-muted/50"
                        onClick={() => handleRegionClick(row.id)}
                      >
                        <TableCell className="font-medium sticky left-0 bg-background z-10 text-primary hover:underline">
                          {row.name}
                        </TableCell>
                        <TableCell className="text-center">{row.totalUnits}</TableCell>
                        <TableCell className="text-center">{row.completedCount}</TableCell>
                        <TableCell className="text-center">
                          <div className="flex items-center gap-2">
                            {(() => {
                              const percentage = row.percentage;
                              const colorClass =
                                percentage === 100
                                  ? '[&>div]:bg-green-500'
                                  : percentage >= 50
                                  ? '[&>div]:bg-yellow-500'
                                  : '[&>div]:bg-red-500';
                              return <Progress value={percentage} className={`h-4 flex-1 ${colorClass}`} />;
                            })()}
                            <span className="w-14 text-right text-sm font-medium">
                              {row.percentage.toFixed(1)}%
                            </span>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            ) : (
              // Province level table
              <div className="overflow-x-auto">
                <button
                  onClick={handleBackToRegions}
                  className="mb-4 text-sm text-primary hover:underline flex items-center gap-1"
                >
                  ← กลับไปยังเขตสุขภาพ
                </button>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>จังหวัด</TableHead>
                      <TableHead className="text-right">จำนวนสถานบริการ</TableHead>
                      <TableHead className="text-right">คะแนนเชิงปริมาณ</TableHead>
                      <TableHead className="text-right">คะแนนเชิงผลกระทบ</TableHead>
                      <TableHead className="text-right">คะแนนรวม</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {provinceTableData.map(row => (
                      <TableRow key={row.id}>
                        <TableCell className="font-medium">{row.name}</TableCell>
                        <TableCell className="text-right">{row.totalUnits}</TableCell>
                        <TableCell className="text-right">
                          {row.avgQuantitative !== null ? row.avgQuantitative.toFixed(2) : '-'}
                        </TableCell>
                        <TableCell className="text-right">
                          {row.avgImpact !== null ? row.avgImpact.toFixed(2) : '-'}
                        </TableCell>
                        <TableCell className="text-right font-medium">
                          {row.avgTotal !== null ? row.avgTotal.toFixed(2) : '-'}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Legend */}
        {selectedRegion === 'all' && (
          <div className="flex items-center gap-6 text-sm text-muted-foreground">
            <div className="flex items-center gap-2">
              <div className="w-4 h-4 bg-green-500 rounded"></div>
              <span>100% (ผ่านทั้งหมด)</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-4 h-4 bg-yellow-500 rounded"></div>
              <span>50-99%</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-4 h-4 bg-red-500 rounded"></div>
              <span>ต่ำกว่า 50%</span>
            </div>
          </div>
        )}
      </div>
    </PublicLayout>
  );
}
