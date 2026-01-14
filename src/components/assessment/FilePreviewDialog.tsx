import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { supabase } from '@/integrations/supabase/client';
import { Loader2, Download, X, FileText, ExternalLink } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

interface FilePreviewDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  fileName: string;
  filePath: string;
  fileType: string | null;
}

export function FilePreviewDialog({ 
  open, 
  onOpenChange, 
  fileName, 
  filePath, 
  fileType 
}: FilePreviewDialogProps) {
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const isImage = fileType?.startsWith('image/');
  const isPdf = fileType === 'application/pdf';
  const isPreviewable = isImage || isPdf;

  useEffect(() => {
    if (open && filePath) {
      loadPreview();
    }
    return () => {
      if (previewUrl) {
        URL.revokeObjectURL(previewUrl);
      }
    };
  }, [open, filePath]);

  const loadPreview = async () => {
    setLoading(true);
    setError(null);
    
    try {
      const { data, error } = await supabase.storage
        .from('evidence-files')
        .download(filePath);

      if (error) throw error;

      const url = URL.createObjectURL(data);
      setPreviewUrl(url);
    } catch (err: any) {
      console.error('Error loading preview:', err);
      setError('ไม่สามารถโหลดไฟล์ได้');
    } finally {
      setLoading(false);
    }
  };

  const handleDownload = () => {
    if (previewUrl) {
      const link = document.createElement('a');
      link.href = previewUrl;
      link.download = fileName;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      toast({ title: 'ดาวน์โหลดสำเร็จ' });
    }
  };

  const handleOpenInNewTab = () => {
    if (previewUrl) {
      window.open(previewUrl, '_blank');
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] flex flex-col">
        <DialogHeader className="flex-shrink-0">
          <DialogTitle className="flex items-center gap-2 pr-8">
            <FileText className="w-5 h-5" />
            <span className="truncate">{fileName}</span>
          </DialogTitle>
        </DialogHeader>

        <div className="flex-1 min-h-0 overflow-hidden">
          {loading ? (
            <div className="flex items-center justify-center h-64">
              <Loader2 className="w-8 h-8 animate-spin text-primary" />
              <span className="ml-2 text-muted-foreground">กำลังโหลด...</span>
            </div>
          ) : error ? (
            <div className="flex flex-col items-center justify-center h-64 gap-4">
              <p className="text-destructive">{error}</p>
              <Button variant="outline" onClick={loadPreview}>
                ลองใหม่
              </Button>
            </div>
          ) : isImage && previewUrl ? (
            <div className="flex items-center justify-center h-full bg-muted/30 rounded-lg p-4">
              <img 
                src={previewUrl} 
                alt={fileName}
                className="max-w-full max-h-[60vh] object-contain rounded-lg shadow-lg"
              />
            </div>
          ) : isPdf && previewUrl ? (
            <div className="h-[60vh] w-full bg-muted/30 rounded-lg overflow-hidden">
              <iframe
                src={previewUrl}
                title={fileName}
                className="w-full h-full border-0"
              />
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center h-64 gap-4 text-center">
              <FileText className="w-16 h-16 text-muted-foreground" />
              <div>
                <p className="font-medium">ไม่สามารถ preview ไฟล์นี้ได้</p>
                <p className="text-sm text-muted-foreground mt-1">
                  รองรับเฉพาะไฟล์ PDF และรูปภาพ
                </p>
              </div>
            </div>
          )}
        </div>

        <div className="flex justify-end gap-2 pt-4 border-t flex-shrink-0">
          {previewUrl && isPreviewable && (
            <Button variant="outline" onClick={handleOpenInNewTab}>
              <ExternalLink className="w-4 h-4 mr-2" />
              เปิดในแท็บใหม่
            </Button>
          )}
          {previewUrl && (
            <Button onClick={handleDownload}>
              <Download className="w-4 h-4 mr-2" />
              ดาวน์โหลด
            </Button>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
