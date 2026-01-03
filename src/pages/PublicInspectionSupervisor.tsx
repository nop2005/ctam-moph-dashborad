import { useState, useEffect, useMemo } from 'react';
import { PublicLayout } from '@/components/layout/PublicLayout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { FileSearch, Loader2, ChevronRight, Building2, MapPin, Lock } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { useNavigate } from 'react-router-dom';

interface HealthRegion {
  id: string;
  region_number: number;
  name: string;
}

interface Province {
  id: string;
  name: string;
  health_region_id: string;
}

interface InspectionFile {
  id: string;
  province_id: string;
  health_region_id: string;
  assessment_round: string;
  fiscal_year: number;
}

interface RegionStats {
  regionId: string;
  regionNumber: number;
  regionName: string;
  provinceCount: number;
  round1Count: number;
  round2Count: number;
  round1Percentage: number;
  round2Percentage: number;
}

interface ProvinceStats {
  provinceId: string;
  provinceName: string;
  round1Count: number;
  round2Count: number;
  hasRound1: boolean;
  hasRound2: boolean;
}

const getCurrentFiscalYear = () => {
  const now = new Date();
  const month = now.getMonth();
  const year = now.getFullYear();
  return month >= 9 ? year + 1 : year;
};

export default function PublicInspectionSupervisor() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [healthRegions, setHealthRegions] = useState<HealthRegion[]>([]);
  const [provinces, setProvinces] = useState<Province[]>([]);
  const [inspectionFiles, setInspectionFiles] = useState<InspectionFile[]>([]);
  const [fiscalYears, setFiscalYears] = useState<number[]>([]);
  const [selectedFiscalYear, setSelectedFiscalYear] = useState<string>(getCurrentFiscalYear().toString());
  const [selectedRegion, setSelectedRegion] = useState<string | null>(null);

  // Fetch fiscal years from inspection_files table
  useEffect(() => {
    const fetchFiscalYears = async () => {
      const { data } = await supabase
        .from('inspection_files')
        .select('fiscal_year');

      if (data) {
        const uniqueYears = [...new Set(data.map(a => a.fiscal_year))];
        const currentYear = getCurrentFiscalYear();
        if (!uniqueYears.includes(currentYear)) {
          uniqueYears.unshift(currentYear);
        }
        setFiscalYears(uniqueYears.sort((a, b) => b - a));
      }
    };
    fetchFiscalYears();
  }, []);

  // Fetch all data
  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      try {
        const [regionsRes, provincesRes] = await Promise.all([
          supabase.from('health_regions').select('id, region_number, name').order('region_number', { ascending: true }),
          supabase.from('provinces').select('id, name, health_region_id').order('name'),
        ]);

        if (regionsRes.error) throw regionsRes.error;
        if (provincesRes.error) throw provincesRes.error;

        setHealthRegions(regionsRes.data || []);
        setProvinces(provincesRes.data || []);

        // Fetch inspection files with fiscal year filter
        let inspectionQuery = supabase
          .from('inspection_files')
          .select('id, province_id, health_region_id, assessment_round, fiscal_year');

        if (selectedFiscalYear !== 'all') {
          inspectionQuery = inspectionQuery.eq('fiscal_year', parseInt(selectedFiscalYear));
        }

        const { data: files, error: filesError } = await inspectionQuery;
        if (filesError) throw filesError;

        setInspectionFiles(files || []);
      } catch (error) {
        console.error('Error fetching data:', error);
        toast.error('เกิดข้อผิดพลาดในการโหลดข้อมูล');
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [selectedFiscalYear]);

  // Calculate region stats
  const regionStats = useMemo((): RegionStats[] => {
    return healthRegions.map(region => {
      const regionProvinces = provinces.filter(p => p.health_region_id === region.id);
      const provinceCount = regionProvinces.length;

      const regionFiles = inspectionFiles.filter(f => f.health_region_id === region.id);

      const round1Provinces = new Set(
        regionFiles.filter(f => f.assessment_round === 'รอบที่ 1').map(f => f.province_id)
      );
      const round2Provinces = new Set(
        regionFiles.filter(f => f.assessment_round === 'รอบที่ 2').map(f => f.province_id)
      );

      const round1Count = round1Provinces.size;
      const round2Count = round2Provinces.size;

      const round1Percentage = provinceCount > 0 ? (round1Count / provinceCount) * 100 : 0;
      const round2Percentage = provinceCount > 0 ? (round2Count / provinceCount) * 100 : 0;

      return {
        regionId: region.id,
        regionNumber: region.region_number,
        regionName: region.name,
        provinceCount,
        round1Count,
        round2Count,
        round1Percentage,
        round2Percentage
      };
    });
  }, [healthRegions, provinces, inspectionFiles]);

  // Calculate province stats for selected region
  const provinceStats = useMemo((): ProvinceStats[] => {
    if (!selectedRegion) return [];

    const regionProvinces = provinces.filter(p => p.health_region_id === selectedRegion);
    const regionFiles = inspectionFiles.filter(f => f.health_region_id === selectedRegion);

    return regionProvinces.map(province => {
      const provinceFiles = regionFiles.filter(f => f.province_id === province.id);
      const round1Files = provinceFiles.filter(f => f.assessment_round === 'รอบที่ 1');
      const round2Files = provinceFiles.filter(f => f.assessment_round === 'รอบที่ 2');

      return {
        provinceId: province.id,
        provinceName: province.name,
        round1Count: round1Files.length,
        round2Count: round2Files.length,
        hasRound1: round1Files.length > 0,
        hasRound2: round2Files.length > 0
      };
    });
  }, [selectedRegion, provinces, inspectionFiles]);

  const selectedRegionData = useMemo(() => {
    return healthRegions.find(r => r.id === selectedRegion);
  }, [selectedRegion, healthRegions]);

  const handleRegionClick = (regionId: string) => {
    setSelectedRegion(regionId);
  };

  const handleProvinceClick = () => {
    toast.info('กรุณาเข้าสู่ระบบเพื่อดูรายละเอียดรายงาน', {
      action: {
        label: 'เข้าสู่ระบบ',
        onClick: () => navigate('/login')
      }
    });
  };

  const handleBackToRegions = () => {
    setSelectedRegion(null);
  };

  return (
    <PublicLayout>
      <div className="mb-6 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">รายงานผู้นิเทศ</h1>
          <p className="text-muted-foreground">รายงานการตรวจราชการสำหรับผู้นิเทศ (สำหรับผู้ใช้ทั่วไป)</p>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-sm text-muted-foreground">ปีงบประมาณ:</span>
          <Select value={selectedFiscalYear} onValueChange={setSelectedFiscalYear}>
            <SelectTrigger className="w-[160px]">
              <SelectValue placeholder="เลือกปีงบประมาณ" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">ทุกปีงบประมาณ</SelectItem>
              {fiscalYears.map((year) => (
                <SelectItem key={year} value={year.toString()}>
                  พ.ศ. {year + 543}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Breadcrumb navigation */}
      <div className="flex items-center gap-2 text-sm text-muted-foreground mb-4">
        <button
          onClick={handleBackToRegions}
          className={`hover:text-primary ${!selectedRegion ? 'font-medium text-foreground' : ''}`}
        >
          ทุกเขตสุขภาพ
        </button>
        {selectedRegion && selectedRegionData && (
          <>
            <ChevronRight className="h-4 w-4" />
            <span className="font-medium text-foreground">
              เขตสุขภาพที่ {selectedRegionData.region_number}
            </span>
          </>
        )}
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            {selectedRegion ? (
              <>
                <MapPin className="h-5 w-5" />
                รายงานรายจังหวัด - เขตสุขภาพที่ {selectedRegionData?.region_number}
              </>
            ) : (
              <>
                <FileSearch className="h-5 w-5" />
                สถิติการนิเทศแยกตามเขตสุขภาพ
              </>
            )}
          </CardTitle>
          <CardDescription>
            {selectedRegion 
              ? 'แสดงจำนวนรายงานของแต่ละจังหวัด (เข้าสู่ระบบเพื่อดูรายละเอียดรายงาน)'
              : 'แสดงจำนวนจังหวัดและความก้าวหน้าการนิเทศในแต่ละรอบ'
            }
          </CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : !selectedRegion ? (
            // Region view
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>เขตสุขภาพ</TableHead>
                  <TableHead className="text-center">จำนวนจังหวัด</TableHead>
                  <TableHead className="text-center">รอบที่ 1</TableHead>
                  <TableHead className="text-center">รอบที่ 2</TableHead>
                  <TableHead className="text-center">ร้อยละรอบที่ 1</TableHead>
                  <TableHead className="text-center">ร้อยละรอบที่ 2</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {regionStats.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center text-muted-foreground py-8">
                      ไม่พบข้อมูลเขตสุขภาพ
                    </TableCell>
                  </TableRow>
                ) : (
                  regionStats.map((stat) => (
                    <TableRow 
                      key={stat.regionId} 
                      className="cursor-pointer hover:bg-muted/50"
                      onClick={() => handleRegionClick(stat.regionId)}
                    >
                      <TableCell className="font-medium text-primary hover:underline flex items-center gap-2">
                        <Building2 className="h-4 w-4" />
                        เขตสุขภาพที่ {stat.regionNumber}
                      </TableCell>
                      <TableCell className="text-center">{stat.provinceCount}</TableCell>
                      <TableCell className="text-center">{stat.round1Count}</TableCell>
                      <TableCell className="text-center">{stat.round2Count}</TableCell>
                      <TableCell className="text-center">
                        {stat.round1Percentage > 0 ? stat.round1Percentage.toFixed(2) : '-'}
                      </TableCell>
                      <TableCell className="text-center">
                        {stat.round2Percentage > 0 ? stat.round2Percentage.toFixed(2) : '-'}
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          ) : (
            // Province view
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>จังหวัด</TableHead>
                  <TableHead className="text-center">จำนวนไฟล์รอบที่ 1</TableHead>
                  <TableHead className="text-center">จำนวนไฟล์รอบที่ 2</TableHead>
                  <TableHead className="text-center">สถานะ</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {provinceStats.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={4} className="text-center text-muted-foreground py-8">
                      ไม่พบข้อมูลจังหวัด
                    </TableCell>
                  </TableRow>
                ) : (
                  provinceStats.map((stat) => (
                    <TableRow 
                      key={stat.provinceId} 
                      className="cursor-pointer hover:bg-muted/50"
                      onClick={handleProvinceClick}
                    >
                      <TableCell className="font-medium text-primary hover:underline flex items-center gap-2">
                        <MapPin className="h-4 w-4" />
                        {stat.provinceName}
                      </TableCell>
                      <TableCell className="text-center">{stat.round1Count}</TableCell>
                      <TableCell className="text-center">{stat.round2Count}</TableCell>
                      <TableCell className="text-center">
                        <div className="flex items-center justify-center gap-1">
                          <Lock className="h-4 w-4 text-muted-foreground" />
                          <span className="text-muted-foreground text-sm">เข้าสู่ระบบเพื่อดู</span>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </PublicLayout>
  );
}
