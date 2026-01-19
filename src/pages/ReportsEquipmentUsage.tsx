import { useEffect, useState, useMemo } from 'react';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { supabase } from '@/integrations/supabase/client';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Wrench, Filter } from 'lucide-react';
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
  description: string | null;
}

interface Assessment {
  id: string;
  hospital_id: string | null;
  health_office_id: string | null;
  status: string;
  fiscal_year: number;
}

type ViewLevel = 'country' | 'region' | 'province';

// Equipment type mapping
const EQUIPMENT_TYPES = [
  { key: 'private', label: 'เอกชน', color: '#3b82f6' },
  { key: 'opensource', label: 'พัฒนาเอง/Open Source', color: '#10b981' },
  { key: 'mixed', label: 'ร่วมกัน', color: '#f59e0b' },
  { key: 'other', label: 'อื่นๆ', color: '#8b5cf6' },
];

// Helper function to extract equipment type from description
const extractEquipmentType = (description: string | null): string | null => {
  if (!description) return null;
  const match = description.match(/\[(private|opensource|mixed|other)\]/);
  return match ? match[1] : null;
};

// Helper function to get current fiscal year
const getCurrentFiscalYear = (): number => {
  const now = new Date();
  const month = now.getMonth();
  const year = now.getFullYear();
  return month >= 9 ? year + 1 : year;
};

// Generate list of fiscal years
const generateFiscalYears = (assessments: Assessment[]): number[] => {
  const years = new Set<number>();
  const currentFiscalYear = getCurrentFiscalYear();
  years.add(currentFiscalYear);
  assessments.forEach(a => {
    if (a.fiscal_year) years.add(a.fiscal_year);
  });
  return Array.from(years).sort((a, b) => b - a);
};

