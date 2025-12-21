import { useState, useCallback } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Separator } from '@/components/ui/separator';
import { Progress } from '@/components/ui/progress';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Loader2, AlertTriangle, Shield, Clock, CheckCircle2, XCircle, Award, Info, TrendingUp } from 'lucide-react';
import { ImpactEvidenceUpload } from './ImpactEvidenceUpload';
import type { Database } from '@/integrations/supabase/types';

type ImpactScore = Database['public']['Tables']['impact_scores']['Row'];

interface ImpactSectionProps {
  assessmentId: string;
  impactScore: ImpactScore | null;
  onScoreChange: (score: ImpactScore | null) => void;
  readOnly: boolean;
}

interface QualityLevel {
  level: number;
  name: string;
  nameEn: string;
  minScore: number;
  maxScore: number;
  interpretation: string;
  color: string;
  bgColor: string;
  borderColor: string;
}

const qualityLevels: QualityLevel[] = [
  {
    level: 5,
    name: 'ดีเยี่ยม',
    nameEn: 'Excellent',
    minScore: 86,
    maxScore: 100,
    interpretation: 'ผลลัพธ์โดดเด่น สร้างผลกระทบเชิงบวกต่อประชาชนและระบบบริการสาธารณสุขอย่างยั่งยืน',
    color: 'text-emerald-600',
    bgColor: 'bg-emerald-50',
    borderColor: 'border-emerald-500',
  },
  {
    level: 4,
    name: 'ดี',
    nameEn: 'Good',
    minScore: 71,
    maxScore: 85,
    interpretation: 'ผลลัพธ์บรรลุเป้าหมายชัดเจน สร้างผลกระทบเชิงบวกต่อประชาชน แต่ควรพัฒนาระบบบริการสุขภาพอย่างต่อเนื่อง',
    color: 'text-blue-600',
    bgColor: 'bg-blue-50',
    borderColor: 'border-blue-500',
  },
  {
    level: 3,
    name: 'พอใช้',
    nameEn: 'Fair',
    minScore: 56,
    maxScore: 70,
    interpretation: 'ผลลัพธ์อยู่ในระดับมาตรฐาน มีระบบบริการสุขภาพบางส่วนต้องปรับปรุง',
    color: 'text-yellow-600',
    bgColor: 'bg-yellow-50',
    borderColor: 'border-yellow-500',
  },
  {
    level: 2,
    name: 'ต้องพัฒนา',
    nameEn: 'Developing',
    minScore: 41,
    maxScore: 55,
    interpretation: 'ผลลัพธ์ยังไม่บรรลุเป้าหมาย ต้องปรับกลยุทธ์หรือระบบสนับสนุน',
    color: 'text-orange-600',
    bgColor: 'bg-orange-50',
    borderColor: 'border-orange-500',
  },
  {
    level: 1,
    name: 'ต้องเร่งแก้ไข',
    nameEn: 'Critical',
    minScore: 0,
    maxScore: 40,
    interpretation: 'ผลลัพธ์ไม่เป็นไปตามเป้าหมาย หรือเกิดผลกระทบในทางลบต่อประชาชนและระบบบริการสุขภาพ ต้องแก้ไขเร่งด่วน',
    color: 'text-red-600',
    bgColor: 'bg-red-50',
    borderColor: 'border-red-500',
  },
];

const getQualityLevel = (percentScore: number): QualityLevel => {
  for (const level of qualityLevels) {
    if (percentScore >= level.minScore && percentScore <= level.maxScore) {
      return level;
    }
  }
  return qualityLevels[qualityLevels.length - 1];
};

const breachSeverityOptions = [
  { value: 'none', label: 'ไม่มี', penalty: 0 },
  { value: 'low', label: 'น้อย (1-100 records)', penalty: 2 },
  { value: 'medium', label: 'ปานกลาง (101-1000 records)', penalty: 5 },
  { value: 'high', label: 'มาก (1001-10000 records)', penalty: 8 },
  { value: 'critical', label: 'วิกฤต (>10000 records)', penalty: 15 },
];

