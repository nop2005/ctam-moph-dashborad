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
import { TrendingUp, Filter, Building2, MapPin, ArrowLeft } from 'lucide-react';
import { toast } from 'sonner';
import { useAuth } from '@/contexts/AuthContext';
import { PieChart, Pie, Cell, ResponsiveContainer, Legend, Tooltip } from 'recharts';

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
  // numeric columns can come back as string
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

// Helper function to get current fiscal year (Oct 1 - Sep 30)
const getCurrentFiscalYear = (): number => {
  const now = new Date();
  const month = now.getMonth(); // 0-11
  const year = now.getFullYear();
  // If current month is October (9) or later, fiscal year is next year
  // Otherwise, fiscal year is current year
  return month >= 9 ? year + 1 : year;
};

// Generate list of fiscal years for the filter
const generateFiscalYears = (assessments: Assessment[]): number[] => {
  const years = new Set<number>();
  const currentFiscalYear = getCurrentFiscalYear();
  
  // Add current fiscal year
  years.add(currentFiscalYear);
  
  // Add years from assessments
  assessments.forEach(a => {
    if (a.fiscal_year) years.add(a.fiscal_year);
  });
  
  return Array.from(years).sort((a, b) => b - a); // Sort descending
};

export default function ReportsQuantitative() {
  const { profile } = useAuth();
  const [loading, setLoading] = useState(true);
  const [healthRegions, setHealthRegions] = useState<HealthRegion[]>([]);
  const [provinces, setProvinces] = useState<Province[]>([]);
  const [hospitals, setHospitals] = useState<Hospital[]>([]);
  const [healthOffices, setHealthOffices] = useState<HealthOffice[]>([]);
  const [categories, setCategories] = useState<CTAMCategory[]>([]);
  const [assessmentItems, setAssessmentItems] = useState<AssessmentItem[]>([]);
  const [assessments, setAssessments] = useState<Assessment[]>([]);

  // Filters
  const [selectedRegion, setSelectedRegion] = useState<string>('all');
  const [selectedProvince, setSelectedProvince] = useState<string>('all');
  const [selectedFiscalYear, setSelectedFiscalYear] = useState<string>(getCurrentFiscalYear().toString());

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

      // NOTE: Supabase has a default 1000-row limit per request; we page until exhausted.
      // eslint-disable-next-line no-constant-condition
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
          supabase.from('ctam_categories').select('*').order('order_number'),
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
          supabase
            .from('assessments')
            .select('id, hospital_id, health_office_id, status, fiscal_year, quantitative_score, created_at')
            .order('created_at', { ascending: true })
        );

        const itemsAll = await fetchAll<AssessmentItem>(
          supabase
            .from('assessment_items')
            .select('id, assessment_id, category_id, score, created_at')
            .order('created_at', { ascending: true })
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
    
    // Provincial admin can only see their own province
    if (isProvincialAdmin && userProvinceId) {
      return regionProvinces.filter(p => p.id === userProvinceId);
    }
    
    return regionProvinces;
  }, [selectedRegion, provinces, isProvincialAdmin, userProvinceId]);

  // Reset province when region changes (only for non-provincial admin)
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

  // Filter assessment items by filtered assessments
  const filteredAssessmentItems = useMemo(() => {
    const filteredAssessmentIds = new Set(filteredAssessments.map(a => a.id));
    return assessmentItems.filter(item => filteredAssessmentIds.has(item.assessment_id));
  }, [assessmentItems, filteredAssessments]);

  // Calculate pass percentage per category for a set of hospital IDs and health office IDs
  // For province level: returns percentage of units that passed (score = 1) each category
  // totalCount = ALL units in scope (including those without assessments)
  // For unit level: returns the actual score (1 = pass, 0 = fail)
  const calculateCategoryAverages = (hospitalIds: string[], healthOfficeIds: string[] = [], isProvinceLevel: boolean = false) => {
    const relevantAssessments = filteredAssessments.filter(a => 
      (a.hospital_id && hospitalIds.includes(a.hospital_id)) ||
      (a.health_office_id && healthOfficeIds.includes(a.health_office_id))
    );
    const totalUnitsInScope = hospitalIds.length + healthOfficeIds.length;
    
    return categories.map(cat => {
      if (isProvinceLevel) {
        // For province level: calculate percentage of units that passed this category
        let passedCount = 0;
        
        // Check hospitals
        hospitalIds.forEach(hospitalId => {
          const unitAssessments = relevantAssessments.filter(a => a.hospital_id === hospitalId);
          if (unitAssessments.length === 0) return;
          
          const assessmentIds = unitAssessments.map(a => a.id);
          const catItems = filteredAssessmentItems.filter(
            item => assessmentIds.includes(item.assessment_id) && item.category_id === cat.id
          );
          
          if (catItems.length > 0) {
            const hasPassed = catItems.some(item => Number(item.score) === 1);
            if (hasPassed) passedCount++;
          }
        });
        
        // Check health offices
        healthOfficeIds.forEach(officeId => {
          const unitAssessments = relevantAssessments.filter(a => a.health_office_id === officeId);
          if (unitAssessments.length === 0) return;
          
          const assessmentIds = unitAssessments.map(a => a.id);
          const catItems = filteredAssessmentItems.filter(
            item => assessmentIds.includes(item.assessment_id) && item.category_id === cat.id
          );
          
          if (catItems.length > 0) {
            const hasPassed = catItems.some(item => Number(item.score) === 1);
            if (hasPassed) passedCount++;
          }
        });
        
        if (totalUnitsInScope === 0) return { categoryId: cat.id, average: null, passedCount: 0, totalCount: 0 };
        const percentage = (passedCount / totalUnitsInScope) * 100;
        return { categoryId: cat.id, average: percentage, passedCount, totalCount: totalUnitsInScope };
      } else {
        // For unit level: use original average calculation
        const assessmentIds = relevantAssessments.map(a => a.id);
        const relevantItems = filteredAssessmentItems.filter(item => assessmentIds.includes(item.assessment_id));
        const catItems = relevantItems.filter(item => item.category_id === cat.id);
        if (catItems.length === 0) return { categoryId: cat.id, average: null };
        const avg = catItems.reduce((sum, item) => sum + Number(item.score), 0) / catItems.length;
        return { categoryId: cat.id, average: avg };
      }
    });
  };

  // Determine what to display based on filters
  const tableData = useMemo(() => {
    if (selectedRegion === 'all') {
      // Show all regions with averages - same format as province level
      return healthRegions.map(region => {
        const regionProvinces = provinces.filter(p => p.health_region_id === region.id);
        const regionHospitals = hospitals.filter(h => 
          regionProvinces.some(p => p.id === h.province_id)
        );
        const regionHealthOffices = healthOffices.filter(ho => ho.health_region_id === region.id);
        const hospitalIds = regionHospitals.map(h => h.id);
        const healthOfficeIds = regionHealthOffices.map(ho => ho.id);
        const categoryAverages = calculateCategoryAverages(hospitalIds, healthOfficeIds, true);
        
        // Calculate units that passed all 17 items (green)
        let unitsPassedAll17 = 0;
        
        // Check hospitals
        hospitalIds.forEach(hospitalId => {
          const unitAssessments = filteredAssessments.filter(a => a.hospital_id === hospitalId);
          if (unitAssessments.length === 0) return;
          
          const assessmentIds = unitAssessments.map(a => a.id);
          let passedAllCategories = true;
          
          categories.forEach(cat => {
            const catItems = filteredAssessmentItems.filter(
              item => assessmentIds.includes(item.assessment_id) && item.category_id === cat.id
            );
            const hasPassed = catItems.some(item => Number(item.score) === 1);
            if (!hasPassed) passedAllCategories = false;
          });
          
          if (passedAllCategories) unitsPassedAll17++;
        });
        
        // Check health offices
        healthOfficeIds.forEach(officeId => {
          const unitAssessments = filteredAssessments.filter(a => a.health_office_id === officeId);
          if (unitAssessments.length === 0) return;
          
          const assessmentIds = unitAssessments.map(a => a.id);
          let passedAllCategories = true;
          
          categories.forEach(cat => {
            const catItems = filteredAssessmentItems.filter(
              item => assessmentIds.includes(item.assessment_id) && item.category_id === cat.id
            );
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
          categoryAverages,
        };
      });
    } else if (selectedProvince === 'all') {
      // Show provinces in selected region
      const regionProvinces = provinces.filter(p => p.health_region_id === selectedRegion);
      return regionProvinces.map(province => {
        const provinceHospitals = hospitals.filter(h => h.province_id === province.id);
        const provinceHealthOffices = healthOffices.filter(ho => ho.province_id === province.id);
        const hospitalIds = provinceHospitals.map(h => h.id);
        const healthOfficeIds = provinceHealthOffices.map(ho => ho.id);
        const categoryAverages = calculateCategoryAverages(hospitalIds, healthOfficeIds, true);
        
        // Calculate units that passed all 17 items
        let unitsPassedAll17 = 0;
        
        // Check hospitals
        hospitalIds.forEach(hospitalId => {
          const unitAssessments = filteredAssessments.filter(a => a.hospital_id === hospitalId);
          if (unitAssessments.length === 0) return;
          
          const assessmentIds = unitAssessments.map(a => a.id);
          let passedAllCategories = true;
          
          categories.forEach(cat => {
            const catItems = filteredAssessmentItems.filter(
              item => assessmentIds.includes(item.assessment_id) && item.category_id === cat.id
            );
            const hasPassed = catItems.some(item => Number(item.score) === 1);
            if (!hasPassed) passedAllCategories = false;
          });
          
          if (passedAllCategories) unitsPassedAll17++;
        });
        
        // Check health offices
        healthOfficeIds.forEach(officeId => {
          const unitAssessments = filteredAssessments.filter(a => a.health_office_id === officeId);
          if (unitAssessments.length === 0) return;
          
          const assessmentIds = unitAssessments.map(a => a.id);
          let passedAllCategories = true;
          
          categories.forEach(cat => {
            const catItems = filteredAssessmentItems.filter(
              item => assessmentIds.includes(item.assessment_id) && item.category_id === cat.id
            );
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
          categoryAverages,
        };
      });
    } else {
      // Show hospitals and health offices in selected province
      const provinceHospitals = hospitals.filter(h => h.province_id === selectedProvince);
      const provinceHealthOffices = healthOffices.filter(ho => ho.province_id === selectedProvince);
      
      const hospitalRows = provinceHospitals.map(hospital => {
        const categoryAverages = calculateCategoryAverages([hospital.id], []);

        return {
          id: hospital.id,
          name: hospital.name,
          code: hospital.code,
          type: 'hospital' as const,
          hospitalCount: 1,
          categoryAverages,
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
          categoryAverages,
        };
      });
      
      return [...hospitalRows, ...healthOfficeRows];
    }
  }, [selectedRegion, selectedProvince, healthRegions, provinces, hospitals, healthOffices, categories, filteredAssessments, filteredAssessmentItems]);

  // Get title based on filter state
  const getTitle = () => {
    if (selectedRegion === 'all') {
      return 'คะแนนเฉลี่ยเชิงปริมาณ รายเขตสุขภาพ';
    } else if (selectedProvince === 'all') {
      const region = healthRegions.find(r => r.id === selectedRegion);
      return `คะแนนเฉลี่ยเชิงปริมาณ รายจังหวัด - เขตสุขภาพที่ ${region?.region_number || ''}`;
    } else {
      const province = provinces.find(p => p.id === selectedProvince);
      return `คะแนนเชิงปริมาณ รายโรงพยาบาล - ${province?.name || ''}`;
    }
  };

  // Format score display - show "ผ่าน" for 1, "ไม่ผ่าน" for 0 or other values
  const formatScore = (
    catAvg: { average: number | null; passedCount?: number; totalCount?: number }, 
    type: 'hospital' | 'province' | 'region' = 'region'
  ) => {
    if (catAvg.average === null) return '-';
    // For hospital level, show ผ่าน/ไม่ผ่าน
    if (type === 'hospital') {
      if (catAvg.average === 1) return 'ผ่าน';
      return 'ไม่ผ่าน';
    }
    // For province and region level, show passedCount on first line, (percentage%) on second line
    if ((type === 'province' || type === 'region') && catAvg.passedCount !== undefined) {
      return (
        <div className="flex flex-col items-center">
          <span>{catAvg.passedCount}</span>
          <span className="text-xs">({catAvg.average?.toFixed(2)}%)</span>
        </div>
      );
    }
    // Fallback
    return catAvg.average.toFixed(2);
  };

  // Get score color class - adjusted for province/region level (percentage 0-100)
  const getScoreColorClass = (score: number | null, type: 'hospital' | 'province' | 'region' = 'region') => {
    if (score === null) return 'text-muted-foreground';
    
    if (type === 'province' || type === 'region') {
      // Province and Region level uses percentage (0-100)
      if (score >= 80) return 'text-green-600 dark:text-green-400 font-medium';
      if (score >= 50) return 'text-yellow-600 dark:text-yellow-400';
      return 'text-red-600 dark:text-red-400';
    }
    
    // Hospital level uses 0-1 scale
    if (score >= 0.8) return 'text-green-600 dark:text-green-400 font-medium';
    if (score >= 0.5) return 'text-yellow-600 dark:text-yellow-400';
    return 'text-red-600 dark:text-red-400';
  };

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-2">
              <TrendingUp className="w-6 h-6 text-primary" />
              รายงานเชิงปริมาณ
            </h1>
            <p className="text-muted-foreground">คะแนนการประเมินเชิงปริมาณ 17 ข้อ CTAM</p>
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
                <label className="text-sm font-medium mb-1.5 block">เขตสุขภาพ</label>
                <Select 
                  value={selectedRegion} 
                  onValueChange={setSelectedRegion}
                  disabled={isProvincialAdmin}
                >
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
                    {healthRegions
                      .filter(region => {
                        if (isProvincialAdmin && userProvinceId) {
                          const userProvince = provinces.find(p => p.id === userProvinceId);
                          return userProvince?.health_region_id === region.id;
                        }
                        return true;
                      })
                      .map((region) => (
                        <SelectItem key={region.id} value={region.id} className="text-sm">
                          เขต {region.region_number}
                        </SelectItem>
                      ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="w-full sm:w-48">
                <label className="text-sm font-medium mb-1.5 block">จังหวัด</label>
                <Select 
                  value={selectedProvince} 
                  onValueChange={setSelectedProvince}
                  disabled={selectedRegion === 'all' || isProvincialAdmin}
                >
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
                    {filteredProvinces.map((province) => (
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
                    {fiscalYears.map((year) => (
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

        {/* Safety Level Donut Chart */}
        <Card className="max-w-5xl">
          <CardHeader className="pb-2">
            <CardTitle className="text-base">สัดส่วนระดับความปลอดภัยไซเบอร์ของโรงพยาบาล</CardTitle>
          </CardHeader>
          <CardContent>
            {(() => {
              // Get all hospitals in selected province (if selected), otherwise all hospitals
              let allHospitalsInScope: Hospital[] = [];
              if (selectedProvince !== 'all') {
                allHospitalsInScope = hospitals.filter(h => h.province_id === selectedProvince);
              } else if (selectedRegion !== 'all') {
                const regionProvinces = provinces.filter(p => p.health_region_id === selectedRegion);
                allHospitalsInScope = hospitals.filter(h => regionProvinces.some(p => p.id === h.province_id));
              } else {
                allHospitalsInScope = hospitals;
              }
              
              // Calculate safety level distribution from all hospitals
              const hospitalRows = tableData.filter(row => row.type === 'hospital');
              let greenCount = 0;
              let yellowCount = 0;
              let redCount = 0;
              let grayCount = 0;
              
              // Assessed hospitals
              const assessedHospitalIds = new Set<string>();
              hospitalRows.forEach(row => {
                const passedCount = row.categoryAverages.filter(c => c.average === 1).length;
                const totalCount = row.categoryAverages.filter(c => c.average !== null).length;
                const passedPercentage = totalCount > 0 ? (passedCount / totalCount) * 100 : null;
                
                if (passedPercentage !== null) {
                  assessedHospitalIds.add(row.id);
                  if (passedPercentage === 100) greenCount++;
                  else if (passedPercentage >= 50) yellowCount++;
                  else redCount++;
                }
              });
              
              // Count unassessed hospitals
              grayCount = allHospitalsInScope.filter(h => !assessedHospitalIds.has(h.id)).length;
              
              const total = greenCount + yellowCount + redCount + grayCount;
              
              if (total === 0) {
                return <div className="text-center py-8 text-muted-foreground">ไม่พบข้อมูลโรงพยาบาล (กรุณาเลือกจังหวัดเพื่อดูข้อมูล)</div>;
              }
              
              const pieData = [
                { name: 'ปลอดภัยไซเบอร์สูง', shortName: '100%', value: greenCount, color: '#22c55e', percentage: ((greenCount / total) * 100).toFixed(1) },
                { name: 'ปลอดภัยต่ำ', shortName: '50-99%', value: yellowCount, color: '#eab308', percentage: ((yellowCount / total) * 100).toFixed(1) },
                { name: 'ไม่ปลอดภัย', shortName: '<50%', value: redCount, color: '#ef4444', percentage: ((redCount / total) * 100).toFixed(1) },
                { name: 'ยังไม่ประเมิน', shortName: '-', value: grayCount, color: '#9ca3af', percentage: ((grayCount / total) * 100).toFixed(1) },
              ].filter(d => d.value > 0);
              
              // Custom label renderer for outside labels
              const renderCustomLabel = ({ cx, cy, midAngle, outerRadius, name, shortName, value, percentage }: any) => {
                const RADIAN = Math.PI / 180;
                const radius = outerRadius + 25;
                const x = cx + radius * Math.cos(-midAngle * RADIAN);
                const y = cy + radius * Math.sin(-midAngle * RADIAN);
                
                return (
                  <text
                    x={x}
                    y={y}
                    fill="currentColor"
                    textAnchor={x > cx ? 'start' : 'end'}
                    dominantBaseline="central"
                    className="text-xs fill-foreground"
                  >
                    {`${shortName} ${value} รพ. (${percentage}%)`}
                  </text>
                );
              };
              
              return (
                <div className="flex flex-col md:flex-row items-start gap-4">
                  <div className="w-full md:w-auto h-[280px] min-w-[480px] flex-shrink-0">
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie
                          data={pieData}
                          cx="50%"
                          cy="50%"
                          labelLine={true}
                          label={renderCustomLabel}
                          innerRadius={50}
                          outerRadius={80}
                          fill="#8884d8"
                          dataKey="value"
                          paddingAngle={2}
                        >
                          {pieData.map((entry, index) => (
                            <Cell key={`cell-${index}`} fill={entry.color} stroke={entry.color} />
                          ))}
                        </Pie>
                        <Tooltip 
                          formatter={(value: number, name: string) => [`${value} รพ.`, name]}
                        />
                      </PieChart>
                    </ResponsiveContainer>
                  </div>
                  <div className="space-y-3 w-fit">
                    <div>
                      <span className="text-xl font-bold">{total}</span>
                      <span className="text-muted-foreground ml-2 text-sm">โรงพยาบาลทั้งหมด</span>
                    </div>
                    <div className="space-y-2">
                      <div className="flex items-center gap-3 p-2 rounded-lg bg-green-50 dark:bg-green-950/30 whitespace-nowrap">
                        <div className="w-3 h-3 rounded-full bg-green-500 shrink-0" />
                        <span className="text-sm font-medium text-green-700 dark:text-green-400">ปลอดภัยสูง (100%)</span>
                        <span className="ml-auto text-sm font-bold">{greenCount}</span>
                        <span className="text-xs text-muted-foreground">({((greenCount / total) * 100).toFixed(1)}%)</span>
                      </div>
                      <div className="flex items-center gap-3 p-2 rounded-lg bg-yellow-50 dark:bg-yellow-950/30 whitespace-nowrap">
                        <div className="w-3 h-3 rounded-full bg-yellow-500 shrink-0" />
                        <span className="text-sm font-medium text-yellow-700 dark:text-yellow-400">ปลอดภัยต่ำ (50-99%)</span>
                        <span className="ml-auto text-sm font-bold">{yellowCount}</span>
                        <span className="text-xs text-muted-foreground">({((yellowCount / total) * 100).toFixed(1)}%)</span>
                      </div>
                      <div className="flex items-center gap-3 p-2 rounded-lg bg-red-50 dark:bg-red-950/30 whitespace-nowrap">
                        <div className="w-3 h-3 rounded-full bg-red-500 shrink-0" />
                        <span className="text-sm font-medium text-red-700 dark:text-red-400">ไม่ปลอดภัย (&lt;50%)</span>
                        <span className="ml-auto text-sm font-bold">{redCount}</span>
                        <span className="text-xs text-muted-foreground">({((redCount / total) * 100).toFixed(1)}%)</span>
                      </div>
                      <div className="flex items-center gap-3 p-2 rounded-lg bg-gray-50 dark:bg-gray-950/30 whitespace-nowrap">
                        <div className="w-3 h-3 rounded-full bg-gray-400 shrink-0" />
                        <span className="text-sm font-medium text-gray-700 dark:text-gray-400">ยังไม่ประเมิน</span>
                        <span className="ml-auto text-sm font-bold">{grayCount}</span>
                        <span className="text-xs text-muted-foreground">({((grayCount / total) * 100).toFixed(1)}%)</span>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })()}
          </CardContent>
        </Card>

        {/* Data Table */}
        <Card>
          <CardHeader>
            <div className="flex items-center gap-3">
              {/* Back button - show when drilling down */}
              {(selectedRegion !== 'all' || selectedProvince !== 'all') && !isProvincialAdmin && (
                <button
                  onClick={() => {
                    if (selectedProvince !== 'all') {
                      // Go back to province list
                      setSelectedProvince('all');
                    } else if (selectedRegion !== 'all') {
                      // Go back to region list
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
            </div>
          </CardHeader>
          <CardContent>
            {(() => {
              const showSummaryCols = selectedProvince === 'all';
              const sticky = {
                name: 180,
                hospitalCount: 80,
                passedAll17: 100,
                percentGreen: 80,
                level: 60,
              } as const;

              const left = {
                name: 0,
                hospitalCount: sticky.name,
                passedAll17: sticky.name + sticky.hospitalCount,
                percentGreen: sticky.name + (showSummaryCols ? sticky.hospitalCount + sticky.passedAll17 : 0),
                level:
                  sticky.name +
                  (showSummaryCols ? sticky.hospitalCount + sticky.passedAll17 + sticky.percentGreen : sticky.percentGreen),
              } as const;

              const stickyHeaderBase = "sticky z-30 border-r border-border/60";
              const stickyCellBase = "sticky z-20 border-r border-border/60 bg-background";

              if (loading) {
                return <div className="text-center py-12 text-muted-foreground">กำลังโหลดข้อมูล...</div>;
              }

              if (tableData.length === 0) {
                return <div className="text-center py-12 text-muted-foreground">ไม่พบข้อมูล</div>;
              }

              return (
                <div className="w-full overflow-x-auto">
                  <Table className="min-w-max">
                    <TableHeader>
                      <TableRow className="bg-muted/50">
                        <TableHead
                          className={`${stickyHeaderBase} bg-muted/50 min-w-[180px]`}
                          style={{ left: left.name }}
                        >
                          {selectedProvince !== 'all' ? 'โรงพยาบาล' : selectedRegion !== 'all' ? 'จังหวัด' : 'เขตสุขภาพ'}
                        </TableHead>

                        {showSummaryCols && (
                          <TableHead
                            className={`${stickyHeaderBase} bg-muted/50 text-center min-w-[80px]`}
                            style={{ left: left.hospitalCount }}
                          >
                            จำนวน รพ.
                          </TableHead>
                        )}

                        {showSummaryCols && (
                          <TableHead
                            className={`${stickyHeaderBase} text-center min-w-[100px] bg-green-100 dark:bg-green-900/30`}
                            style={{ left: left.passedAll17 }}
                          >
                            <div className="flex flex-col items-center">
                              <span>รพ.ผ่านครบ</span>
                              <span>17 ข้อ</span>
                            </div>
                          </TableHead>
                        )}

                        <TableHead
                          className={`${stickyHeaderBase} text-center min-w-[80px] bg-primary/10`}
                          style={{ left: left.percentGreen }}
                        >
                          {selectedProvince !== 'all' ? (
                            <div className="flex flex-col items-center">
                              <span>ร้อยละ</span>
                              <span>ข้อที่ผ่าน</span>
                            </div>
                          ) : (
                            <div className="flex flex-col items-center">
                              <span>ร้อยละรพ.</span>
                              <span>ที่ผ่าน (เขียว)</span>
                            </div>
                          )}
                        </TableHead>

                        <TableHead
                          className={`${stickyHeaderBase} text-center min-w-[60px] ${
                            showSummaryCols ? 'bg-green-100 dark:bg-green-900/30' : 'bg-primary/10'
                          }`}
                          style={{ left: left.level }}
                        >
                          ระดับ
                        </TableHead>

                        {categories.map((cat, index) => (
                          <TableHead
                            key={cat.id}
                            className="text-center min-w-[80px] text-xs"
                            title={cat.name_th}
                          >
                            <div className="flex flex-col items-center">
                              <span className="font-bold">ข้อ {index + 1}</span>
                              <span className="text-muted-foreground truncate max-w-[70px]">{cat.code}</span>
                            </div>
                          </TableHead>
                        ))}
                      </TableRow>
                    </TableHeader>

                    <TableBody>
                      {tableData.map((row) => {
                        const passedCount = row.categoryAverages.filter((c) => c.average === 1).length;
                        const totalCount = row.categoryAverages.filter((c) => c.average !== null).length;
                        const passedPercentage = totalCount > 0 ? (passedCount / totalCount) * 100 : null;

                        return (
                          <TableRow key={row.id} className="hover:bg-muted/30">
                            <TableCell
                              className={`${stickyCellBase} font-medium`}
                              style={{ left: left.name, minWidth: sticky.name }}
                            >
                              <div className="flex flex-col">
                                {row.type === 'region' && (
                                  <button
                                    onClick={() => setSelectedRegion(row.id)}
                                    className="text-left text-primary hover:text-primary/80 hover:underline cursor-pointer font-medium"
                                  >
                                    {row.name}
                                  </button>
                                )}
                                {row.type === 'province' && (
                                  <button
                                    onClick={() => setSelectedProvince(row.id)}
                                    className="text-left text-primary hover:text-primary/80 hover:underline cursor-pointer font-medium"
                                  >
                                    {row.name}
                                  </button>
                                )}
                                {row.type === 'hospital' && (
                                  <>
                                    <span>{row.name}</span>
                                    {'code' in row && (
                                      <span className="text-xs text-muted-foreground font-mono">{row.code}</span>
                                    )}
                                  </>
                                )}
                              </div>
                            </TableCell>

                            {showSummaryCols && (
                              <TableCell
                                className={`${stickyCellBase} text-center font-medium`}
                                style={{ left: left.hospitalCount, minWidth: sticky.hospitalCount }}
                              >
                                {row.hospitalCount}
                              </TableCell>
                            )}

                            {showSummaryCols && (
                              <TableCell
                                className={`${stickyCellBase} text-center font-medium bg-green-50 dark:bg-green-900/20`}
                                style={{ left: left.passedAll17, minWidth: sticky.passedAll17 }}
                              >
                                {'hospitalsPassedAll17' in row ? row.hospitalsPassedAll17 : 0}
                              </TableCell>
                            )}

                            <TableCell
                              className={`${stickyCellBase} text-center bg-primary/5 font-bold`}
                              style={{ left: left.percentGreen, minWidth: sticky.percentGreen }}
                            >
                              {(row.type === 'province' || row.type === 'region') && 'hospitalsPassedAll17' in row ? (
                                <span
                                  className={
                                    (row.hospitalsPassedAll17 as number) > 0
                                      ? 'text-green-600 dark:text-green-400'
                                      : 'text-red-600 dark:text-red-400'
                                  }
                                >
                                  {row.hospitalCount > 0
                                    ? (((row.hospitalsPassedAll17 as number) / row.hospitalCount) * 100).toFixed(2)
                                    : 0}
                                  %
                                </span>
                              ) : passedPercentage !== null ? (
                                `${passedPercentage.toFixed(0)}%`
                              ) : (
                                '-'
                              )}
                            </TableCell>

                            <TableCell
                              className={`${stickyCellBase} text-center ${
                                showSummaryCols ? 'bg-green-50 dark:bg-green-900/20' : ''
                              }`}
                              style={{ left: left.level, minWidth: sticky.level }}
                            >
                              {(() => {
                                if ((row.type === 'province' || row.type === 'region') && 'hospitalsPassedAll17' in row) {
                                  const greenPercentage =
                                    row.hospitalCount > 0
                                      ? ((row.hospitalsPassedAll17 as number) / row.hospitalCount) * 100
                                      : 0;
                                  return (
                                    <div
                                      className={`w-6 h-6 rounded-full mx-auto ${
                                        greenPercentage === 100
                                          ? 'bg-green-500'
                                          : greenPercentage >= 50
                                            ? 'bg-yellow-500'
                                            : 'bg-red-500'
                                      }`}
                                    />
                                  );
                                }
                                return passedPercentage !== null ? (
                                  <div
                                    className={`w-6 h-6 rounded-full mx-auto ${
                                      passedPercentage === 100
                                        ? 'bg-green-500'
                                        : passedPercentage >= 50
                                          ? 'bg-yellow-500'
                                          : 'bg-red-500'
                                    }`}
                                  />
                                ) : (
                                  '-'
                                );
                              })()}
                            </TableCell>

                            {row.categoryAverages.map((catAvg) => (
                              <TableCell
                                key={catAvg.categoryId}
                                className={`text-center ${getScoreColorClass(catAvg.average, row.type)}`}
                              >
                                {formatScore(catAvg, row.type)}
                              </TableCell>
                            ))}
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
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
