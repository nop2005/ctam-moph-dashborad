import { useEffect, useState, useMemo } from 'react';
import { PublicLayout } from '@/components/layout/PublicLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { supabase } from '@/integrations/supabase/client';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { BarChart3, FileText, Building2, Filter, ChevronLeft } from 'lucide-react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from 'sonner';
import { Bar, BarChart, ResponsiveContainer, XAxis, YAxis, Tooltip, Cell } from 'recharts';
import { Button } from '@/components/ui/button';

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

interface RegionStats {
  id: string;
  name: string;
  region_number: number;
  total_units: number;
  with_assessment: number;
  completed: number;
  pending: number;
  avg_score: number;
  avg_qualitative_score: number;
  avg_quantitative_score: number;
}

interface ProvinceStats {
  id: string;
  name: string;
  health_region_id: string;
  total_units: number;
  with_assessment: number;
  completed: number;
  pending: number;
  avg_score: number;
  avg_qualitative_score: number;
  avg_quantitative_score: number;
}

interface PublicReportData {
  health_regions: HealthRegion[];
  provinces: Province[];
  region_stats: RegionStats[];
  province_stats: ProvinceStats[];
  fiscal_years: number[];
}

const getCurrentFiscalYear = (): number => {
  const now = new Date();
  const month = now.getMonth();
  const year = now.getFullYear();
  return month >= 9 ? year + 1 : year;
};

const CHART_COLORS = [
  'hsl(var(--chart-1))',
  'hsl(var(--chart-2))',
  'hsl(var(--chart-3))',
  'hsl(var(--chart-4))',
  'hsl(var(--chart-5))',
];

type DrillLevel = 'region' | 'province';

