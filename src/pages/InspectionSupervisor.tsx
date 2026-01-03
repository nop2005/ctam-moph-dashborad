import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { FileSearch, Loader2, Eye } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

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

export default function InspectionSupervisor() {
  const navigate = useNavigate();
  const { profile } = useAuth();
  const [loading, setLoading] = useState(true);
  const [regionStats, setRegionStats] = useState<RegionStats[]>([]);
  const [fiscalYears, setFiscalYears] = useState<number[]>([]);
  const [selectedFiscalYear, setSelectedFiscalYear] = useState<string>(getCurrentFiscalYear().toString());
  const [userHealthRegionId, setUserHealthRegionId] = useState<string | null>(null);

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
      if (!profile) return;
      
      setLoading(true);
      try {
        // Determine user's health region based on role
        let regionId: string | null = null;
        
        if (profile.role === 'hospital_it' && profile.hospital_id) {
          // Get hospital's province, then province's health region
          const { data: hospital } = await supabase
            .from('hospitals')
            .select('province_id')
            .eq('id', profile.hospital_id)
            .maybeSingle();
          
          if (hospital?.province_id) {
            const { data: province } = await supabase
              .from('provinces')
              .select('health_region_id')
              .eq('id', hospital.province_id)
              .maybeSingle();
            regionId = province?.health_region_id || null;
          }
        } else if ((profile.role === 'provincial' || profile.role === 'health_office') && profile.province_id) {
          // Get province's health region
          const { data: province } = await supabase
            .from('provinces')
            .select('health_region_id')
            .eq('id', profile.province_id)
            .maybeSingle();
          regionId = province?.health_region_id || null;
        } else if (profile.role === 'regional' && profile.health_region_id) {
          regionId = profile.health_region_id;
        }
        // central_admin sees all regions (regionId stays null)
        
        setUserHealthRegionId(regionId);

        // Fetch ALL health regions for the overview table
        const { data: regions } = await supabase
          .from('health_regions')
          .select('id, region_number, name')
          .order('region_number', { ascending: true });

        if (!regions) {
          setRegionStats([]);
          return;
        }

        // Fetch all provinces with their region
        const { data: provinces } = await supabase
          .from('provinces')
          .select('id, health_region_id');

        // Fetch inspection files to count completed inspections
        let inspectionQuery = supabase
          .from('inspection_files')
          .select('province_id, health_region_id, assessment_round');

        if (selectedFiscalYear !== 'all') {
          inspectionQuery = inspectionQuery.eq('fiscal_year', parseInt(selectedFiscalYear));
        }

        const { data: inspectionFiles } = await inspectionQuery;

        // Calculate stats per region
        const stats: RegionStats[] = regions.map(region => {
          const regionProvinces = provinces?.filter(p => p.health_region_id === region.id) || [];
          const provinceCount = regionProvinces.length;

          // Count unique provinces that have at least one file uploaded per round
          const regionFiles = inspectionFiles?.filter(f => f.health_region_id === region.id) || [];
          
          const round1Provinces = new Set(
            regionFiles.filter(f => f.assessment_round === 'รอบที่ 1').map(f => f.province_id)
          );
          const round2Provinces = new Set(
            regionFiles.filter(f => f.assessment_round === 'รอบที่ 2').map(f => f.province_id)
          );

          const round1Count = round1Provinces.size;
          const round2Count = round2Provinces.size;

          // Calculate percentage based on province count
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
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [profile, selectedFiscalYear]);

  // Check if user can access a specific region
  const canAccessRegion = (regionId: string) => {
    if (profile?.role === 'central_admin') return true;
    if (!userHealthRegionId) return false;
    return regionId === userHealthRegionId;
  };

  const handleRowClick = (regionId: string) => {
    if (canAccessRegion(regionId)) {
      navigate(`/inspection/supervisor/region/${regionId}`);
    }
  };

  return (
    <DashboardLayout>
      <div className="mb-6 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">รายงานผู้นิเทศ</h1>
          <p className="text-muted-foreground">รายงานการตรวจราชการสำหรับผู้นิเทศ</p>
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
                  <TableHead className="text-center">รายงาน</TableHead>
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
                    <TableCell colSpan={7} className="text-center text-muted-foreground py-8">
                      ไม่พบข้อมูลเขตสุขภาพ
                    </TableCell>
                  </TableRow>
                ) : (
                  regionStats.map((stat) => {
                    const isAccessible = canAccessRegion(stat.regionId);
                    return (
                      <TableRow 
                        key={stat.regionId} 
                        className={isAccessible ? "cursor-pointer hover:bg-muted/50" : "opacity-70"}
                        onClick={() => handleRowClick(stat.regionId)}
                      >
                        <TableCell className="font-medium">
                          <span className={isAccessible ? "text-primary hover:underline" : "text-muted-foreground"}>
                            เขตสุขภาพที่ {stat.regionNumber}
                          </span>
                        </TableCell>
                        <TableCell className="text-center">
                          {isAccessible ? (
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleRowClick(stat.regionId);
                              }}
                            >
                              <Eye className="h-4 w-4 text-primary" />
                            </Button>
                          ) : (
                            <span className="text-muted-foreground">-</span>
                          )}
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
                    );
                  })
                )}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </DashboardLayout>
  );
}