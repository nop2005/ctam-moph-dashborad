import { useState, useEffect, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import { Paperclip, X, FileText, Loader2 } from 'lucide-react';

interface EvidenceFile {
  id: string;
  file_name: string;
  file_path: string;
  file_type: string | null;
  file_size: number | null;
}

interface EvidenceUploadProps {
  qualitativeScoreId: string | null;
  fieldName: string;
  disabled?: boolean;
}

export function EvidenceUpload({ qualitativeScoreId, fieldName, disabled }: EvidenceUploadProps) {
  const { profile } = useAuth();
  const { toast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [files, setFiles] = useState<EvidenceFile[]>([]);
  const [uploading, setUploading] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (qualitativeScoreId) {
      loadFiles();
    } else {
      setLoading(false);
    }
  }, [qualitativeScoreId]);

  const loadFiles = async () => {
    if (!qualitativeScoreId) return;
    
    try {
      const { data, error } = await supabase
        .from('qualitative_evidence_files')
        .select('id, file_name, file_path, file_type, file_size')
        .eq('qualitative_score_id', qualitativeScoreId)
        .eq('field_name', fieldName);

      if (error) throw error;
      setFiles(data || []);
    } catch (error: any) {
      console.error('Error loading files:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !profile || !qualitativeScoreId) {
      if (!qualitativeScoreId) {
        toast({ 
          title: 'กรุณาบันทึกข้อมูลก่อน', 
          description: 'ต้องบันทึกแบบประเมินก่อนจึงจะแนบไฟล์ได้',
          variant: 'destructive' 
        });
      }
      return;
    }

    try {
      setUploading(true);

      // Upload to storage
      const fileExt = file.name.split('.').pop();
      const fileName = `${profile.user_id}/${qualitativeScoreId}/${fieldName}/${Date.now()}.${fileExt}`;

      const { error: uploadError } = await supabase.storage
        .from('qualitative-evidence')
        .upload(fileName, file);

      if (uploadError) throw uploadError;

      // Get public URL
      const { data: { publicUrl } } = supabase.storage
        .from('qualitative-evidence')
        .getPublicUrl(fileName);

      // Save to database
      const { data: newFile, error: dbError } = await supabase
        .from('qualitative_evidence_files')
        .insert({
          qualitative_score_id: qualitativeScoreId,
          field_name: fieldName,
          file_name: file.name,
          file_path: publicUrl,
          file_type: file.type,
          file_size: file.size,
          uploaded_by: profile.id,
        })
        .select()
        .single();

      if (dbError) throw dbError;

      setFiles([...files, newFile]);
      toast({ title: 'อัพโหลดสำเร็จ' });

    } catch (error: any) {
      console.error('Error uploading file:', error);
      toast({ title: 'อัพโหลดไม่สำเร็จ', description: error.message, variant: 'destructive' });
    } finally {
      setUploading(false);
      e.target.value = '';
    }
  };

  const handleDelete = async (fileId: string, filePath: string) => {
    try {
      // Delete from database
      const { error: dbError } = await supabase
        .from('qualitative_evidence_files')
        .delete()
        .eq('id', fileId);

      if (dbError) throw dbError;

      // Extract path from URL for storage deletion
      const pathMatch = filePath.match(/qualitative-evidence\/(.+)$/);
      if (pathMatch) {
        await supabase.storage
          .from('qualitative-evidence')
          .remove([pathMatch[1]]);
      }

      setFiles(files.filter(f => f.id !== fileId));
      toast({ title: 'ลบไฟล์สำเร็จ' });

    } catch (error: any) {
      console.error('Error deleting file:', error);
      toast({ title: 'ลบไม่สำเร็จ', description: error.message, variant: 'destructive' });
    }
  };

  const formatFileSize = (bytes: number | null) => {
    if (!bytes) return '';
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  if (loading) {
    return <Loader2 className="w-3 h-3 animate-spin text-muted-foreground" />;
  }

  return (
    <div className="flex items-center gap-2 flex-wrap">
      {/* Existing files */}
      {files.map((file) => (
        <div key={file.id} className="flex items-center gap-1 bg-muted px-2 py-1 rounded text-xs">
          <FileText className="w-3 h-3" />
          <a 
            href={file.file_path} 
            target="_blank" 
            rel="noopener noreferrer"
            className="hover:underline max-w-[100px] truncate"
            title={file.file_name}
          >
            {file.file_name}
          </a>
          <span className="text-muted-foreground">{formatFileSize(file.file_size)}</span>
          {!disabled && (
            <button
              onClick={() => handleDelete(file.id, file.file_path)}
              className="text-destructive hover:text-destructive/80 ml-1"
            >
              <X className="w-3 h-3" />
            </button>
          )}
        </div>
      ))}

      {/* Upload button */}
      {!disabled && (
        <>
          <input
            ref={fileInputRef}
            type="file"
            className="hidden"
            onChange={handleFileUpload}
            disabled={uploading || !qualitativeScoreId}
          />
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="h-7 text-xs gap-1"
            disabled={uploading || !qualitativeScoreId}
            onClick={() => fileInputRef.current?.click()}
          >
            {uploading ? (
              <Loader2 className="w-3 h-3 animate-spin" />
            ) : (
              <Paperclip className="w-3 h-3" />
            )}
            แนบหลักฐาน
          </Button>
        </>
      )}
      
      {!qualitativeScoreId && !disabled && (
        <span className="text-xs text-muted-foreground">(บันทึกก่อนแนบไฟล์)</span>
      )}
    </div>
  );
}
