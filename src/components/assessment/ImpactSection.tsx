import { useState } from 'react';
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
import { Save, Loader2, AlertTriangle, Shield, Clock } from 'lucide-react';
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
  const calculateScores = () => {
    let incidentScore = 0;
    let breachScore = 0;

    // Incident score (based on recovery time)
    if (formData.had_incident) {
      if (formData.incident_recovery_hours <= 4) incidentScore = -2;
      else if (formData.incident_recovery_hours <= 24) incidentScore = -5;
      else if (formData.incident_recovery_hours <= 72) incidentScore = -8;
      else incidentScore = -15;
    }

    // Breach score (based on severity)
    if (formData.had_data_breach) {
      const severity = breachSeverityOptions.find(s => s.value === formData.breach_severity);
      breachScore = -(severity?.penalty ?? 0);
    }

    return {
      incident_score: incidentScore,
      breach_score: breachScore,
      breach_penalty_level: breachSeverityOptions.findIndex(s => s.value === formData.breach_severity),
      total_score: Math.max(0, 15 + incidentScore + breachScore),
    };
  };

  const handleSave = async () => {
    try {
      setSaving(true);
      const scores = calculateScores();

      const data = {
        assessment_id: assessmentId,
        ...formData,
        ...scores,
        evaluated_by: profile?.user_id,
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
      toast({ title: 'บันทึกสำเร็จ' });

    } catch (error: any) {
      console.error('Error saving impact score:', error);
      toast({ title: 'เกิดข้อผิดพลาด', description: error.message, variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  const scores = calculateScores();

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <AlertTriangle className="w-5 h-5" />
            ผลกระทบ (Impact) - 15%
          </CardTitle>
          <CardDescription>
            ประเมินผลกระทบจาก Cyber Incident และ Data Breach
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
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
              <div className="flex items-center justify-between">
                <Label htmlFor="had_incident" className="flex-1">
                  เคยเกิด Cyber Incident ในรอบประเมินนี้
                </Label>
                <Switch
                  id="had_incident"
                  checked={formData.had_incident}
                  onCheckedChange={(checked) => setFormData({ ...formData, had_incident: checked })}
                  disabled={readOnly}
                />
              </div>

              {formData.had_incident && (
                <div className="space-y-2">
                  <Label htmlFor="incident_recovery_hours" className="flex items-center gap-2">
                    <Clock className="w-4 h-4" />
                    ระยะเวลาฟื้นฟูระบบ (ชั่วโมง)
                  </Label>
                  <Input
                    id="incident_recovery_hours"
                    type="number"
                    min="0"
                    value={formData.incident_recovery_hours}
                    onChange={(e) => setFormData({ ...formData, incident_recovery_hours: parseInt(e.target.value) || 0 })}
                    disabled={readOnly}
                    className="w-32"
                  />
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
              <div className="flex items-center justify-between">
                <Label htmlFor="had_data_breach" className="flex-1">
                  เคยเกิด Data Breach ในรอบประเมินนี้
                </Label>
                <Switch
                  id="had_data_breach"
                  checked={formData.had_data_breach}
                  onCheckedChange={(checked) => setFormData({ ...formData, had_data_breach: checked })}
                  disabled={readOnly}
                />
              </div>

              {formData.had_data_breach && (
                <div className="space-y-2">
                  <Label htmlFor="breach_severity">ความรุนแรงของ Data Breach</Label>
                  <Select
                    value={formData.breach_severity}
                    onValueChange={(value) => setFormData({ ...formData, breach_severity: value })}
                    disabled={readOnly}
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
              disabled={readOnly}
              className="min-h-[100px]"
            />
          </div>

          {/* Total Score */}
          <div className="flex items-center justify-between p-4 bg-primary/5 rounded-lg">
            <span className="font-semibold">คะแนนผลกระทบรวม</span>
            <span className="text-2xl font-bold text-primary">{scores.total_score}/15</span>
          </div>

          {/* Save Button */}
          {!readOnly && (
            <div className="flex justify-end">
              <Button onClick={handleSave} disabled={saving}>
                {saving ? (
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                ) : (
                  <Save className="w-4 h-4 mr-2" />
                )}
                บันทึก
              </Button>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}