export default function ReportsEquipmentUsage() {
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
  const [selectedFiscalYear, setSelectedFiscalYear] = useState<string>(getCurrentFiscalYear().toString());
  const [viewLevel, setViewLevel] = useState<ViewLevel>('country');
  const [selectedRegion, setSelectedRegion] = useState<string>('all');
  const [selectedProvince, setSelectedProvince] = useState<string>('all');

  const isProvincialAdmin = profile?.role === 'provincial';
  const userProvinceId = profile?.province_id;

  // Fetch data
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
          supabase.from('assessments').select('id, hospital_id, health_office_id, status, fiscal_year, created_at').order('created_at', { ascending: true })
        );
        const itemsAll = await fetchAll<AssessmentItem>(
          supabase.from('assessment_items').select('id, assessment_id, category_id, description, created_at').order('created_at', { ascending: true })
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

  // Set initial filters based on user role
  useEffect(() => {
    if (provinces.length > 0 && isProvincialAdmin && userProvinceId) {
      const userProvince = provinces.find(p => p.id === userProvinceId);
      if (userProvince) {
        setSelectedRegion(userProvince.health_region_id);
        setSelectedProvince(userProvinceId);
        setViewLevel('province');
      }
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

  // Generate fiscal years
  const fiscalYears = useMemo(() => generateFiscalYears(assessments), [assessments]);

  // Filter assessments by fiscal year
  const filteredAssessments = useMemo(() => {
    if (selectedFiscalYear === 'all') return assessments;
    return assessments.filter(a => a.fiscal_year === parseInt(selectedFiscalYear));
  }, [assessments, selectedFiscalYear]);

  // Calculate equipment usage stats
  const equipmentStats = useMemo(() => {
    // Determine which units are in scope
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
    }

    // Get relevant assessments
    const relevantAssessments = filteredAssessments.filter(
      a => (a.hospital_id && hospitalIds.includes(a.hospital_id)) ||
           (a.health_office_id && healthOfficeIds.includes(a.health_office_id))
    );

    // Get latest assessment for each unit
    const latestAssessmentByUnit = new Map<string, Assessment>();
    relevantAssessments.forEach(a => {
      const unitKey = a.hospital_id || a.health_office_id;
      if (unitKey) {
        latestAssessmentByUnit.set(unitKey, a);
      }
    });

    const latestAssessmentIds = new Set(Array.from(latestAssessmentByUnit.values()).map(a => a.id));

    // Filter assessment items
    const relevantItems = assessmentItems.filter(item => latestAssessmentIds.has(item.assessment_id));

    // Calculate stats for each category
    return categories.map(cat => {
      const categoryItems = relevantItems.filter(item => item.category_id === cat.id);
      
      const counts = {
        private: 0,
        opensource: 0,
        mixed: 0,
        other: 0,
        total: 0,
      };

      // Count unique assessments for each equipment type
      const processedAssessments = new Set<string>();
      categoryItems.forEach(item => {
        if (processedAssessments.has(item.assessment_id)) return;
        processedAssessments.add(item.assessment_id);
        
        const equipmentType = extractEquipmentType(item.description);
        if (equipmentType && equipmentType in counts) {
          counts[equipmentType as keyof typeof counts]++;
        }
        counts.total++;
      });

      return {
        categoryId: cat.id,
        code: cat.code,
        name: cat.name_th,
        orderNumber: cat.order_number,
        ...counts,
      };
    });
  }, [categories, hospitals, healthOffices, provinces, viewLevel, selectedRegion, selectedProvince, filteredAssessments, assessmentItems]);

  // Calculate overall pie chart data
  const pieChartData = useMemo(() => {
    const totals = {
      private: 0,
      opensource: 0,
      mixed: 0,
      other: 0,
    };

    equipmentStats.forEach(stat => {
      totals.private += stat.private;
      totals.opensource += stat.opensource;
      totals.mixed += stat.mixed;
      totals.other += stat.other;
    });

    const total = totals.private + totals.opensource + totals.mixed + totals.other;

    return EQUIPMENT_TYPES.map(type => ({
      name: type.label,
      value: totals[type.key as keyof typeof totals],
      color: type.color,
      percentage: total > 0 ? ((totals[type.key as keyof typeof totals] / total) * 100).toFixed(1) : '0',
    }));
  }, [equipmentStats]);

  // Get title based on filters
  const getTitle = () => {
    if (viewLevel === 'country') return 'รายงานการใช้อุปกรณ์ - ภาพรวมทั้งประเทศ';
    if (viewLevel === 'region') {
      const region = healthRegions.find(r => r.id === selectedRegion);
      return `รายงานการใช้อุปกรณ์ - เขตสุขภาพที่ ${region?.region_number || ''}`;
    }
    const province = provinces.find(p => p.id === selectedProvince);
    return `รายงานการใช้อุปกรณ์ - ${province?.name || ''}`;
  };

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-2">
              <Wrench className="w-6 h-6 text-primary" />
              รายงานการใช้อุปกรณ์/ซอฟต์แวร์
            </h1>
            <p className="text-muted-foreground">แสดงสัดส่วนการใช้อุปกรณ์และซอฟต์แวร์แต่ละประเภทในแต่ละหมวด</p>
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
                <Select 
                  value={viewLevel} 
                  onValueChange={(value: ViewLevel) => {
                    setViewLevel(value);
                    if (value === 'country') {
                      setSelectedRegion('all');
                      setSelectedProvince('all');
                    }
                  }}
                  disabled={isProvincialAdmin}
                >
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

              {(viewLevel === 'region' || viewLevel === 'province') && (
                <div className="w-full sm:w-48">
                  <label className="text-sm font-medium mb-1.5 block">เขตสุขภาพ</label>
                  <Select 
                    value={selectedRegion} 
                    onValueChange={(value) => {
                      setSelectedRegion(value);
                      setSelectedProvince('all');
                    }}
                    disabled={isProvincialAdmin}
                  >
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
                      }).map(region => (
                        <SelectItem key={region.id} value={region.id} className="text-sm">
                          เขต {region.region_number}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}

              {viewLevel === 'province' && selectedRegion !== 'all' && (
                <div className="w-full sm:w-48">
                  <label className="text-sm font-medium mb-1.5 block">จังหวัด</label>
                  <Select 
                    value={selectedProvince} 
                    onValueChange={setSelectedProvince}
                    disabled={isProvincialAdmin}
                  >
                    <SelectTrigger className="h-9 text-sm">
                      <SelectValue placeholder="เลือกจังหวัด" />
                    </SelectTrigger>
                    <SelectContent className="bg-background z-50">
                      {filteredProvinces.map(province => (
                        <SelectItem key={province.id} value={province.id} className="text-sm">
                          {province.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}

              <div className="w-full sm:w-48">
                <label className="text-sm font-medium mb-1.5 block">ปีงบประมาณ</label>
                <Select value={selectedFiscalYear} onValueChange={setSelectedFiscalYear}>
                  <SelectTrigger className="h-9 text-sm">
                    <SelectValue placeholder="เลือกปี" />
                  </SelectTrigger>
                  <SelectContent className="bg-background z-50">
                    {fiscalYears.map(year => (
                      <SelectItem key={year} value={year.toString()} className="text-sm">
                        ปีงบประมาณ {year}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Main Content */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Pie Chart */}
          <Card className="lg:col-span-1">
            <CardHeader>
              <CardTitle className="text-lg">สัดส่วนการใช้อุปกรณ์</CardTitle>
            </CardHeader>
            <CardContent>
              {loading ? (
                <div className="h-64 flex items-center justify-center">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
                </div>
              ) : (
                <div className="h-72">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={pieChartData}
                        cx="50%"
                        cy="50%"
                        innerRadius={50}
                        outerRadius={80}
                        paddingAngle={2}
                        dataKey="value"
                        label={({ percentage }) => `${percentage}%`}
                        labelLine={false}
                      >
                        {pieChartData.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={entry.color} />
                        ))}
                      </Pie>
                      <Tooltip 
                        formatter={(value: number, name: string) => [`${value} หน่วย`, name]}
                      />
                      <Legend 
                        verticalAlign="bottom" 
                        height={36}
                        formatter={(value) => <span className="text-sm">{value}</span>}
                      />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
              )}
              
              {/* Legend with values */}
              <div className="mt-4 space-y-2">
                {pieChartData.map((item) => (
                  <div key={item.name} className="flex items-center justify-between text-sm">
                    <div className="flex items-center gap-2">
                      <div 
                        className="w-3 h-3 rounded-full" 
                        style={{ backgroundColor: item.color }}
                      />
                      <span>{item.name}</span>
                    </div>
                    <span className="font-medium">{item.value} ({item.percentage}%)</span>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Table */}
          <Card className="lg:col-span-2">
            <CardHeader>
              <CardTitle className="text-lg">{getTitle()}</CardTitle>
            </CardHeader>
            <CardContent>
              {loading ? (
                <div className="h-64 flex items-center justify-center">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
                </div>
              ) : (
                <div className="overflow-auto max-h-[500px]">
                  <Table>
                    <TableHeader className="sticky top-0 bg-background z-10">
                      <TableRow>
                        <TableHead className="w-12 text-center">ข้อที่</TableHead>
                        <TableHead className="min-w-[200px]">หมวด</TableHead>
                        {EQUIPMENT_TYPES.map(type => (
                          <TableHead key={type.key} className="text-center min-w-[100px]">
                            <div className="flex items-center justify-center gap-1">
                              <div 
                                className="w-2 h-2 rounded-full" 
                                style={{ backgroundColor: type.color }}
                              />
                              {type.label}
                            </div>
                          </TableHead>
                        ))}
                        <TableHead className="text-center">รวม</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {equipmentStats.map((stat, index) => (
                        <TableRow key={stat.categoryId}>
                          <TableCell className="text-center font-medium">{index + 1}</TableCell>
                          <TableCell>
                            <div>
                              <div className="font-medium">{stat.code}</div>
                              <div className="text-xs text-muted-foreground">{stat.name}</div>
                            </div>
                          </TableCell>
                          <TableCell className="text-center">
                            <span className="text-blue-600 font-medium">{stat.private}</span>
                          </TableCell>
                          <TableCell className="text-center">
                            <span className="text-green-600 font-medium">{stat.opensource}</span>
                          </TableCell>
                          <TableCell className="text-center">
                            <span className="text-amber-600 font-medium">{stat.mixed}</span>
                          </TableCell>
                          <TableCell className="text-center">
                            <span className="text-purple-600 font-medium">{stat.other}</span>
                          </TableCell>
                          <TableCell className="text-center font-medium">{stat.total}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </DashboardLayout>
  );
}
