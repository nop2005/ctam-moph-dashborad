// This page is a clone of ReportsQuantitative.tsx for the "CTAM แยกตามพื้นที่" submenu
// It provides the same quantitative report functionality under the CTAM 17 section

import { useEffect, useState, useMemo } from 'react';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { supabase } from '@/integrations/supabase/client';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { TrendingUp, Filter, Building2, MapPin, ArrowLeft, UserCircle, Briefcase, Map } from 'lucide-react';
import { Progress } from '@/components/ui/progress';
import { toast } from 'sonner';
import { useAuth } from '@/contexts/AuthContext';
import { PieChart, Pie, Cell, ResponsiveContainer, Legend, Tooltip } from 'recharts';
import { useReportAccessPolicy } from '@/hooks/useReportAccessPolicy';
import { getLatestAssessmentsByUnit, isApprovedAssessmentStatus } from '@/lib/assessment-latest';
import ThailandMap, { ProvinceData } from '@/components/reports/ThailandMap';

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
interface CTAMCategory {
  id: string;
  code: string;
  name_th: string;
  name_en: string;
  order_number: number;
}
interface AssessmentItem {
  id: string;
  assessment_id: string;
  category_id: string;
  score: number | string | null;
}
interface Assessment {
  id: string;
  hospital_id: string | null;
  health_office_id: string | null;
  status: string;
  fiscal_year: number;
  quantitative_score: number | string | null;
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

export default function ReportsQuantitativeByRegion() {
  const { profile } = useAuth();
  const [loading, setLoading] = useState(true);
  const [healthRegions, setHealthRegions] = useState<HealthRegion[]>([]);
  const [provinces, setProvinces] = useState<Province[]>([]);
  const [hospitals, setHospitals] = useState<Hospital[]>([]);
  const [healthOffices, setHealthOffices] = useState<HealthOffice[]>([]);
  const [categories, setCategories] = useState<CTAMCategory[]>([]);
  const [assessmentItems, setAssessmentItems] = useState<AssessmentItem[]>([]);
  const [assessments, setAssessments] = useState<Assessment[]>([]);
  const [organizationName, setOrganizationName] = useState<string | null>(null);

  const [selectedRegion, setSelectedRegion] = useState<string>('all');
  const [selectedProvince, setSelectedProvince] = useState<string>('all');
  const [selectedFiscalYear, setSelectedFiscalYear] = useState<string>(getCurrentFiscalYear().toString());
  const [selectedColorFilter, setSelectedColorFilter] = useState<'all' | 'green' | 'yellow' | 'red' | 'gray'>('all');

  const isProvincialAdmin = profile?.role === 'provincial';
  const userProvinceId = profile?.province_id;

  const {
    canDrillToProvince,
    canDrillToHospital,
    canViewSameProvinceHospitals,
    userProvinceId: policyUserProvinceId
  } = useReportAccessPolicy('quantitative', provinces, healthOffices);

  // Fetch data
  useEffect(() => {
    const fetchAll = async <T,>(query: ReturnType<typeof supabase.from> extends ((table: any) => infer R) ? R : any): Promise<T[]> => {
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
        const [regionsRes, provincesRes, hospitalsRes, healthOfficesRes, categoriesRes] = await Promise.all([
          supabase.from('health_regions').select('*').order('region_number'),
          supabase.from('provinces').select('*').order('name'),
          supabase.from('hospitals').select('*').order('name'),
          supabase.from('health_offices').select('*').order('name'),
          supabase.from('ctam_categories').select('*').order('order_number')
        ]);
        if (regionsRes.error) throw regionsRes.error;
        if (provincesRes.error) throw provincesRes.error;
        if (hospitalsRes.error) throw hospitalsRes.error;
        if (healthOfficesRes.error) throw healthOfficesRes.error;
        if (categoriesRes.error) throw categoriesRes.error;
        setHealthRegions(regionsRes.data || []);
        setProvinces(provincesRes.data || []);
        setHospitals(hospitalsRes.data || []);
        setHealthOffices(healthOfficesRes.data || []);
        setCategories(categoriesRes.data || []);
        const assessmentsAll = await fetchAll<Assessment>(
          supabase.from('assessments').select('id, hospital_id, health_office_id, status, fiscal_year, quantitative_score, created_at').order('created_at', { ascending: true })
        );
        const itemsAll = await fetchAll<AssessmentItem>(
          supabase.from('assessment_items').select('id, assessment_id, category_id, score, created_at').order('created_at', { ascending: true })
        );
        setAssessments(assessmentsAll);
        setAssessmentItems(itemsAll);
      } catch (error) {
        console.error('Error fetching data:', error);
        toast.error('เกิดข้อผิดพลาดในการโหลดข้อมูล');
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, []);

  useEffect(() => {
    if (isProvincialAdmin && userProvinceId && provinces.length > 0) {
      const userProvince = provinces.find(p => p.id === userProvinceId);
      if (userProvince) {
        setSelectedRegion(userProvince.health_region_id);
        setSelectedProvince(userProvinceId);
      }
    }
  }, [isProvincialAdmin, userProvinceId, provinces]);

  useEffect(() => {
    const fetchOrganizationName = async () => {
      if (!profile) return;
      if (profile.health_office_id) {
        const { data } = await supabase.from('health_offices').select('name').eq('id', profile.health_office_id).maybeSingle();
        if (data) setOrganizationName(data.name);
      } else if (profile.hospital_id) {
        const { data } = await supabase.from('hospitals').select('name').eq('id', profile.hospital_id).maybeSingle();
        if (data) setOrganizationName(data.name);
      } else if (profile.province_id) {
        const { data } = await supabase.from('provinces').select('name').eq('id', profile.province_id).maybeSingle();
        if (data) setOrganizationName(`สสจ.${data.name}`);
      } else if (profile.health_region_id) {
        const { data } = await supabase.from('health_regions').select('region_number').eq('id', profile.health_region_id).maybeSingle();
        if (data) setOrganizationName(`เขตสุขภาพที่ ${data.region_number}`);
      } else if (profile.role === 'central_admin') {
        setOrganizationName('กระทรวงสาธารณสุข');
      } else if (profile.role === 'supervisor') {
        setOrganizationName('ผู้ตรวจราชการ');
      }
    };
    fetchOrganizationName();
  }, [profile]);

  const filteredProvinces = useMemo(() => {
    if (selectedRegion === 'all') return [];
    const regionProvinces = provinces.filter(p => p.health_region_id === selectedRegion);
    if (isProvincialAdmin && userProvinceId) {
      return regionProvinces.filter(p => p.id === userProvinceId);
    }
    return regionProvinces;
  }, [selectedRegion, provinces, isProvincialAdmin, userProvinceId]);

  useEffect(() => {
    if (!isProvincialAdmin) {
      setSelectedProvince('all');
      setSelectedColorFilter('all');
    }
  }, [selectedRegion, isProvincialAdmin]);

  useEffect(() => {
    setSelectedColorFilter('all');
  }, [selectedProvince]);

  const fiscalYears = useMemo(() => generateFiscalYears(assessments), [assessments]);

  const filteredAssessments = useMemo(() => {
    if (selectedFiscalYear === 'all') return assessments;
    return assessments.filter(a => a.fiscal_year === parseInt(selectedFiscalYear));
  }, [assessments, selectedFiscalYear]);

  const approvedAssessments = useMemo(
    () => filteredAssessments.filter(a => isApprovedAssessmentStatus(a.status)),
    [filteredAssessments]
  );

  const latestApprovedByUnit = useMemo(() => getLatestAssessmentsByUnit(approvedAssessments), [approvedAssessments]);

  const filteredAssessmentItems = useMemo(() => {
    const filteredAssessmentIds = new Set(filteredAssessments.map(a => a.id));
    return assessmentItems.filter(item => filteredAssessmentIds.has(item.assessment_id));
  }, [assessmentItems, filteredAssessments]);

  const calculateCategoryAverages = (hospitalIds: string[], healthOfficeIds: string[] = [], isProvinceLevel: boolean = false) => {
    const totalUnitsInScope = hospitalIds.length + healthOfficeIds.length;
    const unitIds = [...hospitalIds, ...healthOfficeIds];
    const latestAssessmentIds = unitIds
      .map(unitId => latestApprovedByUnit.get(unitId)?.id)
      .filter((id): id is string => Boolean(id));

    return categories.map(cat => {
      if (isProvinceLevel) {
        let passedCount = 0;
        unitIds.forEach(unitId => {
          const assessmentId = latestApprovedByUnit.get(unitId)?.id;
          if (!assessmentId) return;
          const catItems = filteredAssessmentItems.filter(
            item => item.assessment_id === assessmentId && item.category_id === cat.id
          );
          if (catItems.length === 0) return;
          const hasPassed = catItems.some(item => Number(item.score) === 1);
          if (hasPassed) passedCount++;
        });
        if (totalUnitsInScope === 0) {
          return { categoryId: cat.id, average: null, passedCount: 0, totalCount: 0 };
        }
        const percentage = (passedCount / totalUnitsInScope) * 100;
        return { categoryId: cat.id, average: percentage, passedCount, totalCount: totalUnitsInScope };
      }

      if (latestAssessmentIds.length === 0) {
        return { categoryId: cat.id, average: null };
      }
      const catItems = filteredAssessmentItems.filter(
        item => latestAssessmentIds.includes(item.assessment_id) && item.category_id === cat.id
      );
      if (catItems.length === 0) {
        return { categoryId: cat.id, average: null };
      }
      const avg = catItems.reduce((sum, item) => sum + Number(item.score), 0) / catItems.length;
      return { categoryId: cat.id, average: avg };
    });
  };

  const tableData = useMemo(() => {
    if (selectedRegion === 'all') {
      return healthRegions.map(region => {
        const regionProvinces = provinces.filter(p => p.health_region_id === region.id);
        const regionHospitals = hospitals.filter(h => regionProvinces.some(p => p.id === h.province_id));
        const regionHealthOffices = healthOffices.filter(ho => ho.health_region_id === region.id);
        const hospitalIds = regionHospitals.map(h => h.id);
        const healthOfficeIds = regionHealthOffices.map(ho => ho.id);
        const categoryAverages = calculateCategoryAverages(hospitalIds, healthOfficeIds, true);

        let unitsPassedAll17 = 0;
        let unitsAssessed = 0;

        hospitalIds.forEach(hospitalId => {
          const latestAssessmentId = latestApprovedByUnit.get(hospitalId)?.id;
          if (!latestAssessmentId) return;
          unitsAssessed++;
          const passedAllCategories = categories.every(cat => {
            const catItems = filteredAssessmentItems.filter(
              item => item.assessment_id === latestAssessmentId && item.category_id === cat.id
            );
            return catItems.some(item => Number(item.score) === 1);
          });
          if (passedAllCategories) unitsPassedAll17++;
        });

        healthOfficeIds.forEach(officeId => {
          const latestAssessmentId = latestApprovedByUnit.get(officeId)?.id;
          if (!latestAssessmentId) return;
          unitsAssessed++;
          const passedAllCategories = categories.every(cat => {
            const catItems = filteredAssessmentItems.filter(
              item => item.assessment_id === latestAssessmentId && item.category_id === cat.id
            );
            return catItems.some(item => Number(item.score) === 1);
          });
          if (passedAllCategories) unitsPassedAll17++;
        });

        const allUnitIds = [...hospitalIds, ...healthOfficeIds];
        const quantScores = allUnitIds
          .map(uid => latestApprovedByUnit.get(uid))
          .filter(a => a && a.quantitative_score !== null && a.quantitative_score !== undefined)
          .map(a => Number(a!.quantitative_score));
        const avgQuantitativeScore = quantScores.length > 0
          ? quantScores.reduce((s, v) => s + v, 0) / quantScores.length
          : null;

        return {
          id: region.id,
          name: `เขตสุขภาพที่ ${region.region_number}`,
          type: 'region' as const,
          hospitalCount: regionHospitals.length + regionHealthOffices.length,
          hospitalsAssessed: unitsAssessed,
          hospitalsPassedAll17: unitsPassedAll17,
          avgQuantitativeScore,
          categoryAverages
        };
      });
    } else if (selectedProvince === 'all') {
      const regionProvinces = provinces.filter(p => p.health_region_id === selectedRegion);
      return regionProvinces.map(province => {
        const provinceHospitals = hospitals.filter(h => h.province_id === province.id);
        const provinceHealthOffices = healthOffices.filter(ho => ho.province_id === province.id);
        const hospitalIds = provinceHospitals.map(h => h.id);
        const healthOfficeIds = provinceHealthOffices.map(ho => ho.id);
        const categoryAverages = calculateCategoryAverages(hospitalIds, healthOfficeIds, true);

        let unitsPassedAll17 = 0;
        let unitsAssessed = 0;

        hospitalIds.forEach(hospitalId => {
          const latestAssessmentId = latestApprovedByUnit.get(hospitalId)?.id;
          if (!latestAssessmentId) return;
          unitsAssessed++;
          const passedAllCategories = categories.every(cat => {
            const catItems = filteredAssessmentItems.filter(
              item => item.assessment_id === latestAssessmentId && item.category_id === cat.id
            );
            return catItems.some(item => Number(item.score) === 1);
          });
          if (passedAllCategories) unitsPassedAll17++;
        });

        healthOfficeIds.forEach(officeId => {
          const latestAssessmentId = latestApprovedByUnit.get(officeId)?.id;
          if (!latestAssessmentId) return;
          unitsAssessed++;
          const passedAllCategories = categories.every(cat => {
            const catItems = filteredAssessmentItems.filter(
              item => item.assessment_id === latestAssessmentId && item.category_id === cat.id
            );
            return catItems.some(item => Number(item.score) === 1);
          });
          if (passedAllCategories) unitsPassedAll17++;
        });

        const allUnitIds = [...hospitalIds, ...healthOfficeIds];
        const quantScores = allUnitIds
          .map(uid => latestApprovedByUnit.get(uid))
          .filter(a => a && a.quantitative_score !== null && a.quantitative_score !== undefined)
          .map(a => Number(a!.quantitative_score));
        const avgQuantitativeScore = quantScores.length > 0
          ? quantScores.reduce((s, v) => s + v, 0) / quantScores.length
          : null;

        return {
          id: province.id,
          name: province.name,
          type: 'province' as const,
          hospitalCount: provinceHospitals.length + provinceHealthOffices.length,
          hospitalsAssessed: unitsAssessed,
          hospitalsPassedAll17: unitsPassedAll17,
          avgQuantitativeScore,
          categoryAverages
        };
      });
    } else {
      let provinceHospitals = hospitals.filter(h => h.province_id === selectedProvince);
      let provinceHealthOffices = healthOffices.filter(ho => ho.province_id === selectedProvince);

      if (profile?.role === 'hospital_it' && !canViewSameProvinceHospitals()) {
        provinceHospitals = provinceHospitals.filter(h => h.id === profile.hospital_id);
        provinceHealthOffices = [];
      }
      if (profile?.role === 'health_office' && !canViewSameProvinceHospitals()) {
        provinceHospitals = [];
        provinceHealthOffices = provinceHealthOffices.filter(ho => ho.id === profile.health_office_id);
      }
      const hospitalRows = provinceHospitals.map(hospital => {
        const categoryAverages = calculateCategoryAverages([hospital.id], []);
        return {
          id: hospital.id,
          name: hospital.name,
          code: hospital.code,
          type: 'hospital' as const,
          hospitalCount: 1,
          categoryAverages
        };
      });
      const healthOfficeRows = provinceHealthOffices.map(office => {
        const categoryAverages = calculateCategoryAverages([], [office.id]);
        return {
          id: office.id,
          name: office.name,
          code: office.code,
          type: 'health_office' as const,
          hospitalCount: 1,
          categoryAverages
        };
      });
      return [...hospitalRows, ...healthOfficeRows];
    }
  }, [selectedRegion, selectedProvince, healthRegions, provinces, hospitals, healthOffices, categories, filteredAssessments, filteredAssessmentItems, profile, canViewSameProvinceHospitals, latestApprovedByUnit]);

  const getUnitPassPercentage = (unitId: string): number | null => {
    const latestAssessment = latestApprovedByUnit.get(unitId);
    if (!latestAssessment) return null;
    const unitCategoryAverages = categories.map(cat => {
      const catItems = filteredAssessmentItems.filter(
        item => item.assessment_id === latestAssessment.id && item.category_id === cat.id
      );
      if (catItems.length === 0) return null;
      const avg = catItems.reduce((sum, item) => sum + Number(item.score), 0) / catItems.length;
      return avg;
    });
    const passedCount = unitCategoryAverages.filter(c => c === 1).length;
    const totalCount = unitCategoryAverages.filter(c => c !== null).length;
    return totalCount > 0 ? (passedCount / totalCount) * 100 : null;
  };

  const colorCounts = useMemo(() => {
    if (selectedProvince === 'all') {
      return { all: 0, green: 0, yellow: 0, red: 0, gray: 0 };
    }
    let greenCount = 0, yellowCount = 0, redCount = 0, grayCount = 0;
    tableData.forEach(row => {
      if (row.type !== 'hospital' && row.type !== 'health_office') return;
      const passPercentage = getUnitPassPercentage(row.id);
      if (passPercentage === null) grayCount++;
      else if (passPercentage === 100) greenCount++;
      else if (passPercentage >= 50) yellowCount++;
      else redCount++;
    });
    return { all: tableData.length, green: greenCount, yellow: yellowCount, red: redCount, gray: grayCount };
  }, [tableData, selectedProvince, latestApprovedByUnit, categories, filteredAssessmentItems]);

  const filteredTableData = useMemo(() => {
    if (selectedColorFilter === 'all' || selectedProvince === 'all') return tableData;
    return tableData.filter(row => {
      if (row.type !== 'hospital' && row.type !== 'health_office') return true;
      const passPercentage = getUnitPassPercentage(row.id);
      switch (selectedColorFilter) {
        case 'green': return passPercentage === 100;
        case 'yellow': return passPercentage !== null && passPercentage >= 50 && passPercentage < 100;
        case 'red': return passPercentage !== null && passPercentage < 50;
        case 'gray': return passPercentage === null;
        default: return true;
      }
    });
  }, [tableData, selectedColorFilter, selectedProvince, latestApprovedByUnit, categories, filteredAssessmentItems]);

  const getTitle = () => {
    if (selectedRegion === 'all') return 'คะแนนเฉลี่ยเชิงปริมาณ รายเขตสุขภาพ';
    if (selectedProvince === 'all') {
      const region = healthRegions.find(r => r.id === selectedRegion);
      return `คะแนนเฉลี่ยเชิงปริมาณ รายจังหวัด - เขตสุขภาพที่ ${region?.region_number || ''}`;
    }
    const province = provinces.find(p => p.id === selectedProvince);
    return `คะแนนเชิงปริมาณ รายโรงพยาบาล - ${province?.name || ''}`;
  };

  const formatScore = (catAvg: { average: number | null; passedCount?: number; totalCount?: number }, type: 'hospital' | 'province' | 'region' = 'region') => {
    if (catAvg.average === null) return '-';
    if (type === 'hospital') {
      return catAvg.average === 1 ? 'ผ่าน' : 'ไม่ผ่าน';
    }
    if ((type === 'province' || type === 'region') && catAvg.passedCount !== undefined) {
      return (
        <div className="flex flex-col items-center">
          <span>{catAvg.passedCount}</span>
          <span className="text-xs">({catAvg.average?.toFixed(2)}%)</span>
        </div>
      );
    }
    return catAvg.average.toFixed(2);
  };

  const getScoreColorClass = (score: number | null, type: 'hospital' | 'province' | 'region' = 'region') => {
    if (score === null) return 'text-muted-foreground';
    if (type === 'province' || type === 'region') {
      if (score >= 80) return 'text-green-600 dark:text-green-400 font-medium';
      if (score >= 50) return 'text-yellow-600 dark:text-yellow-400';
      return 'text-red-600 dark:text-red-400';
    }
    if (score >= 0.8) return 'text-green-600 dark:text-green-400 font-medium';
    if (score >= 0.5) return 'text-yellow-600 dark:text-yellow-400';
    return 'text-red-600 dark:text-red-400';
  };

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Header */}
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <TrendingUp className="w-6 h-6 text-primary" />
            CTAM แยกตามพื้นที่
          </h1>
          <p className="text-muted-foreground">คะแนนการประเมินเชิงปริมาณ 17 ข้อ CTAM แยกตามพื้นที่</p>
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
                <label className="text-sm font-medium mb-1.5 block">เขตสุขภาพ</label>
                <Select value={selectedRegion} onValueChange={setSelectedRegion} disabled={isProvincialAdmin}>
                  <SelectTrigger className="h-9 text-sm">
                    <SelectValue placeholder="เลือกเขต" />
                  </SelectTrigger>
                  <SelectContent className="bg-background z-50">
                    {!isProvincialAdmin && (
                      <SelectItem value="all" className="text-sm">
                        <div className="flex items-center gap-2">
                          <MapPin className="w-3.5 h-3.5" />
                          ทุกเขตสุขภาพ
                        </div>
                      </SelectItem>
                    )}
                    {healthRegions.filter(region => {
                      if (isProvincialAdmin && userProvinceId) {
                        const userProvince = provinces.find(p => p.id === userProvinceId);
                        return userProvince?.health_region_id === region.id;
                      }
                      return true;
                    }).map(region => (
                      <SelectItem key={region.id} value={region.id} className="text-sm">
                        เขต {region.region_number}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="w-full sm:w-48">
                <label className="text-sm font-medium mb-1.5 block">จังหวัด</label>
                <Select value={selectedProvince} onValueChange={setSelectedProvince} disabled={selectedRegion === 'all' || isProvincialAdmin}>
                  <SelectTrigger className="h-9 text-sm">
                    <SelectValue placeholder={selectedRegion === 'all' ? 'เลือกเขตก่อน' : 'เลือกจังหวัด'} />
                  </SelectTrigger>
                  <SelectContent className="bg-background z-50">
                    {!isProvincialAdmin && (
                      <SelectItem value="all" className="text-sm">
                        <div className="flex items-center gap-2">
                          <Building2 className="w-3.5 h-3.5" />
                          ทุกจังหวัด
                        </div>
                      </SelectItem>
                    )}
                    {filteredProvinces.map(province => (
                      <SelectItem key={province.id} value={province.id} className="text-sm">
                        {province.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="w-full sm:w-48">
                <label className="text-sm font-medium mb-1.5 block">ปีงบประมาณ</label>
                <Select value={selectedFiscalYear} onValueChange={setSelectedFiscalYear}>
                  <SelectTrigger className="h-9 text-sm">
                    <SelectValue placeholder="เลือกปีงบประมาณ" />
                  </SelectTrigger>
                  <SelectContent className="bg-background z-50">
                    <SelectItem value="all" className="text-sm">ทุกปีงบประมาณ</SelectItem>
                    {fiscalYears.map(year => (
                      <SelectItem key={year} value={year.toString()} className="text-sm">
                        ปีงบประมาณ {year + 543}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Map and Donut Chart Section */}
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
          {/* Thailand Map */}
          <Card className="h-[500px]">
            <CardHeader className="pb-2">
              <CardTitle className="text-base flex items-center gap-2">
                <Map className="w-4 h-4" />
                แผนที่ระดับความปลอดภัยไซเบอร์รายจังหวัด
                {selectedProvince !== 'all' ? (
                  <span className="text-primary font-medium">
                    - {provinces.find(p => p.id === selectedProvince)?.name}
                  </span>
                ) : selectedRegion !== 'all' ? (
                  <span className="text-primary font-medium">
                    - เขตสุขภาพที่ {healthRegions.find(r => r.id === selectedRegion)?.region_number}
                  </span>
                ) : null}
              </CardTitle>
            </CardHeader>
            <CardContent className="h-[calc(100%-60px)]">
              {(() => {
                const provinceMapData: ProvinceData[] = provinces.map(province => {
                  const provinceHospitals = hospitals.filter(h => h.province_id === province.id);
                  const provinceHealthOffices = healthOffices.filter(ho => ho.province_id === province.id);
                  const hospitalIds = provinceHospitals.map(h => h.id);
                  const healthOfficeIds = provinceHealthOffices.map(ho => ho.id);
                  const totalUnits = hospitalIds.length + healthOfficeIds.length;
                  let passedAll17 = 0;
                  let assessed = 0;

                  hospitalIds.forEach(hospitalId => {
                    const latestAssessmentId = latestApprovedByUnit.get(hospitalId)?.id;
                    if (!latestAssessmentId) return;
                    assessed++;
                    const passedAllCategories = categories.every(cat => {
                      const catItems = filteredAssessmentItems.filter(
                        item => item.assessment_id === latestAssessmentId && item.category_id === cat.id
                      );
                      return catItems.some(item => Number(item.score) === 1);
                    });
                    if (passedAllCategories) passedAll17++;
                  });

                  healthOfficeIds.forEach(officeId => {
                    const latestAssessmentId = latestApprovedByUnit.get(officeId)?.id;
                    if (!latestAssessmentId) return;
                    assessed++;
                    const passedAllCategories = categories.every(cat => {
                      const catItems = filteredAssessmentItems.filter(
                        item => item.assessment_id === latestAssessmentId && item.category_id === cat.id
                      );
                      return catItems.some(item => Number(item.score) === 1);
                    });
                    if (passedAllCategories) passedAll17++;
                  });

                  const passedPercentage = totalUnits > 0 ? (passedAll17 / totalUnits) * 100 : null;
                  return {
                    id: province.id,
                    name: province.name,
                    passedPercentage,
                    totalUnits,
                    passedAll17,
                    assessed,
                    healthRegionId: province.health_region_id
                  };
                });

                return (
                  <ThailandMap
                    provinceData={provinceMapData}
                    selectedRegion={selectedRegion}
                    selectedProvince={selectedProvince}
                    onProvinceClick={(provinceId) => {
                      const province = provinces.find(p => p.id === provinceId);
                      if (province) {
                        if (selectedRegion === 'all') {
                          setSelectedRegion(province.health_region_id);
                        }
                        setSelectedProvince(provinceId);
                      }
                    }}
                    healthRegions={healthRegions}
                    provinces={provinces}
                  />
                );
              })()}
            </CardContent>
          </Card>

          {/* Safety Level Donut Chart */}
          <Card className="h-[500px]">
            <CardHeader className="pb-2">
              <CardTitle className="text-base flex items-center gap-2 flex-wrap">
                สัดส่วนระดับความปลอดภัยไซเบอร์ของหน่วยบริการ (รพ. + สสจ./สำนักเขต)
                {selectedProvince !== 'all' ? (
                  <span className="text-primary font-medium">
                    - {provinces.find(p => p.id === selectedProvince)?.name}
                  </span>
                ) : selectedRegion !== 'all' ? (
                  <span className="text-primary font-medium">
                    - เขตสุขภาพที่ {healthRegions.find(r => r.id === selectedRegion)?.region_number}
                  </span>
                ) : null}
              </CardTitle>
            </CardHeader>
            <CardContent>
              {(() => {
                let allHospitalsInScope: Hospital[] = [];
                let allHealthOfficesInScope: HealthOffice[] = [];
                
                if (selectedProvince !== 'all') {
                  allHospitalsInScope = hospitals.filter(h => h.province_id === selectedProvince);
                  allHealthOfficesInScope = healthOffices.filter(ho => ho.province_id === selectedProvince);
                } else if (selectedRegion !== 'all') {
                  const regionProvinces = provinces.filter(p => p.health_region_id === selectedRegion);
                  allHospitalsInScope = hospitals.filter(h => regionProvinces.some(p => p.id === h.province_id));
                  allHealthOfficesInScope = healthOffices.filter(ho => ho.health_region_id === selectedRegion);
                } else {
                  allHospitalsInScope = hospitals;
                  allHealthOfficesInScope = healthOffices;
                }

                const allUnitsInScope = [
                  ...allHospitalsInScope.map(h => ({ id: h.id, type: 'hospital' as const })),
                  ...allHealthOfficesInScope.map(ho => ({ id: ho.id, type: 'health_office' as const }))
                ];

                let greenCount = 0, yellowCount = 0, redCount = 0, grayCount = 0;
                const assessedUnitIds = new Set<string>();

                allUnitsInScope.forEach(unit => {
                  const latestAssessment = latestApprovedByUnit.get(unit.id);
                  if (!latestAssessment) return;
                  const unitCategoryAverages = categories.map(cat => {
                    const catItems = filteredAssessmentItems.filter(
                      item => item.assessment_id === latestAssessment.id && item.category_id === cat.id
                    );
                    if (catItems.length === 0) return { categoryId: cat.id, average: null };
                    const avg = catItems.reduce((sum, item) => sum + Number(item.score), 0) / catItems.length;
                    return { categoryId: cat.id, average: avg };
                  });
                  const passedCount = unitCategoryAverages.filter(c => c.average === 1).length;
                  const totalCount = unitCategoryAverages.filter(c => c.average !== null).length;
                  const passedPercentage = totalCount > 0 ? passedCount / totalCount * 100 : null;
                  if (passedPercentage !== null) {
                    assessedUnitIds.add(unit.id);
                    if (passedPercentage === 100) greenCount++;
                    else if (passedPercentage >= 50) yellowCount++;
                    else redCount++;
                  }
                });

                grayCount = allUnitsInScope.filter(u => !assessedUnitIds.has(u.id)).length;
                const total = greenCount + yellowCount + redCount + grayCount;

                if (total === 0) {
                  return <div className="text-center py-8 text-muted-foreground">ไม่พบข้อมูลหน่วยบริการ</div>;
                }

                const pieData = [
                  { name: 'ปลอดภัยไซเบอร์สูง', shortName: '100%', value: greenCount, color: '#22c55e', percentage: (greenCount / total * 100).toFixed(1) },
                  { name: 'ปลอดภัยต่ำ', shortName: '50-99%', value: yellowCount, color: '#eab308', percentage: (yellowCount / total * 100).toFixed(1) },
                  { name: 'ไม่ปลอดภัย', shortName: '<50%', value: redCount, color: '#ef4444', percentage: (redCount / total * 100).toFixed(1) },
                  { name: 'ยังไม่ประเมิน', shortName: '-', value: grayCount, color: '#9ca3af', percentage: (grayCount / total * 100).toFixed(1) }
                ].filter(d => d.value > 0);

                const renderCustomLabel = ({ cx, cy, midAngle, outerRadius, shortName, value, percentage }: any) => {
                  const RADIAN = Math.PI / 180;
                  const radius = outerRadius + 20;
                  const x = cx + radius * Math.cos(-midAngle * RADIAN);
                  const y = cy + radius * Math.sin(-midAngle * RADIAN);
                  return (
                    <text x={x} y={y} fill="currentColor" textAnchor={x > cx ? 'start' : 'end'} dominantBaseline="central" className="text-xs fill-foreground">
                      {`${shortName} ${value} แห่ง (${percentage}%)`}
                    </text>
                  );
                };

                return (
                  <div className="flex flex-row gap-6 items-center h-[350px]">
                    <div className="flex-1 h-full min-w-[280px]">
                      <ResponsiveContainer width="100%" height="100%">
                        <PieChart>
                          <Pie data={pieData} cx="50%" cy="50%" labelLine={true} label={renderCustomLabel} innerRadius={60} outerRadius={100} fill="#8884d8" dataKey="value" paddingAngle={2}>
                            {pieData.map((entry, index) => <Cell key={`cell-${index}`} fill={entry.color} stroke={entry.color} />)}
                          </Pie>
                          <Tooltip formatter={(value: number, name: string) => [`${value} แห่ง`, name]} />
                        </PieChart>
                      </ResponsiveContainer>
                    </div>
                    <div className="flex flex-col gap-3 min-w-[280px]">
                      <div className="mb-2">
                        <span className="text-2xl font-bold">{total}</span>
                        <span className="text-muted-foreground ml-2 text-sm">หน่วยบริการทั้งหมด (รพ. {allHospitalsInScope.length} + สสจ./สำนักเขต {allHealthOfficesInScope.length})</span>
                      </div>
                      <div className="flex items-center gap-3 py-2 border-b border-border/40">
                        <div className="w-3 h-3 rounded-full bg-green-500 shrink-0" />
                        <span className="text-sm text-foreground">ปลอดภัยสูง (เขียว 100%)</span>
                        <span className="ml-auto text-sm font-bold min-w-[40px] text-right">{greenCount}</span>
                        <span className="text-xs text-muted-foreground w-[50px] text-right">({pieData.find(d => d.name === 'ปลอดภัยไซเบอร์สูง')?.percentage || '0.0'}%)</span>
                      </div>
                      <div className="flex items-center gap-3 py-2 border-b border-border/40">
                        <div className="w-3 h-3 rounded-full bg-yellow-500 shrink-0" />
                        <span className="text-sm text-foreground">ปลอดภัยต่ำ (เขียว 50-99%)</span>
                        <span className="ml-auto text-sm font-bold min-w-[40px] text-right">{yellowCount}</span>
                        <span className="text-xs text-muted-foreground w-[50px] text-right">({pieData.find(d => d.name === 'ปลอดภัยต่ำ')?.percentage || '0.0'}%)</span>
                      </div>
                      <div className="flex items-center gap-3 py-2 border-b border-border/40">
                        <div className="w-3 h-3 rounded-full bg-red-500 shrink-0" />
                        <span className="text-sm text-foreground">ไม่ปลอดภัย (เขียว &lt;50%)</span>
                        <span className="ml-auto text-sm font-bold min-w-[40px] text-right">{redCount}</span>
                        <span className="text-xs text-muted-foreground w-[50px] text-right">({pieData.find(d => d.name === 'ไม่ปลอดภัย')?.percentage || '0.0'}%)</span>
                      </div>
                      <div className="flex items-center gap-3 py-2">
                        <div className="w-3 h-3 rounded-full bg-gray-400 shrink-0" />
                        <span className="text-sm text-foreground">ยังไม่ประเมิน</span>
                        <span className="ml-auto text-sm font-bold min-w-[40px] text-right">{grayCount}</span>
                        <span className="text-xs text-muted-foreground w-[50px] text-right">({pieData.find(d => d.name === 'ยังไม่ประเมิน')?.percentage || '0.0'}%)</span>
                      </div>
                    </div>
                  </div>
                );
              })()}
            </CardContent>
          </Card>
        </div>

        {/* Data Table */}
        <Card>
          <CardHeader>
            <div className="flex flex-col sm:flex-row sm:items-center gap-3">
              <div className="flex items-center gap-3 flex-1">
                {(selectedRegion !== 'all' || selectedProvince !== 'all') && !isProvincialAdmin && (
                  <button onClick={() => {
                    if (selectedProvince !== 'all') {
                      setSelectedProvince('all');
                      setSelectedColorFilter('all');
                    } else if (selectedRegion !== 'all') {
                      setSelectedRegion('all');
                    }
                  }} className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-primary hover:text-primary/80 hover:bg-primary/10 rounded-md transition-colors">
                    <ArrowLeft className="w-4 h-4" />
                    ย้อนกลับ
                  </button>
                )}
                <CardTitle className="text-lg">{getTitle()}</CardTitle>
              </div>
              
              {selectedProvince !== 'all' && (
                <div className="flex items-center gap-2 flex-wrap">
                  <button onClick={() => setSelectedColorFilter('all')} className={`px-3 py-1.5 text-xs font-medium rounded-md border transition-colors ${selectedColorFilter === 'all' ? 'bg-primary text-primary-foreground border-primary' : 'bg-background text-foreground border-border hover:bg-muted'}`}>
                    ทั้งหมด ({colorCounts.all})
                  </button>
                  <button onClick={() => setSelectedColorFilter('red')} className={`px-3 py-1.5 text-xs font-medium rounded-md border transition-colors ${selectedColorFilter === 'red' ? 'bg-red-500 text-white border-red-500' : 'bg-background text-red-600 border-red-300 hover:bg-red-50 dark:hover:bg-red-950'}`}>
                    แดง ({colorCounts.red})
                  </button>
                  <button onClick={() => setSelectedColorFilter('yellow')} className={`px-3 py-1.5 text-xs font-medium rounded-md border transition-colors ${selectedColorFilter === 'yellow' ? 'bg-yellow-500 text-white border-yellow-500' : 'bg-background text-yellow-600 border-yellow-300 hover:bg-yellow-50 dark:hover:bg-yellow-950'}`}>
                    เหลือง ({colorCounts.yellow})
                  </button>
                  <button onClick={() => setSelectedColorFilter('green')} className={`px-3 py-1.5 text-xs font-medium rounded-md border transition-colors ${selectedColorFilter === 'green' ? 'bg-green-500 text-white border-green-500' : 'bg-background text-green-600 border-green-300 hover:bg-green-50 dark:hover:bg-green-950'}`}>
                    เขียว ({colorCounts.green})
                  </button>
                  <button onClick={() => setSelectedColorFilter('gray')} className={`px-3 py-1.5 text-xs font-medium rounded-md border transition-colors ${selectedColorFilter === 'gray' ? 'bg-gray-500 text-white border-gray-500' : 'bg-background text-gray-600 border-gray-300 hover:bg-gray-50 dark:hover:bg-gray-950'}`}>
                    ยังไม่ประเมิน ({colorCounts.gray})
                  </button>
                </div>
              )}
            </div>
          </CardHeader>
          <CardContent>
            {(() => {
              const showSummaryCols = selectedProvince === 'all';
              const isHospitalLevel = selectedProvince !== 'all';
              const sticky = {
                name: 180, hospitalCount: 80, hospitalsAssessed: 100, passedAll17: 100,
                unitQuantScore: 110, unitPassedItems: 110, percentGreen: 200
              } as const;
              const left = {
                name: 0,
                hospitalCount: sticky.name,
                hospitalsAssessed: sticky.name + sticky.hospitalCount,
                passedAll17: sticky.name + sticky.hospitalCount + sticky.hospitalsAssessed,
                unitQuantScore: sticky.name,
                unitPassedItems: sticky.name + sticky.unitQuantScore,
                percentGreen: sticky.name + (showSummaryCols ? sticky.hospitalCount + sticky.hospitalsAssessed + sticky.passedAll17 : isHospitalLevel ? sticky.unitQuantScore + sticky.unitPassedItems : 0)
              } as const;
              const stickyHeaderBase = "sticky z-30 border-r border-border/60";
              const stickyCellBase = "sticky z-20 border-r border-border/60 bg-background";

              if (loading) return <div className="text-center py-12 text-muted-foreground">กำลังโหลดข้อมูล...</div>;
              if (filteredTableData.length === 0) return <div className="text-center py-12 text-muted-foreground">ไม่พบข้อมูล</div>;

              return (
                <div className="space-y-4">
                  <div className="w-full overflow-x-auto">
                    <Table className="min-w-max">
                      <TableHeader>
                        <TableRow className="bg-muted/50">
                          <TableHead className={`${stickyHeaderBase} bg-muted/50 min-w-[180px]`} style={{ left: left.name }}>
                            {selectedProvince !== 'all' ? 'โรงพยาบาล' : selectedRegion !== 'all' ? 'จังหวัด' : 'เขตสุขภาพ'}
                          </TableHead>

                          {showSummaryCols && <TableHead className={`${stickyHeaderBase} bg-muted/50 text-center min-w-[80px]`} style={{ left: left.hospitalCount }}>จำนวน รพ.</TableHead>}
                          {showSummaryCols && <TableHead className={`${stickyHeaderBase} text-center min-w-[100px] bg-blue-100 dark:bg-blue-900/30`} style={{ left: left.hospitalsAssessed }}>
                            <div className="flex flex-col items-center"><span>รพ.ที่ประเมิน</span><span>แล้ว</span></div>
                          </TableHead>}
                          {showSummaryCols && <TableHead className={`${stickyHeaderBase} text-center min-w-[100px] bg-green-100 dark:bg-green-900/30`} style={{ left: left.passedAll17 }}>
                            <div className="flex flex-col items-center"><span>รพ.ผ่านครบ</span><span>17 ข้อ</span></div>
                          </TableHead>}

                          {isHospitalLevel && <TableHead className={`${stickyHeaderBase} text-center min-w-[110px] bg-orange-100 dark:bg-orange-900/30`} style={{ left: left.unitQuantScore }}>
                            <div className="flex flex-col items-center"><span>คะแนนที่ได้</span><span>(เต็ม 7)</span></div>
                          </TableHead>}
                          {isHospitalLevel && <TableHead className={`${stickyHeaderBase} text-center min-w-[110px] bg-green-100 dark:bg-green-900/30`} style={{ left: left.unitPassedItems }}>
                            <div className="flex flex-col items-center"><span>ข้อที่ผ่าน</span><span>(17 ข้อ)</span></div>
                          </TableHead>}

                          <TableHead className={`${stickyHeaderBase} text-center min-w-[200px] bg-primary/10`} style={{ left: left.percentGreen }}>
                            {isHospitalLevel ? (
                              <div className="flex flex-col items-center"><span>ข้อที่ผ่าน</span><span>(ร้อยละ)</span></div>
                            ) : (
                              <div className="flex flex-col items-center"><span>ผ่านร้อยละ</span></div>
                            )}
                          </TableHead>
                        </TableRow>
                      </TableHeader>

                      <TableBody>
                        {filteredTableData.map(row => {
                          const passedCount = row.categoryAverages.filter(c => c.average === 1).length;
                          const totalCount = row.categoryAverages.filter(c => c.average !== null).length;
                          const passedPercentage = totalCount > 0 ? passedCount / totalCount * 100 : null;

                          return (
                            <TableRow key={row.id} className="hover:bg-muted/30">
                              <TableCell className={`${stickyCellBase} font-medium`} style={{ left: left.name, minWidth: sticky.name }}>
                                <div className="flex flex-col">
                                  {row.type === 'region' && (() => {
                                    const canDrill = canDrillToProvince(row.id);
                                    return canDrill ? (
                                      <button onClick={() => setSelectedRegion(row.id)} className="text-left text-primary hover:text-primary/80 hover:underline cursor-pointer font-medium">{row.name}</button>
                                    ) : <span className="text-muted-foreground opacity-50">{row.name}</span>;
                                  })()}
                                  {row.type === 'province' && (() => {
                                    const canDrill = canDrillToHospital(row.id);
                                    return canDrill ? (
                                      <button onClick={() => setSelectedProvince(row.id)} className="text-left text-primary hover:text-primary/80 hover:underline cursor-pointer font-medium">{row.name}</button>
                                    ) : <span className="text-muted-foreground opacity-50">{row.name}</span>;
                                  })()}
                                  {(row.type === 'hospital' || row.type === 'health_office') && <>
                                    <span>{row.name}</span>
                                    {'code' in row && <span className="text-xs text-muted-foreground font-mono">{row.code}</span>}
                                  </>}
                                </div>
                              </TableCell>

                              {showSummaryCols && <TableCell className={`${stickyCellBase} text-center font-medium`} style={{ left: left.hospitalCount, minWidth: sticky.hospitalCount }}>{row.hospitalCount}</TableCell>}
                              {showSummaryCols && <TableCell className={`${stickyCellBase} text-center font-medium bg-blue-50 dark:bg-blue-900/20`} style={{ left: left.hospitalsAssessed, minWidth: sticky.hospitalsAssessed }}>{'hospitalsAssessed' in row ? row.hospitalsAssessed : 0}</TableCell>}
                              
                              {showSummaryCols && <TableCell className={`${stickyCellBase} text-center font-medium bg-green-50 dark:bg-green-900/20`} style={{ left: left.passedAll17, minWidth: sticky.passedAll17 }}>{'hospitalsPassedAll17' in row ? row.hospitalsPassedAll17 : 0}</TableCell>}

                              {isHospitalLevel && (() => {
                                const latestAssessment = latestApprovedByUnit.get(row.id);
                                const quantitativeScore = latestAssessment && latestAssessment.quantitative_score !== null ? Number(latestAssessment.quantitative_score) : null;
                                return <TableCell className={`${stickyCellBase} text-center font-medium bg-orange-50 dark:bg-orange-900/20`} style={{ left: left.unitQuantScore, minWidth: sticky.unitQuantScore }}>
                                  {quantitativeScore !== null ? quantitativeScore.toFixed(2) : '-'}
                                </TableCell>;
                              })()}

                              {isHospitalLevel && (() => {
                                const latestAssessment = latestApprovedByUnit.get(row.id);
                                let unitPassedCount: number | null = null;
                                if (latestAssessment) {
                                  const latestItems = filteredAssessmentItems.filter(item => item.assessment_id === latestAssessment.id);
                                  unitPassedCount = latestItems.filter(item => Number(item.score) === 1).length;
                                }
                                return <TableCell className={`${stickyCellBase} text-center font-medium bg-green-50 dark:bg-green-900/20`} style={{ left: left.unitPassedItems, minWidth: sticky.unitPassedItems }}>
                                  {unitPassedCount !== null ? unitPassedCount : '-'}
                                </TableCell>;
                              })()}

                              <TableCell className={`${stickyCellBase} text-center bg-primary/5`} style={{ left: left.percentGreen, minWidth: 200 }}>
                                {(() => {
                                  let percentage: number;
                                  if ((row.type === 'province' || row.type === 'region') && 'hospitalsPassedAll17' in row) {
                                    percentage = row.hospitalCount > 0 ? (row.hospitalsPassedAll17 as number) / row.hospitalCount * 100 : 0;
                                  } else {
                                    percentage = passedPercentage ?? 0;
                                  }
                                  const colorClass = percentage === 100 ? '[&>div]:bg-green-500' : percentage >= 50 ? '[&>div]:bg-yellow-500' : '[&>div]:bg-red-500';
                                  return (
                                    <div className="flex items-center gap-2">
                                      <Progress value={percentage} className={`h-4 flex-1 ${colorClass}`} />
                                      <span className="text-sm font-medium min-w-[50px] text-right">
                                        {row.hospitalCount > 0 || passedPercentage !== null ? `${percentage.toFixed(1)}%` : '-'}
                                      </span>
                                    </div>
                                  );
                                })()}
                              </TableCell>
                            </TableRow>
                          );
                        })}
                      </TableBody>
                    </Table>
                  </div>

                  <div className="flex flex-wrap items-center gap-6 text-sm text-muted-foreground border border-primary/30 rounded-lg p-4 bg-primary/5">
                    <span className="font-medium text-orange-500">สัญลักษณ์ (ร้อยละรพ.ที่ผ่าน 17 ข้อ) :</span>
                    <div className="flex items-center gap-2">
                      <div className="w-4 h-4 rounded bg-red-500"></div>
                      <span>ผ่านน้อยกว่า 50%</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="w-4 h-4 rounded bg-yellow-500"></div>
                      <span>ผ่าน 50% - 99%</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="w-4 h-4 rounded bg-green-500"></div>
                      <span>ผ่าน 100%</span>
                    </div>
                  </div>
                </div>
              );
            })()}
          </CardContent>
        </Card>

        {/* Category Legend */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">คำอธิบายหัวข้อประเมิน (17 ข้อ CTAM)</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2">
              {categories.map((cat, index) => (
                <div key={cat.id} className="flex items-start gap-2 text-sm">
                  <span className="font-bold text-primary min-w-[40px]">ข้อ {index + 1}</span>
                  <span className="text-muted-foreground">{cat.name_th}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}
