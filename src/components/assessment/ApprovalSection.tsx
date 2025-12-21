import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
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
import { CheckCircle, XCircle, RotateCcw, Loader2, History, User, Clock } from 'lucide-react';
import { format } from 'date-fns';
import { th } from 'date-fns/locale';
import type { Database } from '@/integrations/supabase/types';

type Assessment = Database['public']['Tables']['assessments']['Row'];
type ApprovalHistory = Database['public']['Tables']['approval_history']['Row'];

interface ApprovalSectionProps {
  assessment: Assessment;
  onRefresh: () => void;
}

export function ApprovalSection({ assessment, onRefresh }: ApprovalSectionProps) {
  const { profile } = useAuth();
  const { toast } = useToast();
  const [history, setHistory] = useState<ApprovalHistory[]>([]);
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState(false);
  const [comment, setComment] = useState('');
  const [approveDialogOpen, setApproveDialogOpen] = useState(false);
  const [returnDialogOpen, setReturnDialogOpen] = useState(false);

  useEffect(() => {
    loadHistory();
  }, [assessment.id]);

  const loadHistory = async () => {
    try {
      const { data, error } = await supabase
        .from('approval_history')
        .select('*')
        .eq('assessment_id', assessment.id)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setHistory(data || []);
    } catch (error: any) {
      console.error('Error loading history:', error);
    } finally {
      setLoading(false);
    }
  };

  const getNextStatus = () => {
    if (profile?.role === 'provincial' && assessment.status === 'submitted') {
      return 'approved_provincial';
    }
    if (profile?.role === 'regional' && assessment.status === 'approved_provincial') {
      return 'approved_regional';
    }
    if (profile?.role === 'central_admin') {
      return 'completed';
    }
    return null;
  };

  const canApprove = () => {
    if (profile?.role === 'provincial' && assessment.status === 'submitted') return true;
    if (profile?.role === 'regional' && assessment.status === 'approved_provincial') return true;
    if (profile?.role === 'central_admin' && assessment.status === 'approved_regional') return true;
    return false;
  };

  const canReturn = () => {
    if (profile?.role === 'provincial' && assessment.status === 'submitted') return true;
    if (profile?.role === 'regional' && assessment.status === 'approved_provincial') return true;
    if (profile?.role === 'central_admin' && assessment.status !== 'draft' && assessment.status !== 'completed') return true;
    return false;
  };

  const handleApprove = async () => {
    const nextStatus = getNextStatus();
    if (!nextStatus) return;

    try {
      setProcessing(true);

      // Prepare update data
      const updateData: Record<string, unknown> = {
        status: nextStatus,
      };

      if (profile?.role === 'provincial') {
        updateData.provincial_approved_by = profile.user_id;
        updateData.provincial_approved_at = new Date().toISOString();
        updateData.provincial_comment = comment || null;
      } else if (profile?.role === 'regional') {
        updateData.regional_approved_by = profile.user_id;
        updateData.regional_approved_at = new Date().toISOString();
        updateData.regional_comment = comment || null;
      }

      const { error: updateError } = await supabase
        .from('assessments')
        .update(updateData)
        .eq('id', assessment.id);

      if (updateError) throw updateError;

      // Add to history
      const { error: historyError } = await supabase
        .from('approval_history')
        .insert({
          assessment_id: assessment.id,
          from_status: assessment.status,
          to_status: nextStatus,
          action: 'approve',
          performed_by: profile?.user_id!,
          comment: comment || null,
        });

      if (historyError) throw historyError;

      toast({ title: 'อนุมัติสำเร็จ' });
      setApproveDialogOpen(false);
      setComment('');
      onRefresh();

    } catch (error: any) {
      console.error('Error approving:', error);
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

      const { error: updateError } = await supabase
        .from('assessments')
        .update({ status: 'returned' })
        .eq('id', assessment.id);

      if (updateError) throw updateError;

      // Add to history
      const { error: historyError } = await supabase
        .from('approval_history')
        .insert({
          assessment_id: assessment.id,
          from_status: assessment.status,
          to_status: 'returned',
          action: 'return',
          performed_by: profile?.user_id!,
          comment: comment,
        });

      if (historyError) throw historyError;

      toast({ title: 'ตีกลับสำเร็จ', description: 'โรงพยาบาลจะได้รับแจ้งให้แก้ไข' });
      setReturnDialogOpen(false);
      setComment('');
      onRefresh();

    } catch (error: any) {
      console.error('Error returning:', error);
      toast({ title: 'เกิดข้อผิดพลาด', description: error.message, variant: 'destructive' });
    } finally {
      setProcessing(false);
    }
  };

  const getActionLabel = (action: string) => {
    switch (action) {
      case 'submit': return 'ส่งแบบประเมิน';
      case 'approve': return 'อนุมัติ';
      case 'return': return 'ตีกลับ';
      default: return action;
    }
  };

  const getStatusLabel = (status: string) => {
    switch (status) {
      case 'draft': return 'ร่าง';
      case 'submitted': return 'รอตรวจสอบ';
      case 'approved_provincial': return 'สสจ.อนุมัติ';
      case 'approved_regional': return 'เขตอนุมัติ';
      case 'returned': return 'ตีกลับ';
      case 'completed': return 'เสร็จสิ้น';
      default: return status;
    }
  };

  return (
    <div className="space-y-6">
      {/* Approval Actions */}
      {(canApprove() || canReturn()) && (
        <Card>
          <CardHeader>
            <CardTitle>ดำเนินการตรวจสอบ</CardTitle>
            <CardDescription>
              ตรวจสอบและอนุมัติหรือตีกลับแบบประเมิน
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label>ความคิดเห็น</Label>
              <Textarea
                placeholder="เพิ่มความคิดเห็นหรือหมายเหตุ..."
                value={comment}
                onChange={(e) => setComment(e.target.value)}
                className="min-h-[100px]"
              />
            </div>
            <div className="flex gap-3">
              {canApprove() && (
                <Button 
                  onClick={() => setApproveDialogOpen(true)}
                  className="flex-1"
                >
                  <CheckCircle className="w-4 h-4 mr-2" />
                  อนุมัติ
                </Button>
              )}
              {canReturn() && (
                <Button 
                  variant="destructive"
                  onClick={() => setReturnDialogOpen(true)}
                  className="flex-1"
                >
                  <RotateCcw className="w-4 h-4 mr-2" />
                  ตีกลับแก้ไข
                </Button>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Approval History */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <History className="w-5 h-5" />
            ประวัติการดำเนินการ
          </CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex items-center justify-center py-4">
              <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
            </div>
          ) : history.length === 0 ? (
            <p className="text-muted-foreground text-center py-4">ยังไม่มีประวัติ</p>
          ) : (
            <div className="space-y-4">
              {history.map((item, index) => (
                <div key={item.id}>
                  <div className="flex items-start gap-4">
                    <div className={`w-10 h-10 rounded-full flex items-center justify-center ${
                      item.action === 'approve' ? 'bg-success/10' :
                      item.action === 'return' ? 'bg-destructive/10' :
                      'bg-primary/10'
                    }`}>
                      {item.action === 'approve' ? (
                        <CheckCircle className="w-5 h-5 text-success" />
                      ) : item.action === 'return' ? (
                        <XCircle className="w-5 h-5 text-destructive" />
                      ) : (
                        <User className="w-5 h-5 text-primary" />
                      )}
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-medium">{getActionLabel(item.action)}</span>
                        <Badge variant="outline">{getStatusLabel(item.from_status)}</Badge>
                        <span className="text-muted-foreground">→</span>
                        <Badge variant="outline">{getStatusLabel(item.to_status)}</Badge>
                      </div>
                      {item.comment && (
                        <p className="text-sm text-muted-foreground mt-1">{item.comment}</p>
                      )}
                      <div className="flex items-center gap-2 text-xs text-muted-foreground mt-1">
                        <Clock className="w-3 h-3" />
                        {format(new Date(item.created_at), 'd MMM yyyy HH:mm', { locale: th })}
                      </div>
                    </div>
                  </div>
                  {index < history.length - 1 && <Separator className="my-4" />}
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Approve Dialog */}
      <AlertDialog open={approveDialogOpen} onOpenChange={setApproveDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>ยืนยันการอนุมัติ</AlertDialogTitle>
            <AlertDialogDescription>
              คุณต้องการอนุมัติแบบประเมินนี้หรือไม่?
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
            <AlertDialogTitle>ยืนยันการตีกลับ</AlertDialogTitle>
            <AlertDialogDescription>
              คุณต้องการตีกลับแบบประเมินนี้เพื่อให้โรงพยาบาลแก้ไขหรือไม่?
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
    </div>
  );
}