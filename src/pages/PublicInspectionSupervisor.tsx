import { useState, useEffect } from 'react';
import { PublicLayout } from '@/components/layout/PublicLayout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { FileSearch, Loader2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

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

const getCurrentFiscalYear = () => {
  const now = new Date();
  const month = now.getMonth();
  const year = now.getFullYear();
  return month >= 9 ? year + 1 : year;
};

export default function PublicInspectionSupervisor() {
  const [loading, setLoading] = useState(true);
  const [regionStats, setRegionStats] = useState<RegionStats[]>([]);
  const [fiscalYears, setFiscalYears] = useState<number[]>([]);
  const [selectedFiscalYear, setSelectedFiscalYear] = useState<string>(getCurrentFiscalYear().toString());

  useEffect(() => {
    const fetchFiscalYears = async () => {
      const { data } = await supabase
        .from('assessments')
        .select('fiscal_year')
        .order('fiscal_year', { ascending: false });

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

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      try {
        const { data: regions } = await supabase
          .from('health_regions')
          .select('id, region_number, name')
          .order('region_number', { ascending: true });

        if (!regions) {
          setRegionStats([]);
          return;
        }

        const { data: provinces } = await supabase
          .from('provinces')
          .select('id, health_region_id');

        let inspectionQuery = supabase
          .from('inspection_files')
          .select('province_id, health_region_id, assessment_round');

        if (selectedFiscalYear !== 'all') {
          inspectionQuery = inspectionQuery.eq('fiscal_year', parseInt(selectedFiscalYear));
        }

        const { data: inspectionFiles } = await inspectionQuery;

        const stats: RegionStats[] = regions.map(region => {
          const regionProvinces = provinces?.filter(p => p.health_region_id === region.id) || [];
          const provinceCount = regionProvinces.length;

          const regionFiles = inspectionFiles?.filter(f => f.health_region_id === region.id) || [];
          
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

        setRegionStats(stats);
      } catch (error) {
        console.error('Error fetching data:', error);
        toast.error('เกิดข้อผิดพลาดในการโหลดข้อมูล');
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [selectedFiscalYear]);

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

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileSearch className="h-5 w-5" />
            สถิติการนิเทศแยกตามเขตสุขภาพ
          </CardTitle>
          <CardDescription>
            แสดงจำนวนจังหวัดและความก้าวหน้าการนิเทศในแต่ละรอบ
          </CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : (
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
                    <TableRow key={stat.regionId}>
                      <TableCell className="font-medium">
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
          )}
        </CardContent>
      </Card>
    </PublicLayout>
  );
}
