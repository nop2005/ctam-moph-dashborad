import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ArrowLeft, MapPin, Loader2, CheckCircle, Clock, XCircle } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';

interface ProvinceStats {
  provinceId: string;
  provinceName: string;
  provinceCode: string;
  round1Status: 'completed' | 'pending' | 'not_started';
  round2Status: 'completed' | 'pending' | 'not_started';
  round1AssessmentId?: string;
  round2AssessmentId?: string;
}

const getCurrentFiscalYear = () => {
  const now = new Date();
  const month = now.getMonth();
  const year = now.getFullYear();
  return month >= 9 ? year + 1 : year;
};

export default function InspectionRegionDetail() {
  const { regionId } = useParams<{ regionId: string }>();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [regionInfo, setRegionInfo] = useState<{ name: string; regionNumber: number } | null>(null);
  const [provinceStats, setProvinceStats] = useState<ProvinceStats[]>([]);
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
      if (!regionId) return;
      
      setLoading(true);
      try {
        // Fetch region info
        const { data: region } = await supabase
          .from('health_regions')
          .select('name, region_number')
          .eq('id', regionId)
          .maybeSingle();

        if (region) {
          setRegionInfo({ name: region.name, regionNumber: region.region_number });
        }

        // Fetch provinces in this region
        const { data: provinces } = await supabase
          .from('provinces')
          .select('id, name, code')
          .eq('health_region_id', regionId)
          .order('name', { ascending: true });

        if (!provinces) {
          setProvinceStats([]);
          return;
        }

        // Fetch assessments for provinces in this region
        let assessmentQuery = supabase
          .from('assessments')
          .select(`
            id,
            assessment_period,
            status,
            hospitals!inner(province_id)
          `)
          .in('status', ['approved_provincial', 'approved_regional']);

        if (selectedFiscalYear !== 'all') {
          assessmentQuery = assessmentQuery.eq('fiscal_year', parseInt(selectedFiscalYear));
        }

        const { data: assessments } = await assessmentQuery;

        // Calculate stats per province
        const stats: ProvinceStats[] = provinces.map(province => {
          const provinceAssessments = assessments?.filter(a => {
            const hospital = a.hospitals as any;
            return hospital?.province_id === province.id;
          }) || [];

          const round1Assessment = provinceAssessments.find(a => a.assessment_period === 'รอบที่ 1');
          const round2Assessment = provinceAssessments.find(a => a.assessment_period === 'รอบที่ 2');

          const getStatus = (assessment: any): 'completed' | 'pending' | 'not_started' => {
            if (!assessment) return 'not_started';
            if (assessment.status === 'approved_regional') return 'completed';
            return 'pending';
          };

          return {
            provinceId: province.id,
            provinceName: province.name,
            provinceCode: province.code,
            round1Status: getStatus(round1Assessment),
            round2Status: getStatus(round2Assessment),
            round1AssessmentId: round1Assessment?.id,
            round2AssessmentId: round2Assessment?.id,
          };
        });

        setProvinceStats(stats);
      } catch (error) {
        console.error('Error fetching data:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [regionId, selectedFiscalYear]);

  const getStatusBadge = (status: 'completed' | 'pending' | 'not_started') => {
    switch (status) {
      case 'completed':
        return (
          <Badge className="bg-green-100 text-green-800 hover:bg-green-100">
            <CheckCircle className="h-3 w-3 mr-1" />
            นิเทศแล้ว
          </Badge>
        );
      case 'pending':
        return (
          <Badge className="bg-yellow-100 text-yellow-800 hover:bg-yellow-100">
            <Clock className="h-3 w-3 mr-1" />
            รอดำเนินการ
          </Badge>
        );
      case 'not_started':
        return (
          <Badge variant="outline" className="text-muted-foreground">
            <XCircle className="h-3 w-3 mr-1" />
            ยังไม่เริ่ม
          </Badge>
        );
    }
  };

  const completedRound1 = provinceStats.filter(p => p.round1Status === 'completed').length;
  const completedRound2 = provinceStats.filter(p => p.round2Status === 'completed').length;
  const totalProvinces = provinceStats.length;

  return (
    <DashboardLayout>
      <div className="mb-6 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => navigate('/inspection/supervisor')}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div>
            <h1 className="text-2xl font-bold">
              {regionInfo ? regionInfo.name : 'รายละเอียดเขตสุขภาพ'}
            </h1>
            <p className="text-muted-foreground">รายการจังหวัดและสถานะการนิเทศ</p>
          </div>
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

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">จำนวนจังหวัด</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totalProvinces}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">นิเทศรอบที่ 1</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">
              {completedRound1}/{totalProvinces}
              <span className="text-sm font-normal text-muted-foreground ml-2">
                ({totalProvinces > 0 ? ((completedRound1 / totalProvinces) * 100).toFixed(1) : 0}%)
              </span>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">นิเทศรอบที่ 2</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-blue-600">
              {completedRound2}/{totalProvinces}
              <span className="text-sm font-normal text-muted-foreground ml-2">
                ({totalProvinces > 0 ? ((completedRound2 / totalProvinces) * 100).toFixed(1) : 0}%)
              </span>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <MapPin className="h-5 w-5" />
            รายการจังหวัด
          </CardTitle>
          <CardDescription>
            สถานะการนิเทศแต่ละจังหวัดในเขตสุขภาพ
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
                  <TableHead>จังหวัด</TableHead>
                  <TableHead>รหัส</TableHead>
                  <TableHead className="text-center">รอบที่ 1</TableHead>
                  <TableHead className="text-center">รอบที่ 2</TableHead>
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
                    <TableRow key={stat.provinceId}>
                      <TableCell className="font-medium">{stat.provinceName}</TableCell>
                      <TableCell className="text-muted-foreground">{stat.provinceCode}</TableCell>
                      <TableCell className="text-center">{getStatusBadge(stat.round1Status)}</TableCell>
                      <TableCell className="text-center">{getStatusBadge(stat.round2Status)}</TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </DashboardLayout>
  );
}
