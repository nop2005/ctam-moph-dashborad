import { useEffect, useState, useMemo } from 'react';
import { PublicLayout } from '@/components/layout/PublicLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { supabase } from '@/integrations/supabase/client';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Progress } from '@/components/ui/progress';
import { TrendingUp, Filter, Building2, MapPin, ArrowLeft } from 'lucide-react';
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

export default function PublicReportsQuantitative() {
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

  const { canDrillToHospital } = usePublicReportAccessPolicy('quantitative');

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

  const filteredAssessmentItems = useMemo(() => {
    const filteredAssessmentIds = new Set(filteredAssessments.map(a => a.id));
    return assessmentItems.filter(item => filteredAssessmentIds.has(item.assessment_id));
  }, [assessmentItems, filteredAssessments]);

  const calculateCategoryAverages = (hospitalIds: string[], healthOfficeIds: string[] = []) => {
    const relevantAssessments = filteredAssessments.filter(a =>
      (a.hospital_id && hospitalIds.includes(a.hospital_id)) ||
      (a.health_office_id && healthOfficeIds.includes(a.health_office_id))
    );
    const totalUnitsInScope = hospitalIds.length + healthOfficeIds.length;

    return categories.map(cat => {
      let passedCount = 0;

      hospitalIds.forEach(hospitalId => {
        const unitAssessments = relevantAssessments.filter(a => a.hospital_id === hospitalId);
        if (unitAssessments.length === 0) return;
        const assessmentIds = unitAssessments.map(a => a.id);
        const catItems = filteredAssessmentItems.filter(item =>
          assessmentIds.includes(item.assessment_id) && item.category_id === cat.id
        );
        if (catItems.length > 0) {
          const hasPassed = catItems.some(item => Number(item.score) === 1);
          if (hasPassed) passedCount++;
        }
      });

      healthOfficeIds.forEach(officeId => {
        const unitAssessments = relevantAssessments.filter(a => a.health_office_id === officeId);
        if (unitAssessments.length === 0) return;
        const assessmentIds = unitAssessments.map(a => a.id);
        const catItems = filteredAssessmentItems.filter(item =>
          assessmentIds.includes(item.assessment_id) && item.category_id === cat.id
        );
        if (catItems.length > 0) {
          const hasPassed = catItems.some(item => Number(item.score) === 1);
          if (hasPassed) passedCount++;
        }
      });

      if (totalUnitsInScope === 0) return { categoryId: cat.id, average: null, passedCount: 0, totalCount: 0 };
      const percentage = (passedCount / totalUnitsInScope) * 100;
      return { categoryId: cat.id, average: percentage, passedCount, totalCount: totalUnitsInScope };
    });
  };

  // Public users: cannot drill to hospital level
  const tableData = useMemo(() => {
    if (selectedRegion === 'all') {
      return healthRegions.map(region => {
        const regionProvinces = provinces.filter(p => p.health_region_id === region.id);
        const regionHospitals = hospitals.filter(h => regionProvinces.some(p => p.id === h.province_id));
        const regionHealthOffices = healthOffices.filter(ho => ho.health_region_id === region.id);
        const hospitalIds = regionHospitals.map(h => h.id);
        const healthOfficeIds = regionHealthOffices.map(ho => ho.id);
        const categoryAverages = calculateCategoryAverages(hospitalIds, healthOfficeIds);

        let unitsPassedAll17 = 0;
        hospitalIds.forEach(hospitalId => {
          const unitAssessments = filteredAssessments.filter(a => a.hospital_id === hospitalId);
          if (unitAssessments.length === 0) return;
          const assessmentIds = unitAssessments.map(a => a.id);
          let passedAllCategories = true;
          categories.forEach(cat => {
            const catItems = filteredAssessmentItems.filter(item => assessmentIds.includes(item.assessment_id) && item.category_id === cat.id);
            const hasPassed = catItems.some(item => Number(item.score) === 1);
            if (!hasPassed) passedAllCategories = false;
          });
          if (passedAllCategories) unitsPassedAll17++;
        });
        healthOfficeIds.forEach(officeId => {
          const unitAssessments = filteredAssessments.filter(a => a.health_office_id === officeId);
          if (unitAssessments.length === 0) return;
          const assessmentIds = unitAssessments.map(a => a.id);
          let passedAllCategories = true;
          categories.forEach(cat => {
            const catItems = filteredAssessmentItems.filter(item => assessmentIds.includes(item.assessment_id) && item.category_id === cat.id);
            const hasPassed = catItems.some(item => Number(item.score) === 1);
            if (!hasPassed) passedAllCategories = false;
          });
          if (passedAllCategories) unitsPassedAll17++;
        });

        return {
          id: region.id,
          name: `เขตสุขภาพที่ ${region.region_number}`,
          type: 'region' as const,
          hospitalCount: regionHospitals.length + regionHealthOffices.length,
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
        const categoryAverages = calculateCategoryAverages(hospitalIds, healthOfficeIds);

        let unitsPassedAll17 = 0;
        hospitalIds.forEach(hospitalId => {
          const unitAssessments = filteredAssessments.filter(a => a.hospital_id === hospitalId);
          if (unitAssessments.length === 0) return;
          const assessmentIds = unitAssessments.map(a => a.id);
          let passedAllCategories = true;
          categories.forEach(cat => {
            const catItems = filteredAssessmentItems.filter(item => assessmentIds.includes(item.assessment_id) && item.category_id === cat.id);
            const hasPassed = catItems.some(item => Number(item.score) === 1);
            if (!hasPassed) passedAllCategories = false;
          });
          if (passedAllCategories) unitsPassedAll17++;
        });
        healthOfficeIds.forEach(officeId => {
          const unitAssessments = filteredAssessments.filter(a => a.health_office_id === officeId);
          if (unitAssessments.length === 0) return;
          const assessmentIds = unitAssessments.map(a => a.id);
          let passedAllCategories = true;
          categories.forEach(cat => {
            const catItems = filteredAssessmentItems.filter(item => assessmentIds.includes(item.assessment_id) && item.category_id === cat.id);
            const hasPassed = catItems.some(item => Number(item.score) === 1);
            if (!hasPassed) passedAllCategories = false;
          });
          if (passedAllCategories) unitsPassedAll17++;
        });

        return {
          id: province.id,
          name: province.name,
          type: 'province' as const,
          hospitalCount: provinceHospitals.length + provinceHealthOffices.length,
          hospitalsPassedAll17: unitsPassedAll17,
          categoryAverages
        };
      });
    }
    return [];
  }, [selectedRegion, selectedProvince, healthRegions, provinces, hospitals, healthOffices, categories, filteredAssessments, filteredAssessmentItems]);

  const handleRowClick = (id: string, type: string) => {
    if (type === 'region') {
      setSelectedRegion(id);
    } else if (type === 'province') {
      // Public users cannot drill to hospital level
      toast.info('กรุณาเข้าสู่ระบบเพื่อดูรายละเอียดรายโรงพยาบาล');
    }
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
            <p className="text-muted-foreground">สรุปผลการประเมินเชิงปริมาณตาม 17 หมวดหมู่ (สำหรับผู้ใช้ทั่วไป)</p>
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
                      <TableHead className="sticky left-0 bg-background z-10">
                        {selectedRegion === 'all' ? 'เขตสุขภาพ' : 'จังหวัด'}
                      </TableHead>
                      <TableHead className="text-center">จำนวนหน่วยงานทั้งหมด</TableHead>
                      <TableHead className="text-center">ผ่านครบ 17 ข้อ</TableHead>
                      <TableHead className="text-center min-w-[180px]">ผ่านร้อยละ</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {tableData.map((row) => (
                      <TableRow
                        key={row.id}
                        className="cursor-pointer hover:bg-muted/50"
                        onClick={() => handleRowClick(row.id, row.type)}
                      >
                        <TableCell className="font-medium sticky left-0 bg-background z-10 text-primary hover:underline">
                          {row.name}
                        </TableCell>
                        <TableCell className="text-center">{row.hospitalCount}</TableCell>
                        <TableCell className="text-center">{row.hospitalsPassedAll17}</TableCell>
                        <TableCell className="text-center">
                          <div className="flex items-center gap-2">
                            <Progress 
                              value={row.hospitalCount > 0 ? (row.hospitalsPassedAll17 / row.hospitalCount) * 100 : 0} 
                              className="h-4 flex-1" 
                            />
                            <span className="text-sm font-medium min-w-[50px] text-right">
                              {row.hospitalCount > 0 
                                ? `${((row.hospitalsPassedAll17 / row.hospitalCount) * 100).toFixed(1)}%` 
                                : '-'}
                            </span>
                          </div>
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
    </PublicLayout>
  );
}
