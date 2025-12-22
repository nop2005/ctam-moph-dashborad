import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { CheckCircle2, XCircle, AlertCircle, TrendingUp, Shield, Users, AlertTriangle } from 'lucide-react';
import type { Database } from '@/integrations/supabase/types';

type Assessment = Database['public']['Tables']['assessments']['Row'];
type AssessmentItem = Database['public']['Tables']['assessment_items']['Row'];
type CTAMCategory = Database['public']['Tables']['ctam_categories']['Row'];
type QualitativeScore = Database['public']['Tables']['qualitative_scores']['Row'];
type ImpactScore = Database['public']['Tables']['impact_scores']['Row'];

interface AssessmentSummaryProps {
  assessment: Assessment;
  items: AssessmentItem[];
  categories: CTAMCategory[];
  qualitativeScore: QualitativeScore | null;
  impactScore: ImpactScore | null;
}

export function AssessmentSummary({
  assessment,
  items,
  categories,
  qualitativeScore,
  impactScore,
}: AssessmentSummaryProps) {
  // Calculate quantitative score (7 points max) - only count passed items
  const calculateQuantitativeScore = () => {
    const total = categories.length;
    if (total === 0) return 0;
    
    const passCount = items.filter(i => i.status === 'pass').length;
    const score = (passCount / total) * 7;
    return score;
  };

  // Get qualitative score (1.5 points max)
  const getQualitativeScoreValue = () => {
    if (!qualitativeScore) return 0;
    // Convert from 15-scale to 1.5-scale
    const originalScore = Number(qualitativeScore.total_score) || 0;
    return originalScore / 10;
  };

  // Get impact score (1.5 points max)
  const getImpactScoreValue = () => {
    if (!impactScore) return 1.5;
    // total_score in DB is stored as 0-15, convert to 0-1.5 scale
    const originalScore = Number(impactScore.total_score) ?? 15;
    // Clamp to max 1.5
    return Math.min(originalScore / 10, 1.5);
  };

  const quantitativeScoreValue = calculateQuantitativeScore();
  const qualScore = getQualitativeScoreValue();
  const impScore = getImpactScoreValue();
  const totalScore = quantitativeScoreValue + qualScore + impScore;

  const passCount = items.filter(i => i.status === 'pass').length;
  const partialCount = items.filter(i => i.status === 'partial').length;
  const failCount = items.filter(i => i.status === 'fail').length;

  // Simple color based on score
  const getScoreColor = (score: number) => {
    if (score >= 8) return { color: 'text-emerald-600', bg: 'bg-emerald-50', border: 'border-emerald-500' };
    if (score >= 6) return { color: 'text-blue-600', bg: 'bg-blue-50', border: 'border-blue-500' };
    if (score >= 4) return { color: 'text-yellow-600', bg: 'bg-yellow-50', border: 'border-yellow-500' };
    return { color: 'text-red-600', bg: 'bg-red-50', border: 'border-red-500' };
  };

  const scoreStyle = getScoreColor(totalScore);

  return (
    <div className="space-y-6">
      {/* Overall Score Card */}
      <Card className={`border-2 ${scoreStyle.border}`}>
        <CardHeader className="text-center pb-2">
          <CardTitle className="text-2xl">คะแนนรวมการประเมิน CTAM+</CardTitle>
          <CardDescription>
            ปีงบประมาณ {assessment.fiscal_year + 543} / {assessment.assessment_period}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col items-center gap-6">
            {/* Score Circle */}
            <div className="relative">
              <div className={`w-48 h-48 rounded-full border-8 ${scoreStyle.border} flex items-center justify-center ${scoreStyle.bg}`}>
                <div className="text-center">
                  <span className={`text-6xl font-bold ${scoreStyle.color}`}>{totalScore.toFixed(2)}</span>
                  <span className="text-xl text-muted-foreground">/10</span>
                </div>
              </div>
            </div>

            {/* Progress Bar */}
            <div className="w-full max-w-md">
              <Progress value={(totalScore / 10) * 100} className="h-3" />
              <p className="text-center text-sm text-muted-foreground mt-2">
                คะแนนเต็ม 10 คะแนน
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Score Breakdown */}
      <div className="grid md:grid-cols-3 gap-4">
        {/* Quantitative */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2">
              <Shield className="w-4 h-4 text-primary" />
              เชิงปริมาณ (70%)
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              <div className="flex items-baseline gap-2">
                <span className="text-3xl font-bold">{quantitativeScoreValue.toFixed(2)}</span>
                <span className="text-muted-foreground">/7 คะแนน</span>
              </div>
              <Progress value={(quantitativeScoreValue / 7) * 100} className="h-2" />
              <div className="flex items-center gap-4 text-sm">
                <div className="flex items-center gap-1 text-success">
                  <CheckCircle2 className="w-3 h-3" />
                  <span>{passCount} ผ่าน</span>
                </div>
                <div className="flex items-center gap-1 text-warning">
                  <AlertCircle className="w-3 h-3" />
                  <span>{partialCount} บางส่วน</span>
                </div>
                <div className="flex items-center gap-1 text-destructive">
                  <XCircle className="w-3 h-3" />
                  <span>{failCount} ไม่ผ่าน</span>
                </div>
              </div>
              <div className="text-xs text-muted-foreground">
                ({passCount}/{categories.length} = {categories.length > 0 ? ((passCount / categories.length) * 100).toFixed(2) : 0}%)
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Qualitative */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2">
              <Users className="w-4 h-4 text-primary" />
              เชิงคุณภาพ (15%)
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              <div className="flex items-baseline gap-2">
                <span className="text-3xl font-bold">{qualScore.toFixed(2)}</span>
                <span className="text-muted-foreground">/1.5 คะแนน</span>
              </div>
              <Progress value={(qualScore / 1.5) * 100} className="h-2" />
              {qualitativeScore ? (
                <div className="text-sm text-muted-foreground">
                  <div>ภาวะผู้นำ: {((Number(qualitativeScore.leadership_score) || 0) / 10).toFixed(2)}/0.5</div>
                  <div>ความยั่งยืน: {((Number(qualitativeScore.sustainable_score) || 0) / 10).toFixed(2)}/1</div>
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">ยังไม่ได้ประเมิน</p>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Impact */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-primary" />
              ผลกระทบ (15%)
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              <div className="flex items-baseline gap-2">
                <span className="text-3xl font-bold">{impScore.toFixed(2)}</span>
                <span className="text-muted-foreground">/1.5 คะแนน</span>
              </div>
              <Progress value={(impScore / 1.5) * 100} className="h-2" />
              {impactScore ? (
                <div className="text-sm text-muted-foreground">
                  {impactScore.had_incident ? (
                    <div className="text-destructive">• เกิด Incident (หัก {(Math.abs(Number(impactScore.incident_score) || 0) / 10).toFixed(2)})</div>
                  ) : (
                    <div className="text-success">• ไม่เกิด Incident</div>
                  )}
                  {impactScore.had_data_breach ? (
                    <div className="text-destructive">• เกิด Data Breach (หัก {(Math.abs(Number(impactScore.breach_score) || 0) / 10).toFixed(2)})</div>
                  ) : (
                    <div className="text-success">• ไม่เกิด Data Breach</div>
                  )}
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">ยังไม่ได้ประเมิน (ใช้คะแนนเต็ม)</p>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Category Details */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <TrendingUp className="w-5 h-5" />
            รายละเอียดหมวด 17 ข้อ
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {categories.map((category) => {
              const item = items.find(i => i.category_id === category.id);
              const status = item?.status || 'fail';
              
              return (
                <div
                  key={category.id}
                  className="flex items-center gap-3 p-3 rounded-lg bg-muted/50"
                >
                  <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center text-sm font-bold text-primary">
                    {category.order_number}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{category.name_th}</p>
                    <p className="text-xs text-muted-foreground">{category.code}</p>
                  </div>
                  <Badge 
                    variant="outline"
                    className={
                      status === 'pass' ? 'text-success border-success' :
                      status === 'partial' ? 'text-warning border-warning' :
                      'text-destructive border-destructive'
                    }
                  >
                    {status === 'pass' ? <CheckCircle2 className="w-3 h-3" /> :
                     status === 'partial' ? <AlertCircle className="w-3 h-3" /> :
                     <XCircle className="w-3 h-3" />}
                  </Badge>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
