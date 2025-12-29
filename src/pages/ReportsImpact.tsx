import { useEffect, useState, useMemo } from 'react';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { supabase } from '@/integrations/supabase/client';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { 
  Table, 
  TableBody, 
  TableCell, 
  TableHead, 
  TableHeader, 
  TableRow 
} from '@/components/ui/table';
import { AlertTriangle, Filter, Building2, MapPin, ArrowLeft, ShieldCheck, ShieldAlert, ShieldX, AlertCircle } from 'lucide-react';
import { toast } from 'sonner';
import { useAuth } from '@/contexts/AuthContext';
import { PieChart, Pie, Cell, ResponsiveContainer, Legend, Tooltip } from 'recharts';
import { Button } from '@/components/ui/button';

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
  hospital_id: string;
  status: string;
  fiscal_year: number;
  impact_score: number | null;
}

// Helper function to get current fiscal year (Oct 1 - Sep 30)
const getCurrentFiscalYear = (): number => {
  const now = new Date();
  const month = now.getMonth(); // 0-11
  const year = now.getFullYear();
  return month >= 9 ? year + 1 : year;
};

// Generate list of fiscal years for the filter
const generateFiscalYears = (assessments: Assessment[]): number[] => {
  const years = new Set<number>();
  const currentFiscalYear = getCurrentFiscalYear();
  
  years.add(currentFiscalYear);
  
  assessments.forEach(a => {
    if (a.fiscal_year) years.add(a.fiscal_year);
  });
  
  return Array.from(years).sort((a, b) => b - a);
};

// Impact level classification based on total_score (percentage)
const getImpactLevel = (totalScore: number | null): { level: string; color: string; bgColor: string } => {
  if (totalScore === null) return { level: 'ยังไม่ประเมิน', color: 'text-muted-foreground', bgColor: 'bg-muted' };
  if (totalScore >= 100) return { level: 'ปลอดภัยสูง', color: 'text-green-600', bgColor: 'bg-green-100' };
  if (totalScore >= 80) return { level: 'ปลอดภัยปานกลาง', color: 'text-yellow-600', bgColor: 'bg-yellow-100' };
  if (totalScore >= 70) return { level: 'ความเสี่ยงต่ำ', color: 'text-orange-600', bgColor: 'bg-orange-100' };
  return { level: 'ความเสี่ยงสูง', color: 'text-red-600', bgColor: 'bg-red-100' };
};