export function ImpactSection({
  assessmentId,
  impactScore,
  onScoreChange,
  readOnly,
}: ImpactSectionProps) {
  const { profile } = useAuth();
  const { toast } = useToast();
  const [saving, setSaving] = useState(false);
  const [formData, setFormData] = useState({
    had_incident: impactScore?.had_incident ?? false,
    incident_recovery_hours: impactScore?.incident_recovery_hours ?? 0,
    had_data_breach: impactScore?.had_data_breach ?? false,
    breach_severity: impactScore?.breach_severity ?? 'none',
    comment: impactScore?.comment ?? '',
  });

  // Calculate scores based on criteria
  const calculateScores = useCallback((data: typeof formData) => {
    let incidentScore = 0;
    let breachScore = 0;

    if (data.had_incident) {
      if (data.incident_recovery_hours <= 4) incidentScore = -2;
      else if (data.incident_recovery_hours <= 24) incidentScore = -5;
      else if (data.incident_recovery_hours <= 72) incidentScore = -8;
      else incidentScore = -15;
    }

    if (data.had_data_breach) {
      const severity = breachSeverityOptions.find(s => s.value === data.breach_severity);
      breachScore = -(severity?.penalty ?? 0);
    }

    return {
      incident_score: incidentScore,
      breach_score: breachScore,
      breach_penalty_level: breachSeverityOptions.findIndex(s => s.value === data.breach_severity),
      total_score: Math.max(0, 15 + incidentScore + breachScore),
    };
  }, []);

  // Auto-save function
  const autoSave = useCallback(async (newFormData: typeof formData) => {
    if (readOnly || !profile) return;
    
    try {
      setSaving(true);
      const scores = calculateScores(newFormData);

      const data = {
        assessment_id: assessmentId,
        ...newFormData,
        ...scores,
        evaluated_by: profile.id,
        evaluated_at: new Date().toISOString(),
      };

      let result;
      if (impactScore) {
        const { data: updated, error } = await supabase
          .from('impact_scores')
          .update(data)
          .eq('id', impactScore.id)
          .select()
          .single();
        if (error) throw error;
        result = updated;
      } else {
        const { data: created, error } = await supabase
          .from('impact_scores')
          .insert(data)
          .select()
          .single();
        if (error) throw error;
        result = created;
      }

      onScoreChange(result);
    } catch (error: any) {
      console.error('Error auto-saving:', error);
      toast({ title: 'บันทึกไม่สำเร็จ', description: error.message, variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  }, [assessmentId, impactScore, profile, readOnly, calculateScores, onScoreChange, toast]);

  // Handle field change with auto-save
  const handleFieldChange = useCallback((field: keyof typeof formData, value: boolean | number | string) => {
    const newFormData = { ...formData, [field]: value };
    setFormData(newFormData);
    autoSave(newFormData);
  }, [formData, autoSave]);

  const scores = calculateScores(formData);

  const progressPercentage = (scores.total_score / 15) * 100;
  const hasIssues = formData.had_incident || formData.had_data_breach;

  // Calculate score converted to 15% weight (out of 1.5 points)
  const scoreOut1_5 = (scores.total_score / 15) * 1.5;

  // Get quality level based on percentage
  const qualityLevel = getQualityLevel(progressPercentage);

  return (
    <div className="space-y-6">
      {/* Progress Summary & Interpretation Cards - Side by Side */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Progress Summary Card */}
        <Card className={`border-2 ${qualityLevel.borderColor}`}>
          <CardHeader className="flex flex-row items-start justify-between pb-2">
            <div>
              <CardTitle className="text-base">ผลกระทบ (Impact) - 15%</CardTitle>
              <CardDescription className="text-xs">
                ประเมินผลกระทบจาก Cyber Incident และ Data Breach
              </CardDescription>
            </div>
            <div className="text-right">
              <div className="text-2xl font-bold text-primary">
                {scoreOut1_5.toFixed(2)}<span className="text-sm text-muted-foreground">/1.5</span>
              </div>
              <div className="text-xs text-muted-foreground">คะแนน</div>
            </div>
          </CardHeader>
          <CardContent className="pt-2">
            <div className="space-y-3">
              <Progress value={progressPercentage} className="h-2" />
              <div className="flex items-center justify-between text-xs">
                <div className="flex items-center gap-3">
                  <div className="flex items-center gap-1">
                    {formData.had_incident ? (
                      <XCircle className="w-3 h-3 text-destructive" />
                    ) : (
                      <CheckCircle2 className="w-3 h-3 text-success" />
                    )}
                    <span>Incident: {formData.had_incident ? `หัก ${Math.abs(scores.incident_score)}` : 'ไม่มี'}</span>
                  </div>
                  <div className="flex items-center gap-1">
                    {formData.had_data_breach ? (
                      <XCircle className="w-3 h-3 text-destructive" />
                    ) : (
                      <CheckCircle2 className="w-3 h-3 text-success" />
                    )}
                    <span>Breach: {formData.had_data_breach ? `หัก ${Math.abs(scores.breach_score)}` : 'ไม่มี'}</span>
                  </div>
                </div>
                <span className="font-medium">{scores.total_score}/15 ({progressPercentage.toFixed(1)}%)</span>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Quality Level Interpretation Card */}
        <Card className={`border-2 ${qualityLevel.borderColor}`}>
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-base">
              <Award className={`w-4 h-4 ${qualityLevel.color}`} />
              การแปลผลระดับผลกระทบ
              <Dialog>
                <DialogTrigger asChild>
                  <Button variant="ghost" size="icon" className="h-5 w-5 ml-1 rounded-full hover:bg-muted">
                    <Info className="w-3 h-3 text-muted-foreground hover:text-primary" />
                  </Button>
                </DialogTrigger>
                <DialogContent className="max-w-3xl max-h-[80vh] overflow-y-auto">
                  <DialogHeader>
                    <DialogTitle className="text-lg">ตารางที่ 7 การแปลผลคะแนนเพื่อสะท้อนระดับคุณภาพและระดับคะแนนของผลกระทบ</DialogTitle>
                  </DialogHeader>
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b">
                          <th className="text-left py-3 px-4 font-medium">ระดับคุณภาพ</th>
                          <th className="text-center py-3 px-4 font-medium">ช่วงคะแนน</th>
                          <th className="text-left py-3 px-4 font-medium">ความหมายโดยสรุป</th>
                        </tr>
                      </thead>
                      <tbody>
                        {qualityLevels.map((level) => (
                          <tr 
                            key={level.level} 
                            className={`border-b ${progressPercentage >= level.minScore && progressPercentage <= level.maxScore ? level.bgColor : ''}`}
                          >
                            <td className={`py-3 px-4 font-medium ${level.color}`}>
                              ระดับ {level.level} = {level.name} ({level.nameEn})
                            </td>
                            <td className={`py-3 px-4 text-center ${level.color}`}>
                              {level.level === 1 ? 'ต่ำกว่าหรือเท่ากับ 40' : `${level.minScore} - ${level.maxScore}`}
                            </td>
                            <td className="py-3 px-4 text-muted-foreground">
                              {level.interpretation}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </DialogContent>
              </Dialog>
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-0">
            <div className={`p-3 rounded-lg ${qualityLevel.bgColor} space-y-2`}>
              <div className="flex items-center justify-between flex-wrap gap-2">
                <div className="flex items-center gap-2 flex-wrap">
                  <div className={`px-2 py-0.5 rounded-full ${qualityLevel.bgColor} border ${qualityLevel.borderColor}`}>
                    <span className={`font-bold text-sm ${qualityLevel.color}`}>
                      ระดับ {qualityLevel.level} = {qualityLevel.name}
                    </span>
                  </div>
                  <span className="text-xs text-muted-foreground">
                    {qualityLevel.level === 1 ? '≤40' : `${qualityLevel.minScore}-${qualityLevel.maxScore}`}%
                  </span>
                </div>
              </div>
              <p className={`text-xs ${qualityLevel.color}`}>
                <strong>การแปลผล:</strong> {qualityLevel.interpretation}
              </p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Details Card */}
      <Card>
        <CardContent className="pt-6 space-y-6">
          {/* Cyber Incident Section */}
          <div className="space-y-4">
            <div className="flex items-center gap-2">
              <Shield className="w-4 h-4 text-destructive" />
              <h3 className="font-semibold">เหตุ Cyber Incident</h3>
              <span className="text-sm text-muted-foreground ml-auto">
                คะแนนหัก: {scores.incident_score}
              </span>
            </div>

            <div className="grid gap-4 pl-6">
              <div className="flex items-center justify-between gap-4">
                <div className="flex-1">
                  <Label htmlFor="had_incident">หน่วยบริการได้เกิดเหตุการณ์การโจมตีทางไซเบอร์ของระบบ HIS หรือ Website องค์กร หรือ Facebook องค์กร ในรอบประเมินนี้ จนทำให้ระบบไม่สามารถให้บริการได้</Label>
                  <ImpactEvidenceUpload 
                    impactScoreId={impactScore?.id || null} 
                    fieldName="had_incident" 
                    disabled={readOnly} 
                  />
                </div>
                <Switch
                  id="had_incident"
                  checked={formData.had_incident}
                  onCheckedChange={(checked) => handleFieldChange('had_incident', checked)}
                  disabled={readOnly || saving}
                />
              </div>

              {formData.had_incident && (
                <div className="space-y-2">
                  <Label htmlFor="incident_recovery_hours" className="flex items-center gap-2">
                    <Clock className="w-4 h-4" />
                    ระยะเวลาฟื้นฟูระบบ (ชั่วโมง)
                  </Label>
                  <div className="flex items-center gap-4">
                    <Input
                      id="incident_recovery_hours"
                      type="number"
                      min="0"
                      value={formData.incident_recovery_hours}
                      onChange={(e) => setFormData({ ...formData, incident_recovery_hours: parseInt(e.target.value) || 0 })}
                      onBlur={(e) => handleFieldChange('incident_recovery_hours', parseInt(e.target.value) || 0)}
                      disabled={readOnly || saving}
                      className="w-32"
                    />
                    <ImpactEvidenceUpload 
                      impactScoreId={impactScore?.id || null} 
                      fieldName="incident_recovery_hours" 
                      disabled={readOnly} 
                    />
                  </div>
                  <p className="text-xs text-muted-foreground">
                    ≤4 ชม. = -2, ≤24 ชม. = -5, ≤72 ชม. = -8, &gt;72 ชม. = -15
                  </p>
                </div>
              )}
            </div>
          </div>

          <Separator />

          {/* Data Breach Section */}
          <div className="space-y-4">
            <div className="flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-destructive" />
              <h3 className="font-semibold">HIS Data Breach</h3>
              <span className="text-sm text-muted-foreground ml-auto">
                คะแนนหัก: {scores.breach_score}
              </span>
            </div>

            <div className="grid gap-4 pl-6">
              <div className="flex items-center justify-between gap-4">
                <div className="flex-1">
                  <Label htmlFor="had_data_breach">ในรอบการประเมินนี้ มีเหตุการณ์รั่วไหลของฐานข้อมูลของโรงพยาบาล (HIS Data Breach) หรือมีเหตุการณ์ข้อมูลส่วนบุคคลรั่วไหลที่เกี่ยวข้องกับระบบสารสนเทศ จนสคส.วินิจฉัยโทษทางปกครอง</Label>
                  <ImpactEvidenceUpload 
                    impactScoreId={impactScore?.id || null} 
                    fieldName="had_data_breach" 
                    disabled={readOnly} 
                  />
                </div>
                <Switch
                  id="had_data_breach"
                  checked={formData.had_data_breach}
                  onCheckedChange={(checked) => handleFieldChange('had_data_breach', checked)}
                  disabled={readOnly || saving}
                />
              </div>

              {formData.had_data_breach && (
                <div className="space-y-2">
                  <Label htmlFor="breach_severity">ความรุนแรงของ Data Breach</Label>
                  <div className="flex items-center gap-4">
                    <Select
                      value={formData.breach_severity}
                      onValueChange={(value) => handleFieldChange('breach_severity', value)}
                      disabled={readOnly || saving}
                    >
                      <SelectTrigger className="w-full max-w-xs">
                        <SelectValue placeholder="เลือกความรุนแรง" />
                      </SelectTrigger>
                      <SelectContent>
                        {breachSeverityOptions.map((option) => (
                          <SelectItem key={option.value} value={option.value}>
                            {option.label} (หัก {option.penalty} คะแนน)
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <ImpactEvidenceUpload 
                      impactScoreId={impactScore?.id || null} 
                      fieldName="breach_severity" 
                      disabled={readOnly} 
                    />
                  </div>
                </div>
              )}
            </div>
          </div>

          <Separator />

          {/* Comments */}
          <div className="space-y-2">
            <Label htmlFor="impact_comment">รายละเอียดเหตุการณ์ (ถ้ามี)</Label>
            <Textarea
              id="impact_comment"
              placeholder="อธิบายรายละเอียดเหตุการณ์ที่เกิดขึ้น..."
              value={formData.comment}
              onChange={(e) => setFormData({ ...formData, comment: e.target.value })}
              onBlur={(e) => handleFieldChange('comment', e.target.value)}
              disabled={readOnly || saving}
              className="min-h-[100px]"
            />
          </div>

          {/* Auto-save indicator */}
          {saving && (
            <div className="flex items-center justify-end text-sm text-muted-foreground">
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              กำลังบันทึก...
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}