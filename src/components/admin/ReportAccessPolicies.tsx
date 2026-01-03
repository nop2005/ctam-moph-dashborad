import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { toast } from 'sonner';
import { RefreshCw, Shield, Save } from 'lucide-react';

interface ReportAccessPolicy {
  id: string;
  role: string;
  report_type: string;
  view_region: boolean;
  drill_to_province: string;
  drill_to_hospital: string;
  view_same_province_hospitals: boolean;
}

const ROLES = [
  { value: 'hospital_it', label: 'IT โรงพยาบาล' },
  { value: 'health_office', label: 'IT สสจ.' },
  { value: 'provincial', label: 'ผู้ประเมินระดับจังหวัด' },
  { value: 'regional', label: 'ผู้ประเมินระดับเขต' },
  { value: 'central_admin', label: 'Super Admin' },
  { value: 'supervisor', label: 'ผู้นิเทศ' },
];

const REPORT_TYPES = [
  { value: 'overview', label: 'รายงานภาพรวม' },
  { value: 'quantitative', label: 'รายงานเชิงปริมาณ' },
  { value: 'impact', label: 'รายงานเชิงผลกระทบ' },
];

const DRILL_OPTIONS = [
  { value: 'all', label: 'ทั้งหมด' },
  { value: 'own_region', label: 'เฉพาะเขตตัวเอง' },
  { value: 'own_province', label: 'เฉพาะจังหวัดตัวเอง' },
  { value: 'none', label: 'ไม่อนุญาต' },
];

