import { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ArrowLeft, MapPin, Loader2, CheckCircle, XCircle, FileText, Presentation, Check } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';

interface InspectionFile {
  id: string;
  province_id: string;
  fiscal_year: number;
  assessment_round: string;
  file_type: string;
  file_name: string;
  file_path: string;
}

interface ProvinceStats {
  provinceId: string;
  provinceName: string;
  round1Report?: InspectionFile;
  round1Slides?: InspectionFile;
  round2Report?: InspectionFile;
  round2Slides?: InspectionFile;
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
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState<string | null>(null);
  const [regionInfo, setRegionInfo] = useState<{ name: string; regionNumber: number } | null>(null);
  const [provinceStats, setProvinceStats] = useState<ProvinceStats[]>([]);
  const [fiscalYears, setFiscalYears] = useState<number[]>([]);
  const [selectedFiscalYear, setSelectedFiscalYear] = useState<string>(getCurrentFiscalYear().toString());
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [pendingUpload, setPendingUpload] = useState<{
    provinceId: string;
    round: string;
    fileType: 'report' | 'slides';
  } | null>(null);

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
        .select('id, name')
        .eq('health_region_id', regionId)
        .order('name', { ascending: true });

      if (!provinces) {
        setProvinceStats([]);
        return;
      }

      // Fetch inspection files for this region and fiscal year
      let inspectionQuery = supabase
        .from('inspection_files')
        .select('*')
        .eq('health_region_id', regionId);

      if (selectedFiscalYear !== 'all') {
        inspectionQuery = inspectionQuery.eq('fiscal_year', parseInt(selectedFiscalYear));
      }

      const { data: inspectionFiles } = await inspectionQuery;

      // Calculate stats per province
      const stats: ProvinceStats[] = provinces.map(province => {
        const provinceFiles = inspectionFiles?.filter(f => f.province_id === province.id) || [];

        return {
          provinceId: province.id,
          provinceName: province.name,
          round1Report: provinceFiles.find(f => f.assessment_round === 'รอบที่ 1' && f.file_type === 'report'),
          round1Slides: provinceFiles.find(f => f.assessment_round === 'รอบที่ 1' && f.file_type === 'slides'),
          round2Report: provinceFiles.find(f => f.assessment_round === 'รอบที่ 2' && f.file_type === 'report'),
          round2Slides: provinceFiles.find(f => f.assessment_round === 'รอบที่ 2' && f.file_type === 'slides'),
        };
      });

