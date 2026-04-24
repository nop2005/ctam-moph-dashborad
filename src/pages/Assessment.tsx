import { useState, useEffect, useCallback } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { AssessmentHeader } from '@/components/assessment/AssessmentHeader';
import { QuantitativeSection } from '@/components/assessment/QuantitativeSection';
// QualitativeSection removed - no longer used
import { ImpactSection } from '@/components/assessment/ImpactSection';
import { AssessmentSummary } from '@/components/assessment/AssessmentSummary';

import { ApprovalWorkflow } from '@/components/assessment/ApprovalWorkflow';
import { SectionApproval } from '@/components/assessment/SectionApproval';
import { invalidateDashboardCache } from '@/pages/Dashboard';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
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
import { Loader2, Send } from 'lucide-react';
import type { Database } from '@/integrations/supabase/types';

type Assessment = Database['public']['Tables']['assessments']['Row'];
type AssessmentItem = Database['public']['Tables']['assessment_items']['Row'];
type CTAMCategory = Database['public']['Tables']['ctam_categories']['Row'];
type QualitativeScore = Database['public']['Tables']['qualitative_scores']['Row'];
type ImpactScore = Database['public']['Tables']['impact_scores']['Row'];
type Hospital = Database['public']['Tables']['hospitals']['Row'];
type HealthOffice = Database['public']['Tables']['health_offices']['Row'];
type Province = Database['public']['Tables']['provinces']['Row'];

