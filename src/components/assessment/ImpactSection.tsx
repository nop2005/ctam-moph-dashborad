import { useState, useCallback } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Separator } from '@/components/ui/separator';
import { Progress } from '@/components/ui/progress';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Loader2, AlertTriangle, Shield, Award, Info } from 'lucide-react';
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

// ข้อ 1: Cyber Incident options (50% total)
const cyberIncidentOptions = [
  { value: 'no_incident', label: 'ระบบให้บริการได้ (ไม่มีเหตุการณ์โจมตีทางไซเบอร์)', score: 50 },
  { value: 'recovery_under_24', label: 'มีเหตุการณ์ แต่กู้คืนไม่เกิน 24 ชั่วโมง', score: 42.5 },
  { value: 'recovery_25_48', label: 'มีเหตุการณ์ กู้คืน 25-48 ชั่วโมง', score: 35 },
  { value: 'recovery_49_72', label: 'มีเหตุการณ์ กู้คืน 49-72 ชั่วโมง', score: 27.5 },
  { value: 'recovery_73_96', label: 'มีเหตุการณ์ กู้คืน 73-96 ชั่วโมง', score: 20 },
];

// ข้อ 2: HIS Data Breach options (50% total)
const dataBreachOptions = [
  { value: 'no_breach', label: 'ไม่มีเหตุการณ์รั่วไหลของฐานข้อมูลของโรงพยาบาล (HIS Data Breach) หรือไม่มีเหตุการณ์ข้อมูลส่วนบุคคลรั่วไหลที่เกี่ยวข้องกับระบบสารสนเทศ', score: 50 },
  { value: 'no_fine_training', label: 'สคส.วินิจฉัยโทษทางปกครองระดับไม่ร้ายแรง และให้อบรมเจ้าหน้าที่เพิ่มเติม', score: 42.5 },
  { value: 'no_fine_fix', label: 'สคส.วินิจฉัยโทษทางปกครองระดับไม่ร้ายแรง และให้แก้ไขหรือปรับปรุงกระบวนการหรือเอกสารที่เกี่ยวข้อง', score: 35 },
  { value: 'fine_under_1m', label: 'สคส.วินิจฉัยโทษทางปกครองระดับร้ายแรง ปรับไม่เกิน 1 ล้านบาท', score: 27.5 },
  { value: 'fine_1m_3m', label: 'สคส.วินิจฉัยโทษทางปกครองระดับร้ายแรง ปรับ 1-3 ล้านบาท', score: 20 },
];

// Helper to convert old data format to new format
const getIncidentValueFromOldData = (hadIncident: boolean | null, recoveryHours: number | null): string => {
  if (!hadIncident) return 'no_incident';
  if (recoveryHours === null || recoveryHours === 0) return 'no_incident';
  if (recoveryHours <= 24) return 'recovery_under_24';
  if (recoveryHours <= 48) return 'recovery_25_48';
  if (recoveryHours <= 72) return 'recovery_49_72';
  return 'recovery_73_96';
};

const getBreachValueFromOldData = (hadBreach: boolean | null, severity: string | null): string => {
  if (!hadBreach) return 'no_breach';
  switch (severity) {
    case 'no_fine_training': return 'no_fine_training';
    case 'no_fine_fix': return 'no_fine_fix';
    case 'fine_under_1m': return 'fine_under_1m';
    case 'fine_1m_3m': return 'fine_1m_3m';
    default: return 'no_breach';
  }
};

