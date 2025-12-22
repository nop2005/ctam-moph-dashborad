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
  score: number;
}

interface Assessment {
  id: string;
  hospital_id: string;
  status: string;
  quantitative_score: number | null;
}

export default function ReportsQuantitative() {
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

  // Fetch data
  useEffect(() => {
    const fetchData = async () => {
      try {
        const [regionsRes, provincesRes, hospitalsRes, categoriesRes, assessmentsRes, itemsRes] = await Promise.all([
          supabase.from('health_regions').select('*').order('region_number'),
          supabase.from('provinces').select('*').order('name'),
          supabase.from('hospitals').select('*').order('name'),
          supabase.from('ctam_categories').select('*').order('order_number'),
          supabase.from('assessments').select('id, hospital_id, status, quantitative_score'),
          supabase.from('assessment_items').select('id, assessment_id, category_id, score'),
        ]);

        if (regionsRes.error) throw regionsRes.error;
        if (provincesRes.error) throw provincesRes.error;
        if (hospitalsRes.error) throw hospitalsRes.error;
        if (categoriesRes.error) throw categoriesRes.error;
        if (assessmentsRes.error) throw assessmentsRes.error;
        if (itemsRes.error) throw itemsRes.error;

        setHealthRegions(regionsRes.data || []);
        setProvinces(provincesRes.data || []);
        setHospitals(hospitalsRes.data || []);
        setCategories(categoriesRes.data || []);
        setAssessments(assessmentsRes.data || []);
        setAssessmentItems(itemsRes.data || []);
      } catch (error) {
        console.error('Error fetching data:', error);
        toast.error('เกิดข้อผิดพลาดในการโหลดข้อมูล');
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, []);

  // Filter provinces based on selected region
  const filteredProvinces = useMemo(() => {
    if (selectedRegion === 'all') return [];
    return provinces.filter(p => p.health_region_id === selectedRegion);
  }, [selectedRegion, provinces]);

  // Reset province when region changes
  useEffect(() => {
    setSelectedProvince('all');
  }, [selectedRegion]);

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

  // Format score display
  const formatScore = (score: number | null) => {
    if (score === null) return '-';
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
              <div className="flex-1">
                <label className="text-sm font-medium mb-2 block">เขตสุขภาพ</label>
                <Select value={selectedRegion} onValueChange={setSelectedRegion}>
                  <SelectTrigger>
                    <SelectValue placeholder="เลือกเขตสุขภาพ" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">
                      <div className="flex items-center gap-2">
                        <MapPin className="w-4 h-4" />
                        ทุกเขตสุขภาพ
                      </div>
                    </SelectItem>
                    {healthRegions.map((region) => (
                      <SelectItem key={region.id} value={region.id}>
                        เขตสุขภาพที่ {region.region_number}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="flex-1">
                <label className="text-sm font-medium mb-2 block">จังหวัด</label>
                <Select 
                  value={selectedProvince} 
                  onValueChange={setSelectedProvince}
                  disabled={selectedRegion === 'all'}
                >
                  <SelectTrigger>
                    <SelectValue placeholder={selectedRegion === 'all' ? 'เลือกเขตก่อน' : 'เลือกจังหวัด'} />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">
                      <div className="flex items-center gap-2">
                        <Building2 className="w-4 h-4" />
                        ทุกจังหวัด
                      </div>
                    </SelectItem>
                    {filteredProvinces.map((province) => (
                      <SelectItem key={province.id} value={province.id}>
                        {province.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
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
                        <TableHead className="text-center min-w-[60px]">จำนวน รพ.</TableHead>
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
                        <TableHead className="text-center min-w-[80px] bg-primary/10">เฉลี่ยรวม</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {tableData.map((row) => {
                        const totalAvg = row.categoryAverages.filter(c => c.average !== null);
                        const overallAvg = totalAvg.length > 0 
                          ? totalAvg.reduce((sum, c) => sum + (c.average || 0), 0) / totalAvg.length
                          : null;

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
                            <TableCell className="text-center">{row.hospitalCount}</TableCell>
                            {row.categoryAverages.map((catAvg) => (
                              <TableCell 
                                key={catAvg.categoryId} 
                                className={`text-center ${getScoreColorClass(catAvg.average)}`}
                              >
                                {formatScore(catAvg.average)}
                              </TableCell>
                            ))}
                            <TableCell className={`text-center bg-primary/5 font-bold ${getScoreColorClass(overallAvg)}`}>
                              {formatScore(overallAvg)}
                            </TableCell>
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