export default function PublicReports() {
  const [loading, setLoading] = useState(true);
  const [reportData, setReportData] = useState<PublicReportData | null>(null);
  const [selectedFiscalYear, setSelectedFiscalYear] = useState<string>(getCurrentFiscalYear().toString());
  const [drillLevel, setDrillLevel] = useState<DrillLevel>('region');
  const [selectedRegionId, setSelectedRegionId] = useState<string | null>(null);

  const fiscalYears = useMemo(() => {
    if (!reportData?.fiscal_years) return [getCurrentFiscalYear()];
    const years = new Set([getCurrentFiscalYear(), ...reportData.fiscal_years]);
    return Array.from(years).sort((a, b) => b - a);
  }, [reportData]);

  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);
        const fiscalYear = selectedFiscalYear === 'all' ? null : parseInt(selectedFiscalYear);
        
        const { data, error } = await supabase.rpc('get_public_report_summary', {
          p_fiscal_year: fiscalYear
        });
        
        if (error) throw error;
        setReportData(data as unknown as PublicReportData);
      } catch (error) {
        console.error('Error fetching data:', error);
        toast.error('เกิดข้อผิดพลาดในการโหลดข้อมูล');
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, [selectedFiscalYear]);

  const handleDrillToProvince = (regionId: string) => {
    setSelectedRegionId(regionId);
    setDrillLevel('province');
  };

  const handleBackToRegion = () => {
    setSelectedRegionId(null);
    setDrillLevel('region');
  };

  const currentStats = useMemo(() => {
    if (!reportData) return { totalUnits: 0, withAssessment: 0, completed: 0, pending: 0 };
    
    if (drillLevel === 'region') {
      return reportData.region_stats.reduce((acc, r) => ({
        totalUnits: acc.totalUnits + r.total_units,
        withAssessment: acc.withAssessment + r.with_assessment,
        completed: acc.completed + r.completed,
        pending: acc.pending + r.pending,
      }), { totalUnits: 0, withAssessment: 0, completed: 0, pending: 0 });
    } else {
      const regionProvinces = reportData.province_stats.filter(p => p.health_region_id === selectedRegionId);
      return regionProvinces.reduce((acc, p) => ({
        totalUnits: acc.totalUnits + p.total_units,
        withAssessment: acc.withAssessment + p.with_assessment,
        completed: acc.completed + p.completed,
        pending: acc.pending + p.pending,
      }), { totalUnits: 0, withAssessment: 0, completed: 0, pending: 0 });
    }
  }, [reportData, drillLevel, selectedRegionId]);

  const chartData = useMemo(() => {
    if (!reportData) return [];
    
    if (drillLevel === 'region') {
      return reportData.region_stats.map(r => ({
        id: r.id,
        name: `เขต ${r.region_number}`,
        score: Number(r.avg_score?.toFixed(2)) || 0,
      }));
    } else {
      return reportData.province_stats
        .filter(p => p.health_region_id === selectedRegionId)
        .map(p => ({
          id: p.id,
          name: p.name,
          score: Number(p.avg_score?.toFixed(2)) || 0,
        }));
    }
  }, [reportData, drillLevel, selectedRegionId]);

  const selectedRegion = useMemo(() => {
    if (!selectedRegionId || !reportData) return null;
    return reportData.region_stats.find(r => r.id === selectedRegionId);
  }, [selectedRegionId, reportData]);

  return (
    <PublicLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold">รายงานภาพรวม</h1>
            <p className="text-muted-foreground">สรุปผลการประเมินตามจังหวัดและเขตสุขภาพ (สำหรับผู้ใช้ทั่วไป)</p>
          </div>
          <div className="flex items-center gap-2">
            <Filter className="w-4 h-4 text-muted-foreground" />
            <Select value={selectedFiscalYear} onValueChange={setSelectedFiscalYear}>
              <SelectTrigger className="w-[180px]">
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

        {/* Statistics */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Card>
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-2xl font-bold">{currentStats.totalUnits}</p>
                  <p className="text-sm text-muted-foreground">สถานบริการทั้งหมด</p>
                </div>
                <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center">
                  <Building2 className="w-6 h-6 text-primary" />
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-2xl font-bold">{currentStats.withAssessment}</p>
                  <p className="text-sm text-muted-foreground">ส่งแบบประเมินแล้ว</p>
                </div>
                <div className="w-12 h-12 rounded-xl bg-accent/10 flex items-center justify-center">
                  <FileText className="w-6 h-6 text-accent" />
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-2xl font-bold">{currentStats.completed}</p>
                  <p className="text-sm text-muted-foreground">ตรวจสอบแล้ว</p>
                </div>
                <div className="w-12 h-12 rounded-xl bg-success/10 flex items-center justify-center">
                  <BarChart3 className="w-6 h-6 text-success" />
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-2xl font-bold">{currentStats.pending}</p>
                  <p className="text-sm text-muted-foreground">รอตรวจสอบ</p>
                </div>
                <div className="w-12 h-12 rounded-xl bg-warning/10 flex items-center justify-center">
                  <FileText className="w-6 h-6 text-warning" />
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Chart */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="flex items-center gap-2">
                <BarChart3 className="w-5 h-5" />
                {drillLevel === 'region' 
                  ? `คะแนนรวมรายเขตสุขภาพ (ปีงบประมาณ ${selectedFiscalYear === 'all' ? 'ทั้งหมด' : parseInt(selectedFiscalYear) + 543})`
                  : `คะแนนรวมรายจังหวัด - เขตสุขภาพที่ ${selectedRegion?.region_number || ''}`
                }
              </CardTitle>
              {drillLevel === 'province' && (
                <Button variant="ghost" size="sm" onClick={handleBackToRegion}>
                  <ChevronLeft className="w-4 h-4 mr-1" />
                  กลับ
                </Button>
              )}
            </div>
            <p className="text-sm text-muted-foreground">
              {drillLevel === 'region' 
                ? 'คลิกที่แท่งกราฟเพื่อดูรายละเอียดรายจังหวัด'
                : 'แสดงคะแนนรวมเฉลี่ยของแต่ละจังหวัด (ไม่แสดงรายโรงพยาบาล)'
              }
            </p>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="text-center py-8 text-muted-foreground">กำลังโหลด...</div>
            ) : chartData.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">ไม่พบข้อมูล</div>
            ) : (
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={chartData} margin={{ top: 20, right: 30, left: 20, bottom: 60 }}>
                  <XAxis 
                    dataKey="name" 
                    tick={{ fontSize: 12 }} 
                    angle={-45} 
                    textAnchor="end"
                    height={80}
                  />
                  <YAxis 
                    tick={{ fontSize: 12 }}
                    domain={[0, 10]}
                  />
                  <Tooltip
                    formatter={(value: number) => [`${value.toFixed(2)} คะแนน`, 'คะแนนเฉลี่ย']}
                    contentStyle={{ 
                      backgroundColor: 'hsl(var(--background))',
                      border: '1px solid hsl(var(--border))',
                      borderRadius: '8px'
                    }}
                  />
                  <Bar 
                    dataKey="score" 
                    radius={[4, 4, 0, 0]}
                    cursor={drillLevel === 'region' ? 'pointer' : 'default'}
                    onClick={(data) => {
                      if (drillLevel === 'region' && data?.id) {
                        handleDrillToProvince(data.id);
                      }
                    }}
                  >
                    {chartData.map((_, index) => (
                      <Cell key={`cell-${index}`} fill={CHART_COLORS[index % CHART_COLORS.length]} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>

        {/* Table */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <BarChart3 className="w-5 h-5" />
              {drillLevel === 'region' && 'รายงานสรุปรายเขตสุขภาพ'}
              {drillLevel === 'province' && `รายงานสรุปรายจังหวัด - เขตสุขภาพที่ ${selectedRegion?.region_number || ''}`}
            </CardTitle>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="text-center py-8 text-muted-foreground">กำลังโหลด...</div>
            ) : drillLevel === 'region' ? (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>เขตสุขภาพ</TableHead>
                      <TableHead className="text-right">จำนวนสถานบริการ</TableHead>
                      <TableHead className="text-right">คะแนนเชิงปริมาณ</TableHead>
                      <TableHead className="text-right">คะแนนเชิงผลกระทบ</TableHead>
                      <TableHead className="text-right">คะแนนรวม</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {reportData?.region_stats.map(region => (
                      <TableRow 
                        key={region.id} 
                        className="cursor-pointer hover:bg-muted/50 transition-colors"
                        onClick={() => handleDrillToProvince(region.id)}
                      >
                        <TableCell className="font-medium text-primary underline">
                          เขตสุขภาพที่ {region.region_number}
                        </TableCell>
                        <TableCell className="text-right">{region.total_units}</TableCell>
                        <TableCell className="text-right">
                          {region.avg_quantitative_score > 0 ? region.avg_quantitative_score.toFixed(2) : '-'}
                        </TableCell>
                        <TableCell className="text-right">
                          {region.avg_qualitative_score > 0 ? region.avg_qualitative_score.toFixed(2) : '-'}
                        </TableCell>
                        <TableCell className="text-right font-medium">
                          {region.avg_score > 0 ? region.avg_score.toFixed(2) : '-'}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <div className="mb-4">
                  <button
                    onClick={handleBackToRegion}
                    className="text-sm text-primary hover:underline"
                  >
                    ← กลับไปยังเขตสุขภาพ
                  </button>
                </div>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>จังหวัด</TableHead>
                      <TableHead className="text-right">จำนวนสถานบริการ</TableHead>
                      <TableHead className="text-right">คะแนนเชิงปริมาณ</TableHead>
                      <TableHead className="text-right">คะแนนเชิงผลกระทบ</TableHead>
                      <TableHead className="text-right">คะแนนรวม</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {reportData?.province_stats
                      .filter(p => p.health_region_id === selectedRegionId)
                      .map(province => (
                        <TableRow key={province.id}>
                          <TableCell className="font-medium">
                            {province.name}
                          </TableCell>
                          <TableCell className="text-right">{province.total_units}</TableCell>
                          <TableCell className="text-right">
                            {province.avg_quantitative_score > 0 ? province.avg_quantitative_score.toFixed(2) : '-'}
                          </TableCell>
                          <TableCell className="text-right">
                            {province.avg_qualitative_score > 0 ? province.avg_qualitative_score.toFixed(2) : '-'}
                          </TableCell>
                          <TableCell className="text-right font-medium">
                            {province.avg_score > 0 ? province.avg_score.toFixed(2) : '-'}
                          </TableCell>
                        </TableRow>
                      ))}
                  </TableBody>
                </Table>
                <div className="mt-4 p-3 bg-muted/50 rounded-lg text-sm text-muted-foreground">
                  <p>💡 รายงานสาธารณะแสดงข้อมูลเฉพาะระดับเขตสุขภาพและจังหวัดเท่านั้น</p>
                  <p>หากต้องการดูรายละเอียดรายโรงพยาบาล กรุณาเข้าสู่ระบบ</p>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </PublicLayout>
  );
}