export default function ReportsImpact() {
  const { profile } = useAuth();
  const [loading, setLoading] = useState(true);
  const [healthRegions, setHealthRegions] = useState<HealthRegion[]>([]);
  const [provinces, setProvinces] = useState<Province[]>([]);
  const [hospitals, setHospitals] = useState<Hospital[]>([]);
  const [impactScores, setImpactScores] = useState<ImpactScore[]>([]);
  const [assessments, setAssessments] = useState<Assessment[]>([]);

  // Filters
  const [selectedRegion, setSelectedRegion] = useState<string>('all');
  const [selectedProvince, setSelectedProvince] = useState<string>('all');
  const [selectedFiscalYear, setSelectedFiscalYear] = useState<string>(getCurrentFiscalYear().toString());

  // Filter type for showing only incident/breach data
  const [filterByIssue, setFilterByIssue] = useState<'none' | 'incident' | 'breach'>('none');

  // Check if user is provincial admin
  const isProvincialAdmin = profile?.role === 'provincial';
  const userProvinceId = profile?.province_id;

  // Fetch data
  useEffect(() => {
    const fetchAll = async <T,>(
      query: ReturnType<typeof supabase.from> extends (table: any) => infer R ? R : any
    ): Promise<T[]> => {
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
        const [regionsRes, provincesRes, hospitalsRes] = await Promise.all([
          supabase.from('health_regions').select('*').order('region_number'),
          supabase.from('provinces').select('*').order('name'),
          supabase.from('hospitals').select('*').order('name'),
        ]);

        if (regionsRes.error) throw regionsRes.error;
        if (provincesRes.error) throw provincesRes.error;
        if (hospitalsRes.error) throw hospitalsRes.error;

        setHealthRegions(regionsRes.data || []);
        setProvinces(provincesRes.data || []);
        setHospitals(hospitalsRes.data || []);

        const assessmentsAll = await fetchAll<Assessment>(
          supabase
            .from('assessments')
            .select('id, hospital_id, status, fiscal_year, impact_score, created_at')
            .order('created_at', { ascending: true })
        );

        const impactScoresAll = await fetchAll<ImpactScore>(
          supabase
            .from('impact_scores')
            .select('*')
            .order('created_at', { ascending: true })
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

  // Set initial filters for provincial admin
  useEffect(() => {
    if (isProvincialAdmin && userProvinceId && provinces.length > 0) {
      const userProvince = provinces.find(p => p.id === userProvinceId);
      if (userProvince) {
        setSelectedRegion(userProvince.health_region_id);
        setSelectedProvince(userProvinceId);
      }
    }
  }, [isProvincialAdmin, userProvinceId, provinces]);

  // Filter provinces based on selected region
  const filteredProvinces = useMemo(() => {
    if (selectedRegion === 'all') return [];
    const regionProvinces = provinces.filter(p => p.health_region_id === selectedRegion);
    
    if (isProvincialAdmin && userProvinceId) {
      return regionProvinces.filter(p => p.id === userProvinceId);
    }
    
    return regionProvinces;
  }, [selectedRegion, provinces, isProvincialAdmin, userProvinceId]);

  // Reset province when region changes
  useEffect(() => {
    if (!isProvincialAdmin) {
      setSelectedProvince('all');
    }
  }, [selectedRegion, isProvincialAdmin]);

  // Generate fiscal years from assessments
  const fiscalYears = useMemo(() => generateFiscalYears(assessments), [assessments]);

  // Filter assessments by fiscal year
  const filteredAssessments = useMemo(() => {
    if (selectedFiscalYear === 'all') return assessments;
    return assessments.filter(a => a.fiscal_year === parseInt(selectedFiscalYear));
  }, [assessments, selectedFiscalYear]);

  // Get impact score for an assessment
  const getImpactScoreForAssessment = (assessmentId: string): ImpactScore | undefined => {
    return impactScores.find(is => is.assessment_id === assessmentId);
  };

  // Calculate impact statistics for a set of hospital IDs
  const calculateImpactStats = (hospitalIds: string[]) => {
    const relevantAssessments = filteredAssessments.filter(a => hospitalIds.includes(a.hospital_id));
    
    let highSafety = 0;
    let mediumSafety = 0;
    let lowRisk = 0;
    let highRisk = 0;
    let notAssessed = 0;
    let totalIncidents = 0;
    let totalBreaches = 0;

    hospitalIds.forEach(hospitalId => {
      const hospitalAssessments = relevantAssessments.filter(a => a.hospital_id === hospitalId);
      if (hospitalAssessments.length === 0) {
        notAssessed++;
        return;
      }

      // Get latest assessment's impact score
      const latestAssessment = hospitalAssessments[hospitalAssessments.length - 1];
      const impactScore = getImpactScoreForAssessment(latestAssessment.id);

      if (!impactScore || impactScore.total_score === null) {
        notAssessed++;
        return;
      }

      const level = getImpactLevel(impactScore.total_score);
      if (level.level === 'ปลอดภัยสูง') highSafety++;
      else if (level.level === 'ปลอดภัยปานกลาง') mediumSafety++;
      else if (level.level === 'ความเสี่ยงต่ำ') lowRisk++;
      else if (level.level === 'ความเสี่ยงสูง') highRisk++;

      if (impactScore.had_incident) totalIncidents++;
      if (impactScore.had_data_breach) totalBreaches++;
    });

    return {
      total: hospitalIds.length,
      highSafety,
      mediumSafety,
      lowRisk,
      highRisk,
      notAssessed,
      totalIncidents,
      totalBreaches,
    };
  };

  // Pie chart data based on current filter
  const pieChartData = useMemo(() => {
    let hospitalIds: string[] = [];

    if (selectedRegion === 'all') {
      hospitalIds = hospitals.map(h => h.id);
    } else if (selectedProvince === 'all') {
      const regionProvinces = provinces.filter(p => p.health_region_id === selectedRegion);
      hospitalIds = hospitals.filter(h => 
        regionProvinces.some(p => p.id === h.province_id)
      ).map(h => h.id);
    } else {
      hospitalIds = hospitals.filter(h => h.province_id === selectedProvince).map(h => h.id);
    }

    const stats = calculateImpactStats(hospitalIds);

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
  }, [selectedRegion, selectedProvince, hospitals, provinces, filteredAssessments, impactScores]);

  // Table data based on drill-down level
  const tableData = useMemo(() => {
    // Helper to check if a hospital has incident/breach
    const hospitalHasIssue = (hospitalId: string): { hasIncident: boolean; hasBreach: boolean } => {
      const hospitalAssessments = filteredAssessments.filter(a => a.hospital_id === hospitalId);
      let hasIncident = false;
      let hasBreach = false;
      
      hospitalAssessments.forEach(assessment => {
        const impactScore = getImpactScoreForAssessment(assessment.id);
        if (impactScore?.had_incident) hasIncident = true;
        if (impactScore?.had_data_breach) hasBreach = true;
      });
      
      return { hasIncident, hasBreach };
    };

    if (selectedRegion === 'all') {
      // Show all regions
      const allRegions = healthRegions.map(region => {
        const regionProvinces = provinces.filter(p => p.health_region_id === region.id);
        const regionHospitals = hospitals.filter(h => 
          regionProvinces.some(p => p.id === h.province_id)
        );
        const hospitalIds = regionHospitals.map(h => h.id);
        const stats = calculateImpactStats(hospitalIds);

        return {
          id: region.id,
          name: `เขตสุขภาพที่ ${region.region_number}`,
          type: 'region' as const,
          ...stats,
        };
      });

      // Apply issue filter
      if (filterByIssue === 'incident') {
        return allRegions.filter(r => r.totalIncidents > 0);
      } else if (filterByIssue === 'breach') {
        return allRegions.filter(r => r.totalBreaches > 0);
      }
      return allRegions;
    } else if (selectedProvince === 'all') {
      // Show provinces in selected region
      const regionProvinces = provinces.filter(p => p.health_region_id === selectedRegion);
      const allProvinces = regionProvinces.map(province => {
        const provinceHospitals = hospitals.filter(h => h.province_id === province.id);
        const hospitalIds = provinceHospitals.map(h => h.id);
        const stats = calculateImpactStats(hospitalIds);

        return {
          id: province.id,
          name: province.name,
          type: 'province' as const,
          ...stats,
        };
      });

      // Apply issue filter
      if (filterByIssue === 'incident') {
        return allProvinces.filter(p => p.totalIncidents > 0);
      } else if (filterByIssue === 'breach') {
        return allProvinces.filter(p => p.totalBreaches > 0);
      }
      return allProvinces;
    } else {
      // Show hospitals in selected province
      const provinceHospitals = hospitals.filter(h => h.province_id === selectedProvince);
      const allHospitals = provinceHospitals.map(hospital => {
        const hospitalAssessments = filteredAssessments.filter(a => a.hospital_id === hospital.id);
        const latestAssessment = hospitalAssessments[hospitalAssessments.length - 1];
        const impactScore = latestAssessment ? getImpactScoreForAssessment(latestAssessment.id) : undefined;
        const level = getImpactLevel(impactScore?.total_score ?? null);
        const issues = hospitalHasIssue(hospital.id);

        return {
          id: hospital.id,
          name: hospital.name,
          code: hospital.code,
          type: 'hospital' as const,
          impactScore: impactScore?.total_score ?? null,
          level: level.level,
          levelColor: level.color,
          hadIncident: impactScore?.had_incident ?? null,
          hadBreach: impactScore?.had_data_breach ?? null,
          incidentScore: impactScore?.incident_score ?? null,
          breachScore: impactScore?.breach_score ?? null,
          hasAnyIncident: issues.hasIncident,
          hasAnyBreach: issues.hasBreach,
        };
      });

      // Apply issue filter
      if (filterByIssue === 'incident') {
        return allHospitals.filter(h => h.hasAnyIncident);
      } else if (filterByIssue === 'breach') {
        return allHospitals.filter(h => h.hasAnyBreach);
      }
      return allHospitals;
    }
  }, [selectedRegion, selectedProvince, healthRegions, provinces, hospitals, filteredAssessments, impactScores, filterByIssue]);

  // Get title based on filter state
  const getTitle = () => {
    if (selectedRegion === 'all') {
      return 'รายงานเชิงผลกระทบ รายเขตสุขภาพ';
    } else if (selectedProvince === 'all') {
      const region = healthRegions.find(r => r.id === selectedRegion);
      return `รายงานเชิงผลกระทบ รายจังหวัด - เขตสุขภาพที่ ${region?.region_number || ''}`;
    } else {
      const province = provinces.find(p => p.id === selectedProvince);
      return `รายงานเชิงผลกระทบ รายโรงพยาบาล - ${province?.name || ''}`;
    }
  };

  // Handle drill down
  const handleRowClick = (row: typeof tableData[0]) => {
    if (row.type === 'region') {
      setSelectedRegion(row.id);
    } else if (row.type === 'province') {
      setSelectedProvince(row.id);
    }
  };

  // Handle back navigation
  const handleBack = () => {
    if (selectedProvince !== 'all') {
      setSelectedProvince('all');
    } else if (selectedRegion !== 'all') {
      setSelectedRegion('all');
    }
  };

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-2">
              <AlertTriangle className="w-6 h-6 text-primary" />
              รายงานเชิงผลกระทบ
            </h1>
            <p className="text-muted-foreground">ผลกระทบจากเหตุการณ์ความปลอดภัยไซเบอร์และการละเมิดข้อมูล</p>
          </div>
        </div>

        {/* Filters */}
        <Card>
          <CardHeader className="pb-4">
            <CardTitle className="text-base flex items-center gap-2">
              <Filter className="w-4 h-4" />
              ตัวกรอง
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-col sm:flex-row gap-4">
              <div className="w-full sm:w-48">
                <label className="text-sm text-muted-foreground mb-1 block">เขตสุขภาพ</label>
                <Select 
                  value={selectedRegion} 
                  onValueChange={setSelectedRegion}
                  disabled={isProvincialAdmin}
                >
                  <SelectTrigger>
                    <MapPin className="w-4 h-4 mr-2" />
                    <SelectValue placeholder="เลือกเขตสุขภาพ" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">ทุกเขตสุขภาพ</SelectItem>
                    {healthRegions.map(region => (
                      <SelectItem key={region.id} value={region.id}>
                        เขตสุขภาพที่ {region.region_number}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="w-full sm:w-48">
                <label className="text-sm text-muted-foreground mb-1 block">จังหวัด</label>
                <Select 
                  value={selectedProvince} 
                  onValueChange={setSelectedProvince}
                  disabled={selectedRegion === 'all' || isProvincialAdmin}
                >
                  <SelectTrigger>
                    <Building2 className="w-4 h-4 mr-2" />
                    <SelectValue placeholder="เลือกจังหวัด" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">ทุกจังหวัด</SelectItem>
                    {filteredProvinces.map(province => (
                      <SelectItem key={province.id} value={province.id}>
                        {province.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="w-full sm:w-48">
                <label className="text-sm text-muted-foreground mb-1 block">ปีงบประมาณ</label>
                <Select value={selectedFiscalYear} onValueChange={setSelectedFiscalYear}>
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="เลือกปีงบประมาณ" />
                  </SelectTrigger>
                  <SelectContent>
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
          </CardContent>
        </Card>

        {/* Pie Chart Summary */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">สัดส่วนระดับผลกระทบความปลอดภัยไซเบอร์</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-col lg:flex-row items-center gap-8">
              <div className="w-full lg:w-1/2 h-[300px]">
                {loading ? (
                  <div className="flex items-center justify-center h-full">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
                  </div>
                ) : pieChartData.data.length > 0 ? (
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={pieChartData.data}
                        cx="50%"
                        cy="50%"
                        innerRadius={60}
                        outerRadius={100}
                        paddingAngle={2}
                        dataKey="value"
                        label={({ name, value, percent }) => `${value} รพ. (${(percent * 100).toFixed(1)}%)`}
                        labelLine={false}
                      >
                        {pieChartData.data.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={entry.color} />
                        ))}
                      </Pie>
                      <Tooltip 
                        formatter={(value: number) => [`${value} โรงพยาบาล`, '']}
                      />
                    </PieChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="flex items-center justify-center h-full text-muted-foreground">
                    ไม่มีข้อมูล
                  </div>
                )}
              </div>

              <div className="w-full lg:w-1/2 space-y-4">
                <div className="text-right">
                  <span className="text-4xl font-bold">{pieChartData.stats.total}</span>
                  <span className="text-muted-foreground ml-2">โรงพยาบาลทั้งหมด</span>
                </div>
                
                <div className="space-y-2">
                  <div className="flex items-center justify-between p-2 rounded-lg bg-green-50 dark:bg-green-950/20">
                    <div className="flex items-center gap-2">
                      <ShieldCheck className="w-5 h-5 text-green-600" />
                      <span className="text-green-700 dark:text-green-400">ปลอดภัยสูง (100 คะแนน)</span>
                    </div>
                    <span className="font-bold text-green-600">{pieChartData.stats.highSafety}</span>
                  </div>
                  
                  <div className="flex items-center justify-between p-2 rounded-lg bg-yellow-50 dark:bg-yellow-950/20">
                    <div className="flex items-center gap-2">
                      <ShieldAlert className="w-5 h-5 text-yellow-600" />
                      <span className="text-yellow-700 dark:text-yellow-400">ปลอดภัยปานกลาง (80-99 คะแนน)</span>
                    </div>
                    <span className="font-bold text-yellow-600">{pieChartData.stats.mediumSafety}</span>
                  </div>
                  
                  <div className="flex items-center justify-between p-2 rounded-lg bg-orange-50 dark:bg-orange-950/20">
                    <div className="flex items-center gap-2">
                      <AlertCircle className="w-5 h-5 text-orange-600" />
                      <span className="text-orange-700 dark:text-orange-400">ความเสี่ยงต่ำ (70-79 คะแนน)</span>
                    </div>
                    <span className="font-bold text-orange-600">{pieChartData.stats.lowRisk}</span>
                  </div>
                  
                  <div className="flex items-center justify-between p-2 rounded-lg bg-red-50 dark:bg-red-950/20">
                    <div className="flex items-center gap-2">
                      <ShieldX className="w-5 h-5 text-red-600" />
                      <span className="text-red-700 dark:text-red-400">ความเสี่ยงสูง (&lt;70 คะแนน)</span>
                    </div>
                    <span className="font-bold text-red-600">{pieChartData.stats.highRisk}</span>
                  </div>
                  
                  <div className="flex items-center justify-between p-2 rounded-lg bg-muted">
                    <div className="flex items-center gap-2">
                      <AlertTriangle className="w-5 h-5 text-muted-foreground" />
                      <span className="text-muted-foreground">ยังไม่ประเมิน</span>
                    </div>
                    <span className="font-bold text-muted-foreground">{pieChartData.stats.notAssessed}</span>
                  </div>
                </div>

                {/* Incident & Breach Summary - Clickable Filter Buttons */}
                <div className="mt-4 pt-4 border-t grid grid-cols-2 gap-4">
                  <button 
                    className={`text-center p-3 rounded-lg transition-all ${
                      filterByIssue === 'incident' 
                        ? 'bg-orange-200 dark:bg-orange-900/40 ring-2 ring-orange-500' 
                        : 'bg-orange-50 dark:bg-orange-950/20 hover:bg-orange-100 dark:hover:bg-orange-900/30'
                    }`}
                    onClick={() => {
                      setFilterByIssue(filterByIssue === 'incident' ? 'none' : 'incident');
                    }}
                  >
                    <div className="text-2xl font-bold text-orange-600">{pieChartData.stats.totalIncidents}</div>
                    <div className="text-sm text-orange-700 dark:text-orange-400">รพ. มีเหตุการณ์</div>
                  </button>
                  <button 
                    className={`text-center p-3 rounded-lg transition-all ${
                      filterByIssue === 'breach' 
                        ? 'bg-red-200 dark:bg-red-900/40 ring-2 ring-red-500' 
                        : 'bg-red-50 dark:bg-red-950/20 hover:bg-red-100 dark:hover:bg-red-900/30'
                    }`}
                    onClick={() => {
                      setFilterByIssue(filterByIssue === 'breach' ? 'none' : 'breach');
                    }}
                  >
                    <div className="text-2xl font-bold text-red-600">{pieChartData.stats.totalBreaches}</div>
                    <div className="text-sm text-red-700 dark:text-red-400">รพ. มีการละเมิดข้อมูล</div>
                  </button>
                </div>

                {/* Filter active indicator */}
                {filterByIssue !== 'none' && (
                  <div className="mt-3 p-2 rounded-lg bg-muted text-sm text-muted-foreground flex items-center justify-between">
                    <span>
                      กำลังแสดงเฉพาะ: {filterByIssue === 'incident' ? 'เขต/จังหวัด/รพ. ที่มีเหตุการณ์' : 'เขต/จังหวัด/รพ. ที่มีการละเมิดข้อมูล'}
                    </span>
                    <Button 
                      variant="ghost" 
                      size="sm" 
                      onClick={() => setFilterByIssue('none')}
                      className="h-6 px-2 text-xs"
                    >
                      ล้างตัวกรอง
                    </Button>
                  </div>
                )}
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Detail Table */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="text-base">{getTitle()}</CardTitle>
              {(selectedRegion !== 'all' || selectedProvince !== 'all') && (
                <Button variant="outline" size="sm" onClick={handleBack}>
                  <ArrowLeft className="w-4 h-4 mr-2" />
                  ย้อนกลับ
                </Button>
              )}
            </div>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="flex items-center justify-center py-8">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
              </div>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="min-w-[200px]">
                        {selectedProvince !== 'all' ? 'โรงพยาบาล' : selectedRegion !== 'all' ? 'จังหวัด' : 'เขตสุขภาพ'}
                      </TableHead>
                      {selectedProvince !== 'all' ? (
                        // Hospital level columns
                        <>
                          <TableHead className="text-center">รหัส</TableHead>
                          <TableHead className="text-center">คะแนนรวม</TableHead>
                          <TableHead className="text-center">ระดับ</TableHead>
                          <TableHead className="text-center">เหตุการณ์</TableHead>
                          <TableHead className="text-center">ละเมิดข้อมูล</TableHead>
                        </>
                      ) : (
                        // Region/Province level columns
                        <>
                          <TableHead className="text-center">รพ. ทั้งหมด</TableHead>
                          <TableHead className="text-center text-green-600">ปลอดภัยสูง</TableHead>
                          <TableHead className="text-center text-yellow-600">ปานกลาง</TableHead>
                          <TableHead className="text-center text-orange-600">เสี่ยงต่ำ</TableHead>
                          <TableHead className="text-center text-red-600">เสี่ยงสูง</TableHead>
                          <TableHead className="text-center">ยังไม่ประเมิน</TableHead>
                          <TableHead className="text-center">มีเหตุการณ์</TableHead>
                          <TableHead className="text-center">ละเมิดข้อมูล</TableHead>
                        </>
                      )}
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {tableData.map((row) => (
                      <TableRow 
                        key={row.id}
                        className={row.type !== 'hospital' ? 'cursor-pointer hover:bg-muted/50' : ''}
                        onClick={() => row.type !== 'hospital' && handleRowClick(row)}
                      >
                        <TableCell className="font-medium">{row.name}</TableCell>
                        {row.type === 'hospital' ? (
                          <>
                            <TableCell className="text-center text-muted-foreground">
                              {'code' in row ? row.code : '-'}
                            </TableCell>
                            <TableCell className="text-center font-medium">
                              {'impactScore' in row ? (row.impactScore !== null ? row.impactScore : '-') : '-'}
                            </TableCell>
                            <TableCell className="text-center">
                              {'level' in row && (
                                <span className={row.levelColor}>{row.level}</span>
                              )}
                            </TableCell>
                            <TableCell className="text-center">
                              {'hadIncident' in row && (
                                row.hadIncident === true ? (
                                  <span className="text-orange-600">มี</span>
                                ) : row.hadIncident === false ? (
                                  <span className="text-green-600">ไม่มี</span>
                                ) : '-'
                              )}
                            </TableCell>
                            <TableCell className="text-center">
                              {'hadBreach' in row && (
                                row.hadBreach === true ? (
                                  <span className="text-red-600">มี</span>
                                ) : row.hadBreach === false ? (
                                  <span className="text-green-600">ไม่มี</span>
                                ) : '-'
                              )}
                            </TableCell>
                          </>
                        ) : (
                          <>
                            <TableCell className="text-center">{row.total}</TableCell>
                            <TableCell className="text-center text-green-600 font-medium">{row.highSafety}</TableCell>
                            <TableCell className="text-center text-yellow-600">{row.mediumSafety}</TableCell>
                            <TableCell className="text-center text-orange-600">{row.lowRisk}</TableCell>
                            <TableCell className="text-center text-red-600">{row.highRisk}</TableCell>
                            <TableCell className="text-center text-muted-foreground">{row.notAssessed}</TableCell>
                            <TableCell className="text-center text-orange-600">{row.totalIncidents}</TableCell>
                            <TableCell className="text-center text-red-600">{row.totalBreaches}</TableCell>
                          </>
                        )}
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
