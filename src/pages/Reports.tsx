import { useEffect, useState } from 'react';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

import { ScoreChart, DrillLevel } from '@/components/reports/ScoreChart';
import { 
  Table, 
  TableBody, 
  TableCell, 
  TableHead, 
  TableHeader, 
  TableRow 
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { BarChart3, FileText, Building2 } from 'lucide-react';
import { toast } from 'sonner';

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

interface Assessment {
  id: string;
  hospital_id: string;
  status: string;
  fiscal_year: number;
  assessment_period: string;
  total_score: number | null;
  quantitative_score: number | null;
  qualitative_score: number | null;
  impact_score: number | null;
}

interface HospitalReport {
  hospital: Hospital;
  province: Province;
  assessment: Assessment | null;
}

const statusLabels: Record<string, { label: string; variant: 'default' | 'secondary' | 'destructive' | 'outline' }> = {
  'draft': { label: 'ร่าง', variant: 'secondary' },
  'submitted': { label: 'รอ สสจ. ตรวจสอบ', variant: 'outline' },
  'returned': { label: 'ต้องแก้ไข', variant: 'destructive' },
  'approved_provincial': { label: 'รอเขตสุขภาพตรวจสอบ', variant: 'outline' },
  'approved_regional': { label: 'ผ่านการประเมิน', variant: 'default' },
  'completed': { label: 'เสร็จสิ้น', variant: 'default' },
};

export default function Reports() {
  const { profile } = useAuth();
  const [loading, setLoading] = useState(true);
  const [healthRegions, setHealthRegions] = useState<HealthRegion[]>([]);
  const [provinces, setProvinces] = useState<Province[]>([]);
  const [hospitals, setHospitals] = useState<Hospital[]>([]);
  const [assessments, setAssessments] = useState<Assessment[]>([]);
  
  
  // Chart drill state for syncing table
  const [chartDrillLevel, setChartDrillLevel] = useState<DrillLevel>('region');
  const [chartRegionId, setChartRegionId] = useState<string | null>(null);
  const [chartProvinceId, setChartProvinceId] = useState<string | null>(null);

  const handleDrillChange = (level: DrillLevel, regionId: string | null, provinceId: string | null) => {
    setChartDrillLevel(level);
    setChartRegionId(regionId);
    setChartProvinceId(provinceId);
  };

  // Fetch initial data
  useEffect(() => {
    const fetchData = async () => {
      try {
        const [regionsRes, provincesRes, hospitalsRes, assessmentsRes] = await Promise.all([
          supabase.from('health_regions').select('*').order('region_number'),
          supabase.from('provinces').select('*').order('name'),
          supabase.from('hospitals').select('*').order('name'),
          supabase.from('assessments').select('*'),
        ]);

        if (regionsRes.error) throw regionsRes.error;
        if (provincesRes.error) throw provincesRes.error;
        if (hospitalsRes.error) throw hospitalsRes.error;
        if (assessmentsRes.error) throw assessmentsRes.error;

        setHealthRegions(regionsRes.data || []);
        setProvinces(provincesRes.data || []);
        setHospitals(hospitalsRes.data || []);
        setAssessments(assessmentsRes.data || []);

      } catch (error) {
        console.error('Error fetching data:', error);
        toast.error('เกิดข้อผิดพลาดในการโหลดข้อมูล');
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [profile]);


  // Calculate statistics based on drill level
  const drillStats = (() => {
    let filteredHospitals: Hospital[] = [];
    let filteredAssessments: Assessment[] = [];

    if (chartDrillLevel === 'region') {
      // All hospitals
      filteredHospitals = hospitals;
      filteredAssessments = assessments;
    } else if (chartDrillLevel === 'province' && chartRegionId) {
      // Hospitals in selected region
      const regionProvinces = provinces.filter(p => p.health_region_id === chartRegionId);
      filteredHospitals = hospitals.filter(h => 
        regionProvinces.some(p => p.id === h.province_id)
      );
      filteredAssessments = assessments.filter(a =>
        filteredHospitals.some(h => h.id === a.hospital_id)
      );
    } else if (chartDrillLevel === 'hospital' && chartProvinceId) {
      // Hospitals in selected province
      filteredHospitals = hospitals.filter(h => h.province_id === chartProvinceId);
      filteredAssessments = assessments.filter(a =>
        filteredHospitals.some(h => h.id === a.hospital_id)
      );
    }

    return {
      totalHospitals: filteredHospitals.length,
      withAssessment: filteredAssessments.length,
      completed: filteredAssessments.filter(a => 
        a.status === 'approved_regional' || a.status === 'completed'
      ).length,
      pending: filteredAssessments.filter(a => 
        a.status === 'submitted' || a.status === 'approved_provincial'
      ).length,
    };
  })();

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold">รายงานและสถิติ</h1>
            <p className="text-muted-foreground">สรุปผลการประเมินตามจังหวัดและเขตสุขภาพ</p>
          </div>
        </div>

        {/* Statistics - based on drill level */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Card>
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-2xl font-bold">{drillStats.totalHospitals}</p>
                  <p className="text-sm text-muted-foreground">โรงพยาบาลทั้งหมด</p>
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
                  <p className="text-2xl font-bold">{drillStats.withAssessment}</p>
                  <p className="text-sm text-muted-foreground">มีแบบประเมิน</p>
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
                  <p className="text-2xl font-bold">{drillStats.completed}</p>
                  <p className="text-sm text-muted-foreground">ผ่านการประเมิน</p>
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
                  <p className="text-2xl font-bold">{drillStats.pending}</p>
                  <p className="text-sm text-muted-foreground">รอตรวจสอบ</p>
                </div>
                <div className="w-12 h-12 rounded-xl bg-warning/10 flex items-center justify-center">
                  <FileText className="w-6 h-6 text-warning" />
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Score Chart */}
        <ScoreChart
          healthRegions={healthRegions}
          provinces={provinces}
          hospitals={hospitals}
          assessments={assessments}
          onDrillChange={handleDrillChange}
        />

        {/* Dynamic Reports Table based on drill level */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <BarChart3 className="w-5 h-5" />
              {chartDrillLevel === 'region' && 'รายงานสรุปรายเขตสุขภาพ'}
              {chartDrillLevel === 'province' && `รายงานสรุปรายจังหวัด - เขตสุขภาพที่ ${healthRegions.find(r => r.id === chartRegionId)?.region_number || ''}`}
              {chartDrillLevel === 'hospital' && `รายงานผลการประเมินรายโรงพยาบาล - ${provinces.find(p => p.id === chartProvinceId)?.name || ''}`}
            </CardTitle>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="text-center py-8 text-muted-foreground">กำลังโหลด...</div>
            ) : chartDrillLevel === 'region' ? (
              // Region level table
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>เขตสุขภาพ</TableHead>
                      <TableHead className="text-right">จำนวน รพ.</TableHead>
                      <TableHead className="text-right">มีแบบประเมิน</TableHead>
                      <TableHead className="text-right">ผ่านการประเมิน</TableHead>
                      <TableHead className="text-right">คะแนนเฉลี่ย</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {healthRegions.map((region) => {
                      const regionProvinces = provinces.filter(p => p.health_region_id === region.id);
                      const regionHospitals = hospitals.filter(h => 
                        regionProvinces.some(p => p.id === h.province_id)
                      );
                      const regionAssessments = assessments.filter(a =>
                        regionHospitals.some(h => h.id === a.hospital_id)
                      );
                      const completedCount = regionAssessments.filter(a => 
                        a.status === 'approved_regional' || a.status === 'completed'
                      ).length;
                      const avgScore = regionAssessments.length > 0
                        ? regionAssessments.reduce((sum, a) => sum + (a.total_score || 0), 0) / regionAssessments.filter(a => a.total_score !== null).length
                        : 0;

                      return (
                        <TableRow key={region.id}>
                          <TableCell className="font-medium">เขตสุขภาพที่ {region.region_number}</TableCell>
                          <TableCell className="text-right">{regionHospitals.length}</TableCell>
                          <TableCell className="text-right">{regionAssessments.length}</TableCell>
                          <TableCell className="text-right">{completedCount}</TableCell>
                          <TableCell className="text-right font-medium">
                            {avgScore > 0 ? avgScore.toFixed(2) : '-'}
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>
            ) : chartDrillLevel === 'province' && chartRegionId ? (
              // Province level table
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>จังหวัด</TableHead>
                      <TableHead className="text-right">จำนวน รพ.</TableHead>
                      <TableHead className="text-right">มีแบบประเมิน</TableHead>
                      <TableHead className="text-right">ผ่านการประเมิน</TableHead>
                      <TableHead className="text-right">คะแนนเฉลี่ย</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {provinces.filter(p => p.health_region_id === chartRegionId).map((province) => {
                      const provinceHospitals = hospitals.filter(h => h.province_id === province.id);
                      const provinceAssessments = assessments.filter(a =>
                        provinceHospitals.some(h => h.id === a.hospital_id)
                      );
                      const completedCount = provinceAssessments.filter(a => 
                        a.status === 'approved_regional' || a.status === 'completed'
                      ).length;
                      const assessmentsWithScore = provinceAssessments.filter(a => a.total_score !== null);
                      const avgScore = assessmentsWithScore.length > 0
                        ? assessmentsWithScore.reduce((sum, a) => sum + (a.total_score || 0), 0) / assessmentsWithScore.length
                        : 0;

                      return (
                        <TableRow key={province.id}>
                          <TableCell className="font-medium">{province.name}</TableCell>
                          <TableCell className="text-right">{provinceHospitals.length}</TableCell>
                          <TableCell className="text-right">{provinceAssessments.length}</TableCell>
                          <TableCell className="text-right">{completedCount}</TableCell>
                          <TableCell className="text-right font-medium">
                            {avgScore > 0 ? avgScore.toFixed(2) : '-'}
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>
            ) : chartDrillLevel === 'hospital' && chartProvinceId ? (
              // Hospital level table
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>รหัส</TableHead>
                      <TableHead>โรงพยาบาล</TableHead>
                      <TableHead>สถานะ</TableHead>
                      <TableHead className="text-right">คะแนนรวม</TableHead>
                      <TableHead className="text-right">Quantitative</TableHead>
                      <TableHead className="text-right">Qualitative</TableHead>
                      <TableHead className="text-right">Impact</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {hospitals.filter(h => h.province_id === chartProvinceId).map((hospital) => {
                      const assessment = assessments.find(a => a.hospital_id === hospital.id);

                      return (
                        <TableRow key={hospital.id}>
                          <TableCell className="font-mono text-sm">{hospital.code}</TableCell>
                          <TableCell className="font-medium">{hospital.name}</TableCell>
                          <TableCell>
                            {assessment ? (
                              <Badge variant={statusLabels[assessment.status]?.variant || 'secondary'}>
                                {statusLabels[assessment.status]?.label || assessment.status}
                              </Badge>
                            ) : (
                              <Badge variant="outline">ยังไม่มีข้อมูล</Badge>
                            )}
                          </TableCell>
                          <TableCell className="text-right font-medium">
                            {assessment?.total_score?.toFixed(2) || '-'}
                          </TableCell>
                          <TableCell className="text-right">
                            {assessment?.quantitative_score?.toFixed(2) || '-'}
                          </TableCell>
                          <TableCell className="text-right">
                            {assessment?.qualitative_score?.toFixed(2) || '-'}
                          </TableCell>
                          <TableCell className="text-right">
                            {assessment?.impact_score?.toFixed(2) || '-'}
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>
            ) : (
              <div className="text-center py-8 text-muted-foreground">ไม่พบข้อมูล</div>
            )}
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}
