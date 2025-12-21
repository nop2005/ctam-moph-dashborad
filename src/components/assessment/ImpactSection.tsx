import { useState, useCallback } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Separator } from '@/components/ui/separator';
import { Progress } from '@/components/ui/progress';
import { Loader2, AlertTriangle, Shield, Clock, CheckCircle2, XCircle } from 'lucide-react';
import { ImpactEvidenceUpload } from './ImpactEvidenceUpload';
import type { Database } from '@/integrations/supabase/types';

type ImpactScore = Database['public']['Tables']['impact_scores']['Row'];

interface ImpactSectionProps {
  assessmentId: string;
  impactScore: ImpactScore | null;
  onScoreChange: (score: ImpactScore | null) => void;
  readOnly: boolean;
}

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

  return (
    <div className="space-y-6">
      {/* Progress Summary Card */}
      <Card>
        <CardHeader className="flex flex-row items-start justify-between">
          <div>
            <CardTitle>ผลกระทบ (Impact) - 15%</CardTitle>
            <CardDescription>
              ประเมินผลกระทบจาก Cyber Incident และ Data Breach
            </CardDescription>
          </div>
          <div className="text-right">
            <div className="text-3xl font-bold text-primary">
              {scoreOut1_5.toFixed(2)}<span className="text-lg text-muted-foreground">/1.5</span>
            </div>
            <div className="text-sm text-muted-foreground">คะแนน</div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <Progress value={progressPercentage} className="h-3" />
            <div className="flex items-center justify-between text-sm">
              <div className="flex items-center gap-4">
                <div className="flex items-center gap-2">
                  {formData.had_incident ? (
                    <XCircle className="w-4 h-4 text-destructive" />
                  ) : (
                    <CheckCircle2 className="w-4 h-4 text-success" />
                  )}
                  <span>Cyber Incident: {formData.had_incident ? `หัก ${Math.abs(scores.incident_score)}` : 'ไม่มี'}</span>
                </div>
                <div className="flex items-center gap-2">
                  {formData.had_data_breach ? (
                    <XCircle className="w-4 h-4 text-destructive" />
                  ) : (
                    <CheckCircle2 className="w-4 h-4 text-success" />
                  )}
                  <span>Data Breach: {formData.had_data_breach ? `หัก ${Math.abs(scores.breach_score)}` : 'ไม่มี'}</span>
                </div>
              </div>
              <span className="font-medium text-lg">{scores.total_score}/15 ({progressPercentage.toFixed(1)}%)</span>
            </div>
          </div>
        </CardContent>
      </Card>

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