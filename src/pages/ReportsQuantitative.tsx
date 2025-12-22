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
import { TrendingUp, Filter, Building2, MapPin } from 'lucide-react';
import { toast } from 'sonner';
import { ScrollArea, ScrollBar } from '@/components/ui/scroll-area';
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
  hospital_id: string;
  status: string;
  quantitative_score: number | string | null;
}

export default function ReportsQuantitative() {
  const { profile } = useAuth();
  const [loading, setLoading] = useState(true);
  const [healthRegions, setHealthRegions] = useState<HealthRegion[]>([]);
  const [provinces, setProvinces] = useState<Province[]>([]);
  const [hospitals, setHospitals] = useState<Hospital[]>([]);
  const [categories, setCategories] = useState<CTAMCategory[]>([]);
  const [assessmentItems, setAssessmentItems] = useState<AssessmentItem[]>([]);
  const [assessments, setAssessments] = useState<Assessment[]>([]);

  // Filters
  const [selectedRegion, setSelectedRegion] = useState<string>('all');
  const [selectedProvince, setSelectedProvince] = useState<string>('all');

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
        const [regionsRes, provincesRes, hospitalsRes, categoriesRes] = await Promise.all([
          supabase.from('health_regions').select('*').order('region_number'),
          supabase.from('provinces').select('*').order('name'),
          supabase.from('hospitals').select('*').order('name'),
          supabase.from('ctam_categories').select('*').order('order_number'),
        ]);

        if (regionsRes.error) throw regionsRes.error;
        if (provincesRes.error) throw provincesRes.error;
        if (hospitalsRes.error) throw hospitalsRes.error;
        if (categoriesRes.error) throw categoriesRes.error;

        setHealthRegions(regionsRes.data || []);
        setProvinces(provincesRes.data || []);
        setHospitals(hospitalsRes.data || []);
        setCategories(categoriesRes.data || []);

        const assessmentsAll = await fetchAll<Assessment>(
          supabase
            .from('assessments')
            .select('id, hospital_id, status, quantitative_score, created_at')
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

  // Calculate average scores per category for a set of hospital IDs
  const calculateCategoryAverages = (hospitalIds: string[]) => {
    const relevantAssessments = assessments.filter(a => hospitalIds.includes(a.hospital_id));
    const assessmentIds = relevantAssessments.map(a => a.id);
    const relevantItems = assessmentItems.filter(item => assessmentIds.includes(item.assessment_id));

    return categories.map(cat => {
      const catItems = relevantItems.filter(item => item.category_id === cat.id);
      if (catItems.length === 0) return { categoryId: cat.id, average: null };
      // Parse score to number (Supabase returns numeric as string)
      const avg = catItems.reduce((sum, item) => sum + Number(item.score), 0) / catItems.length;
      return { categoryId: cat.id, average: avg };
    });
  };

  // Determine what to display based on filters
  const tableData = useMemo(() => {
    if (selectedRegion === 'all') {
      // Show all regions with averages
      return healthRegions.map(region => {
        const regionProvinces = provinces.filter(p => p.health_region_id === region.id);
        const regionHospitals = hospitals.filter(h => 
          regionProvinces.some(p => p.id === h.province_id)
        );
        const hospitalIds = regionHospitals.map(h => h.id);
        const categoryAverages = calculateCategoryAverages(hospitalIds);

        return {
          id: region.id,
          name: `เขตสุขภาพที่ ${region.region_number}`,
          type: 'region' as const,
          hospitalCount: regionHospitals.length,
          categoryAverages,
        };
      });
    } else if (selectedProvince === 'all') {
      // Show provinces in selected region
      const regionProvinces = provinces.filter(p => p.health_region_id === selectedRegion);
      return regionProvinces.map(province => {
        const provinceHospitals = hospitals.filter(h => h.province_id === province.id);
        const hospitalIds = provinceHospitals.map(h => h.id);
        const categoryAverages = calculateCategoryAverages(hospitalIds);

        return {
          id: province.id,
          name: province.name,
          type: 'province' as const,
          hospitalCount: provinceHospitals.length,
          categoryAverages,
        };
      });
    } else {
      // Show hospitals in selected province
      const provinceHospitals = hospitals.filter(h => h.province_id === selectedProvince);
      return provinceHospitals.map(hospital => {
        const categoryAverages = calculateCategoryAverages([hospital.id]);

        return {
          id: hospital.id,
          name: hospital.name,
          code: hospital.code,
          type: 'hospital' as const,
          hospitalCount: 1,
          categoryAverages,
        };
      });
    }
  }, [selectedRegion, selectedProvince, healthRegions, provinces, hospitals, categories, assessments, assessmentItems]);

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
  const formatScore = (score: number | null, isHospitalLevel: boolean = false) => {
    if (score === null) return '-';
    // For hospital level, show ผ่าน/ไม่ผ่าน
    if (isHospitalLevel) {
      if (score === 1) return 'ผ่าน';
      return 'ไม่ผ่าน';
    }
    // For aggregated levels (region/province), show percentage or average
    return score.toFixed(2);
  };

  // Get score color class
  const getScoreColorClass = (score: number | null) => {
    if (score === null) return 'text-muted-foreground';
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
                <div className="flex flex-col md:flex-row items-start gap-8">
                  <div className="w-full md:w-auto h-[280px] min-w-[380px]">
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
                  <div className="flex-1 space-y-3 min-w-[380px]">
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
            <CardTitle className="text-lg">{getTitle()}</CardTitle>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="text-center py-12 text-muted-foreground">กำลังโหลดข้อมูล...</div>
            ) : tableData.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground">ไม่พบข้อมูล</div>
            ) : (
              <ScrollArea className="w-full">
                <div className="min-w-[1200px]">
                  <Table>
                    <TableHeader>
                      <TableRow className="bg-muted/50">
                        <TableHead className="sticky left-0 bg-muted/50 z-10 min-w-[180px]">
                          {selectedProvince !== 'all' ? 'โรงพยาบาล' : selectedRegion !== 'all' ? 'จังหวัด' : 'เขตสุขภาพ'}
                        </TableHead>
                        <TableHead className="text-center min-w-[80px] bg-primary/10">ร้อยละข้อที่ผ่าน</TableHead>
                        <TableHead className="text-center min-w-[60px] bg-primary/10">ระดับ</TableHead>
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
                        const totalAvg = row.categoryAverages.filter(c => c.average !== null);
                        const overallAvg = totalAvg.length > 0 
                          ? totalAvg.reduce((sum, c) => sum + (c.average || 0), 0) / totalAvg.length
                          : null;
                        // Calculate percentage of passed items
                        const passedCount = row.categoryAverages.filter(c => c.average === 1).length;
                        const totalCount = row.categoryAverages.filter(c => c.average !== null).length;
                        const passedPercentage = totalCount > 0 ? (passedCount / totalCount) * 100 : null;

                        return (
                          <TableRow key={row.id} className="hover:bg-muted/30">
                            <TableCell className="sticky left-0 bg-background z-10 font-medium">
                              <div className="flex flex-col">
                                <span>{row.name}</span>
                                {row.type === 'hospital' && 'code' in row && (
                                  <span className="text-xs text-muted-foreground font-mono">{row.code}</span>
                                )}
                              </div>
                            </TableCell>
                            <TableCell className={`text-center bg-primary/5 font-bold ${getScoreColorClass(overallAvg)}`}>
                              {passedPercentage !== null ? `${passedPercentage.toFixed(0)}%` : '-'}
                            </TableCell>
                            <TableCell className="text-center">
                              {passedPercentage !== null ? (
                                <div 
                                  className={`w-6 h-6 rounded-full mx-auto ${
                                    passedPercentage === 100 
                                      ? 'bg-green-500' 
                                      : passedPercentage >= 50 
                                        ? 'bg-yellow-500' 
                                        : 'bg-red-500'
                                  }`}
                                />
                              ) : '-'}
                            </TableCell>
                            {row.categoryAverages.map((catAvg) => (
                              <TableCell 
                                key={catAvg.categoryId} 
                                className={`text-center ${getScoreColorClass(catAvg.average)}`}
                              >
                                {formatScore(catAvg.average, row.type === 'hospital')}
                              </TableCell>
                            ))}
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </div>
                <ScrollBar orientation="horizontal" />
              </ScrollArea>
            )}
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
