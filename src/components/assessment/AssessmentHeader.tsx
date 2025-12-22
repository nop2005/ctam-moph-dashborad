import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
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
import { ArrowLeft, Send, Loader2 } from 'lucide-react';
import type { Database } from '@/integrations/supabase/types';

type Assessment = Database['public']['Tables']['assessments']['Row'];

const statusLabels: Record<string, { label: string; className: string }> = {
  draft: { label: 'ร่าง', className: 'status-draft' },
  submitted: { label: 'รอตรวจสอบ', className: 'status-submitted' },
  approved_provincial: { label: 'สสจ.อนุมัติ', className: 'bg-info/10 text-info' },
  approved_regional: { label: 'เขตอนุมัติ', className: 'status-approved' },
  returned: { label: 'ตีกลับแก้ไข', className: 'status-returned' },
  completed: { label: 'เสร็จสิ้น', className: 'status-completed' },
};

interface AssessmentHeaderProps {
  assessment: Assessment;
  onRefresh: () => void;
  canEdit: boolean;
}

export function AssessmentHeader({ assessment, onRefresh, canEdit }: AssessmentHeaderProps) {
  const navigate = useNavigate();
  const { profile } = useAuth();
  const { toast } = useToast();
  const [submitting, setSubmitting] = useState(false);
  const [submitDialogOpen, setSubmitDialogOpen] = useState(false);

  const status = statusLabels[assessment.status] || statusLabels.draft;

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

      toast({ title: 'ส่งแบบประเมินสำเร็จ', description: 'รอการตรวจสอบจาก สสจ.' });
      setSubmitDialogOpen(false);
      onRefresh();

    } catch (error: any) {
      console.error('Error submitting assessment:', error);
      toast({ title: 'เกิดข้อผิดพลาด', description: error.message, variant: 'destructive' });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <>
      <Card>
        <CardContent className="p-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Button variant="ghost" size="icon" onClick={() => navigate('/assessments')}>
                <ArrowLeft className="w-5 h-5" />
              </Button>
              <div>
                <h1 className="text-xl font-bold">
                  แบบประเมิน CTAM+ ปี {assessment.fiscal_year + 543} / {assessment.assessment_period}
                </h1>
                <div className="flex items-center gap-2 mt-1">
                  <Badge className={status.className}>{status.label}</Badge>
                </div>
              </div>
            </div>

            {canEdit && (assessment.status === 'draft' || assessment.status === 'returned') && (
              <Button onClick={() => setSubmitDialogOpen(true)}>
                <Send className="w-4 h-4 mr-2" />
                ส่งแบบประเมิน
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      <AlertDialog open={submitDialogOpen} onOpenChange={setSubmitDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>ยืนยันการส่งแบบประเมิน</AlertDialogTitle>
            <AlertDialogDescription>
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
    </>
  );
}