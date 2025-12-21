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
import { Separator } from '@/components/ui/separator';
import { Progress } from '@/components/ui/progress';
import { Loader2, Users, Shield, GraduationCap, CheckCircle2, XCircle } from 'lucide-react';
import { EvidenceUpload } from './EvidenceUpload';
import type { Database } from '@/integrations/supabase/types';

type QualitativeScore = Database['public']['Tables']['qualitative_scores']['Row'];

interface QualitativeSectionProps {
  assessmentId: string;
  qualitativeScore: QualitativeScore | null;
  onScoreChange: (score: QualitativeScore | null) => void;
  readOnly: boolean;
}

export function QualitativeSection({
  assessmentId,
  qualitativeScore,
  onScoreChange,
  readOnly,
}: QualitativeSectionProps) {
  const { profile } = useAuth();
  const { toast } = useToast();
  const [saving, setSaving] = useState(false);
  const [formData, setFormData] = useState({
    has_ciso: qualitativeScore?.has_ciso ?? false,
    has_dpo: qualitativeScore?.has_dpo ?? false,
    has_it_security_team: qualitativeScore?.has_it_security_team ?? false,
    annual_training_count: qualitativeScore?.annual_training_count ?? 0,
    uses_opensource: qualitativeScore?.uses_opensource ?? false,
    uses_freeware: qualitativeScore?.uses_freeware ?? false,
    comment: qualitativeScore?.comment ?? '',
  });

  // Calculate scores based on criteria
  const calculateScores = useCallback((data: typeof formData) => {
    let leadershipScore = 0;
    let sustainableScore = 0;

    if (data.has_ciso) leadershipScore += 3;
    if (data.has_dpo) leadershipScore += 3;
    if (data.has_it_security_team) leadershipScore += 4;

    if (data.annual_training_count >= 4) sustainableScore += 5;
    else if (data.annual_training_count >= 2) sustainableScore += 3;
    else if (data.annual_training_count >= 1) sustainableScore += 1;

    if (!data.uses_freeware && !data.uses_opensource) sustainableScore += 5;
    else if (!data.uses_freeware) sustainableScore += 3;

    return {
      leadership_score: Math.min(leadershipScore, 10),
      sustainable_score: Math.min(sustainableScore, 10),
      total_score: Math.min(leadershipScore + sustainableScore, 15),
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
      if (qualitativeScore) {
        const { data: updated, error } = await supabase
          .from('qualitative_scores')
          .update(data)
          .eq('id', qualitativeScore.id)
          .select()
          .single();
        if (error) throw error;
        result = updated;
      } else {
        const { data: created, error } = await supabase
          .from('qualitative_scores')
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
  }, [assessmentId, qualitativeScore, profile, readOnly, calculateScores, onScoreChange, toast]);

  // Handle field change with auto-save
  const handleFieldChange = useCallback((field: keyof typeof formData, value: boolean | number | string) => {
    const newFormData = { ...formData, [field]: value };
    setFormData(newFormData);
    autoSave(newFormData);
  }, [formData, autoSave]);

  const scores = calculateScores(formData);

  const progressPercentage = (scores.total_score / 15) * 100;
  const leadershipItems = [formData.has_ciso, formData.has_dpo, formData.has_it_security_team];
  const passCount = leadershipItems.filter(Boolean).length;
  const failCount = leadershipItems.filter(v => !v).length;

  return (
    <div className="space-y-6">
      {/* Progress Summary Card */}
      <Card>
        <CardHeader>
          <CardTitle>เชิงคุณภาพ (Qualitative) - 15%</CardTitle>
          <CardDescription>
            ประเมินตาม WHO 6 Building Blocks: ระบบงาน ภาวะผู้นำ และความยั่งยืน
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <Progress value={progressPercentage} className="h-3" />
            <div className="flex items-center justify-between text-sm">
              <div className="flex items-center gap-4">
                <div className="flex items-center gap-2">
                  <Shield className="w-4 h-4 text-primary" />
                  <span>ภาวะผู้นำ: {scores.leadership_score}/10</span>
                </div>
                <div className="flex items-center gap-2">
                  <GraduationCap className="w-4 h-4 text-primary" />
                  <span>ความยั่งยืน: {scores.sustainable_score}/10</span>
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
          {/* Leadership Section */}
          <div className="space-y-4">
            <div className="flex items-center gap-2">
              <Shield className="w-4 h-4 text-primary" />
              <h3 className="font-semibold">ภาวะผู้นำและธรรมาภิบาล (Leadership)</h3>
              <span className="text-sm text-muted-foreground ml-auto">
                คะแนน: {scores.leadership_score}/10
              </span>
            </div>

            <div className="grid gap-4 pl-6">
              <div className="flex items-center justify-between gap-4">
                <div className="flex-1">
                  <Label htmlFor="has_ciso">แต่งตั้งคณะทำงานด้านไซเบอร์ โดยมี CISO และ เจ้าหน้าที่ประสานงาน DPO ในหน่วยงาน</Label>
                  <EvidenceUpload 
                    qualitativeScoreId={qualitativeScore?.id || null} 
                    fieldName="has_ciso" 
                    disabled={readOnly} 
                  />
                </div>
                <Switch
                  id="has_ciso"
                  checked={formData.has_ciso}
                  onCheckedChange={(checked) => handleFieldChange('has_ciso', checked)}
                  disabled={readOnly || saving}
                />
              </div>

              <div className="flex items-center justify-between gap-4">
                <div className="flex-1">
                  <Label htmlFor="has_dpo">คณะกรรมการ CISO จังหวัดอย่างน้อย 1 ท่าน ต้องผ่านการสอบหรืออบรมตามหลักสูตรที่ ศทส.สป.สธ. กำหนด</Label>
                  <EvidenceUpload 
                    qualitativeScoreId={qualitativeScore?.id || null} 
                    fieldName="has_dpo" 
                    disabled={readOnly} 
                  />
                </div>
                <Switch
                  id="has_dpo"
                  checked={formData.has_dpo}
                  onCheckedChange={(checked) => handleFieldChange('has_dpo', checked)}
                  disabled={readOnly || saving}
                />
              </div>

            </div>
          </div>

          <Separator />

          {/* Sustainable Section */}
          <div className="space-y-4">
            <div className="flex items-center gap-2">
              <GraduationCap className="w-4 h-4 text-primary" />
              <h3 className="font-semibold">ความยั่งยืน (Sustainable)</h3>
              <span className="text-sm text-muted-foreground ml-auto">
                คะแนน: {scores.sustainable_score}/10
              </span>
            </div>

            <div className="grid gap-4 pl-6">
              <div className="space-y-2">
                <Label htmlFor="annual_training_count">
                  จำนวนครั้งอบรม IT Security ต่อปี
                </Label>
                <div className="flex items-center gap-4">
                  <Input
                    id="annual_training_count"
                    type="number"
                    min="0"
                    value={formData.annual_training_count}
                    onChange={(e) => setFormData({ ...formData, annual_training_count: parseInt(e.target.value) || 0 })}
                    onBlur={(e) => handleFieldChange('annual_training_count', parseInt(e.target.value) || 0)}
                    disabled={readOnly || saving}
                    className="w-32"
                  />
                  <EvidenceUpload 
                    qualitativeScoreId={qualitativeScore?.id || null} 
                    fieldName="annual_training_count" 
                    disabled={readOnly} 
                  />
                </div>
                <p className="text-xs text-muted-foreground">
                  4+ ครั้ง = 5 คะแนน, 2-3 ครั้ง = 3 คะแนน, 1 ครั้ง = 1 คะแนน
                </p>
              </div>

              <div className="flex items-center justify-between gap-4">
                <div className="flex-1">
                  <Label htmlFor="uses_freeware">มีการใช้งานซอฟต์แวร์ Open Source หรือ Freeware ใน CTAM+ อย่างน้อย 2 ระบบ</Label>
                  <EvidenceUpload 
                    qualitativeScoreId={qualitativeScore?.id || null} 
                    fieldName="uses_freeware" 
                    disabled={readOnly} 
                  />
                </div>
                <Switch
                  id="uses_freeware"
                  checked={formData.uses_freeware}
                  onCheckedChange={(checked) => handleFieldChange('uses_freeware', checked)}
                  disabled={readOnly || saving}
                />
              </div>

              <div className="flex items-center justify-between gap-4">
                <div className="flex-1">
                  <Label htmlFor="uses_opensource">ใช้ Open Source ในงานสำคัญ</Label>
                  <EvidenceUpload 
                    qualitativeScoreId={qualitativeScore?.id || null} 
                    fieldName="uses_opensource" 
                    disabled={readOnly} 
                  />
                </div>
                <Switch
                  id="uses_opensource"
                  checked={formData.uses_opensource}
                  onCheckedChange={(checked) => handleFieldChange('uses_opensource', checked)}
                  disabled={readOnly || saving}
                />
              </div>
            </div>
          </div>

          <Separator />

          {/* Comments */}
          <div className="space-y-2">
            <Label htmlFor="comment">ความคิดเห็นเพิ่มเติม</Label>
            <Textarea
              id="comment"
              placeholder="หมายเหตุหรือข้อสังเกตเพิ่มเติม..."
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