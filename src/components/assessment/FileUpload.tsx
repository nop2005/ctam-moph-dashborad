import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useAuth } from '@/contexts/AuthContext';
import { Upload, File, Trash2, Download, Loader2, FileText, Image, FileSpreadsheet, Eye, RefreshCw } from 'lucide-react';
import type { Database } from '@/integrations/supabase/types';
import { FilePreviewDialog } from './FilePreviewDialog';
import { ensureValidSession, storageWithRetry } from '@/lib/supabaseRetry';

type EvidenceFile = Database['public']['Tables']['evidence_files']['Row'];

const MAX_FILES = 2;
const MAX_FILE_SIZE_MB = 20;
const MAX_FILE_SIZE_BYTES = MAX_FILE_SIZE_MB * 1024 * 1024;

interface FileUploadProps {
  assessmentId: string;
  assessmentItemId: string;
  readOnly: boolean;
  /** Disable upload interactions (e.g. require selecting sub-option first) */
  disabled?: boolean;
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

export function FileUpload({
  assessmentId,
  assessmentItemId,
  readOnly,
  disabled = false,
  onFileCountChange,
}: FileUploadProps) {
  const { profile, signOut } = useAuth();
  const { toast } = useToast();
  const [files, setFiles] = useState<EvidenceFile[]>([]);
  const [uploading, setUploading] = useState(false);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [previewFile, setPreviewFile] = useState<EvidenceFile | null>(null);

  const loadFiles = useCallback(async () => {
    setLoadError(null);
    
    try {
      // Ensure valid session before loading
      const session = await ensureValidSession();
      if (!session) {
        // User might need to re-login, but don't block loading completely
        console.warn('No valid session for loading files');
      }
      
      const { data, error } = await supabase
        .from('evidence_files')
        .select('*')
        .eq('assessment_item_id', assessmentItemId)
        .order('created_at', { ascending: false });

      if (error) {
        throw error;
      }
      
      const loadedFiles = data || [];
      setFiles(loadedFiles);
      onFileCountChange?.(loadedFiles.length);
    } catch (error: any) {
      console.error('Error loading files:', error);
      const errorMessage = error?.message || 'ไม่สามารถโหลดไฟล์ได้';
      setLoadError(errorMessage);
      
      // Show toast only for network errors
      if (errorMessage.includes('เชื่อมต่อ') || errorMessage.includes('fetch')) {
        toast({
          title: 'โหลดไฟล์ไม่สำเร็จ',
          description: 'กรุณาตรวจสอบการเชื่อมต่อและลองใหม่',
          variant: 'destructive',
        });
      }
    } finally {
      setLoading(false);
    }
  }, [assessmentItemId, onFileCountChange, toast]);

  useEffect(() => {
    loadFiles();
  }, [loadFiles]);

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (disabled) {
      toast({
        title: 'กรุณาเลือกตัวเลือกก่อน',
        description: 'โปรดเลือก "ประเภทของระบบ/เครื่องมือที่ใช้" ก่อนจึงจะอัปโหลดหลักฐานได้',
        variant: 'destructive',
      });
      e.target.value = '';
      return;
    }

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

    // Ensure valid session before upload
    const session = await ensureValidSession();
    if (!session) {
      toast({
        title: 'เซสชันหมดอายุ',
        description: 'กรุณาเข้าสู่ระบบใหม่เพื่อดำเนินการต่อ',
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
      let successCount = 0;

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
        
        // Use retry wrapper for storage upload
        const { error: uploadError } = await storageWithRetry(
          () => supabase.storage
            .from('evidence-files')
            .upload(filePath, file, {
              cacheControl: '3600',
              upsert: false
            }),
          3
        );

        if (uploadError) {
          console.error('Upload error:', uploadError);
          toast({ 
            title: 'อัปโหลดล้มเหลว', 
            description: uploadError.message.includes('เชื่อมต่อ') 
              ? 'การเชื่อมต่อขัดข้อง กรุณาลองใหม่'
              : `ไม่สามารถอัปโหลด ${file.name} ได้`,
            variant: 'destructive' 
          });
          continue;
        }

        // Save file record
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

        if (dbError) {
          console.error('DB error:', dbError);
          // Try to cleanup orphaned storage file
          await supabase.storage.from('evidence-files').remove([filePath]);
          
          toast({ 
            title: 'บันทึกไม่สำเร็จ', 
            description: 'ไม่สามารถบันทึกข้อมูลไฟล์ได้',
            variant: 'destructive' 
          });
          continue;
        }
        
        successCount++;
      }

      if (successCount > 0) {
        toast({ title: `อัปโหลดสำเร็จ ${successCount} ไฟล์` });
        loadFiles();
      }

    } catch (error: any) {
      console.error('Error uploading file:', error);
      
      // Handle specific error types
      if (error instanceof TypeError && error.message === 'Failed to fetch') {
        toast({ 
          title: 'การเชื่อมต่อขัดข้อง', 
          description: 'กรุณาตรวจสอบอินเทอร์เน็ตและลองใหม่อีกครั้ง',
          variant: 'destructive' 
        });
      } else {
        toast({ 
          title: 'อัปโหลดล้มเหลว', 
          description: error.message || 'เกิดข้อผิดพลาด กรุณาลองใหม่',
          variant: 'destructive' 
        });
      }
    } finally {
      setUploading(false);
      e.target.value = '';
    }
  };

  const handleDownload = async (file: EvidenceFile) => {
    try {
      // Ensure valid session
      await ensureValidSession();
      
      const { data, error } = await storageWithRetry(
        () => supabase.storage
          .from('evidence-files')
          .download(file.file_path),
        2
      );

      if (error) throw error;
      if (!data) throw new Error('ไม่พบไฟล์');

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
      toast({ 
        title: 'ดาวน์โหลดล้มเหลว', 
        description: error.message.includes('เชื่อมต่อ')
          ? 'การเชื่อมต่อขัดข้อง กรุณาลองใหม่'
          : error.message,
        variant: 'destructive' 
      });
    }
  };

  const handleDelete = async (file: EvidenceFile) => {
    try {
      // Ensure valid session
      const session = await ensureValidSession();
      if (!session) {
        toast({
          title: 'เซสชันหมดอายุ',
          description: 'กรุณาเข้าสู่ระบบใหม่',
          variant: 'destructive',
        });
        return;
      }
      
      // Delete from storage with retry
      const { error: storageError } = await storageWithRetry(
        () => supabase.storage
          .from('evidence-files')
          .remove([file.file_path]),
        2
      );

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
      loadFiles();

    } catch (error: any) {
      console.error('Error deleting file:', error);
      toast({ 
        title: 'ลบไฟล์ล้มเหลว', 
        description: error.message.includes('เชื่อมต่อ')
          ? 'การเชื่อมต่อขัดข้อง กรุณาลองใหม่'
          : error.message,
        variant: 'destructive' 
      });
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
            disabled={uploading || !canUploadMore || disabled}
            className="hidden"
            id={`file-upload-${assessmentItemId}`}
          />
          <Button
            variant="outline"
            className="w-full border-dashed"
            disabled={uploading || !canUploadMore || disabled}
            onClick={() => document.getElementById(`file-upload-${assessmentItemId}`)?.click()}
          >
            {uploading ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                กำลังอัปโหลด...
              </>
            ) : disabled ? (
              <>
                <Upload className="w-4 h-4 mr-2" />
                เลือกประเภทของระบบ/เครื่องมือก่อน
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
      ) : loadError ? (
        <div className="flex items-center gap-2 text-sm text-destructive">
          <span>โหลดไฟล์ไม่สำเร็จ</span>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              setLoading(true);
              loadFiles();
            }}
            className="h-6 px-2"
          >
            <RefreshCw className="w-3 h-3 mr-1" />
            ลองใหม่
          </Button>
        </div>
      ) : files.length > 0 ? (
        <div className="space-y-2">
          {files.map((file) => (
            <div
              key={file.id}
              className="flex items-center justify-between p-3 bg-muted/50 rounded-lg"
            >
              <div 
                className="flex items-center gap-3 overflow-hidden flex-1 cursor-pointer hover:opacity-80 transition-opacity"
                onClick={() => setPreviewFile(file)}
              >
                {getFileIcon(file.file_type)}
                <div className="overflow-hidden">
                  <p className="text-sm font-medium truncate">{file.file_name}</p>
                  <p className="text-xs text-muted-foreground">
                    {formatFileSize(file.file_size)}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-1">
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => setPreviewFile(file)}
                  title="ดูตัวอย่าง"
                >
                  <Eye className="w-4 h-4" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => handleDownload(file)}
                  title="ดาวน์โหลด"
                >
                  <Download className="w-4 h-4" />
                </Button>
                {!readOnly && (
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => handleDelete(file)}
                    className="text-destructive hover:text-destructive"
                    title="ลบ"
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

      {/* Preview Dialog */}
      {previewFile && (
        <FilePreviewDialog
          open={!!previewFile}
          onOpenChange={(open) => !open && setPreviewFile(null)}
          fileName={previewFile.file_name}
          filePath={previewFile.file_path}
          fileType={previewFile.file_type}
        />
      )}
    </div>
  );
}
