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
import { ArrowLeft, Send, Loader2, Download } from 'lucide-react';
import html2canvas from 'html2canvas';
import { jsPDF } from 'jspdf';
import type { Database } from '@/integrations/supabase/types';

type Assessment = Database['public']['Tables']['assessments']['Row'];
type Hospital = Database['public']['Tables']['hospitals']['Row'];
type HealthOffice = Database['public']['Tables']['health_offices']['Row'];

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
  hospital?: Hospital | null;
  healthOffice?: HealthOffice | null;
  onRefresh: () => void;
  canEdit: boolean;
}

export function AssessmentHeader({ assessment, hospital, healthOffice, onRefresh, canEdit }: AssessmentHeaderProps) {
  const navigate = useNavigate();
  const { profile } = useAuth();
  const { toast } = useToast();
  const [submitting, setSubmitting] = useState(false);
  const [submitDialogOpen, setSubmitDialogOpen] = useState(false);
  const [exporting, setExporting] = useState(false);

  const status = statusLabels[assessment.status] || statusLabels.draft;

  // Check if assessment is approved (can export certificate)
  const canExportCertificate = assessment.status === 'approved_regional' || assessment.status === 'completed';

  const handleExportCertificate = async () => {
    try {
      setExporting(true);
      toast({ title: 'กำลังสร้างใบรับรอง PDF...', description: 'กรุณารอสักครู่' });

      // Get the main content element
      const element = document.querySelector('main');
      if (!element) {
        throw new Error('ไม่พบเนื้อหาหน้าเว็บ');
      }

      // Use html2canvas to capture the page
      const canvas = await html2canvas(element as HTMLElement, {
        scale: 2,
        useCORS: true,
        allowTaint: true,
        backgroundColor: '#ffffff',
        logging: false,
        windowWidth: element.scrollWidth,
        windowHeight: element.scrollHeight,
      });

      // Convert canvas to image data
      const imgData = canvas.toDataURL('image/jpeg', 0.95);
      
      // Calculate PDF dimensions (A4 aspect ratio)
      const imgWidth = canvas.width;
      const imgHeight = canvas.height;
      const pdfWidth = 210; // A4 width in mm
      const pdfHeight = (imgHeight * pdfWidth) / imgWidth;
      
      // Create PDF with appropriate orientation
      const orientation = pdfHeight > pdfWidth * 1.5 ? 'portrait' : 'landscape';
      const pdf = new jsPDF({
        orientation: orientation as 'portrait' | 'landscape',
        unit: 'mm',
        format: orientation === 'portrait' ? [pdfWidth, pdfHeight] : [pdfHeight, pdfWidth]
      });
      
      // Add image to PDF
      if (orientation === 'portrait') {
        pdf.addImage(imgData, 'JPEG', 0, 0, pdfWidth, pdfHeight);
      } else {
        pdf.addImage(imgData, 'JPEG', 0, 0, pdfHeight, pdfWidth);
      }

      // Generate filename and download
      const orgName = hospital?.name || healthOffice?.name || 'assessment';
      const safeName = orgName.replace(/[^a-zA-Z0-9ก-๙]/g, '_');
      const filename = `ใบรับรอง_CTAM_${safeName}_${assessment.fiscal_year + 543}_${assessment.assessment_period}.pdf`;
      
      pdf.save(filename);

      toast({ title: 'สำเร็จ', description: 'ส่งออกใบรับรอง PDF เรียบร้อยแล้ว' });
    } catch (error: any) {
      console.error('Error exporting certificate:', error);
      toast({ title: 'เกิดข้อผิดพลาด', description: error.message || 'ไม่สามารถส่งออกใบรับรองได้', variant: 'destructive' });
    } finally {
      setExporting(false);
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
                {(hospital || healthOffice) && (
                  <p className="text-sm text-muted-foreground mt-0.5">
                    {hospital?.name || healthOffice?.name}
                  </p>
                )}
                <div className="flex items-center gap-2 mt-1">
                  <Badge className={status.className}>{status.label}</Badge>
                </div>
              </div>
            </div>

            <div className="flex items-center gap-2">
              {/* Export Certificate Button - only for approved assessments */}
              {canExportCertificate && (
                <Button 
                  variant="outline" 
                  onClick={handleExportCertificate}
                  disabled={exporting}
                  className="text-success border-success hover:bg-success/10"
                >
                  {exporting ? (
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  ) : (
                    <Download className="w-4 h-4 mr-2" />
                  )}
                  ส่งออกใบรับรอง
                </Button>
              )}

              {canEdit && (assessment.status === 'draft' || assessment.status === 'returned') && (
                <Button onClick={() => setSubmitDialogOpen(true)}>
                  <Send className="w-4 h-4 mr-2" />
                  ส่งแบบประเมิน
                </Button>
              )}
            </div>
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