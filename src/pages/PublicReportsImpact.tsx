import { useEffect, useState, useMemo } from 'react';
import { PublicLayout } from '@/components/layout/PublicLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { supabase } from '@/integrations/supabase/client';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { AlertTriangle, Filter, Building2, MapPin } from 'lucide-react';
import { toast } from 'sonner';
import { PieChart, Pie, Cell, ResponsiveContainer, Legend, Tooltip } from 'recharts';
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

interface ImpactScore {
  id: string;
  assessment_id: string;
  had_incident: boolean | null;
  incident_recovery_hours: number | null;
  incident_score: number | null;
  had_data_breach: boolean | null;
  breach_severity: string | null;
  breach_penalty_level: number | null;
  breach_score: number | null;
  total_score: number | null;
}

interface Assessment {
  id: string;
  hospital_id: string | null;
  health_office_id: string | null;
  status: string;
  fiscal_year: number;
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

const getImpactLevel = (totalScore: number | null): { level: string; color: string; bgColor: string } => {
  if (totalScore === null) return { level: 'ยังไม่ประเมิน', color: 'text-muted-foreground', bgColor: 'bg-muted' };
  if (totalScore >= 100) return { level: 'ปลอดภัยสูง', color: 'text-green-600', bgColor: 'bg-green-100' };
  if (totalScore >= 80) return { level: 'ปลอดภัยปานกลาง', color: 'text-yellow-600', bgColor: 'bg-yellow-100' };
  if (totalScore >= 70) return { level: 'ความเสี่ยงต่ำ', color: 'text-orange-600', bgColor: 'bg-orange-100' };
  return { level: 'ความเสี่ยงสูง', color: 'text-red-600', bgColor: 'bg-red-100' };
};

export default function PublicReportsImpact() {
  const [loading, setLoading] = useState(true);
  const [healthRegions, setHealthRegions] = useState<HealthRegion[]>([]);
  const [provinces, setProvinces] = useState<Province[]>([]);
  const [hospitals, setHospitals] = useState<Hospital[]>([]);
  const [healthOffices, setHealthOffices] = useState<HealthOffice[]>([]);
  const [impactScores, setImpactScores] = useState<ImpactScore[]>([]);
  const [assessments, setAssessments] = useState<Assessment[]>([]);

  const [selectedRegion, setSelectedRegion] = useState<string>('all');
  const [selectedProvince, setSelectedProvince] = useState<string>('all');
  const [selectedFiscalYear, setSelectedFiscalYear] = useState<string>(getCurrentFiscalYear().toString());

  const { canDrillToHospital } = usePublicReportAccessPolicy('impact');

  useEffect(() => {
    const fetchAll = async <T,>(query: any): Promise<T[]> => {
      const pageSize = 1000;
      let from = 0;
      const all: T[] = [];
      while (true) {
        const { data, error } = await query.range(from, from + pageSize - 1);
        if (error) throw error;
        const chunk = (data || []) as T[];
        all.push(...chunk);
        if (chunk.length < pageSize) break;
        from += pageSize;
      }
      return all;
    };

    const fetchData = async () => {
      try {
        const [regionsRes, provincesRes, hospitalsRes, healthOfficesRes] = await Promise.all([
          supabase.from('health_regions').select('*').order('region_number'),
          supabase.from('provinces').select('*').order('name'),
          supabase.from('hospitals').select('*').order('name'),
          supabase.from('health_offices').select('*').order('name'),
        ]);

        if (regionsRes.error) throw regionsRes.error;
        if (provincesRes.error) throw provincesRes.error;
        if (hospitalsRes.error) throw hospitalsRes.error;
        if (healthOfficesRes.error) throw healthOfficesRes.error;

        setHealthRegions(regionsRes.data || []);
        setProvinces(provincesRes.data || []);
        setHospitals(hospitalsRes.data || []);
        setHealthOffices(healthOfficesRes.data || []);

        const assessmentsAll = await fetchAll<Assessment>(
          supabase.from('assessments').select('id, hospital_id, health_office_id, status, fiscal_year, impact_score, created_at').order('created_at', { ascending: true })
        );
        const impactScoresAll = await fetchAll<ImpactScore>(
          supabase.from('impact_scores').select('*').order('created_at', { ascending: true })
        );

        setAssessments(assessmentsAll);
        setImpactScores(impactScoresAll);
      } catch (error) {
        console.error('Error fetching data:', error);
        toast.error('เกิดข้อผิดพลาดในการโหลดข้อมูล');
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, []);

  const filteredProvinces = useMemo(() => {
    if (selectedRegion === 'all') return [];
    return provinces.filter(p => p.health_region_id === selectedRegion);
  }, [selectedRegion, provinces]);

  useEffect(() => {
    setSelectedProvince('all');
  }, [selectedRegion]);

  const fiscalYears = useMemo(() => generateFiscalYears(assessments), [assessments]);

  const filteredAssessments = useMemo(() => {
    if (selectedFiscalYear === 'all') return assessments;
    return assessments.filter(a => a.fiscal_year === parseInt(selectedFiscalYear));
  }, [assessments, selectedFiscalYear]);

  const getImpactScoreForAssessment = (assessmentId: string): ImpactScore | undefined => {
    return impactScores.find(is => is.assessment_id === assessmentId);
  };

  const calculateImpactStats = (hospitalIds: string[], healthOfficeIds: string[] = []) => {
    const relevantAssessments = filteredAssessments.filter(a =>
      (a.hospital_id && hospitalIds.includes(a.hospital_id)) ||
      (a.health_office_id && healthOfficeIds.includes(a.health_office_id))
    );

    let highSafety = 0, mediumSafety = 0, lowRisk = 0, highRisk = 0, notAssessed = 0;
    let totalIncidents = 0, totalBreaches = 0;

    hospitalIds.forEach(hospitalId => {
      const unitAssessments = relevantAssessments.filter(a => a.hospital_id === hospitalId);
      if (unitAssessments.length === 0) { notAssessed++; return; }
      const latestAssessment = unitAssessments[unitAssessments.length - 1];
      const impactScore = getImpactScoreForAssessment(latestAssessment.id);
      if (!impactScore || impactScore.total_score === null) { notAssessed++; return; }
      const level = getImpactLevel(impactScore.total_score);
      if (level.level === 'ปลอดภัยสูง') highSafety++;
      else if (level.level === 'ปลอดภัยปานกลาง') mediumSafety++;
      else if (level.level === 'ความเสี่ยงต่ำ') lowRisk++;
      else if (level.level === 'ความเสี่ยงสูง') highRisk++;
      if (impactScore.had_incident) totalIncidents++;
      if (impactScore.had_data_breach) totalBreaches++;
    });

    healthOfficeIds.forEach(officeId => {
      const unitAssessments = relevantAssessments.filter(a => a.health_office_id === officeId);
      if (unitAssessments.length === 0) { notAssessed++; return; }
      const latestAssessment = unitAssessments[unitAssessments.length - 1];
      const impactScore = getImpactScoreForAssessment(latestAssessment.id);
      if (!impactScore || impactScore.total_score === null) { notAssessed++; return; }
      const level = getImpactLevel(impactScore.total_score);
      if (level.level === 'ปลอดภัยสูง') highSafety++;
      else if (level.level === 'ปลอดภัยปานกลาง') mediumSafety++;
      else if (level.level === 'ความเสี่ยงต่ำ') lowRisk++;
      else if (level.level === 'ความเสี่ยงสูง') highRisk++;
      if (impactScore.had_incident) totalIncidents++;
      if (impactScore.had_data_breach) totalBreaches++;
    });

    return { total: hospitalIds.length + healthOfficeIds.length, highSafety, mediumSafety, lowRisk, highRisk, notAssessed, totalIncidents, totalBreaches };
  };

  const pieChartData = useMemo(() => {
    let hospitalIds: string[] = [];
    let healthOfficeIds: string[] = [];

    if (selectedRegion === 'all') {
      hospitalIds = hospitals.map(h => h.id);
      healthOfficeIds = healthOffices.map(ho => ho.id);
    } else if (selectedProvince === 'all') {
      const regionProvinces = provinces.filter(p => p.health_region_id === selectedRegion);
      hospitalIds = hospitals.filter(h => regionProvinces.some(p => p.id === h.province_id)).map(h => h.id);
      healthOfficeIds = healthOffices.filter(ho => ho.health_region_id === selectedRegion).map(ho => ho.id);
    }

    const stats = calculateImpactStats(hospitalIds, healthOfficeIds);
    return {
      data: [
        { name: 'ปลอดภัยสูง', value: stats.highSafety, color: '#22c55e' },
        { name: 'ปลอดภัยปานกลาง', value: stats.mediumSafety, color: '#eab308' },
        { name: 'ความเสี่ยงต่ำ', value: stats.lowRisk, color: '#f97316' },
        { name: 'ความเสี่ยงสูง', value: stats.highRisk, color: '#ef4444' },
        { name: 'ยังไม่ประเมิน', value: stats.notAssessed, color: '#94a3b8' },
      ].filter(d => d.value > 0),
      stats,
    };
  }, [selectedRegion, selectedProvince, hospitals, healthOffices, provinces, filteredAssessments, impactScores]);

  const tableData = useMemo(() => {
    if (selectedRegion === 'all') {
      return healthRegions.map(region => {
        const regionProvinces = provinces.filter(p => p.health_region_id === region.id);
        const regionHospitals = hospitals.filter(h => regionProvinces.some(p => p.id === h.province_id));
        const regionHealthOffices = healthOffices.filter(ho => ho.health_region_id === region.id);
        const stats = calculateImpactStats(regionHospitals.map(h => h.id), regionHealthOffices.map(ho => ho.id));
        return { id: region.id, name: `เขตสุขภาพที่ ${region.region_number}`, type: 'region' as const, ...stats };
      });
    } else if (selectedProvince === 'all') {
      const regionProvinces = provinces.filter(p => p.health_region_id === selectedRegion);
      return regionProvinces.map(province => {
        const provinceHospitals = hospitals.filter(h => h.province_id === province.id);
        const provinceHealthOffices = healthOffices.filter(ho => ho.province_id === province.id);
        const stats = calculateImpactStats(provinceHospitals.map(h => h.id), provinceHealthOffices.map(ho => ho.id));
        return { id: province.id, name: province.name, type: 'province' as const, ...stats };
      });
    }
    return [];
  }, [selectedRegion, selectedProvince, healthRegions, provinces, hospitals, healthOffices, filteredAssessments, impactScores]);

  const handleRowClick = (id: string, type: string) => {
    if (type === 'region') {
      setSelectedRegion(id);
    } else if (type === 'province') {
      toast.info('กรุณาเข้าสู่ระบบเพื่อดูรายละเอียดรายโรงพยาบาล');
    }
  };

  return (
    <PublicLayout>
      <div className="space-y-6">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-2">
              <AlertTriangle className="w-6 h-6" />
              รายงานเชิงผลกระทบ
            </h1>
            <p className="text-muted-foreground">สรุปผลการประเมินเชิงผลกระทบด้านความปลอดภัย (สำหรับผู้ใช้ทั่วไป)</p>
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
            onClick={() => { setSelectedRegion('all'); setSelectedProvince('all'); }}
            className={`hover:text-primary ${selectedRegion === 'all' ? 'font-medium text-foreground' : ''}`}
          >
            ทุกเขตสุขภาพ
          </button>
          {selectedRegion !== 'all' && (
            <>
              <span>/</span>
              <button
                onClick={() => setSelectedProvince('all')}
                className={`hover:text-primary ${selectedProvince === 'all' ? 'font-medium text-foreground' : ''}`}
              >
                {healthRegions.find(r => r.id === selectedRegion)?.name || 'เขตสุขภาพ'}
              </button>
            </>
          )}
        </div>

        {/* Pie Chart */}
        <Card>
          <CardHeader>
            <CardTitle>การกระจายระดับความปลอดภัย</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-[300px]">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={pieChartData.data}
                    cx="50%"
                    cy="50%"
                    labelLine={false}
                    label={({ name, value, percent }) => `${name}: ${value} (${(percent * 100).toFixed(0)}%)`}
                    outerRadius={100}
                    fill="#8884d8"
                    dataKey="value"
                  >
                    {pieChartData.data.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip />
                  <Legend />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        {/* Table */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              {selectedRegion === 'all' ? (
                <><Building2 className="w-5 h-5" /> รายงานรายเขตสุขภาพ</>
              ) : (
                <><MapPin className="w-5 h-5" /> รายงานรายจังหวัด</>
              )}
            </CardTitle>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="text-center py-8 text-muted-foreground">กำลังโหลด...</div>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>{selectedRegion === 'all' ? 'เขตสุขภาพ' : 'จังหวัด'}</TableHead>
                      <TableHead className="text-center">จำนวนหน่วย</TableHead>
                      <TableHead className="text-center text-green-600">ปลอดภัยสูง</TableHead>
                      <TableHead className="text-center text-yellow-600">ปลอดภัยปานกลาง</TableHead>
                      <TableHead className="text-center text-orange-600">ความปลอดภัยต่ำ</TableHead>
                      <TableHead className="text-center text-red-600">ความปลอดภัยต่ำมาก</TableHead>
                      <TableHead className="text-center">ยังไม่ประเมิน</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {tableData.map((row) => (
                      <TableRow
                        key={row.id}
                        className="cursor-pointer hover:bg-muted/50"
                        onClick={() => handleRowClick(row.id, row.type)}
                      >
                        <TableCell className="font-medium text-primary hover:underline">{row.name}</TableCell>
                        <TableCell className="text-center">{row.total}</TableCell>
                        <TableCell className="text-center">{row.highSafety}</TableCell>
                        <TableCell className="text-center">{row.mediumSafety}</TableCell>
                        <TableCell className="text-center">{row.lowRisk}</TableCell>
                        <TableCell className="text-center">{row.highRisk}</TableCell>
                        <TableCell className="text-center">{row.notAssessed}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </PublicLayout>
  );
}
