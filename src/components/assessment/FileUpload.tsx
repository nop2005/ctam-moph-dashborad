import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useAuth } from '@/contexts/AuthContext';
import { Upload, File, Trash2, Download, Loader2, FileText, Image, FileSpreadsheet } from 'lucide-react';
import type { Database } from '@/integrations/supabase/types';

type EvidenceFile = Database['public']['Tables']['evidence_files']['Row'];

const MAX_FILES = 2;
const MAX_FILE_SIZE_MB = 20;
const MAX_FILE_SIZE_BYTES = MAX_FILE_SIZE_MB * 1024 * 1024;

interface FileUploadProps {
  assessmentId: string;
  assessmentItemId: string;
  readOnly: boolean;
  onFileCountChange?: (count: number) => void;
}

const getFileIcon = (fileType: string | null) => {
  if (!fileType) return <File className="w-4 h-4" />;
  if (fileType.startsWith('image/')) return <Image className="w-4 h-4" />;
  if (fileType.includes('spreadsheet') || fileType.includes('excel')) return <FileSpreadsheet className="w-4 h-4" />;
  if (fileType.includes('pdf') || fileType.includes('document')) return <FileText className="w-4 h-4" />;
  return <File className="w-4 h-4" />;
};

const formatFileSize = (bytes: number | null) => {
  if (!bytes) return '';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
};

// Sanitize file name to remove special characters for Supabase Storage
const sanitizeFileName = (fileName: string): string => {
  // Get file extension
  const lastDot = fileName.lastIndexOf('.');
  const ext = lastDot > 0 ? fileName.substring(lastDot) : '';
  const name = lastDot > 0 ? fileName.substring(0, lastDot) : fileName;
  
  // Replace non-ASCII and special characters with underscores, keep alphanumeric and basic punctuation
  const sanitized = name
    .replace(/[^\w\s.-]/g, '_') // Replace special chars with underscore
    .replace(/\s+/g, '_')       // Replace spaces with underscore
    .replace(/_+/g, '_')        // Collapse multiple underscores
    .replace(/^_|_$/g, '');     // Remove leading/trailing underscores
  
  return (sanitized || 'file') + ext;
};