export default function Assessment() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { profile } = useAuth();
  const { toast } = useToast();

  const [loading, setLoading] = useState(true);
  const [assessment, setAssessment] = useState<Assessment | null>(null);
  const [categories, setCategories] = useState<CTAMCategory[]>([]);
  const [items, setItems] = useState<AssessmentItem[]>([]);
  const [qualitativeScore, setQualitativeScore] = useState<QualitativeScore | null>(null);
  const [impactScore, setImpactScore] = useState<ImpactScore | null>(null);
  const [hospital, setHospital] = useState<Hospital | null>(null);
  const [healthOffice, setHealthOffice] = useState<HealthOffice | null>(null);
  const [province, setProvince] = useState<Province | null>(null);
  const [activeTab, setActiveTab] = useState('quantitative');

  // Navigate back to dashboard after all sections approved, clearing cache
  const handleAllSectionsApproved = useCallback(() => {
    invalidateDashboardCache();
    navigate('/dashboard');
  }, [navigate]);
  const [submitting, setSubmitting] = useState(false);
  const [submitDialogOpen, setSubmitDialogOpen] = useState(false);
  const [allFilesAttached, setAllFilesAttached] = useState(false);
  const [regionalDoneDialogOpen, setRegionalDoneDialogOpen] = useState(false);

  const isReadOnly = assessment?.status !== 'draft' && assessment?.status !== 'returned';
  // Regional admin can edit any assessment in their region regardless of status
  const isRegionalEditor = profile?.role === 'regional';
  // Unit owners (hospital_it / health_office) can also edit any of their assessments
  // even after submission/approval — changes will be resubmitted for re-approval.
  const isUnitOwnerEditor =
    (profile?.role === 'hospital_it' && assessment?.hospital_id === profile?.hospital_id) ||
    (profile?.role === 'health_office' && (assessment?.health_office_id === profile?.health_office_id || assessment?.hospital_id != null));
  // Health office users can edit their own assessments just like hospital_it
  const canEdit = ((profile?.role === 'hospital_it' || profile?.role === 'health_office') && !isReadOnly) || isRegionalEditor || isUnitOwnerEditor;
  // Editing an already-submitted/approved assessment as unit owner = post-approval edit flow
  const isUnitOwnerPostApprovalEdit = isUnitOwnerEditor && isReadOnly;
  const canReview = (profile?.role === 'provincial' && assessment?.status === 'submitted') ||
                   (profile?.role === 'regional' && assessment?.status === 'approved_provincial');
  const canApprove = profile?.role === 'central_admin';

  // Check if all items are answered (have pass/fail status)
  const allItemsAnswered = items.length === categories.length && items.length > 0;
  
  // Check if all "pass" items have sub-option selected
  const allSubOptionsSelected = items.every(item => {
    if (item.status !== 'pass') return true;
    // Check if description contains sub-option format [xxx]
    return item.description && /^\[\w+\]/.test(item.description);
  });

  // File attachment is now optional - only require answers and sub-options
  const canSubmit = canEdit && allItemsAnswered && allSubOptionsSelected;

  // Calculate scores for tabs
  const calculateQuantitativeScore = () => {
    const passCount = items.filter(item => item.status === 'pass').length;
    const totalCategories = categories.length;
    if (totalCategories === 0) return { score: 0, total: 7 };
    const score = (passCount / totalCategories) * 7;
    return { score: Math.round(score * 100) / 100, total: 7 };
  };

  const calculateImpactScore = () => {
    const maxScore = 3;
    // If no impact score exists yet, calculate default score (no incident + no breach = 100%)
    const totalScorePercent = impactScore?.total_score !== null && impactScore?.total_score !== undefined 
      ? Number(impactScore.total_score) 
      : 100; // Default: no incident + no breach = 50 + 50 = 100
    const score = totalScorePercent * (maxScore / 100);
    return { score: Math.round(score * 100) / 100, total: maxScore };
  };

  const calculateTotalScore = () => {
    const quantScore = calculateQuantitativeScore();
    const impactScoreVal = calculateImpactScore();
    const total = quantScore.score + impactScoreVal.score;
    return { score: Math.round(total * 100) / 100, total: 10 };
  };

  const quantScore = calculateQuantitativeScore();
  const impactScoreCalc = calculateImpactScore();
  const totalScore = calculateTotalScore();

  useEffect(() => {
    if (id) {
      loadAssessmentData();
    }
  }, [id]);

  // Auto-recalculate and persist scores when regional admin edits an already-approved assessment.
  // This keeps Dashboard/Reports in sync after regional edits without requiring re-approval.
  useEffect(() => {
    if (!isRegionalEditor && !isUnitOwnerPostApprovalEdit) return;
    if (!assessment || loading) return;
    if (categories.length === 0 || items.length === 0) return;

    const quant = calculateQuantitativeScore().score;
    const imp = calculateImpactScore().score;
    const total = Math.round((quant + imp) * 100) / 100;

    const sameQuant = Number(assessment.quantitative_score ?? -1) === Number(quant.toFixed(2));
    const sameImp = Number(assessment.impact_score ?? -1) === Number(imp.toFixed(2));
    const sameTotal = Number(assessment.total_score ?? -1) === total;
    if (sameQuant && sameImp && sameTotal) return;

    const handle = setTimeout(async () => {
      try {
        const { error } = await supabase
          .from('assessments')
          .update({
            quantitative_score: Number(quant.toFixed(2)),
            qualitative_score: 0,
            impact_score: Number(imp.toFixed(2)),
            total_score: total,
          })
          .eq('id', assessment.id);
        if (error) throw error;
        invalidateDashboardCache();
        setAssessment((prev) => prev ? {
          ...prev,
          quantitative_score: Number(quant.toFixed(2)),
          impact_score: Number(imp.toFixed(2)),
          total_score: total,
        } : prev);
      } catch (e) {
        console.error('Failed to recalc scores after regional edit:', e);
      }
    }, 800);

    return () => clearTimeout(handle);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isRegionalEditor, isUnitOwnerPostApprovalEdit, items, impactScore, categories.length, assessment?.id, loading]);

  const loadAssessmentData = async () => {
    try {
      setLoading(true);

      // Load categories
      const { data: categoriesData, error: catError } = await supabase
        .from('ctam_categories')
        .select('*')
        .order('order_number');

      if (catError) throw catError;
      setCategories(categoriesData || []);

      // Load assessment
      const { data: assessmentData, error: assessError } = await supabase
        .from('assessments')
        .select('*')
        .eq('id', id)
        .maybeSingle();

      if (assessError) throw assessError;
      if (!assessmentData) {
        toast({ title: 'ไม่พบแบบประเมิน', variant: 'destructive' });
        navigate('/assessments');
        return;
      }
      setAssessment(assessmentData);

      // Load hospital info if hospital_id exists
      if (assessmentData.hospital_id) {
        const { data: hospitalData } = await supabase
          .from('hospitals')
          .select('*')
          .eq('id', assessmentData.hospital_id)
          .maybeSingle();
        setHospital(hospitalData);

        // Load province info for the hospital
        if (hospitalData?.province_id) {
          const { data: provinceData } = await supabase
            .from('provinces')
            .select('*')
            .eq('id', hospitalData.province_id)
            .maybeSingle();
          setProvince(provinceData);
        }
      }

      // Load health office info if health_office_id exists
      if (assessmentData.health_office_id) {
        const { data: healthOfficeData } = await supabase
          .from('health_offices')
          .select('*')
          .eq('id', assessmentData.health_office_id)
          .maybeSingle();
        setHealthOffice(healthOfficeData);

        // Load province info for the health office
        if (healthOfficeData?.province_id) {
          const { data: provinceData } = await supabase
            .from('provinces')
            .select('*')
            .eq('id', healthOfficeData.province_id)
            .maybeSingle();
          setProvince(provinceData);
        }
      }

      // Load assessment items
      const { data: itemsData, error: itemsError } = await supabase
        .from('assessment_items')
        .select('*')
        .eq('assessment_id', id);

      if (itemsError) throw itemsError;
      setItems(itemsData || []);

      // Load qualitative score
      const { data: qualData } = await supabase
        .from('qualitative_scores')
        .select('*')
        .eq('assessment_id', id)
        .maybeSingle();
      setQualitativeScore(qualData);

      // Load impact score
      const { data: impactData } = await supabase
        .from('impact_scores')
        .select('*')
        .eq('assessment_id', id)
        .maybeSingle();
      setImpactScore(impactData);

    } catch (error: any) {
      console.error('Error loading assessment:', error);
      toast({ title: 'เกิดข้อผิดพลาด', description: error.message, variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async () => {
    try {
      setSubmitting(true);

      // Update assessment status to submitted
      const { error: updateError } = await supabase
        .from('assessments')
        .update({
          status: 'submitted',
          submitted_by: profile?.id,
          submitted_at: new Date().toISOString(),
        })
        .eq('id', assessment.id);

      if (updateError) throw updateError;

      // Add approval history
      const { error: historyError } = await supabase
        .from('approval_history')
        .insert({
          assessment_id: assessment.id,
          from_status: assessment.status,
          to_status: 'submitted',
          action: 'submit',
          performed_by: profile?.id!,
        });

      if (historyError) throw historyError;

      toast({ title: 'ส่งแบบประเมินสำเร็จ', description: `รอการตรวจสอบจาก สสจ.${province?.name || ''}` });
      setSubmitDialogOpen(false);
      loadAssessmentData();

    } catch (error: any) {
      console.error('Error submitting assessment:', error);
      toast({ title: 'เกิดข้อผิดพลาด', description: error.message, variant: 'destructive' });
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center h-64">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
        </div>
      </DashboardLayout>
    );
  }

  if (!assessment) {
    return null;
  }

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <AssessmentHeader 
          assessment={assessment} 
          hospital={hospital}
          healthOffice={healthOffice}
          onRefresh={loadAssessmentData}
          canEdit={canEdit}
        />

        {/* Regional admin / Unit owner post-approval: confirm done editing */}
        {(isRegionalEditor || isUnitOwnerPostApprovalEdit) && assessment.status !== 'draft' && assessment.status !== 'returned' && (
          <div className="flex justify-end">
            <Button onClick={() => setRegionalDoneDialogOpen(true)}>
              เสร็จสิ้นการแก้ไข
            </Button>
          </div>
        )}

        {/* Approval Workflow Stepper */}
        <ApprovalWorkflow status={assessment.status} />

        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
          <TabsList className="flex justify-center gap-4 w-full max-w-3xl mx-auto h-auto bg-transparent">
            <TabsTrigger value="quantitative" className="flex flex-col text-lg py-3 px-6 rounded-lg border border-border bg-muted data-[state=active]:bg-primary data-[state=active]:text-primary-foreground data-[state=active]:border-primary">
              <span>เชิงปริมาณ (70%)</span>
              <span className="text-sm font-bold text-orange-500 data-[state=active]:text-orange-200">{quantScore.score}/{quantScore.total}</span>
            </TabsTrigger>
            <TabsTrigger value="impact" className="flex flex-col text-lg py-3 px-6 rounded-lg border border-border bg-muted data-[state=active]:bg-primary data-[state=active]:text-primary-foreground data-[state=active]:border-primary">
              <span>ผลกระทบ (30%)</span>
              <span className="text-sm font-bold text-orange-500 data-[state=active]:text-orange-200">{impactScoreCalc.score}/{impactScoreCalc.total}</span>
            </TabsTrigger>
            <TabsTrigger value="summary" className="flex flex-col text-lg py-3 px-6 rounded-lg border border-border bg-muted data-[state=active]:bg-primary data-[state=active]:text-primary-foreground data-[state=active]:border-primary">
              <span>สรุปผล (100%)</span>
              <span className="text-sm font-bold text-orange-500 data-[state=active]:text-orange-200">{totalScore.score}/{totalScore.total}</span>
            </TabsTrigger>
          </TabsList>

          <TabsContent value="quantitative" className="space-y-4">
            <QuantitativeSection
              assessmentId={assessment.id}
              categories={categories}
              items={items}
              onItemsChange={setItems}
              onAllFilesAttached={setAllFilesAttached}
              readOnly={!canEdit}
            />
            
            {/* Submit button at the bottom of quantitative section */}
            {canEdit && !isRegionalEditor && (assessment.status === 'draft' || assessment.status === 'returned') && (
              <div className="flex justify-center pt-4">
                <Button 
                  size="lg"
                  onClick={() => setSubmitDialogOpen(true)}
                  disabled={!canSubmit}
                  className="min-w-[300px]"
                >
                  <Send className="w-4 h-4 mr-2" />
                  ส่งประเมินให้ สสจ.{province?.name || ''}
                </Button>
              </div>
            )}
            {canEdit && !allItemsAnswered && (
              <p className="text-center text-sm text-muted-foreground">
                กรุณาตอบคำถามให้ครบทุกข้อก่อนส่งประเมิน
              </p>
            )}
            {canEdit && allItemsAnswered && !allSubOptionsSelected && (
              <p className="text-center text-sm text-destructive">
                กรุณาเลือกประเภทของระบบ/เครื่องมือที่ใช้ให้ครบทุกข้อที่ตอบ "มี"
              </p>
            )}
            {/* File attachment warning removed - now optional */}
            
            {/* Section-level approval for quantitative */}
            <SectionApproval 
              assessment={assessment} 
              sectionType="quantitative" 
              onRefresh={loadAssessmentData}
              onApproveSuccess={() => setActiveTab('impact')}
              onAllSectionsApproved={handleAllSectionsApproved}
            />
          </TabsContent>

          <TabsContent value="impact" className="space-y-4">
            <ImpactSection
              assessmentId={assessment.id}
              impactScore={impactScore}
              onScoreChange={setImpactScore}
              readOnly={!canEdit && !canReview && !canApprove}
            />
            {/* Section-level approval for impact */}
            <SectionApproval 
              assessment={assessment} 
              sectionType="impact" 
              onRefresh={loadAssessmentData}
              onApproveSuccess={() => setActiveTab('summary')}
              onAllSectionsApproved={handleAllSectionsApproved}
            />
          </TabsContent>

          <TabsContent value="summary">
            <AssessmentSummary
              assessment={assessment}
              items={items}
              categories={categories}
              qualitativeScore={qualitativeScore}
              impactScore={impactScore}
              onRefresh={loadAssessmentData}
              onAllApproved={handleAllSectionsApproved}
            />
          </TabsContent>
        </Tabs>

        {/* Submit Confirmation Dialog */}
        <AlertDialog open={submitDialogOpen} onOpenChange={setSubmitDialogOpen}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>ยืนยันการส่งแบบประเมิน</AlertDialogTitle>
              <AlertDialogDescription>
                คุณกำลังจะส่งแบบประเมินไปยัง สสจ.{province?.name || ''} 
                <br />
                เมื่อส่งแบบประเมินแล้ว คุณจะไม่สามารถแก้ไขได้จนกว่าจะถูกตีกลับ
                กรุณาตรวจสอบข้อมูลให้ถูกต้องก่อนส่ง
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>ยกเลิก</AlertDialogCancel>
              <AlertDialogAction onClick={handleSubmit} disabled={submitting}>
                {submitting && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                ยืนยันส่ง
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

        {/* Regional Done-Editing Confirmation Dialog */}
        <AlertDialog open={regionalDoneDialogOpen} onOpenChange={setRegionalDoneDialogOpen}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>ยืนยันการแก้ไขเสร็จสิ้น</AlertDialogTitle>
              <AlertDialogDescription asChild>
                <div className="space-y-2">
                  <p>คะแนนใหม่ของแบบประเมินนี้:</p>
                  <div className="rounded-md border p-3 bg-muted/50 space-y-1 text-foreground">
                    <div className="flex justify-between">
                      <span>เชิงปริมาณ (70%)</span>
                      <span className="font-semibold">{quantScore.score} / {quantScore.total}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>ผลกระทบ (30%)</span>
                      <span className="font-semibold">{impactScoreCalc.score} / {impactScoreCalc.total}</span>
                    </div>
                    <div className="flex justify-between border-t pt-1 mt-1">
                      <span>คะแนนรวม</span>
                      <span className="font-bold text-primary">{totalScore.score} / {totalScore.total}</span>
                    </div>
                  </div>
                  <p className="text-sm text-muted-foreground">
                    {isUnitOwnerPostApprovalEdit
                      ? 'แบบประเมินจะถูกส่งกลับไปยัง สสจ. และแอดมินเขต เพื่อตรวจสอบและอนุมัติใหม่อีกครั้ง'
                      : 'คะแนนจะถูกบันทึกและอัปเดตในหน้า Dashboard และรายงานทันที'}
                  </p>
                </div>
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel disabled={submitting}>แก้ไขต่อ</AlertDialogCancel>
              <AlertDialogAction
                disabled={submitting}
                onClick={async (e) => {
                  e.preventDefault();
                  if (isUnitOwnerPostApprovalEdit && assessment) {
                    try {
                      setSubmitting(true);
                      const fromStatus = assessment.status;
                      const { error: updErr } = await supabase
                        .from('assessments')
                        .update({
                          status: 'submitted',
                          submitted_by: profile?.id,
                          submitted_at: new Date().toISOString(),
                          quantitative_score: Number(quantScore.score.toFixed(2)),
                          qualitative_score: 0,
                          impact_score: Number(impactScoreCalc.score.toFixed(2)),
                          total_score: totalScore.score,
                          provincial_approved_at: null,
                          provincial_approved_by: null,
                          regional_approved_at: null,
                          regional_approved_by: null,
                          quantitative_approved_at: null,
                          quantitative_approved_by: null,
                          impact_approved_at: null,
                          impact_approved_by: null,
                        })
                        .eq('id', assessment.id);
                      if (updErr) throw updErr;
                      await supabase.from('approval_history').insert({
                        assessment_id: assessment.id,
                        from_status: fromStatus,
                        to_status: 'submitted',
                        action: 'resubmit_after_edit',
                        performed_by: profile?.id!,
                        comment: 'แก้ไขแบบประเมินหลังการอนุมัติ และส่งให้ สสจ./เขต ตรวจสอบใหม่',
                      });
                      toast({ title: 'ส่งแบบประเมินเพื่อตรวจสอบใหม่สำเร็จ', description: 'รอการตรวจสอบจาก สสจ. และแอดมินเขต' });
                    } catch (err: any) {
                      console.error(err);
                      toast({ title: 'เกิดข้อผิดพลาด', description: err.message, variant: 'destructive' });
                      setSubmitting(false);
                      return;
                    }
                  }
                  setRegionalDoneDialogOpen(false);
                  setSubmitting(false);
                  invalidateDashboardCache();
                  navigate('/dashboard');
                }}
              >
                {submitting && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                {isUnitOwnerPostApprovalEdit ? 'ยืนยันและส่งให้ สสจ./เขต' : 'ยืนยันและกลับ Dashboard'}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </DashboardLayout>
  );
}