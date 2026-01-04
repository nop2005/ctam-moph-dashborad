import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useAuth } from '@/contexts/AuthContext';
import { Upload, File, Trash2, Download, Loader2, FileText, Image, FileSpreadsheet } from 'lucide-react';
import type { Database } from '@/integrations/supabase/types';

type EvidenceFile = Database['public']['Tables']['evidence_files']['Row'];

interface FileUploadProps {
  assessmentId: string;
  assessmentItemId: string;
  readOnly: boolean;
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

export function FileUpload({ assessmentId, assessmentItemId, readOnly }: FileUploadProps) {
  const { profile } = useAuth();
  const { toast } = useToast();
  const [files, setFiles] = useState<EvidenceFile[]>([]);
  const [uploading, setUploading] = useState(false);
  const [loading, setLoading] = useState(true);

  const loadFiles = useCallback(async () => {
    try {
      const { data, error } = await supabase
        .from('evidence_files')
        .select('*')
        .eq('assessment_item_id', assessmentItemId)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setFiles(data || []);
    } catch (error: any) {
      console.error('Error loading files:', error);
    } finally {
      setLoading(false);
    }
  }, [assessmentItemId]);

  useEffect(() => {
    loadFiles();
  }, [loadFiles]);

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFiles = e.target.files;
    if (!selectedFiles || selectedFiles.length === 0) return;

    try {
      setUploading(true);

      for (const file of Array.from(selectedFiles)) {
        // Validate file size (50MB max)
        if (file.size > 50 * 1024 * 1024) {
          toast({ 
            title: 'ไฟล์ใหญ่เกินไป', 
            description: `${file.name} มีขนาดเกิน 50MB`,
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
            uploaded_by: profile?.id!,
          });

        if (dbError) throw dbError;
      }

      toast({ title: 'อัปโหลดไฟล์สำเร็จ' });
      loadFiles();

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
      loadFiles();

    } catch (error: any) {
      console.error('Error deleting file:', error);
      toast({ title: 'ลบไฟล์ล้มเหลว', description: error.message, variant: 'destructive' });
    }
  };

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
            disabled={uploading}
            className="hidden"
            id={`file-upload-${assessmentItemId}`}
          />
          <Button
            variant="outline"
            className="w-full border-dashed"
            disabled={uploading}
            onClick={() => document.getElementById(`file-upload-${assessmentItemId}`)?.click()}
          >
            {uploading ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                กำลังอัปโหลด...
              </>
            ) : (
              <>
                <Upload className="w-4 h-4 mr-2" />
                อัปโหลดไฟล์หลักฐาน
              </>
            )}
          </Button>
          <p className="text-xs text-muted-foreground mt-1">
            รองรับ: PDF, รูปภาพ, Word, Excel (สูงสุด 50MB)
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