import { useEffect, useState, useMemo } from 'react';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { supabase } from '@/integrations/supabase/client';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { TrendingUp, Filter, ArrowLeft, Download } from 'lucide-react';
import { Button } from '@/components/ui/button';
import * as XLSX from 'xlsx';
import { Progress } from '@/components/ui/progress';
import { toast } from 'sonner';
import { useAuth } from '@/contexts/AuthContext';
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

export default function ReportsQuantitativeByArea() {
  const { profile } = useAuth();
  const [loading, setLoading] = useState(true);
  const [healthRegions, setHealthRegions] = useState<HealthRegion[]>([]);
  const [provinces, setProvinces] = useState<Province[]>([]);
  const [hospitals, setHospitals] = useState<Hospital[]>([]);
  const [healthOffices, setHealthOffices] = useState<HealthOffice[]>([]);
  const [categories, setCategories] = useState<CTAMCategory[]>([]);
  const [assessmentItems, setAssessmentItems] = useState<AssessmentItem[]>([]);
  const [assessments, setAssessments] = useState<Assessment[]>([]);

  const [selectedRegion, setSelectedRegion] = useState<string>('all');
  const [selectedProvince, setSelectedProvince] = useState<string>('all');
  const [selectedFiscalYear, setSelectedFiscalYear] = useState<string>(getCurrentFiscalYear().toString());
  const [selectedSafetyFilter, setSelectedSafetyFilter] = useState<string>('all');
  const [selectedCategoryFilter, setSelectedCategoryFilter] = useState<string>('all');

  const isProvincialAdmin = profile?.role === 'provincial' || profile?.role === 'ceo';
  const userProvinceId = profile?.province_id;

  const { canDrillToProvince, canDrillToHospital } = useReportAccessPolicy('quantitative', provinces, healthOffices);

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
    }
    setSelectedSafetyFilter('all');
  }, [selectedRegion, isProvincialAdmin]);

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

        return {
          id: region.id,
          name: `เขตสุขภาพที่ ${region.region_number}`,
          type: 'region' as const,
          hospitalCount: regionHospitals.length + regionHealthOffices.length,
          hospitalsAssessed: unitsAssessed,
          hospitalsPassedAll17: unitsPassedAll17,
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

        return {
          id: province.id,
          name: province.name,
          type: 'province' as const,
          hospitalCount: provinceHospitals.length + provinceHealthOffices.length,
          hospitalsAssessed: unitsAssessed,
          hospitalsPassedAll17: unitsPassedAll17,
          categoryAverages
        };
      });
    } else {
      const provinceHospitals = hospitals.filter(h => h.province_id === selectedProvince);
      const provinceHealthOffices = healthOffices.filter(ho => ho.province_id === selectedProvince);
      
      const hospitalData = provinceHospitals.map(hospital => {
        const categoryAverages = calculateCategoryAverages([hospital.id], []);
        return {
          id: hospital.id,
          name: hospital.name,
          code: hospital.code,
          type: 'hospital' as const,
          categoryAverages
        };
      });

      const healthOfficeData = provinceHealthOffices.map(office => {
        const categoryAverages = calculateCategoryAverages([], [office.id]);
        return {
          id: office.id,
          name: office.name,
          code: office.code,
          type: 'health_office' as const,
          categoryAverages
        };
      });

      return [...healthOfficeData, ...hospitalData];
    }
  }, [selectedRegion, selectedProvince, healthRegions, provinces, hospitals, healthOffices, categories, filteredAssessmentItems, latestApprovedByUnit]);

  // Safety filter counts and filtered data for hospital-level view
  const { filteredTableData, safetyCounts } = useMemo(() => {
    if (selectedProvince === 'all') {
      return { filteredTableData: tableData, safetyCounts: { all: 0, green: 0, yellow: 0, red: 0, notSubmitted: 0 } };
    }

    let green = 0, yellow = 0, red = 0, notSubmitted = 0;

    const dataWithLevel = tableData.map(row => {
      const latestAssessment = latestApprovedByUnit.get(row.id);
      if (!latestAssessment) {
        notSubmitted++;
        return { ...row, safetyLevel: 'notSubmitted' as const };
      }
      const passedCount = row.categoryAverages.filter(c => c.average === 1).length;
      const totalCount = row.categoryAverages.filter(c => c.average !== null).length;
      const percentage = totalCount > 0 ? (passedCount / totalCount) * 100 : 0;
      if (percentage === 100) { green++; return { ...row, safetyLevel: 'green' as const }; }
      if (percentage >= 50) { yellow++; return { ...row, safetyLevel: 'yellow' as const }; }
      red++;
      return { ...row, safetyLevel: 'red' as const };
    });

    const all = dataWithLevel.length;
    const filtered = selectedSafetyFilter === 'all' ? dataWithLevel : dataWithLevel.filter(r => r.safetyLevel === selectedSafetyFilter);

    return {
      filteredTableData: filtered,
      safetyCounts: { all, green, yellow, red, notSubmitted }
    };
  }, [tableData, selectedProvince, latestApprovedByUnit, selectedSafetyFilter]);

  // Pre-compute failed/passed category sets independently
  const { failedCategoryIds, passedCategoryIds } = useMemo(() => {
    const failed = new Set<string>();
    const passed = new Set<string>();

    categories.forEach(cat => {
      const hasAnyFailed = filteredTableData.some(row => {
        const catAvg = row.categoryAverages.find(c => c.categoryId === cat.id);
        if (!catAvg || catAvg.average === null) return false;
        if (row.type === 'region' || row.type === 'province') return catAvg.average < 100;
        return catAvg.average !== 1;
      });

      const allPassed = filteredTableData.every(row => {
        const catAvg = row.categoryAverages.find(c => c.categoryId === cat.id);
        if (!catAvg || catAvg.average === null) return true;
        if (row.type === 'region' || row.type === 'province') return catAvg.average === 100;
        return catAvg.average === 1;
      });

      if (hasAnyFailed) failed.add(cat.id);
      if (allPassed) passed.add(cat.id);
    });

    return { failedCategoryIds: failed, passedCategoryIds: passed };
  }, [categories, filteredTableData]);

  const filteredCategories = useMemo(() => {
    if (selectedCategoryFilter === 'all') return categories;
    if (selectedCategoryFilter === 'failed') return categories.filter(c => failedCategoryIds.has(c.id));
    if (selectedCategoryFilter === 'passed') return categories.filter(c => passedCategoryIds.has(c.id));
    return categories;
  }, [categories, selectedCategoryFilter, failedCategoryIds, passedCategoryIds]);

  const getTitle = () => {
    if (selectedProvince !== 'all') {
      const province = provinces.find(p => p.id === selectedProvince);
      return `คะแนนเฉลี่ยเชิงปริมาณ จังหวัด${province?.name || ''}`;
    }
    if (selectedRegion !== 'all') {
      const region = healthRegions.find(r => r.id === selectedRegion);
      return `คะแนนเฉลี่ยเชิงปริมาณ เขตสุขภาพที่ ${region?.region_number || ''}`;
    }
    return 'คะแนนเฉลี่ยเชิงปริมาณ รายเขตสุขภาพ';
  };

  const handleExportExcel = () => {
    const title = getTitle();
    const showSummaryCols = selectedProvince === 'all';

    const headers: string[] = [
      selectedProvince !== 'all' ? 'โรงพยาบาล' : selectedRegion !== 'all' ? 'จังหวัด' : 'เขตสุขภาพ',
    ];
    if (selectedProvince !== 'all') headers.push('รหัส');
    if (showSummaryCols) {
      headers.push('จำนวน รพ.', 'รพ.ที่ประเมินแล้ว', 'รพ.ผ่านครบ 17 ข้อ');
    }
    headers.push('ผ่านร้อยละ');
    categories.forEach((cat, i) => headers.push(`ข้อ ${i + 1} ${cat.code}`));

    const rows = filteredTableData.map(row => {
      const passedCount = row.categoryAverages.filter(c => c.average === 1).length;
      const totalCount = row.categoryAverages.filter(c => c.average !== null).length;
      const passedPercentage = totalCount > 0 ? (passedCount / totalCount) * 100 : null;

      let percentage: number;
      if ((row.type === 'province' || row.type === 'region') && 'hospitalsPassedAll17' in row && 'hospitalCount' in row) {
        percentage = row.hospitalCount > 0 ? ((row.hospitalsPassedAll17 as number) / row.hospitalCount) * 100 : 0;
      } else {
        percentage = passedPercentage ?? 0;
      }

      const rowData: (string | number)[] = [row.name];
      if (selectedProvince !== 'all') rowData.push('code' in row ? row.code : '');
      if (showSummaryCols) {
        rowData.push(
          'hospitalCount' in row ? row.hospitalCount : 0,
          'hospitalsAssessed' in row ? row.hospitalsAssessed : 0,
          'hospitalsPassedAll17' in row ? row.hospitalsPassedAll17 : 0,
        );
      }
      rowData.push(Number(percentage.toFixed(1)));

      row.categoryAverages.forEach(catAvg => {
        if (catAvg.average === null) { rowData.push('-'); return; }
        if (row.type === 'region' || row.type === 'province') {
          rowData.push(`${catAvg.passedCount ?? 0} (${catAvg.average?.toFixed(2)}%)`);
        } else {
          rowData.push(catAvg.average === 1 ? 'ผ่าน' : catAvg.average === 0 ? 'ไม่ผ่าน' : Number(catAvg.average.toFixed(2)));
        }
      });

      return rowData;
    });

    const ws = XLSX.utils.aoa_to_sheet([headers, ...rows]);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'CTAM');
    XLSX.writeFile(wb, `${title}.xlsx`);
    toast.success('ส่งออก Excel สำเร็จ');
  };

  const formatScore = (catAvg: { average: number | null; passedCount?: number; totalCount?: number }, rowType: string) => {
    if (catAvg.average === null) return '-';
    if (rowType === 'region' || rowType === 'province') {
      return (
        <div className="flex flex-col">
          <span className="font-medium">{catAvg.passedCount}</span>
          <span className="text-xs text-muted-foreground">({catAvg.average?.toFixed(2)}%)</span>
        </div>
      );
    }
    return catAvg.average === 1 ? '✓' : catAvg.average === 0 ? '✗' : catAvg.average.toFixed(2);
  };

  const getScoreColorClass = (average: number | null, rowType: string) => {
    if (average === null) return 'bg-muted/30';
    if (rowType === 'region' || rowType === 'province') {
      if (average === 100) return 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400';
      if (average >= 50) return 'bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-400';
      return 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400';
    }
    if (average === 1) return 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400';
    if (average === 0) return 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400';
    return 'bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-400';
  };

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-primary/10 rounded-lg">
              <TrendingUp className="h-6 w-6 text-primary" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-foreground">คะแนน 17 ข้อ แยกตามพื้นที่</h1>
              <p className="text-muted-foreground">แสดงคะแนนเฉลี่ยเชิงปริมาณ (17 ข้อ CTAM) แยกตามเขตสุขภาพ จังหวัด และหน่วยบริการ</p>
            </div>
          </div>

          {/* Filters */}
          <div className="flex flex-wrap items-center gap-3">
            <div className="flex items-center gap-2">
              <Filter className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm text-muted-foreground">ตัวกรอง:</span>
            </div>
            <Select value={selectedFiscalYear} onValueChange={setSelectedFiscalYear}>
              <SelectTrigger className="w-[140px]">
                <SelectValue placeholder="ปีงบประมาณ" />
              </SelectTrigger>
              <SelectContent>
                {fiscalYears.map(year => (
                  <SelectItem key={year} value={year.toString()}>
                    ปี {year}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Data Table */}
        <Card>
          <CardHeader>
            <div className="flex items-center gap-3">
              {(selectedRegion !== 'all' || selectedProvince !== 'all') && !isProvincialAdmin && (
                <button
                  onClick={() => {
                    if (selectedProvince !== 'all') {
                      setSelectedProvince('all');
                    } else if (selectedRegion !== 'all') {
                      setSelectedRegion('all');
                    }
                  }}
                  className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-primary hover:text-primary/80 hover:bg-primary/10 rounded-md transition-colors"
                >
                  <ArrowLeft className="w-4 h-4" />
                  ย้อนกลับ
                </button>
              )}
              <CardTitle className="text-lg">{getTitle()}</CardTitle>
              <Button variant="outline" size="sm" onClick={handleExportExcel} className="gap-2 shrink-0">
                <Download className="w-4 h-4" />
                Export Excel
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            {(() => {
              const showSummaryCols = selectedProvince === 'all';
              const sticky = { name: 180, hospitalCount: 80, hospitalsAssessed: 100, passedAll17: 100, percentGreen: 200 } as const;
              const left = {
                name: 0,
                hospitalCount: sticky.name,
                hospitalsAssessed: sticky.name + sticky.hospitalCount,
                passedAll17: sticky.name + sticky.hospitalCount + sticky.hospitalsAssessed,
                percentGreen: sticky.name + (showSummaryCols ? sticky.hospitalCount + sticky.hospitalsAssessed + sticky.passedAll17 : 0)
              } as const;
              const stickyHeaderBase = "sticky z-30 border-r border-border/60";
              const stickyCellBase = "sticky z-20 border-r border-border/60 bg-background";

              if (loading) {
                return <div className="text-center py-12 text-muted-foreground">กำลังโหลดข้อมูล...</div>;
              }

              if (filteredTableData.length === 0 && selectedSafetyFilter === 'all') {
                return <div className="text-center py-12 text-muted-foreground">ไม่พบข้อมูล</div>;
              }

              return (
                <div className="space-y-4">
                  {/* Safety Filter Buttons - show when province selected */}
                  {selectedProvince !== 'all' && (
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-sm font-medium text-muted-foreground mr-1">แยกหน่วยงาน:</span>
                      {[
                        { key: 'all', label: 'ทั้งหมด', count: safetyCounts.all, bg: 'bg-primary text-primary-foreground', outline: 'border-primary text-primary' },
                        { key: 'red', label: 'แดง', count: safetyCounts.red, bg: 'bg-red-500 text-white', outline: 'border-red-500 text-red-500' },
                        { key: 'yellow', label: 'เหลือง', count: safetyCounts.yellow, bg: 'bg-yellow-500 text-white', outline: 'border-yellow-500 text-yellow-600' },
                        { key: 'green', label: 'เขียว', count: safetyCounts.green, bg: 'bg-green-500 text-white', outline: 'border-green-500 text-green-600' },
                        { key: 'notSubmitted', label: 'ยังไม่ประเมิน', count: safetyCounts.notSubmitted, bg: 'bg-gray-400 text-white', outline: 'border-gray-400 text-gray-500' },
                      ].map(f => (
                        <button
                          key={f.key}
                          onClick={() => setSelectedSafetyFilter(f.key)}
                          className={`px-4 py-1.5 rounded-full text-sm font-medium border-2 transition-colors ${
                            selectedSafetyFilter === f.key ? f.bg : `bg-background ${f.outline}`
                          }`}
                        >
                          {f.label} ({f.count})
                        </button>
                      ))}
                    </div>
                  )}

                  {/* Category Filter Buttons (แยกข้อ) */}
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-sm font-medium text-muted-foreground mr-1">แยกข้อ:</span>
                    {[
                      { key: 'all', label: 'แสดงทุกข้อ', bg: 'bg-primary text-primary-foreground', outline: 'border-primary text-primary' },
                      { key: 'failed', label: 'ข้อที่ไม่ผ่าน', bg: 'bg-red-500 text-white', outline: 'border-red-500 text-red-500' },
                      { key: 'passed', label: 'ข้อที่ผ่าน', bg: 'bg-green-500 text-white', outline: 'border-green-500 text-green-600' },
                    ].map(f => (
                      <button
                        key={f.key}
                        onClick={() => setSelectedCategoryFilter(f.key)}
                        className={`px-4 py-1.5 rounded-full text-sm font-medium border-2 transition-colors ${
                          selectedCategoryFilter === f.key ? f.bg : `bg-background ${f.outline}`
                        }`}
                      >
                        {f.label} ({f.key === 'all' ? categories.length : f.key === 'failed' ? failedCategoryIds.size : passedCategoryIds.size})
                      </button>
                    ))}
                  </div>

                  {filteredTableData.length === 0 ? (
                    <div className="text-center py-12 text-muted-foreground">ไม่พบข้อมูลที่ตรงตามตัวกรอง</div>
                  ) : (
                  <div className="w-full overflow-x-auto">
                    <Table className="min-w-max">
                      <TableHeader>
                        <TableRow className="bg-muted/50">
                          <TableHead className={`${stickyHeaderBase} bg-muted/50 min-w-[180px]`} style={{ left: left.name }}>
                            {selectedProvince !== 'all' ? 'โรงพยาบาล' : selectedRegion !== 'all' ? 'จังหวัด' : 'เขตสุขภาพ'}
                          </TableHead>

                          {showSummaryCols && (
                            <TableHead className={`${stickyHeaderBase} bg-muted/50 text-center min-w-[80px]`} style={{ left: left.hospitalCount }}>
                              จำนวน รพ.
                            </TableHead>
                          )}

                          {showSummaryCols && (
                            <TableHead className={`${stickyHeaderBase} text-center min-w-[100px] bg-blue-100 dark:bg-blue-900/30`} style={{ left: left.hospitalsAssessed }}>
                              <div className="flex flex-col items-center">
                                <span>รพ.ที่ประเมิน</span>
                                <span>แล้ว</span>
                              </div>
                            </TableHead>
                          )}

                          {showSummaryCols && (
                            <TableHead className={`${stickyHeaderBase} text-center min-w-[100px] bg-green-100 dark:bg-green-900/30`} style={{ left: left.passedAll17 }}>
                              <div className="flex flex-col items-center">
                                <span>รพ.ผ่านครบ</span>
                                <span>17 ข้อ</span>
                              </div>
                            </TableHead>
                          )}

                          <TableHead className={`${stickyHeaderBase} text-center min-w-[200px] bg-primary/10`} style={{ left: left.percentGreen }}>
                            {selectedProvince !== 'all' ? (
                              <div className="flex flex-col items-center">
                                <span>ข้อที่ผ่าน</span>
                                <span>(ร้อยละ)</span>
                              </div>
                            ) : (
                              <div className="flex flex-col items-center">
                                <span>ผ่านร้อยละ</span>
                              </div>
                            )}
                          </TableHead>

                          {filteredCategories.map(cat => {
                            const originalIndex = categories.findIndex(c => c.id === cat.id);
                            return (
                              <TableHead key={cat.id} className="text-center min-w-[80px] text-xs" title={cat.name_th}>
                                <div className="flex flex-col items-center">
                                  <span className="font-bold">ข้อ {originalIndex + 1}</span>
                                  <span className="text-muted-foreground truncate max-w-[70px]">{cat.code}</span>
                                </div>
                              </TableHead>
                            );
                          })}
                        </TableRow>
                      </TableHeader>

                      <TableBody>
                        {filteredTableData.map(row => {
                          const passedCount = row.categoryAverages.filter(c => c.average === 1).length;
                          const totalCount = row.categoryAverages.filter(c => c.average !== null).length;
                          const passedPercentage = totalCount > 0 ? (passedCount / totalCount) * 100 : null;

                          return (
                            <TableRow key={row.id} className="hover:bg-muted/30">
                              <TableCell className={`${stickyCellBase} font-medium`} style={{ left: left.name, minWidth: sticky.name }}>
                                <div className="flex flex-col">
                                  {row.type === 'region' && (() => {
                                    const canDrill = canDrillToProvince(row.id);
                                    return canDrill ? (
                                      <button onClick={() => setSelectedRegion(row.id)} className="text-left text-primary hover:text-primary/80 hover:underline cursor-pointer font-medium">
                                        {row.name}
                                      </button>
                                    ) : (
                                      <span className="text-muted-foreground opacity-50">{row.name}</span>
                                    );
                                  })()}
                                  {row.type === 'province' && (() => {
                                    const canDrill = canDrillToHospital(row.id);
                                    return canDrill ? (
                                      <button onClick={() => setSelectedProvince(row.id)} className="text-left text-primary hover:text-primary/80 hover:underline cursor-pointer font-medium">
                                        {row.name}
                                      </button>
                                    ) : (
                                      <span className="text-muted-foreground opacity-50">{row.name}</span>
                                    );
                                  })()}
                                  {(row.type === 'hospital' || row.type === 'health_office') && (
                                    <>
                                      <span>{row.name}</span>
                                      {'code' in row && <span className="text-xs text-muted-foreground font-mono">{row.code}</span>}
                                    </>
                                  )}
                                </div>
                              </TableCell>

                              {showSummaryCols && (
                                <TableCell className={`${stickyCellBase} text-center font-medium`} style={{ left: left.hospitalCount, minWidth: sticky.hospitalCount }}>
                                  {'hospitalCount' in row ? row.hospitalCount : '-'}
                                </TableCell>
                              )}

                              {showSummaryCols && (
                                <TableCell className={`${stickyCellBase} text-center font-medium bg-blue-50 dark:bg-blue-900/20`} style={{ left: left.hospitalsAssessed, minWidth: sticky.hospitalsAssessed }}>
                                  {'hospitalsAssessed' in row ? row.hospitalsAssessed : 0}
                                </TableCell>
                              )}

                              {showSummaryCols && (
                                <TableCell className={`${stickyCellBase} text-center font-medium bg-green-50 dark:bg-green-900/20`} style={{ left: left.passedAll17, minWidth: sticky.passedAll17 }}>
                                  {'hospitalsPassedAll17' in row ? row.hospitalsPassedAll17 : 0}
                                </TableCell>
                              )}

                              <TableCell className={`${stickyCellBase} text-center bg-primary/5`} style={{ left: left.percentGreen, minWidth: 200 }}>
                                {(() => {
                                  let percentage: number;
                                  if ((row.type === 'province' || row.type === 'region') && 'hospitalsPassedAll17' in row && 'hospitalCount' in row) {
                                    percentage = row.hospitalCount > 0 ? ((row.hospitalsPassedAll17 as number) / row.hospitalCount) * 100 : 0;
                                  } else {
                                    percentage = passedPercentage ?? 0;
                                  }
                                  const colorClass = percentage === 100 ? '[&>div]:bg-green-500' : percentage >= 50 ? '[&>div]:bg-yellow-500' : '[&>div]:bg-red-500';

                                  const isUnitLevel = row.type === 'hospital' || row.type === 'health_office';
                                  let quantitativeScore: number | null = null;
                                  let unitPassedCount: number | null = null;
                                  if (isUnitLevel) {
                                    const latestAssessment = latestApprovedByUnit.get(row.id);
                                    if (latestAssessment && latestAssessment.quantitative_score !== null) {
                                      quantitativeScore = Number(latestAssessment.quantitative_score);
                                    }
                                    if (latestAssessment) {
                                      const latestAssessmentItems = filteredAssessmentItems.filter(item => item.assessment_id === latestAssessment.id);
                                      unitPassedCount = latestAssessmentItems.filter(item => Number(item.score) === 1).length;
                                    }
                                  }

                                  return (
                                    <div className="flex flex-col gap-1">
                                      <div className="flex items-center gap-2">
                                        <Progress value={percentage} className={`h-4 flex-1 ${colorClass}`} />
                                        <span className="text-sm font-medium min-w-[50px] text-right">
                                          {('hospitalCount' in row && row.hospitalCount > 0) || passedPercentage !== null ? `${percentage.toFixed(1)}%` : '-'}
                                        </span>
                                      </div>
                                      {isUnitLevel && unitPassedCount !== null && quantitativeScore !== null && (
                                        <span className="text-xs text-muted-foreground">
                                          (ผ่าน {unitPassedCount}/17 ข้อ = {quantitativeScore.toFixed(2)}/7 คะแนน)
                                        </span>
                                      )}
                                    </div>
                                  );
                                })()}
                              </TableCell>

                              {row.categoryAverages
                                .filter(catAvg => filteredCategories.some(c => c.id === catAvg.categoryId))
                                .map(catAvg => (
                                <TableCell key={catAvg.categoryId} className={`text-center ${getScoreColorClass(catAvg.average, row.type)}`}>
                                  {formatScore(catAvg, row.type)}
                                </TableCell>
                              ))}
                            </TableRow>
                          );
                        })}
                      </TableBody>
                    </Table>
                  </div>
                  )}

                  {/* Color Legend */}
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
