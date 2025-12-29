import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { 
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { CheckCircle2, XCircle, AlertCircle, TrendingUp, Shield, AlertTriangle, CheckCircle, Loader2, ArrowLeft, Send } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
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
  onRefresh?: () => void;
}

export function AssessmentSummary({
  assessment,
  items,
  categories,
  qualitativeScore,
  impactScore,
  onRefresh,
}: AssessmentSummaryProps) {
  const { profile } = useAuth();
  const { toast } = useToast();
  const [processing, setProcessing] = useState(false);
  const [comment, setComment] = useState('');
  const [dialogOpen, setDialogOpen] = useState(false);

  const [returnDialogOpen, setReturnDialogOpen] = useState(false);
  const [provincialDialogOpen, setProvincialDialogOpen] = useState(false);
  const [regionalReturnDialogOpen, setRegionalReturnDialogOpen] = useState(false);

  // Check if provincial can approve (send to regional)
  const canProvincialApprove = () => {
    return profile?.role === 'provincial' && assessment.status === 'submitted';
  };

  // Check if user can do final approval
  const canFinalApprove = () => {
    if (profile?.role === 'regional' && assessment.status === 'approved_provincial') return true;
    if (profile?.role === 'central_admin' && assessment.status === 'approved_regional') return true;
    return false;
  };

  // Handle provincial approval - send to regional
  const handleProvincialApprove = async () => {
    try {
      setProcessing(true);

      const { error: updateError } = await supabase
        .from('assessments')
        .update({
          status: 'approved_provincial' as Database['public']['Enums']['assessment_status'],
          provincial_approved_by: profile?.id,
          provincial_approved_at: new Date().toISOString(),
          provincial_comment: comment || null,
        })
        .eq('id', assessment.id);

      if (updateError) throw updateError;

      // Add history
      await supabase
        .from('approval_history')
        .insert([{
          assessment_id: assessment.id,
          from_status: assessment.status,
          to_status: 'approved_provincial' as Database['public']['Enums']['assessment_status'],
          action: 'approve',
          performed_by: profile?.id!,
          comment: comment || 'ผ่านการตรวจสอบระดับจังหวัด',
        }]);

      toast({ 
        title: 'อนุมัติสำเร็จ', 
        description: 'ส่งต่อให้เขตสุขภาพตรวจสอบแล้ว'
      });
      setProvincialDialogOpen(false);
      setComment('');
      onRefresh?.();

    } catch (error: any) {
      console.error('Error approving:', error);
      toast({ title: 'เกิดข้อผิดพลาด', description: error.message, variant: 'destructive' });
    } finally {
      setProcessing(false);
    }
  };

  // Handle return to hospital for revision (Provincial)
  const handleReturn = async () => {
    try {
      setProcessing(true);

      if (!comment.trim()) {
        toast({ title: 'กรุณาระบุเหตุผล', description: 'กรุณาระบุเหตุผลในการส่งกลับแก้ไข', variant: 'destructive' });
        setProcessing(false);
        return;
      }

      const { error: updateError } = await supabase
        .from('assessments')
        .update({
          status: 'returned' as Database['public']['Enums']['assessment_status'],
          provincial_comment: comment,
        })
        .eq('id', assessment.id);

      if (updateError) throw updateError;

      // Add history
      await supabase
        .from('approval_history')
        .insert([{
          assessment_id: assessment.id,
          from_status: assessment.status,
          to_status: 'returned' as Database['public']['Enums']['assessment_status'],
          action: 'return',
          performed_by: profile?.id!,
          comment: comment,
        }]);

      toast({ 
        title: 'ส่งกลับแก้ไขแล้ว', 
        description: 'ส่งกลับให้โรงพยาบาลแก้ไขเรียบร้อย'
      });
      setReturnDialogOpen(false);
      setComment('');
      onRefresh?.();

    } catch (error: any) {
      console.error('Error returning:', error);
      toast({ title: 'เกิดข้อผิดพลาด', description: error.message, variant: 'destructive' });
    } finally {
      setProcessing(false);
    }
  };

  // Handle return to hospital for revision (Regional)
  const handleRegionalReturn = async () => {
    try {
      setProcessing(true);

      if (!comment.trim()) {
        toast({ title: 'กรุณาระบุเหตุผล', description: 'กรุณาระบุเหตุผลในการส่งกลับแก้ไข', variant: 'destructive' });
        setProcessing(false);
        return;
      }

      // Reset all approval states and send back to draft/returned
      const { error: updateError } = await supabase
        .from('assessments')
        .update({
          status: 'returned' as Database['public']['Enums']['assessment_status'],
          regional_comment: comment,
          // Reset provincial approval so flow starts again
          provincial_approved_by: null,
          provincial_approved_at: null,
          provincial_comment: null,
        })
        .eq('id', assessment.id);

      if (updateError) throw updateError;

      // Add history
      await supabase
        .from('approval_history')
        .insert([{
          assessment_id: assessment.id,
          from_status: assessment.status,
          to_status: 'returned' as Database['public']['Enums']['assessment_status'],
          action: 'return',
          performed_by: profile?.id!,
          comment: comment,
        }]);

      toast({ 
        title: 'ส่งกลับแก้ไขแล้ว', 
        description: 'ส่งกลับให้โรงพยาบาลแก้ไขและเริ่ม Flow การอนุมัติใหม่'
      });
      setRegionalReturnDialogOpen(false);
      setComment('');
      onRefresh?.();

    } catch (error: any) {
      console.error('Error returning:', error);
      toast({ title: 'เกิดข้อผิดพลาด', description: error.message, variant: 'destructive' });
    } finally {
      setProcessing(false);
    }
  };

  const handleFinalApprove = async () => {
    try {
      setProcessing(true);

      const nextStatus = profile?.role === 'regional' ? 'approved_regional' : 'completed';
      
      const updateData: Record<string, unknown> = {
        status: nextStatus,
        quantitative_score: calculateQuantitativeScore(),
        qualitative_score: 0, // No longer used
        impact_score: getImpactScoreValue(),
        total_score: calculateQuantitativeScore() + getImpactScoreValue(),
      };

      if (profile?.role === 'regional') {
        updateData.regional_approved_by = profile.id;
        updateData.regional_approved_at = new Date().toISOString();
        updateData.regional_comment = comment || null;
      }

      const { error: updateError } = await supabase
        .from('assessments')
        .update(updateData)
        .eq('id', assessment.id);

      if (updateError) throw updateError;

      // Add history
      await supabase
        .from('approval_history')
        .insert([{
          assessment_id: assessment.id,
          from_status: assessment.status,
          to_status: nextStatus as Database['public']['Enums']['assessment_status'],
          action: 'approve',
          performed_by: profile?.id!,
          comment: comment || 'อนุมัติการประเมินเสร็จสิ้น',
        }]);

      toast({ 
        title: 'อนุมัติสำเร็จ', 
        description: nextStatus === 'approved_regional' ? 'การประเมินผ่านการอนุมัติระดับเขต' : 'การประเมินเสร็จสมบูรณ์'
      });
      setDialogOpen(false);
      setComment('');
      onRefresh?.();

    } catch (error: any) {
      console.error('Error approving:', error);
      toast({ title: 'เกิดข้อผิดพลาด', description: error.message, variant: 'destructive' });
    } finally {
      setProcessing(false);
    }
  };
  // Calculate quantitative score (7 points max = 70%) - only count passed items
  const calculateQuantitativeScore = () => {
    const total = categories.length;
    if (total === 0) return 0;
    
    const passCount = items.filter(i => i.status === 'pass').length;
    const score = (passCount / total) * 7;
    return score;
  };

  // Get impact score (3 points max = 30%)
  const getImpactScoreValue = () => {
    if (!impactScore) return 3;
    // total_score in DB is stored as 0-100 scale, convert to 0-3 scale (30%)
    const originalScore = Number(impactScore.total_score) ?? 100;
    // Clamp to max 3
    return Math.min((originalScore / 100) * 3, 3);
  };

  const quantitativeScoreValue = calculateQuantitativeScore();
  const impScore = getImpactScoreValue();
  const totalScore = quantitativeScoreValue + impScore;

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
      <div className="grid md:grid-cols-2 gap-4">
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

        {/* Impact */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-primary" />
              ผลกระทบ (30%)
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              <div className="flex items-baseline gap-2">
                <span className="text-3xl font-bold">{impScore.toFixed(2)}</span>
                <span className="text-muted-foreground">/3 คะแนน</span>
              </div>
              <Progress value={(impScore / 3) * 100} className="h-2" />
              {impactScore ? (
                <div className="text-sm text-muted-foreground">
                  {impactScore.had_incident ? (
                    <div className="text-destructive">• เกิด Incident (หัก {((Math.abs(Number(impactScore.incident_score) || 0) / 100) * 3).toFixed(2)})</div>
                  ) : (
                    <div className="text-success">• ไม่เกิด Incident</div>
                  )}
                  {impactScore.had_data_breach ? (
                    <div className="text-destructive">• เกิด Data Breach (หัก {((Math.abs(Number(impactScore.breach_score) || 0) / 100) * 3).toFixed(2)})</div>
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

      {/* Provincial Approval Buttons */}
      {canProvincialApprove() && (
        <Card className="border-primary">
          <CardHeader>
            <CardTitle className="text-lg">ตรวจสอบและอนุมัติ (สสจ.)</CardTitle>
            <CardDescription>
              ตรวจสอบผลการประเมินและดำเนินการอนุมัติหรือส่งกลับแก้ไข
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label>ความคิดเห็น / เหตุผล</Label>
              <Textarea
                placeholder="เพิ่มความคิดเห็นหรือเหตุผลในการส่งกลับ..."
                value={comment}
                onChange={(e) => setComment(e.target.value)}
                className="min-h-[80px]"
              />
            </div>
            <div className="flex gap-4">
              <Button 
                variant="outline"
                size="lg" 
                className="flex-1"
                onClick={() => setReturnDialogOpen(true)}
              >
                <ArrowLeft className="w-5 h-5 mr-2" />
                ย้อนกลับแก้ไข
              </Button>
              <Button 
                size="lg" 
                className="flex-1"
                onClick={() => setProvincialDialogOpen(true)}
              >
                <Send className="w-5 h-5 mr-2" />
                ยืนยันส่งเขตสุขภาพ
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Final Approval Button - Regional */}
      {canFinalApprove() && (
        <Card className="border-primary">
          <CardHeader>
            <CardTitle className="text-lg">อนุมัติการประเมิน</CardTitle>
            <CardDescription>
              ตรวจสอบคะแนนและอนุมัติการประเมินทั้งหมด
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label>ความคิดเห็น (ถ้ามี)</Label>
              <Textarea
                placeholder="เพิ่มความคิดเห็นหรือหมายเหตุ..."
                value={comment}
                onChange={(e) => setComment(e.target.value)}
                className="min-h-[80px]"
              />
            </div>
            <div className="flex gap-4">
              <Button 
                variant="outline"
                size="lg" 
                className="flex-1"
                onClick={() => setRegionalReturnDialogOpen(true)}
              >
                <ArrowLeft className="w-5 h-5 mr-2" />
                ส่งกลับไปแก้ไข
              </Button>
              <Button 
                size="lg" 
                className="flex-1"
                onClick={() => setDialogOpen(true)}
              >
                <CheckCircle className="w-5 h-5 mr-2" />
                อนุมัติการประเมินเสร็จสิ้น
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Provincial Approval Dialog */}
      <AlertDialog open={provincialDialogOpen} onOpenChange={setProvincialDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>ยืนยันส่งต่อเขตสุขภาพ</AlertDialogTitle>
            <AlertDialogDescription>
              คุณต้องการอนุมัติและส่งต่อการประเมินนี้ไปยังเขตสุขภาพหรือไม่? 
              คะแนนรวม: {totalScore.toFixed(2)}/10 คะแนน
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>ยกเลิก</AlertDialogCancel>
            <AlertDialogAction onClick={handleProvincialApprove} disabled={processing}>
              {processing && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              ยืนยันส่งเขตสุขภาพ
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Return Dialog */}
      <AlertDialog open={returnDialogOpen} onOpenChange={setReturnDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>ยืนยันส่งกลับแก้ไข</AlertDialogTitle>
            <AlertDialogDescription>
              คุณต้องการส่งกลับให้โรงพยาบาลแก้ไขหรือไม่? กรุณาระบุเหตุผลในช่องความคิดเห็น
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>ยกเลิก</AlertDialogCancel>
            <AlertDialogAction onClick={handleReturn} disabled={processing || !comment.trim()}>
              {processing && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              ยืนยันส่งกลับ
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Regional Return Dialog */}
      <AlertDialog open={regionalReturnDialogOpen} onOpenChange={setRegionalReturnDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>ยืนยันส่งกลับแก้ไข</AlertDialogTitle>
            <AlertDialogDescription>
              คุณต้องการส่งกลับให้โรงพยาบาลแก้ไขหรือไม่? การอนุมัติจากระดับจังหวัดจะถูกยกเลิกและต้องเริ่มกระบวนการอนุมัติใหม่ กรุณาระบุเหตุผลในช่องความคิดเห็น
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>ยกเลิก</AlertDialogCancel>
            <AlertDialogAction onClick={handleRegionalReturn} disabled={processing || !comment.trim()}>
              {processing && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              ยืนยันส่งกลับ
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Final Approval Dialog */}
      <AlertDialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>ยืนยันการอนุมัติการประเมิน</AlertDialogTitle>
            <AlertDialogDescription>
              คุณต้องการอนุมัติการประเมินนี้หรือไม่? คะแนนรวม: {totalScore.toFixed(2)}/10 คะแนน
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>ยกเลิก</AlertDialogCancel>
            <AlertDialogAction onClick={handleFinalApprove} disabled={processing}>
              {processing && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              ยืนยันอนุมัติ
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