export function FileUpload({ assessmentId, assessmentItemId, readOnly, onFileCountChange }: FileUploadProps) {
  const { profile } = useAuth();
  const { toast } = useToast();
  const [files, setFiles] = useState<EvidenceFile[]>([]);
  const [uploading, setUploading] = useState(false);
  const [loading, setLoading] = useState(false);

  const [hasLoaded, setHasLoaded] = useState(false);
  const [retryCount, setRetryCount] = useState(0);
  const retryCountRef = useRef(0);
  const retryTimerRef = useRef<number | null>(null);
  const [retryTick, setRetryTick] = useState(0);

  const isRetriableBackendError = (error: any) => {
    const status = error?.status ?? error?.statusCode;
    const code = error?.code;
    return code === 'PGRST002' || status === 502 || status === 503 || status === 504;
  };

  const clearRetryTimer = () => {
    if (retryTimerRef.current) {
      window.clearTimeout(retryTimerRef.current);
      retryTimerRef.current = null;
    }
  };

  const scheduleRetry = () => {
    clearRetryTimer();

    const attempt = retryCountRef.current;
    if (attempt >= 6) {
      // Give up silently after some retries; keep UI usable.
      setHasLoaded(true);
      return;
    }

    const delay = Math.min(800 * 2 ** attempt, 6000) + Math.random() * 250;
    retryCountRef.current = attempt + 1;
    setRetryCount(retryCountRef.current);

    retryTimerRef.current = window.setTimeout(() => {
      setRetryTick((t) => t + 1);
    }, delay);
  };

  const loadFiles = useCallback(
    async ({ force = false }: { force?: boolean } = {}) => {
      if (hasLoaded && !force) return;

      if (force) {
        clearRetryTimer();
        retryCountRef.current = 0;
        setRetryCount(0);
        setHasLoaded(false);
      }

      try {
        setLoading(true);
        const { data, error } = await supabase
          .from('evidence_files')
          .select('id, file_name, file_path, file_type, file_size, created_at')
          .eq('assessment_item_id', assessmentItemId)
          .order('created_at', { ascending: false });

        if (error) throw error;

        const loadedFiles = (data || []) as EvidenceFile[];
        setFiles(loadedFiles);
        onFileCountChange?.(loadedFiles.length);
        setHasLoaded(true);
        clearRetryTimer();
        retryCountRef.current = 0;
        setRetryCount(0);
      } catch (error: any) {
        console.error('Error loading files:', error);

        // Transient backend errors: retry with backoff (don’t mark as loaded)
        if (isRetriableBackendError(error)) {
          setHasLoaded(false);
          scheduleRetry();
          return;
        }

        // Non-retriable errors: stop trying
        setHasLoaded(true);
      } finally {
        setLoading(false);
      }
    },
    [assessmentItemId, hasLoaded, onFileCountChange]
  );

  useEffect(() => {
    // Reset when changing item
    setFiles([]);
    setHasLoaded(false);
    clearRetryTimer();
    retryCountRef.current = 0;
    setRetryCount(0);
    setRetryTick(0);

    return () => clearRetryTimer();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [assessmentItemId]);

  // Lazy/staggered initial load + controlled retries
  useEffect(() => {
    const timer = window.setTimeout(() => {
      loadFiles();
    }, Math.random() * 500);

    return () => window.clearTimeout(timer);
  }, [loadFiles, retryTick]);

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFiles = e.target.files;
    if (!selectedFiles || selectedFiles.length === 0) return;

    // Ensure profile is loaded (required for uploaded_by)
    if (!profile?.id) {
      toast({
        title: 'ไม่พร้อมอัปโหลดไฟล์',
        description: 'กำลังโหลดข้อมูลผู้ใช้ กรุณารอสักครู่แล้วลองใหม่อีกครั้ง',
        variant: 'destructive',
      });
      e.target.value = '';
      return;
    }

    // Check max files limit
    const remainingSlots = MAX_FILES - files.length;
    if (remainingSlots <= 0) {
      toast({
        title: 'ถึงจำนวนไฟล์สูงสุดแล้ว',
        description: `สามารถแนบได้สูงสุด ${MAX_FILES} ไฟล์ต่อข้อ`,
        variant: 'destructive'
      });
      e.target.value = '';
      return;
    }

    const filesToUpload = Array.from(selectedFiles).slice(0, remainingSlots);
    
    if (filesToUpload.length < selectedFiles.length) {
      toast({ 
        title: 'เลือกไฟล์เกินจำนวน', 
        description: `สามารถอัปโหลดได้อีก ${remainingSlots} ไฟล์ (สูงสุด ${MAX_FILES} ไฟล์ต่อข้อ)`,
        variant: 'destructive' 
      });
    }

    try {
      setUploading(true);

      for (const file of filesToUpload) {
        // Validate file size (20MB max)
        if (file.size > MAX_FILE_SIZE_BYTES) {
          toast({ 
            title: 'ไฟล์ใหญ่เกินไป', 
            description: `${file.name} มีขนาดเกิน ${MAX_FILE_SIZE_MB}MB`,
            variant: 'destructive' 
          });
          continue;
        }

        // Upload to storage - sanitize file name for Supabase Storage
        const safeFileName = sanitizeFileName(file.name);
        const filePath = `${assessmentId}/${assessmentItemId}/${Date.now()}_${safeFileName}`;
        const { error: uploadError } = await supabase.storage
          .from('evidence-files')
          .upload(filePath, file);

        if (uploadError) throw uploadError;

        // Save file record - use profile.id (not user_id) for foreign key
        const { error: dbError } = await supabase
          .from('evidence_files')
          .insert({
            assessment_item_id: assessmentItemId,
            file_name: file.name,
            file_path: filePath,
            file_type: file.type,
            file_size: file.size,
            uploaded_by: profile.id,
          });

        if (dbError) throw dbError;
      }

      toast({ title: 'อัปโหลดไฟล์สำเร็จ' });
      loadFiles({ force: true });

    } catch (error: any) {
      console.error('Error uploading file:', error);
      toast({ title: 'อัปโหลดล้มเหลว', description: error.message, variant: 'destructive' });
    } finally {
      setUploading(false);
      // Reset input
      e.target.value = '';
    }
  };

  const handleDownload = async (file: EvidenceFile) => {
    try {
      const { data, error } = await supabase.storage
        .from('evidence-files')
        .download(file.file_path);

      if (error) throw error;

      // Create download link
      const url = URL.createObjectURL(data);
      const link = document.createElement('a');
      link.href = url;
      link.download = file.file_name;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);

    } catch (error: any) {
      console.error('Error downloading file:', error);
      toast({ title: 'ดาวน์โหลดล้มเหลว', description: error.message, variant: 'destructive' });
    }
  };

  const handleDelete = async (file: EvidenceFile) => {
    try {
      // Delete from storage
      const { error: storageError } = await supabase.storage
        .from('evidence-files')
        .remove([file.file_path]);

      if (storageError) throw storageError;

      // Delete from database
      const { error: dbError } = await supabase
        .from('evidence_files')
        .delete()
        .eq('id', file.id);

      if (dbError) throw dbError;

      toast({ title: 'ลบไฟล์สำเร็จ' });
      const newCount = files.length - 1;
      onFileCountChange?.(newCount);
      loadFiles({ force: true });

    } catch (error: any) {
      console.error('Error deleting file:', error);
      toast({ title: 'ลบไฟล์ล้มเหลว', description: error.message, variant: 'destructive' });
    }
  };

  const canUploadMore = files.length < MAX_FILES;

  return (
    <div className="space-y-3">
      {/* Upload Button */}
      {!readOnly && (
        <div className="relative">
          <Input
            type="file"
            multiple
            accept=".pdf,.jpg,.jpeg,.png,.gif,.doc,.docx,.xls,.xlsx"
            onChange={handleFileUpload}
            disabled={uploading || !canUploadMore}
            className="hidden"
            id={`file-upload-${assessmentItemId}`}
          />
          <Button
            variant="outline"
            className="w-full border-dashed"
            disabled={uploading || !canUploadMore}
            onClick={() => document.getElementById(`file-upload-${assessmentItemId}`)?.click()}
          >
            {uploading ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                กำลังอัปโหลด...
              </>
            ) : !canUploadMore ? (
              <>
                <Upload className="w-4 h-4 mr-2" />
                ถึงจำนวนไฟล์สูงสุดแล้ว ({MAX_FILES} ไฟล์)
              </>
            ) : (
              <>
                <Upload className="w-4 h-4 mr-2" />
                อัปโหลดไฟล์หลักฐาน
              </>
            )}
          </Button>
          <p className="text-xs text-muted-foreground mt-1">
            รองรับ: PDF, รูปภาพ, Word, Excel (สูงสุด {MAX_FILE_SIZE_MB}MB ต่อไฟล์, สูงสุด {MAX_FILES} ไฟล์)
          </p>
          <p className="text-xs text-muted-foreground">
            แนบแล้ว: {files.length}/{MAX_FILES} ไฟล์
          </p>
        </div>
      )}

      {/* File List */}
      {loading ? (
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="w-4 h-4 animate-spin" />
          กำลังโหลด...
        </div>
      ) : files.length > 0 ? (
        <div className="space-y-2">
          {files.map((file) => (
            <div
              key={file.id}
              className="flex items-center justify-between p-3 bg-muted/50 rounded-lg"
            >
              <div className="flex items-center gap-3 overflow-hidden">
                {getFileIcon(file.file_type)}
                <div className="overflow-hidden">
                  <p className="text-sm font-medium truncate">{file.file_name}</p>
                  <p className="text-xs text-muted-foreground">
                    {formatFileSize(file.file_size)}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => handleDownload(file)}
                >
                  <Download className="w-4 h-4" />
                </Button>
                {!readOnly && (
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => handleDelete(file)}
                    className="text-destructive hover:text-destructive"
                  >
                    <Trash2 className="w-4 h-4" />
                  </Button>
                )}
              </div>
            </div>
          ))}
        </div>
      ) : (
        <p className="text-sm text-muted-foreground">ยังไม่มีไฟล์แนบ</p>
      )}
    </div>
  );
}