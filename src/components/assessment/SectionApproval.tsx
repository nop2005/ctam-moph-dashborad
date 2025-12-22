import { useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
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
import { CheckCircle, RotateCcw, Loader2, CheckCircle2 } from 'lucide-react';
import { format } from 'date-fns';
import { th } from 'date-fns/locale';
import type { Database } from '@/integrations/supabase/types';

type Assessment = Database['public']['Tables']['assessments']['Row'];

type SectionType = 'quantitative' | 'qualitative' | 'impact';

interface SectionApprovalProps {
  assessment: Assessment;
  sectionType: SectionType;
  onRefresh: () => void;
}

const sectionLabels: Record<SectionType, string> = {
  quantitative: 'เชิงปริมาณ',
  qualitative: 'เชิงคุณภาพ',
  impact: 'ผลกระทบ',
};

export function SectionApproval({ assessment, sectionType, onRefresh }: SectionApprovalProps) {
  const { profile } = useAuth();
  const { toast } = useToast();
  const [processing, setProcessing] = useState(false);
  const [comment, setComment] = useState('');
  const [approveDialogOpen, setApproveDialogOpen] = useState(false);
  const [returnDialogOpen, setReturnDialogOpen] = useState(false);

  // Check if user can review this section
  const canReview = () => {
    if (profile?.role === 'provincial' && assessment.status === 'submitted') return true;
    if (profile?.role === 'regional' && assessment.status === 'approved_provincial') return true;
    if (profile?.role === 'central_admin') return true;
    return false;
  };

  // Get approval status for this section
  const getApprovalInfo = () => {
    const approvedByKey = `${sectionType}_approved_by` as keyof Assessment;
    const approvedAtKey = `${sectionType}_approved_at` as keyof Assessment;
    
    return {
      approvedBy: assessment[approvedByKey] as string | null,
      approvedAt: assessment[approvedAtKey] as string | null,
    };
  };

  const { approvedBy, approvedAt } = getApprovalInfo();
  const isApproved = !!approvedBy && !!approvedAt;

  // Check if all sections are approved (including the one we just approved)
  const checkAllSectionsApproved = async (currentSection: SectionType) => {
    const { data, error } = await supabase
      .from('assessments')
      .select('quantitative_approved_by, qualitative_approved_by, impact_approved_by')
      .eq('id', assessment.id)
      .single();

    if (error || !data) return false;

    // Create a merged check - current section will be approved by us
    const sections = {
      quantitative: data.quantitative_approved_by,
      qualitative: data.qualitative_approved_by,
      impact: data.impact_approved_by,
    };
    
    // Mark current section as approved (we're about to save it)
    sections[currentSection] = profile?.id || 'pending';

    return !!(sections.quantitative && sections.qualitative && sections.impact);
  };

  const handleApprove = async () => {
    try {
      setProcessing(true);

      const approvedByKey = `${sectionType}_approved_by`;
      const approvedAtKey = `${sectionType}_approved_at`;

      // Update section approval
      const { error: updateError } = await supabase
        .from('assessments')
        .update({
          [approvedByKey]: profile?.id,
          [approvedAtKey]: new Date().toISOString(),
        })
        .eq('id', assessment.id);

      if (updateError) throw updateError;

      // Add to history
      await supabase
        .from('approval_history')
        .insert([{
          assessment_id: assessment.id,
          from_status: assessment.status,
          to_status: assessment.status,
          action: `approve_${sectionType}`,
          performed_by: profile?.id!,
          comment: comment || `อนุมัติส่วน${sectionLabels[sectionType]}`,
        }]);

      // Check if all sections are now approved (including this one)
      const allApproved = await checkAllSectionsApproved(sectionType);
      
      if (allApproved) {
        // Determine next status
        let nextStatus: string;
        if (profile?.role === 'provincial') {
          nextStatus = 'approved_provincial';
        } else if (profile?.role === 'regional') {
          nextStatus = 'approved_regional';
        } else {
          nextStatus = 'completed';
        }

        // Update main status and clear section approvals for next level
        const statusUpdate: Record<string, unknown> = {
          status: nextStatus,
        };

        // If moving to next level, clear section approvals for fresh review
        if (nextStatus !== 'completed') {
          statusUpdate.quantitative_approved_by = null;
          statusUpdate.quantitative_approved_at = null;
          statusUpdate.qualitative_approved_by = null;
          statusUpdate.qualitative_approved_at = null;
          statusUpdate.impact_approved_by = null;
          statusUpdate.impact_approved_at = null;
        }

        if (profile?.role === 'provincial') {
          statusUpdate.provincial_approved_by = profile.id;
          statusUpdate.provincial_approved_at = new Date().toISOString();
          statusUpdate.provincial_comment = comment || null;
        } else if (profile?.role === 'regional') {
          statusUpdate.regional_approved_by = profile.id;
          statusUpdate.regional_approved_at = new Date().toISOString();
          statusUpdate.regional_comment = comment || null;
        }

        await supabase
          .from('assessments')
          .update(statusUpdate)
          .eq('id', assessment.id);

        // Add completion history
        await supabase
          .from('approval_history')
          .insert([{
            assessment_id: assessment.id,
            from_status: assessment.status,
            to_status: nextStatus as Database['public']['Enums']['assessment_status'],
            action: 'approve',
            performed_by: profile?.id!,
            comment: 'อนุมัติครบทุกส่วน',
          }]);

        toast({ 
          title: 'อนุมัติครบทุกส่วนแล้ว', 
          description: nextStatus === 'completed' ? 'การประเมินเสร็จสมบูรณ์' : 'ส่งต่อให้ระดับถัดไปตรวจสอบ' 
        });
      } else {
        toast({ title: `อนุมัติส่วน${sectionLabels[sectionType]}สำเร็จ` });
      }

      setApproveDialogOpen(false);
      setComment('');
      onRefresh();

    } catch (error: any) {
      console.error('Error approving section:', error);
      toast({ title: 'เกิดข้อผิดพลาด', description: error.message, variant: 'destructive' });
    } finally {
      setProcessing(false);
    }
  };

  const handleReturn = async () => {
    if (!comment.trim()) {
      toast({ title: 'กรุณาระบุเหตุผลการตีกลับ', variant: 'destructive' });
      return;
    }

    try {
      setProcessing(true);

      // Clear all section approvals and return
      const { error: updateError } = await supabase
        .from('assessments')
        .update({
          status: 'returned',
          quantitative_approved_by: null,
          quantitative_approved_at: null,
          qualitative_approved_by: null,
          qualitative_approved_at: null,
          impact_approved_by: null,
          impact_approved_at: null,
        })
        .eq('id', assessment.id);

      if (updateError) throw updateError;

      // Add to history
      await supabase
        .from('approval_history')
        .insert([{
          assessment_id: assessment.id,
          from_status: assessment.status,
          to_status: 'returned' as Database['public']['Enums']['assessment_status'],
          action: `return_${sectionType}`,
          performed_by: profile?.id!,
          comment: `ตีกลับส่วน${sectionLabels[sectionType]}: ${comment}`,
        }]);

      toast({ title: 'ตีกลับสำเร็จ', description: 'โรงพยาบาลจะได้รับแจ้งให้แก้ไข' });
      setReturnDialogOpen(false);
      setComment('');
      onRefresh();

    } catch (error: any) {
      console.error('Error returning section:', error);
      toast({ title: 'เกิดข้อผิดพลาด', description: error.message, variant: 'destructive' });
    } finally {
      setProcessing(false);
    }
  };

  if (!canReview()) return null;

  // Already approved - show status
  if (isApproved) {
    return (
      <Card className="border-success/50 bg-success/5">
        <CardContent className="pt-6">
          <div className="flex items-center gap-3">
            <CheckCircle2 className="w-6 h-6 text-success" />
            <div>
              <p className="font-medium text-success">อนุมัติส่วน{sectionLabels[sectionType]}แล้ว</p>
              <p className="text-sm text-muted-foreground">
                {approvedAt && format(new Date(approvedAt), 'd MMM yyyy HH:mm', { locale: th })}
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <>
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">ตรวจสอบส่วน{sectionLabels[sectionType]}</CardTitle>
          <CardDescription>
            ตรวจสอบและอนุมัติหรือตีกลับส่วน{sectionLabels[sectionType]}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label>ความคิดเห็น</Label>
            <Textarea
              placeholder="เพิ่มความคิดเห็นหรือหมายเหตุ..."
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              className="min-h-[80px]"
            />
          </div>
          <div className="flex gap-3">
            <Button 
              onClick={() => setApproveDialogOpen(true)}
              className="flex-1"
            >
              <CheckCircle className="w-4 h-4 mr-2" />
              อนุมัติ
            </Button>
            <Button 
              variant="destructive"
              onClick={() => setReturnDialogOpen(true)}
              className="flex-1"
            >
              <RotateCcw className="w-4 h-4 mr-2" />
              ตีกลับแก้ไข
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Approve Dialog */}
      <AlertDialog open={approveDialogOpen} onOpenChange={setApproveDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>ยืนยันการอนุมัติส่วน{sectionLabels[sectionType]}</AlertDialogTitle>
            <AlertDialogDescription>
              คุณต้องการอนุมัติส่วน{sectionLabels[sectionType]}หรือไม่?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>ยกเลิก</AlertDialogCancel>
            <AlertDialogAction onClick={handleApprove} disabled={processing}>
              {processing && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              ยืนยันอนุมัติ
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Return Dialog */}
      <AlertDialog open={returnDialogOpen} onOpenChange={setReturnDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>ยืนยันการตีกลับส่วน{sectionLabels[sectionType]}</AlertDialogTitle>
            <AlertDialogDescription>
              คุณต้องการตีกลับส่วน{sectionLabels[sectionType]}เพื่อให้โรงพยาบาลแก้ไขหรือไม่?
              {!comment.trim() && (
                <span className="text-destructive block mt-2">
                  * กรุณาระบุเหตุผลการตีกลับในช่องความคิดเห็น
                </span>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>ยกเลิก</AlertDialogCancel>
            <AlertDialogAction 
              onClick={handleReturn} 
              disabled={processing || !comment.trim()}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {processing && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              ยืนยันตีกลับ
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
