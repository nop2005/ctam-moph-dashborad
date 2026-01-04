import { useEffect, useState, useMemo } from 'react';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { supabase } from '@/integrations/supabase/client';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { ListOrdered, Filter, ArrowUpDown, ArrowUp, ArrowDown } from 'lucide-react';
import { toast } from 'sonner';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { useReportAccessPolicy } from '@/hooks/useReportAccessPolicy';
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
type SortOrder = 'asc' | 'desc' | 'default';
type ViewLevel = 'country' | 'region' | 'province' | 'hospital';

// Helper function to get current fiscal year (Oct 1 - Sep 30)
const getCurrentFiscalYear = (): number => {
  const now = new Date();
  const month = now.getMonth();
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
export default function ReportsQuantitativeDetail() {
  const {
    profile
  } = useAuth();
  const [loading, setLoading] = useState(true);
  const [healthRegions, setHealthRegions] = useState<HealthRegion[]>([]);
  const [provinces, setProvinces] = useState<Province[]>([]);
  const [hospitals, setHospitals] = useState<Hospital[]>([]);
  const [healthOffices, setHealthOffices] = useState<HealthOffice[]>([]);
  const [categories, setCategories] = useState<CTAMCategory[]>([]);
  const [assessmentItems, setAssessmentItems] = useState<AssessmentItem[]>([]);
  const [assessments, setAssessments] = useState<Assessment[]>([]);

  // Filters
  const [selectedFiscalYear, setSelectedFiscalYear] = useState<string>(getCurrentFiscalYear().toString());
  const [viewLevel, setViewLevel] = useState<ViewLevel>('country');
  const [selectedRegion, setSelectedRegion] = useState<string>('all');
  const [selectedProvince, setSelectedProvince] = useState<string>('all');

  // Sorting
  const [sortOrder, setSortOrder] = useState<SortOrder>('default');

  // Check user role for access control
  const isProvincialAdmin = profile?.role === 'provincial';
  const isHospitalIT = profile?.role === 'hospital_it';
  const isHealthOffice = profile?.role === 'health_office';
  const userProvinceId = profile?.province_id;
  const userRegionId = profile?.health_region_id;
  const userHospitalId = profile?.hospital_id;
  const userHealthOfficeId = profile?.health_office_id;

  // Report access policy
  const {
    canDrillToProvince,
    canDrillToHospital,
    canViewSameProvinceHospitals
  } = useReportAccessPolicy('quantitative', provinces, healthOffices);

  // Fetch data
  useEffect(() => {
    const fetchAll = async <T,>(query: any): Promise<T[]> => {
      const pageSize = 1000;
      let from = 0;
      const all: T[] = [];
      while (true) {
        const {
          data,
          error
        } = await query.range(from, from + pageSize - 1);
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
        const [regionsRes, provincesRes, hospitalsRes, healthOfficesRes, categoriesRes] = await Promise.all([supabase.from('health_regions').select('*').order('region_number'), supabase.from('provinces').select('*').order('name'), supabase.from('hospitals').select('*').order('name'), supabase.from('health_offices').select('*').order('name'), supabase.from('ctam_categories').select('*').order('order_number')]);
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
        const assessmentsAll = await fetchAll<Assessment>(supabase.from('assessments').select('id, hospital_id, health_office_id, status, fiscal_year, quantitative_score, created_at').order('created_at', {
          ascending: true
        }));
        const itemsAll = await fetchAll<AssessmentItem>(supabase.from('assessment_items').select('id, assessment_id, category_id, score, created_at').order('created_at', {
          ascending: true
        }));
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

  // Set initial filters based on user role
  useEffect(() => {
    if (provinces.length > 0) {
      // Provincial admin: start at their province level
      if (isProvincialAdmin && userProvinceId) {
        const userProvince = provinces.find(p => p.id === userProvinceId);
        if (userProvince) {
          setSelectedRegion(userProvince.health_region_id);
          setSelectedProvince(userProvinceId);
          setViewLevel('province');
        }
      }
      // Hospital IT and Health Office: can view country-wide data (no filter restriction)
      // They can see aggregated data from all units, not just their own
    }
  }, [isProvincialAdmin, userProvinceId, provinces]);

  // Filter provinces based on selected region
  const filteredProvinces = useMemo(() => {
    if (selectedRegion === 'all') return provinces;
    const regionProvinces = provinces.filter(p => p.health_region_id === selectedRegion);
    if (isProvincialAdmin && userProvinceId) {
      return regionProvinces.filter(p => p.id === userProvinceId);
    }
    return regionProvinces;
  }, [selectedRegion, provinces, isProvincialAdmin, userProvinceId]);

  // Generate fiscal years from assessments
  const fiscalYears = useMemo(() => generateFiscalYears(assessments), [assessments]);

  // Filter assessments by fiscal year
  const filteredAssessments = useMemo(() => {
    if (selectedFiscalYear === 'all') return assessments;
    return assessments.filter(a => a.fiscal_year === parseInt(selectedFiscalYear));
  }, [assessments, selectedFiscalYear]);

  // Filter assessment items by filtered assessments
  const filteredAssessmentItems = useMemo(() => {
    const filteredAssessmentIds = new Set(filteredAssessments.map(a => a.id));
    return assessmentItems.filter(item => filteredAssessmentIds.has(item.assessment_id));
  }, [assessmentItems, filteredAssessments]);

  // Calculate pass percentage per category based on scope
  const calculateCategoryStats = useMemo(() => {
    // Determine which hospitals/health offices are in scope
    let hospitalIds: string[] = [];
    let healthOfficeIds: string[] = [];
    if (viewLevel === 'country') {
      hospitalIds = hospitals.map(h => h.id);
      healthOfficeIds = healthOffices.map(ho => ho.id);
    } else if (viewLevel === 'region' && selectedRegion !== 'all') {
      const regionProvinces = provinces.filter(p => p.health_region_id === selectedRegion);
      hospitalIds = hospitals.filter(h => regionProvinces.some(p => p.id === h.province_id)).map(h => h.id);
      healthOfficeIds = healthOffices.filter(ho => ho.health_region_id === selectedRegion).map(ho => ho.id);
    } else if (viewLevel === 'province' && selectedProvince !== 'all') {
      hospitalIds = hospitals.filter(h => h.province_id === selectedProvince).map(h => h.id);
      healthOfficeIds = healthOffices.filter(ho => ho.province_id === selectedProvince).map(ho => ho.id);
    } else if (viewLevel === 'hospital' && selectedProvince !== 'all') {
      hospitalIds = hospitals.filter(h => h.province_id === selectedProvince).map(h => h.id);
      healthOfficeIds = healthOffices.filter(ho => ho.province_id === selectedProvince).map(ho => ho.id);
    }
    const totalUnitsInScope = hospitalIds.length + healthOfficeIds.length;
    const relevantAssessments = filteredAssessments.filter(a => a.hospital_id && hospitalIds.includes(a.hospital_id) || a.health_office_id && healthOfficeIds.includes(a.health_office_id));

    // Create a map to get the latest assessment for each unit
    const latestAssessmentByUnit = new Map<string, Assessment>();
    relevantAssessments.forEach(a => {
      const unitKey = a.hospital_id || a.health_office_id;
      if (unitKey) {
        const existing = latestAssessmentByUnit.get(unitKey);
        // Keep the assessment (since they're already sorted by created_at ascending, last one is latest)
        latestAssessmentByUnit.set(unitKey, a);
      }
    });
    const latestAssessmentIds = new Set(Array.from(latestAssessmentByUnit.values()).map(a => a.id));
    return categories.map(cat => {
      let passedCount = 0;
      let failedCount = 0;
      let assessedCount = 0;

      // Get all assessment items for this category from the latest assessments
      const categoryItems = filteredAssessmentItems.filter(item => latestAssessmentIds.has(item.assessment_id) && item.category_id === cat.id);

      // Count pass/fail for each unique assessment (unit)
      const processedAssessments = new Set<string>();
      categoryItems.forEach(item => {
        if (processedAssessments.has(item.assessment_id)) return;
        processedAssessments.add(item.assessment_id);
        const score = Number(item.score);
        if (score === 1) {
          passedCount++;
        } else {
          failedCount++;
        }
        assessedCount++;
      });
      const passPercentage = assessedCount > 0 ? passedCount / assessedCount * 100 : 0;
      return {
        categoryId: cat.id,
        code: cat.code,
        name: cat.name_th,
        orderNumber: cat.order_number,
        passedCount,
        failedCount,
        assessedCount,
        totalUnits: totalUnitsInScope,
        passPercentage
      };
    });
  }, [categories, hospitals, healthOffices, provinces, viewLevel, selectedRegion, selectedProvince, filteredAssessments, filteredAssessmentItems]);

  // Sort category stats based on sortOrder
  const sortedCategoryStats = useMemo(() => {
    const stats = [...calculateCategoryStats];
    if (sortOrder === 'default') {
      return stats.sort((a, b) => a.orderNumber - b.orderNumber);
    } else if (sortOrder === 'asc') {
      return stats.sort((a, b) => a.passPercentage - b.passPercentage);
    } else {
      return stats.sort((a, b) => b.passPercentage - a.passPercentage);
    }
  }, [calculateCategoryStats, sortOrder]);

  // Toggle sort order
  const toggleSortOrder = () => {
    if (sortOrder === 'default') setSortOrder('asc');else if (sortOrder === 'asc') setSortOrder('desc');else setSortOrder('default');
  };

  // Get sort icon
  const getSortIcon = () => {
    if (sortOrder === 'asc') return <ArrowUp className="w-4 h-4" />;
    if (sortOrder === 'desc') return <ArrowDown className="w-4 h-4" />;
    return <ArrowUpDown className="w-4 h-4" />;
  };

  // Get title based on view level
  const getTitle = () => {
    if (viewLevel === 'country') return 'รายงานรายข้อ - ภาพรวมทั้งประเทศ';
    if (viewLevel === 'region') {
      const region = healthRegions.find(r => r.id === selectedRegion);
      return `รายงานรายข้อ - เขตสุขภาพที่ ${region?.region_number || ''}`;
    }
    if (viewLevel === 'province') {
      const province = provinces.find(p => p.id === selectedProvince);
      return `รายงานรายข้อ - ${province?.name || ''}`;
    }
    const province = provinces.find(p => p.id === selectedProvince);
    return `รายงานรายข้อ - ${province?.name || ''} (รายโรงพยาบาล)`;
  };

  // Get progress color class
  const getProgressColorClass = (percentage: number) => {
    if (percentage >= 80) return 'bg-green-500';
    if (percentage >= 50) return 'bg-yellow-500';
    return 'bg-red-500';
  };
  return <DashboardLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-2">รายงาน CTAM+ เพิ่มเติม (รายข้อ 17 ข้อ)<ListOrdered className="w-6 h-6 text-primary" />
              รายงานเพิ่มเติม (รายข้อ 17 ข้อ)
            </h1>
            <p className="text-muted-foreground">แสดงผลการประเมินแยกรายข้อ พร้อมเรียงลำดับตามคะแนน</p>
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
            <div className="flex flex-col sm:flex-row gap-4 flex-wrap">
              <div className="w-full sm:w-48">
                <label className="text-sm font-medium mb-1.5 block">ระดับการดู</label>
                <Select value={viewLevel} onValueChange={(value: ViewLevel) => {
                setViewLevel(value);
                if (value === 'country') {
                  setSelectedRegion('all');
                  setSelectedProvince('all');
                }
              }} disabled={isProvincialAdmin}>
                  <SelectTrigger className="h-9 text-sm">
                    <SelectValue placeholder="เลือกระดับ" />
                  </SelectTrigger>
                  <SelectContent className="bg-background z-50">
                    {!isProvincialAdmin && <SelectItem value="country" className="text-sm">ภาพรวมประเทศ</SelectItem>}
                    {!isProvincialAdmin && <SelectItem value="region" className="text-sm">รายเขตสุขภาพ</SelectItem>}
                    <SelectItem value="province" className="text-sm">รายจังหวัด</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {(viewLevel === 'region' || viewLevel === 'province' || viewLevel === 'hospital') && <div className="w-full sm:w-48">
                  <label className="text-sm font-medium mb-1.5 block">เขตสุขภาพ</label>
                  <Select value={selectedRegion} onValueChange={value => {
                setSelectedRegion(value);
                setSelectedProvince('all');
              }} disabled={isProvincialAdmin}>
                    <SelectTrigger className="h-9 text-sm">
                      <SelectValue placeholder="เลือกเขต" />
                    </SelectTrigger>
                    <SelectContent className="bg-background z-50">
                      {healthRegions.filter(region => {
                    if (isProvincialAdmin && userProvinceId) {
                      const userProvince = provinces.find(p => p.id === userProvinceId);
                      return userProvince?.health_region_id === region.id;
                    }
                    return true;
                  }).map(region => <SelectItem key={region.id} value={region.id} className="text-sm">
                          เขต {region.region_number}
                        </SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>}

              {(viewLevel === 'province' || viewLevel === 'hospital') && selectedRegion !== 'all' && <div className="w-full sm:w-48">
                  <label className="text-sm font-medium mb-1.5 block">จังหวัด</label>
                  <Select value={selectedProvince} onValueChange={setSelectedProvince} disabled={isProvincialAdmin}>
                    <SelectTrigger className="h-9 text-sm">
                      <SelectValue placeholder="เลือกจังหวัด" />
                    </SelectTrigger>
                    <SelectContent className="bg-background z-50">
                      {filteredProvinces.map(province => <SelectItem key={province.id} value={province.id} className="text-sm">
                          {province.name}
                        </SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>}

              <div className="w-full sm:w-48">
                <label className="text-sm font-medium mb-1.5 block">ปีงบประมาณ</label>
                <Select value={selectedFiscalYear} onValueChange={setSelectedFiscalYear}>
                  <SelectTrigger className="h-9 text-sm">
                    <SelectValue placeholder="เลือกปีงบประมาณ" />
                  </SelectTrigger>
                  <SelectContent className="bg-background z-50">
                    <SelectItem value="all" className="text-sm">ทุกปีงบประมาณ</SelectItem>
                    {fiscalYears.map(year => <SelectItem key={year} value={year.toString()} className="text-sm">
                        ปีงบประมาณ {year + 543}
                      </SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Data Table */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="text-base flex items-center gap-2">
                <ListOrdered className="w-4 h-4" />
                {getTitle()}
              </CardTitle>
              <Button variant="outline" size="sm" onClick={toggleSortOrder} className="flex items-center gap-2">
                {getSortIcon()}
                <span className="text-sm">
                  {sortOrder === 'default' && 'เรียงตามลำดับข้อ'}
                  {sortOrder === 'asc' && 'น้อยไปมาก'}
                  {sortOrder === 'desc' && 'มากไปน้อย'}
                </span>
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            {loading ? <div className="text-center py-8 text-muted-foreground">กำลังโหลดข้อมูล...</div> : sortedCategoryStats.length === 0 ? <div className="text-center py-8 text-muted-foreground">ไม่พบข้อมูล</div> : <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-16 text-center">ข้อที่</TableHead>
                      <TableHead>หมวด</TableHead>
                      <TableHead className="w-32 text-center">ผ่าน</TableHead>
                      <TableHead className="w-32 text-center">ไม่ผ่าน</TableHead>
                      <TableHead className="w-32 text-center">ประเมินแล้ว</TableHead>
                      <TableHead className="w-32 text-center">ทั้งหมด</TableHead>
                      <TableHead className="w-48">เปอร์เซ็นต์ผ่าน</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {sortedCategoryStats.map((stat, index) => <TableRow key={stat.categoryId}>
                        <TableCell className="text-center font-medium">
                          {stat.orderNumber}
                        </TableCell>
                        <TableCell>
                          <div>
                            <div className="font-medium">{stat.code}</div>
                            <div className="text-xs text-muted-foreground line-clamp-2">{stat.name}</div>
                          </div>
                        </TableCell>
                        <TableCell className="text-center">
                          <span className="text-green-600 dark:text-green-400 font-medium">
                            {stat.passedCount}
                          </span>
                        </TableCell>
                        <TableCell className="text-center">
                          <span className="text-red-600 dark:text-red-400 font-medium">
                            {stat.failedCount}
                          </span>
                        </TableCell>
                        <TableCell className="text-center">
                          {stat.assessedCount}
                        </TableCell>
                        <TableCell className="text-center text-muted-foreground">
                          {stat.totalUnits}
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <div className="relative h-2 flex-1 overflow-hidden rounded-full bg-secondary">
                              <div className={`h-full transition-all ${getProgressColorClass(stat.passPercentage)}`} style={{
                          width: `${stat.passPercentage}%`
                        }} />
                            </div>
                            <span className="text-sm font-medium w-16 text-right">
                              {stat.passPercentage.toFixed(1)}%
                            </span>
                          </div>
                        </TableCell>
                      </TableRow>)}
                  </TableBody>
                </Table>
              </div>}
          </CardContent>
        </Card>

        {/* Legend */}
        <Card>
          <CardContent className="pt-4">
            <div className="flex flex-wrap gap-4 text-sm">
              <div className="flex items-center gap-2">
                <div className="w-4 h-2 rounded bg-green-500"></div>
                <span>≥80% (ปลอดภัยสูง)</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-4 h-2 rounded bg-yellow-500"></div>
                <span>50-79% (ปลอดภัยปานกลาง)</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-4 h-2 rounded bg-red-500"></div>
                <span>&lt;50% (ต้องปรับปรุง)</span>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>;
}