export function ImpactSection({
  assessmentId,
  impactScore,
  onScoreChange,
  readOnly,
}: ImpactSectionProps) {
  const { profile } = useAuth();
  const { toast } = useToast();
  const [saving, setSaving] = useState(false);
  
  // Initialize from existing data or defaults
  const initialIncidentValue = impactScore 
    ? getIncidentValueFromOldData(impactScore.had_incident, impactScore.incident_recovery_hours)
    : 'no_incident';
  const initialBreachValue = impactScore 
    ? getBreachValueFromOldData(impactScore.had_data_breach, impactScore.breach_severity)
    : 'no_breach';
    
  const [formData, setFormData] = useState({
    incident_option: initialIncidentValue,
    breach_option: initialBreachValue,
    incident_comment: '',
    breach_comment: '',
    comment: impactScore?.comment ?? '',
  });

  // Calculate scores based on selected options
  const calculateScores = useCallback((data: typeof formData) => {
    const incidentOption = cyberIncidentOptions.find(o => o.value === data.incident_option);
    const breachOption = dataBreachOptions.find(o => o.value === data.breach_option);
    
    const incidentScore = incidentOption?.score ?? 50;
    const breachScore = breachOption?.score ?? 50;
    const totalScore = incidentScore + breachScore; // Max 100
    
    return {
      incident_score: incidentScore,
      breach_score: breachScore,
      total_score: totalScore,
    };
  }, []);

  // Auto-save function
  const autoSave = useCallback(async (newFormData: typeof formData) => {
    if (readOnly || !profile) return;
    
    try {
      setSaving(true);
      const scores = calculateScores(newFormData);
      
      // Map new format to database fields
      const hadIncident = newFormData.incident_option !== 'no_incident';
      const hadBreach = newFormData.breach_option !== 'no_breach';

      const data = {
        assessment_id: assessmentId,
        had_incident: hadIncident,
        incident_recovery_hours: hadIncident ? getRecoveryHoursFromOption(newFormData.incident_option) : null,
        incident_score: scores.incident_score,
        had_data_breach: hadBreach,
        breach_severity: hadBreach ? newFormData.breach_option : null,
        breach_score: scores.breach_score,
        total_score: scores.total_score,
        comment: newFormData.comment,
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

  // Helper to get recovery hours from option
  const getRecoveryHoursFromOption = (option: string): number => {
    switch (option) {
      case 'recovery_under_24': return 24;
      case 'recovery_25_48': return 48;
      case 'recovery_49_72': return 72;
      case 'recovery_73_96': return 96;
      default: return 0;
    }
  };

  // Handle field change with auto-save
  const handleFieldChange = useCallback((field: keyof typeof formData, value: string) => {
    const newFormData = { ...formData, [field]: value };
    setFormData(newFormData);
    autoSave(newFormData);
  }, [formData, autoSave]);

  const scores = calculateScores(formData);
  const progressPercentage = scores.total_score;

  // Calculate score converted to 15% weight (out of 1.5 points)
  const scoreOut1_5 = (scores.total_score / 100) * 1.5;

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
                    <Shield className="w-3 h-3 text-primary" />
                    <span>Incident: {scores.incident_score}%</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <AlertTriangle className="w-3 h-3 text-primary" />
                    <span>Breach: {scores.breach_score}%</span>
                  </div>
                </div>
                <span className="font-medium">{scores.total_score}/100 ({progressPercentage.toFixed(1)}%)</span>
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
          {/* ข้อ 1: Cyber Incident Section */}
          <div className="space-y-4">
            <div className="flex items-center gap-2">
              <div className="flex items-center justify-center w-6 h-6 rounded-full bg-primary text-primary-foreground text-sm font-bold">
                1
              </div>
              <Shield className="w-4 h-4 text-destructive" />
              <h3 className="font-semibold">เหตุ Cyber Incident</h3>
              <span className="text-sm text-muted-foreground ml-auto">
                คะแนน: {scores.incident_score}%
              </span>
            </div>

            <div className="pl-8 space-y-3">
              <p className="text-sm text-muted-foreground">
                หน่วยบริการได้เกิดเหตุการณ์การโจมตีทางไซเบอร์ของระบบ HIS หรือ Website องค์กร หรือ Facebook องค์กร ในรอบประเมินนี้ จนทำให้ระบบไม่สามารถให้บริการได้
              </p>
              
              <RadioGroup
                value={formData.incident_option}
                onValueChange={(value) => handleFieldChange('incident_option', value)}
                disabled={readOnly || saving}
                className="space-y-2"
              >
                {cyberIncidentOptions.map((option) => (
                  <div key={option.value} className="flex items-start space-x-3 p-3 rounded-lg border hover:bg-muted/50 transition-colors">
                    <RadioGroupItem value={option.value} id={`incident_${option.value}`} className="mt-0.5" />
                    <div className="flex-1">
                      <Label htmlFor={`incident_${option.value}`} className="cursor-pointer text-sm">
                        {option.label}
                      </Label>
                    </div>
                    <span className="text-sm font-medium text-primary whitespace-nowrap">
                      ({option.score}%)
                    </span>
                  </div>
                ))}
              </RadioGroup>

              <ImpactEvidenceUpload 
                impactScoreId={impactScore?.id || null} 
                fieldName="cyber_incident" 
                disabled={readOnly} 
              />

              {/* Incident Comment */}
              <div className="space-y-2 pt-2">
                <Label htmlFor="incident_comment">รายละเอียดเหตุการณ์ (ถ้ามี)</Label>
                <Textarea
                  id="incident_comment"
                  placeholder="อธิบายรายละเอียดเหตุการณ์ Cyber Incident ที่เกิดขึ้น..."
                  value={formData.incident_comment}
                  onChange={(e) => setFormData({ ...formData, incident_comment: e.target.value })}
                  onBlur={(e) => handleFieldChange('incident_comment', e.target.value)}
                  disabled={readOnly || saving}
                  className="min-h-[80px]"
                />
              </div>
            </div>
          </div>

          <Separator />

          {/* ข้อ 2: Data Breach Section */}
          <div className="space-y-4">
            <div className="flex items-center gap-2">
              <div className="flex items-center justify-center w-6 h-6 rounded-full bg-primary text-primary-foreground text-sm font-bold">
                2
              </div>
              <AlertTriangle className="w-4 h-4 text-destructive" />
              <h3 className="font-semibold">HIS Data Breach</h3>
              <span className="text-sm text-muted-foreground ml-auto">
                คะแนน: {scores.breach_score}%
              </span>
            </div>

            <div className="pl-8 space-y-3">
              <p className="text-sm text-muted-foreground">
                ในรอบการประเมินนี้ มีเหตุการณ์รั่วไหลของฐานข้อมูลของโรงพยาบาล (HIS Data Breach) หรือมีเหตุการณ์ข้อมูลส่วนบุคคลรั่วไหลที่เกี่ยวข้องกับระบบสารสนเทศ จนสคส.วินิจฉัยโทษทางปกครอง
              </p>
              
              <RadioGroup
                value={formData.breach_option}
                onValueChange={(value) => handleFieldChange('breach_option', value)}
                disabled={readOnly || saving}
                className="space-y-2"
              >
                {dataBreachOptions.map((option) => (
                  <div key={option.value} className="flex items-start space-x-3 p-3 rounded-lg border hover:bg-muted/50 transition-colors">
                    <RadioGroupItem value={option.value} id={`breach_${option.value}`} className="mt-0.5" />
                    <div className="flex-1">
                      <Label htmlFor={`breach_${option.value}`} className="cursor-pointer text-sm">
                        {option.label}
                      </Label>
                    </div>
                    <span className="text-sm font-medium text-primary whitespace-nowrap">
                      ({option.score}%)
                    </span>
                  </div>
                ))}
              </RadioGroup>

              <ImpactEvidenceUpload 
                impactScoreId={impactScore?.id || null} 
                fieldName="data_breach" 
                disabled={readOnly} 
              />

              {/* Breach Comment */}
              <div className="space-y-2 pt-2">
                <Label htmlFor="breach_comment">รายละเอียดเหตุการณ์ (ถ้ามี)</Label>
                <Textarea
                  id="breach_comment"
                  placeholder="อธิบายรายละเอียดเหตุการณ์ Data Breach ที่เกิดขึ้น..."
                  value={formData.breach_comment}
                  onChange={(e) => setFormData({ ...formData, breach_comment: e.target.value })}
                  onBlur={(e) => handleFieldChange('breach_comment', e.target.value)}
                  disabled={readOnly || saving}
                  className="min-h-[80px]"
                />
              </div>
            </div>
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
