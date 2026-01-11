import { useEffect, useState, useMemo } from 'react';
import { PublicLayout } from '@/components/layout/PublicLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { supabase } from '@/integrations/supabase/client';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Progress } from '@/components/ui/progress';
import { TrendingUp, Filter, Building2, MapPin, Map as MapIcon } from 'lucide-react';
import { toast } from 'sonner';
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

interface PublicQuantitativeSummary {
  fiscal_years: number[];
  region_passed_all_17: { health_region_id: string; passed_all_17: number }[];
  province_passed_all_17: { province_id: string; passed_all_17: number }[];
  province_avg_quantitative_score: { province_id: string; avg_quantitative_score: number | null }[];
}

const getCurrentFiscalYear = (): number => {
  const now = new Date();
  const month = now.getMonth();
  const year = now.getFullYear();
  return month >= 9 ? year + 1 : year;
};

export default function PublicReportsQuantitative() {
  const [baseLoading, setBaseLoading] = useState(true);
  const [summaryLoading, setSummaryLoading] = useState(true);
  const loading = baseLoading || summaryLoading;

  const [healthRegions, setHealthRegions] = useState<HealthRegion[]>([]);
  const [provinces, setProvinces] = useState<Province[]>([]);
  const [hospitals, setHospitals] = useState<Hospital[]>([]);
  const [healthOffices, setHealthOffices] = useState<HealthOffice[]>([]);
  const [summary, setSummary] = useState<PublicQuantitativeSummary | null>(null);

  const [selectedRegion, setSelectedRegion] = useState<string>('all');
  const [selectedProvince, setSelectedProvince] = useState<string>('all');
  const [selectedFiscalYear, setSelectedFiscalYear] = useState<string>(getCurrentFiscalYear().toString());

  useEffect(() => {
    const fetchBaseData = async () => {
      try {
        setBaseLoading(true);
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
      } catch (error) {
        console.error('Error fetching data:', error);
        toast.error('เกิดข้อผิดพลาดในการโหลดข้อมูล');
      } finally {
        setBaseLoading(false);
      }
    };

    fetchBaseData();
  }, []);

  useEffect(() => {
    const fetchSummary = async () => {
      try {
        setSummaryLoading(true);
        const fiscalYear = selectedFiscalYear === 'all' ? null : parseInt(selectedFiscalYear);

        const { data, error } = await supabase.rpc('get_public_quantitative_summary', {
          p_fiscal_year: fiscalYear,
        });

        if (error) throw error;
        setSummary(data as unknown as PublicQuantitativeSummary);
      } catch (error) {
        console.error('Error fetching summary:', error);
        toast.error('เกิดข้อผิดพลาดในการโหลดข้อมูลสรุป');
      } finally {
        setSummaryLoading(false);
      }
    };

    fetchSummary();
  }, [selectedFiscalYear]);

  const fiscalYears = useMemo(() => {
    const currentFiscalYear = getCurrentFiscalYear();
    const years = new Set<number>([currentFiscalYear]);
    (summary?.fiscal_years || []).forEach(y => years.add(y));
    return Array.from(years).sort((a, b) => b - a);
  }, [summary]);

  const regionPassedAll17Map = useMemo(() => {
    const map = new Map<string, number>();
    (summary?.region_passed_all_17 || []).forEach(r => {
      map.set(r.health_region_id, Number(r.passed_all_17) || 0);
    });
    return map;
  }, [summary]);

const provincePassedAll17Map = useMemo(() => {
    const map = new Map<string, number>();
    (summary?.province_passed_all_17 || []).forEach(p => {
      map.set(p.province_id, Number(p.passed_all_17) || 0);
    });
    return map;
  }, [summary]);

  const regionTableData = useMemo(() => {
    return healthRegions.map(region => {
      const regionProvinces = provinces.filter(p => p.health_region_id === region.id);
      const regionHospitals = hospitals.filter(h => regionProvinces.some(p => p.id === h.province_id));
      const regionHealthOffices = healthOffices.filter(ho => ho.health_region_id === region.id);
      const totalUnits = regionHospitals.length + regionHealthOffices.length;

      const unitsPassedAll17 = regionPassedAll17Map.get(region.id) ?? 0;

      return {
        id: region.id,
        name: `เขตสุขภาพที่ ${region.region_number}`,
        totalUnits,
        passedAll17: unitsPassedAll17,
        percentage: totalUnits > 0 ? (unitsPassedAll17 / totalUnits) * 100 : 0,
      };
    });
  }, [healthRegions, provinces, hospitals, healthOffices, regionPassedAll17Map]);

  const provinceTableData = useMemo(() => {
    if (selectedRegion === 'all') return [];

    const regionProvinces = provinces.filter(p => p.health_region_id === selectedRegion);
    return regionProvinces.map(province => {
      const provinceHospitals = hospitals.filter(h => h.province_id === province.id);
      const provinceHealthOffices = healthOffices.filter(ho => ho.province_id === province.id);
      const totalUnits = provinceHospitals.length + provinceHealthOffices.length;

      const passedAll17 = provincePassedAll17Map.get(province.id) ?? 0;

      return {
        id: province.id,
        name: province.name,
        totalUnits,
        passedAll17,
        percentage: totalUnits > 0 ? (passedAll17 / totalUnits) * 100 : 0,
      };
    });
  }, [selectedRegion, provinces, hospitals, healthOffices, provincePassedAll17Map]);

  // Compute province map data for Thailand map
  const provinceMapData = useMemo<ProvinceData[]>(() => {
    return provinces.map(province => {
      const provinceHospitals = hospitals.filter(h => h.province_id === province.id);
      const provinceHealthOffices = healthOffices.filter(ho => ho.province_id === province.id);
      const totalUnits = provinceHospitals.length + provinceHealthOffices.length;
      const passedAll17 = provincePassedAll17Map.get(province.id) ?? 0;
      const passedPercentage = totalUnits > 0 ? (passedAll17 / totalUnits) * 100 : null;

      return {
        id: province.id,
        name: province.name,
        passedPercentage,
        totalUnits,
        passedAll17,
        assessed: passedAll17, // Approximation for public view
        healthRegionId: province.health_region_id,
      };
    });
  }, [provinces, hospitals, healthOffices, provincePassedAll17Map]);

  const handleRegionClick = (regionId: string) => {
    setSelectedRegion(regionId);
    setSelectedProvince('all');
  };

  const handleBackToRegions = () => {
    setSelectedRegion('all');
    setSelectedProvince('all');
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
            <p className="text-muted-foreground">
              สรุปผลการประเมินเชิงปริมาณตาม 17 หมวดหมู่ (สำหรับผู้ใช้ทั่วไป)
            </p>
          </div>
        </div>

        {/* Filters Card */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <Filter className="w-4 h-4" />
              ตัวกรอง
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-4">
              <div className="w-full sm:w-48">
                <label className="text-sm font-medium mb-1.5 block">เขตสุขภาพ</label>
                <Select value={selectedRegion} onValueChange={(value) => {
                  setSelectedRegion(value);
                  setSelectedProvince('all');
                }}>
                  <SelectTrigger className="h-9 text-sm">
                    <SelectValue placeholder="เลือกเขตสุขภาพ" />
                  </SelectTrigger>
                  <SelectContent className="bg-background z-50">
                    <SelectItem value="all" className="text-sm">
                      <div className="flex items-center gap-2">
                        <Building2 className="w-3 h-3" />
                        ทุกเขตสุขภาพ
                      </div>
                    </SelectItem>
                    {healthRegions.map(region => (
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
                  disabled={selectedRegion === 'all'}
                >
                  <SelectTrigger className="h-9 text-sm">
                    <SelectValue placeholder="เลือกจังหวัด" />
                  </SelectTrigger>
                  <SelectContent className="bg-background z-50">
                    <SelectItem value="all" className="text-sm">
                      <div className="flex items-center gap-2">
                        <MapPin className="w-3 h-3" />
                        ทุกจังหวัด
                      </div>
                    </SelectItem>
                    {provinces
                      .filter(p => selectedRegion === 'all' || p.health_region_id === selectedRegion)
                      .map(province => (
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

        {/* Breadcrumb navigation */}
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <button
            onClick={handleBackToRegions}
            className={`hover:text-primary ${selectedRegion === 'all' ? 'font-medium text-foreground' : ''}`}
          >
            ทุกเขตสุขภาพ
          </button>
          {selectedRegion !== 'all' && (
            <>
              <span>/</span>
              <span className="font-medium text-foreground">
                {healthRegions.find(r => r.id === selectedRegion)?.name || 'เขตสุขภาพ'}
              </span>
            </>
          )}
        </div>

        {/* Thailand Map */}
        <Card className="h-[500px]">
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2 flex-wrap">
              <MapIcon className="w-4 h-4" />
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
          </CardContent>
        </Card>

        {/* Table */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              {selectedRegion === 'all' ? (
                <>
                  <Building2 className="w-5 h-5" /> รายงานรายเขตสุขภาพ
                </>
              ) : (
                <>
                  <MapPin className="w-5 h-5" /> รายงานสรุปรายจังหวัด - เขตสุขภาพที่{' '}
                  {healthRegions.find(r => r.id === selectedRegion)?.region_number}
                </>
              )}
            </CardTitle>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="text-center py-8 text-muted-foreground">กำลังโหลด...</div>
            ) : selectedRegion === 'all' ? (
              // Region level table
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="sticky left-0 bg-background z-10">เขตสุขภาพ</TableHead>
                      <TableHead className="text-center">จำนวนหน่วยงานทั้งหมด</TableHead>
                      <TableHead className="text-center">ผ่านครบ 17 ข้อ</TableHead>
                      <TableHead className="text-center min-w-[180px]">ผ่านร้อยละ</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {regionTableData.map(row => (
                      <TableRow
                        key={row.id}
                        className="cursor-pointer hover:bg-muted/50"
                        onClick={() => handleRegionClick(row.id)}
                      >
                        <TableCell className="font-medium sticky left-0 bg-background z-10 text-primary hover:underline">
                          {row.name}
                        </TableCell>
                        <TableCell className="text-center">{row.totalUnits}</TableCell>
                        <TableCell className="text-center">{row.passedAll17}</TableCell>
                        <TableCell className="text-center">
                          <div className="flex items-center gap-2">
                            {(() => {
                              const percentage = row.percentage;
                              const colorClass =
                                percentage === 100
                                  ? '[&>div]:bg-success'
                                  : percentage >= 50
                                  ? '[&>div]:bg-warning'
                                  : '[&>div]:bg-destructive';
                              return <Progress value={percentage} className={`h-4 flex-1 ${colorClass}`} />;
                            })()}
                            <span className="w-14 text-right text-sm font-medium">
                              {row.percentage.toFixed(1)}%
                            </span>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            ) : (
              // Province level table
              <div className="overflow-x-auto">
                <button
                  onClick={handleBackToRegions}
                  className="mb-4 text-sm text-primary hover:underline flex items-center gap-1"
                >
                  ← กลับไปยังเขตสุขภาพ
                </button>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="sticky left-0 bg-background z-10">จังหวัด</TableHead>
                      <TableHead className="text-center">จำนวนหน่วยงานทั้งหมด</TableHead>
                      <TableHead className="text-center">ผ่านครบ 17 ข้อ</TableHead>
                      <TableHead className="text-center min-w-[180px]">ผ่านร้อยละ</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {provinceTableData.map(row => (
                      <TableRow key={row.id}>
                        <TableCell className="font-medium sticky left-0 bg-background z-10">{row.name}</TableCell>
                        <TableCell className="text-center">{row.totalUnits}</TableCell>
                        <TableCell className="text-center">{row.passedAll17}</TableCell>
                        <TableCell className="text-center">
                          <div className="flex items-center gap-2">
                            {(() => {
                              const percentage = row.percentage;
                              const colorClass =
                                percentage === 100
                                  ? '[&>div]:bg-success'
                                  : percentage >= 50
                                  ? '[&>div]:bg-warning'
                                  : '[&>div]:bg-destructive';
                              return <Progress value={percentage} className={`h-4 flex-1 ${colorClass}`} />;
                            })()}
                            <span className="w-14 text-right text-sm font-medium">
                              {row.percentage.toFixed(1)}%
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

        {/* Legend */}
        <div className="flex items-center gap-6 text-sm text-muted-foreground">
            <div className="flex items-center gap-2">
              <div className="w-4 h-4 bg-success rounded"></div>
              <span>100% (ผ่านทั้งหมด)</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-4 h-4 bg-warning rounded"></div>
              <span>50-99%</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-4 h-4 bg-destructive rounded"></div>
              <span>ต่ำกว่า 50%</span>
            </div>
          </div>
      </div>
    </PublicLayout>
  );
}
