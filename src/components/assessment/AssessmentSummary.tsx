import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { CheckCircle2, XCircle, AlertCircle, TrendingUp, Shield, Users, AlertTriangle, Award } from 'lucide-react';
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

interface QualityLevel {
  level: number;
  name: string;
  nameEn: string;
  minScore: number;
  maxScore: number;
  description: string;
  color: string;
  bgColor: string;
  borderColor: string;
}

const qualityLevels: QualityLevel[] = [
  {
    level: 5,
    name: 'ดีเยี่ยม',
    nameEn: 'Excellent',
    minScore: 8.6,
    maxScore: 10,
    description: 'ผลลัพธ์โดดเด่น สร้างผลกระทบเชิงบวกต่อประชาชนและระบบบริการสาธารณสุขอย่างยั่งยืน',
    color: 'text-emerald-600',
    bgColor: 'bg-emerald-50',
    borderColor: 'border-emerald-500',
  },
  {
    level: 4,
    name: 'ดี',
    nameEn: 'Good',
    minScore: 7.1,
    maxScore: 8.5,
    description: 'ผลลัพธ์บรรลุเป้าหมายชัดเจน สร้างผลกระทบเชิงบวกต่อประชาชน แต่ควรพัฒนาระบบบริการสุขภาพอย่างต่อเนื่อง',
    color: 'text-blue-600',
    bgColor: 'bg-blue-50',
    borderColor: 'border-blue-500',
  },
  {
    level: 3,
    name: 'พอใช้',
    nameEn: 'Fair',
    minScore: 5.6,
    maxScore: 7.0,
    description: 'ผลลัพธ์อยู่ในระดับมาตรฐาน มีระบบบริการสุขภาพบางส่วนต้องปรับปรุง',
    color: 'text-yellow-600',
    bgColor: 'bg-yellow-50',
    borderColor: 'border-yellow-500',
  },
  {
    level: 2,
    name: 'ต้องพัฒนา',
    nameEn: 'Developing',
    minScore: 4.1,
    maxScore: 5.5,
    description: 'ผลลัพธ์ยังไม่บรรลุเป้าหมาย ต้องปรับกลยุทธ์หรือระบบสนับสนุน',
    color: 'text-orange-600',
    bgColor: 'bg-orange-50',
    borderColor: 'border-orange-500',
  },
  {
    level: 1,
    name: 'ต้องเร่งแก้ไข',
    nameEn: 'Critical',
    minScore: 0,
    maxScore: 4.0,
    description: 'ผลลัพธ์ไม่เป็นไปตามเป้าหมาย หรือเกิดผลกระทบในทางลบต่อประชาชนและระบบบริการสุขภาพ ต้องแก้ไขเร่งด่วน',
    color: 'text-red-600',
    bgColor: 'bg-red-50',
    borderColor: 'border-red-500',
  },
];

const getQualityLevel = (score: number): QualityLevel => {
  for (const level of qualityLevels) {
    if (score >= level.minScore && score <= level.maxScore) {
      return level;
    }
  }
  return qualityLevels[qualityLevels.length - 1];
};

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
    // Convert from 15-scale to 1.5-scale
    const originalScore = Number(impactScore.total_score) || 15;
    return originalScore / 10;
  };

  const quantitativeScoreValue = calculateQuantitativeScore();
  const qualScore = getQualitativeScoreValue();
  const impScore = getImpactScoreValue();
  const totalScore = quantitativeScoreValue + qualScore + impScore;

  const passCount = items.filter(i => i.status === 'pass').length;
  const partialCount = items.filter(i => i.status === 'partial').length;
  const failCount = items.filter(i => i.status === 'fail').length;

  const qualityLevel = getQualityLevel(totalScore);

  return (
    <div className="space-y-6">
      {/* Overall Score Card */}
      <Card className={`border-2 ${qualityLevel.borderColor}`}>
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
              <div className={`w-48 h-48 rounded-full border-8 ${qualityLevel.borderColor} flex items-center justify-center ${qualityLevel.bgColor}`}>
                <div className="text-center">
                  <span className={`text-6xl font-bold ${qualityLevel.color}`}>{totalScore.toFixed(2)}</span>
                  <span className="text-xl text-muted-foreground">/10</span>
                </div>
              </div>
            </div>

            {/* Quality Level Badge */}
            <div className={`flex items-center gap-3 px-6 py-3 rounded-xl ${qualityLevel.bgColor} border-2 ${qualityLevel.borderColor}`}>
              <Award className={`w-8 h-8 ${qualityLevel.color}`} />
              <div className="text-center">
                <div className={`text-xl font-bold ${qualityLevel.color}`}>
                  ระดับ {qualityLevel.level} = {qualityLevel.name} ({qualityLevel.nameEn})
                </div>
                <div className="text-sm text-muted-foreground">
                  ช่วงคะแนน: {qualityLevel.minScore} - {qualityLevel.maxScore}
                </div>
              </div>
            </div>

            {/* Description */}
            <div className={`max-w-2xl text-center p-4 rounded-lg ${qualityLevel.bgColor}`}>
              <p className={`text-sm ${qualityLevel.color}`}>
                {qualityLevel.description}
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

      {/* Quality Level Reference Table */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Award className="w-5 h-5" />
            ตารางระดับคุณภาพ
          </CardTitle>
        </CardHeader>
        <CardContent>
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
                    className={`border-b ${totalScore >= level.minScore && totalScore <= level.maxScore ? level.bgColor : ''}`}
                  >
                    <td className={`py-3 px-4 font-medium ${level.color}`}>
                      ระดับ {level.level} = {level.name} ({level.nameEn})
                    </td>
                    <td className={`py-3 px-4 text-center ${level.color}`}>
                      {level.level === 1 ? 'ต่ำกว่าหรือเท่ากับ 4.0' : `${level.minScore} - ${level.maxScore}`}
                    </td>
                    <td className="py-3 px-4 text-muted-foreground">
                      {level.description}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

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