export function ReportAccessPolicies() {
  const [policies, setPolicies] = useState<ReportAccessPolicy[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [selectedReportType, setSelectedReportType] = useState('overview');
  const [hasChanges, setHasChanges] = useState(false);

  useEffect(() => {
    fetchPolicies();
  }, []);

  const fetchPolicies = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('report_access_policies')
        .select('*')
        .order('role');

      if (error) throw error;
      setPolicies(data || []);
    } catch (error) {
      console.error('Error fetching policies:', error);
      toast.error('ไม่สามารถโหลดนโยบายได้');
    } finally {
      setLoading(false);
    }
  };

  const handlePolicyChange = (
    role: string,
    field: 'view_region' | 'drill_to_province' | 'drill_to_hospital' | 'view_same_province_hospitals',
    value: boolean | string
  ) => {
    setPolicies(prev => {
      return prev.map(p => {
        if (p.role === role && p.report_type === selectedReportType) {
          return { ...p, [field]: value };
        }
        return p;
      });
    });
    setHasChanges(true);
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const policiesToUpdate = policies.filter(p => p.report_type === selectedReportType);
      
      for (const policy of policiesToUpdate) {
        const { error } = await supabase
          .from('report_access_policies')
          .update({
            view_region: policy.view_region,
            drill_to_province: policy.drill_to_province,
            drill_to_hospital: policy.drill_to_hospital,
            view_same_province_hospitals: policy.view_same_province_hospitals,
          })
          .eq('id', policy.id);
        
        if (error) throw error;
      }
      
      toast.success('บันทึกนโยบายสำเร็จ');
      setHasChanges(false);
    } catch (error) {
      console.error('Error saving policies:', error);
      toast.error('ไม่สามารถบันทึกนโยบายได้');
    } finally {
      setSaving(false);
    }
  };

  const filteredPolicies = policies.filter(p => p.report_type === selectedReportType);

  const getRoleLabel = (role: string) => {
    return ROLES.find(r => r.value === role)?.label || role;
  };

  const getRoleBadgeVariant = (role: string): 'default' | 'secondary' | 'destructive' | 'outline' => {
    const variants: Record<string, 'default' | 'secondary' | 'destructive' | 'outline'> = {
      hospital_it: 'secondary',
      health_office: 'outline',
      provincial: 'outline',
      regional: 'default',
      central_admin: 'destructive',
      supervisor: 'default',
    };
    return variants[role] || 'secondary';
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Shield className="h-5 w-5" />
              นโยบายการเข้าถึงรายงาน
            </CardTitle>
            <CardDescription>
              กำหนดสิทธิ์การ drill-down รายงานสำหรับแต่ละบทบาท
            </CardDescription>
          </div>
          <div className="flex items-center gap-2">
            <Select value={selectedReportType} onValueChange={setSelectedReportType}>
              <SelectTrigger className="w-[200px]">
                <SelectValue placeholder="เลือกรายงาน" />
              </SelectTrigger>
              <SelectContent>
                {REPORT_TYPES.map(rt => (
                  <SelectItem key={rt.value} value={rt.value}>
                    {rt.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button variant="outline" size="icon" onClick={fetchPolicies} disabled={loading}>
              <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <div className="rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-[180px]">บทบาท</TableHead>
                <TableHead className="text-center">เห็นระดับเขต</TableHead>
                <TableHead className="text-center">Drill ไประดับจังหวัด</TableHead>
                <TableHead className="text-center">Drill ไประดับสถานบริการ</TableHead>
                <TableHead className="text-center w-[140px]">เห็น รพ.อื่นในจังหวัด</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow>
                  <TableCell colSpan={5} className="text-center py-8">
                    <RefreshCw className="h-6 w-6 animate-spin mx-auto text-muted-foreground" />
                  </TableCell>
                </TableRow>
              ) : filteredPolicies.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} className="text-center py-8 text-muted-foreground">
                    ไม่พบข้อมูลนโยบาย
                  </TableCell>
                </TableRow>
              ) : (
                filteredPolicies.map(policy => (
                  <TableRow key={policy.id}>
                    <TableCell>
                      <Badge variant={getRoleBadgeVariant(policy.role)}>
                        {getRoleLabel(policy.role)}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-center">
                      <Checkbox
                        checked={policy.view_region}
                        onCheckedChange={(checked) => 
                          handlePolicyChange(policy.role, 'view_region', checked as boolean)
                        }
                      />
                    </TableCell>
                    <TableCell className="text-center">
                      <Select
                        value={policy.drill_to_province}
                        onValueChange={(value) => 
                          handlePolicyChange(policy.role, 'drill_to_province', value)
                        }
                      >
                        <SelectTrigger className="w-[160px] mx-auto">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {DRILL_OPTIONS.map(opt => (
                            <SelectItem key={opt.value} value={opt.value}>
                              {opt.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </TableCell>
                    <TableCell className="text-center">
                      <Select
                        value={policy.drill_to_hospital}
                        onValueChange={(value) => 
                          handlePolicyChange(policy.role, 'drill_to_hospital', value)
                        }
                      >
                        <SelectTrigger className="w-[160px] mx-auto">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {DRILL_OPTIONS.map(opt => (
                            <SelectItem key={opt.value} value={opt.value}>
                              {opt.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </TableCell>
                    <TableCell className="text-center">
                      <Checkbox
                        checked={policy.view_same_province_hospitals}
                        onCheckedChange={(checked) => 
                          handlePolicyChange(policy.role, 'view_same_province_hospitals', checked as boolean)
                        }
                      />
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
        
        {hasChanges && (
          <div className="mt-4 flex justify-end">
            <Button onClick={handleSave} disabled={saving} className="gap-2">
              {saving ? (
                <RefreshCw className="h-4 w-4 animate-spin" />
              ) : (
                <Save className="h-4 w-4" />
              )}
              บันทึกการเปลี่ยนแปลง
            </Button>
          </div>
        )}
        
        <div className="mt-6 p-4 bg-muted/50 rounded-lg">
          <h4 className="font-medium mb-2">คำอธิบายตัวเลือก:</h4>
          <ul className="text-sm text-muted-foreground space-y-1">
            <li><span className="font-medium">ทั้งหมด:</span> ดูได้ทุกเขต/จังหวัด</li>
            <li><span className="font-medium">เฉพาะเขตตัวเอง:</span> ดูได้เฉพาะเขตสุขภาพที่ตนเองสังกัด</li>
            <li><span className="font-medium">เฉพาะจังหวัดตัวเอง:</span> ดูได้เฉพาะจังหวัดที่ตนเองสังกัด</li>
            <li><span className="font-medium">ไม่อนุญาต:</span> ไม่สามารถ drill-down ได้</li>
            <li><span className="font-medium">เห็น รพ.อื่นในจังหวัด:</span> เมื่อเปิด IT รพ. จะสามารถเห็นคะแนนของ รพ.อื่นในจังหวัดเดียวกันได้</li>
          </ul>
        </div>
      </CardContent>
    </Card>
  );
}
