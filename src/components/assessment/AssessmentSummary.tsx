import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
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
  // Calculate quantitative score (70%)
  const calculateQuantitativeScore = () => {
    const total = categories.length;
    if (total === 0) return 0;
    
    const passCount = items.filter(i => i.status === 'pass').length;
    const partialCount = items.filter(i => i.status === 'partial').length;
    const score = ((passCount + partialCount * 0.5) / total) * 70;
    return score;
  };

  // Get qualitative score (15%)
  const getQualitativeScore = () => {
    if (!qualitativeScore) return 0;
    return Number(qualitativeScore.total_score) || 0;
  };

  // Get impact score (15%)
  const getImpactScore = () => {
    if (!impactScore) return 15; // Default to full score if no incidents
    return Number(impactScore.total_score) || 15;
  };

  const quantitativeScore = calculateQuantitativeScore();
  const qualScore = getQualitativeScore();
  const impScore = getImpactScore();
  const totalScore = quantitativeScore + qualScore + impScore;

  const passCount = items.filter(i => i.status === 'pass').length;
  const partialCount = items.filter(i => i.status === 'partial').length;
  const failCount = items.filter(i => i.status === 'fail').length;

  const getGrade = (score: number) => {
    if (score >= 90) return { grade: 'A', color: 'text-success', label: 'ดีเยี่ยม' };
    if (score >= 80) return { grade: 'B', color: 'text-info', label: 'ดี' };
    if (score >= 70) return { grade: 'C', color: 'text-warning', label: 'พอใช้' };
    if (score >= 60) return { grade: 'D', color: 'text-orange-500', label: 'ควรปรับปรุง' };
    return { grade: 'F', color: 'text-destructive', label: 'ไม่ผ่าน' };
  };

  const gradeInfo = getGrade(totalScore);

  return (
    <div className="space-y-6">
      {/* Overall Score Card */}
      <Card className="border-2 border-primary/20">
        <CardHeader className="text-center">
          <CardTitle>คะแนนรวมการประเมิน CTAM+</CardTitle>
          <CardDescription>
            ปีงบประมาณ {assessment.fiscal_year + 543} / {assessment.assessment_period}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col items-center gap-4">
            <div className="relative">
              <div className="w-40 h-40 rounded-full border-8 border-primary/20 flex items-center justify-center">
                <div className="text-center">
                  <span className={`text-5xl font-bold ${gradeInfo.color}`}>{totalScore.toFixed(1)}</span>
                  <span className="text-xl text-muted-foreground">/100</span>
                </div>
              </div>
              <div className={`absolute -bottom-2 left-1/2 -translate-x-1/2 px-4 py-1 rounded-full bg-background border-2 ${gradeInfo.color.replace('text-', 'border-')}`}>
                <span className={`font-bold ${gradeInfo.color}`}>
                  เกรด {gradeInfo.grade}: {gradeInfo.label}
                </span>
              </div>
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
                <span className="text-3xl font-bold">{quantitativeScore.toFixed(1)}</span>
                <span className="text-muted-foreground">/70 คะแนน</span>
              </div>
              <Progress value={(quantitativeScore / 70) * 100} className="h-2" />
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
                <span className="text-3xl font-bold">{qualScore.toFixed(1)}</span>
                <span className="text-muted-foreground">/15 คะแนน</span>
              </div>
              <Progress value={(qualScore / 15) * 100} className="h-2" />
              {qualitativeScore ? (
                <div className="text-sm text-muted-foreground">
                  <div>ภาวะผู้นำ: {Number(qualitativeScore.leadership_score) || 0}/10</div>
                  <div>ความยั่งยืน: {Number(qualitativeScore.sustainable_score) || 0}/10</div>
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
                <span className="text-3xl font-bold">{impScore.toFixed(1)}</span>
                <span className="text-muted-foreground">/15 คะแนน</span>
              </div>
              <Progress value={(impScore / 15) * 100} className="h-2" />
              {impactScore ? (
                <div className="text-sm text-muted-foreground">
                  {impactScore.had_incident ? (
                    <div className="text-destructive">• เกิด Incident (หัก {Math.abs(Number(impactScore.incident_score) || 0)})</div>
                  ) : (
                    <div className="text-success">• ไม่เกิด Incident</div>
                  )}
                  {impactScore.had_data_breach ? (
                    <div className="text-destructive">• เกิด Data Breach (หัก {Math.abs(Number(impactScore.breach_score) || 0)})</div>
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