      setProvinceStats(stats);
    } catch (error) {
      console.error('Error fetching data:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [regionId, selectedFiscalYear]);

  const handleUploadClick = (provinceId: string, round: string, fileType: 'report' | 'slides') => {
    setPendingUpload({ provinceId, round, fileType });
    fileInputRef.current?.click();
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !pendingUpload || !user || !regionId) return;

    const { provinceId, round, fileType } = pendingUpload;
    const fiscalYear = selectedFiscalYear === 'all' ? getCurrentFiscalYear() : parseInt(selectedFiscalYear);
    
    setUploading(`${provinceId}-${round}-${fileType}`);

    try {
      // Upload file to storage
      const fileExt = file.name.split('.').pop();
      const fileName = `${regionId}/${provinceId}/${fiscalYear}/${round}/${fileType}.${fileExt}`;
      
      const { error: uploadError } = await supabase.storage
        .from('inspection-files')
        .upload(fileName, file, { upsert: true });

      if (uploadError) throw uploadError;

      // Get public URL
      const { data: urlData } = supabase.storage
        .from('inspection-files')
        .getPublicUrl(fileName);

      // Check if record exists
      const { data: existing } = await supabase
        .from('inspection_files')
        .select('id')
        .eq('province_id', provinceId)
        .eq('fiscal_year', fiscalYear)
        .eq('assessment_round', round)
        .eq('file_type', fileType)
        .maybeSingle();

      if (existing) {
        // Update existing record
        const { error: updateError } = await supabase
          .from('inspection_files')
          .update({
            file_name: file.name,
            file_path: urlData.publicUrl,
            file_size: file.size,
          })
          .eq('id', existing.id);

        if (updateError) throw updateError;
      } else {
        // Insert new record
        const { error: insertError } = await supabase
          .from('inspection_files')
          .insert({
            province_id: provinceId,
            health_region_id: regionId,
            fiscal_year: fiscalYear,
            assessment_round: round,
            file_type: fileType,
            file_name: file.name,
            file_path: urlData.publicUrl,
            file_size: file.size,
            uploaded_by: user.id,
          });

        if (insertError) throw insertError;
      }

      toast.success('อัพโหลดไฟล์สำเร็จ');
      fetchData();
    } catch (error: any) {
      console.error('Upload error:', error);
      toast.error('เกิดข้อผิดพลาดในการอัพโหลด: ' + error.message);
    } finally {
      setUploading(null);
      setPendingUpload(null);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  const getStatusBadge = (hasReport?: InspectionFile, hasSlides?: InspectionFile) => {
    if (hasReport || hasSlides) {
      return (
        <Badge className="bg-green-100 text-green-800 hover:bg-green-100">
          <CheckCircle className="h-3 w-3 mr-1" />
          นิเทศแล้ว
        </Badge>
      );
    }
    return (
      <Badge variant="outline" className="text-muted-foreground">
        <XCircle className="h-3 w-3 mr-1" />
        ยังไม่เริ่ม
      </Badge>
    );
  };

  const getUploadButton = (
    provinceId: string,
    round: string,
    fileType: 'report' | 'slides',
    existingFile?: InspectionFile
  ) => {
    const isUploading = uploading === `${provinceId}-${round}-${fileType}`;
    const Icon = fileType === 'report' ? FileText : Presentation;

    if (existingFile) {
      return (
        <Button
          variant="outline"
          size="sm"
          className="gap-1 bg-green-50 border-green-200 text-green-700 hover:bg-green-100"
          onClick={() => window.open(existingFile.file_path, '_blank')}
        >
          <Check className="h-3 w-3" />
          ดูไฟล์
        </Button>
      );
    }

    return (
      <Button
        variant="outline"
        size="sm"
        className="gap-1"
        onClick={() => handleUploadClick(provinceId, round, fileType)}
        disabled={isUploading}
      >
        {isUploading ? (
          <Loader2 className="h-3 w-3 animate-spin" />
        ) : (
          <Icon className="h-3 w-3" />
        )}
        อัพโหลด
      </Button>
    );
  };

  const completedRound1 = provinceStats.filter(p => p.round1Report || p.round1Slides).length;
  const completedRound2 = provinceStats.filter(p => p.round2Report || p.round2Slides).length;
  const totalProvinces = provinceStats.length;

  return (
    <DashboardLayout>
      <input
        type="file"
        ref={fileInputRef}
        onChange={handleFileChange}
        className="hidden"
        accept=".pdf,.doc,.docx,.ppt,.pptx,.xls,.xlsx"
      />

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
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>จังหวัด</TableHead>
                    <TableHead className="text-center">รอบที่ 1</TableHead>
                    <TableHead className="text-center">อัพโหลดรายงาน</TableHead>
                    <TableHead className="text-center">อัพโหลดสไลด์</TableHead>
                    <TableHead className="text-center">รอบที่ 2</TableHead>
                    <TableHead className="text-center">อัพโหลดรายงาน</TableHead>
                    <TableHead className="text-center">อัพโหลดสไลด์</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {provinceStats.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={7} className="text-center text-muted-foreground py-8">
                        ไม่พบข้อมูลจังหวัด
                      </TableCell>
                    </TableRow>
                  ) : (
                    provinceStats.map((stat) => (
                      <TableRow key={stat.provinceId}>
                        <TableCell className="font-medium">{stat.provinceName}</TableCell>
                        <TableCell className="text-center">
                          {getStatusBadge(stat.round1Report, stat.round1Slides)}
                        </TableCell>
                        <TableCell className="text-center">
                          {getUploadButton(stat.provinceId, 'รอบที่ 1', 'report', stat.round1Report)}
                        </TableCell>
                        <TableCell className="text-center">
                          {getUploadButton(stat.provinceId, 'รอบที่ 1', 'slides', stat.round1Slides)}
                        </TableCell>
                        <TableCell className="text-center">
                          {getStatusBadge(stat.round2Report, stat.round2Slides)}
                        </TableCell>
                        <TableCell className="text-center">
                          {getUploadButton(stat.provinceId, 'รอบที่ 2', 'report', stat.round2Report)}
                        </TableCell>
                        <TableCell className="text-center">
                          {getUploadButton(stat.provinceId, 'รอบที่ 2', 'slides', stat.round2Slides)}
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </DashboardLayout>
  );
}
