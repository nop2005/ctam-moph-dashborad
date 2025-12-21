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
import { Loader2, Users, Shield, GraduationCap, CheckCircle2, XCircle, Award, TrendingUp, Info } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { EvidenceUpload } from './EvidenceUpload';
import type { Database } from '@/integrations/supabase/types';

type QualitativeScore = Database['public']['Tables']['qualitative_scores']['Row'];

interface QualityLevel {
  level: number;
  name: string;
  nameEn: string;
  minScore: number;
  maxScore: number;
  interpretation: string;
  developmentLevel: string;
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
    interpretation: 'ระบบบริการสุขภาพดีเยี่ยม เป็นแบบอย่างที่ดี ปรับปรุงต่อเนื่องอย่างเป็นระบบ',
    developmentLevel: 'ยั่งยืนและเป็นต้นแบบ',
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
    interpretation: 'ระบบบริการสุขภาพมีความมั่นคง ครอบคลุม และมีการพัฒนาต่อเนื่อง',
    developmentLevel: 'พัฒนาอย่างมั่นคง',
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
    interpretation: 'ระบบบริการสุขภาพดำเนินการได้ตามมาตรฐานพื้นฐาน มีบางส่วนต้องปรับปรุง',
    developmentLevel: 'กำลังพัฒนา',
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
    interpretation: 'ระบบบริการสุขภาพไม่มั่นคง ต้องเร่งปรับปรุงในหลายองค์ประกอบ',
    developmentLevel: 'ต้องการการสนับสนุน',
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
    interpretation: 'ระบบบริการสุขภาพมีจุดอ่อนสำคัญ ต้องดำเนินการแก้ไขเร่งด่วน',
    developmentLevel: 'ต้องการฟื้นฟูระบบ',
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

  // Calculate scores based on criteria (3 + 2 + 10 = 15)
  const calculateScores = useCallback((data: typeof formData) => {
    let leadershipScore = 0;
    let sustainableScore = 0;

    // Leadership items: 3 + 2 = 5 points
    if (data.has_ciso) leadershipScore += 3;
    if (data.has_dpo) leadershipScore += 2;

    // Sustainable item: 10 points
    if (data.uses_freeware) sustainableScore += 10;

    return {
      leadership_score: leadershipScore,
      sustainable_score: sustainableScore,
      total_score: leadershipScore + sustainableScore,
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
              <CardTitle className="text-base">เชิงคุณภาพ (Qualitative) - 15%</CardTitle>
              <CardDescription className="text-xs">
                ประเมินตาม WHO 6 Building Blocks
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
                    <span>ภาวะผู้นำ: {scores.leadership_score}/5</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <GraduationCap className="w-3 h-3 text-primary" />
                    <span>ความยั่งยืน: {scores.sustainable_score}/10</span>
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
              การแปลผลระดับคุณภาพ
              <Dialog>
                <DialogTrigger asChild>
                  <Button variant="ghost" size="icon" className="h-5 w-5 ml-1 rounded-full hover:bg-muted">
                    <Info className="w-3 h-3 text-muted-foreground hover:text-primary" />
                  </Button>
                </DialogTrigger>
                <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
                  <DialogHeader>
                    <DialogTitle className="text-lg">ตารางการแปลผลระดับคุณภาพและระดับคะแนนการพัฒนา (5 ระดับ)</DialogTitle>
                  </DialogHeader>
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b">
                          <th className="text-left py-3 px-4 font-medium">ระดับคุณภาพ</th>
                          <th className="text-center py-3 px-4 font-medium">ช่วงคะแนน</th>
                          <th className="text-left py-3 px-4 font-medium">การแปลผลเชิงคุณภาพ</th>
                          <th className="text-center py-3 px-4 font-medium">ระดับการพัฒนา</th>
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
                            <td className={`py-3 px-4 text-center font-medium ${level.color}`}>
                              {level.developmentLevel}
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
                <div className={`flex items-center gap-1 px-2 py-0.5 rounded-full border ${qualityLevel.borderColor} ${qualityLevel.bgColor}`}>
                  <TrendingUp className={`w-3 h-3 ${qualityLevel.color}`} />
                  <span className={`font-medium text-xs ${qualityLevel.color}`}>{qualityLevel.developmentLevel}</span>
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
          {/* Leadership Section */}
          <div className="space-y-4">
            <div className="flex items-center gap-2">
              <Shield className="w-4 h-4 text-primary" />
              <h3 className="font-semibold">ภาวะผู้นำและธรรมาภิบาล (Leadership)</h3>
              <span className="text-sm text-muted-foreground ml-auto">
                คะแนน: {scores.leadership_score}/5
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