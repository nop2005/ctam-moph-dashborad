import { useState, useEffect } from 'react';
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

interface ImpactEvidenceUploadProps {
  impactScoreId: string | null;
  fieldName: string;
  disabled?: boolean;
}

export function ImpactEvidenceUpload({ impactScoreId, fieldName, disabled }: ImpactEvidenceUploadProps) {
  const { profile } = useAuth();
  const { toast } = useToast();
  const [files, setFiles] = useState<EvidenceFile[]>([]);
  const [uploading, setUploading] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (impactScoreId) {
      loadFiles();
    } else {
      setLoading(false);
    }
  }, [impactScoreId]);

  const loadFiles = async () => {
    if (!impactScoreId) return;
    
    try {
      const { data, error } = await supabase
        .from('impact_evidence_files')
        .select('id, file_name, file_path, file_type, file_size')
        .eq('impact_score_id', impactScoreId)
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
    if (!file || !profile || !impactScoreId) {
      if (!impactScoreId) {
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

      const fileExt = file.name.split('.').pop();
      const fileName = `${profile.user_id}/${impactScoreId}/${fieldName}/${Date.now()}.${fileExt}`;

      const { error: uploadError } = await supabase.storage
        .from('impact-evidence')
        .upload(fileName, file);

      if (uploadError) throw uploadError;

      const { data: { publicUrl } } = supabase.storage
        .from('impact-evidence')
        .getPublicUrl(fileName);

      const { data: newFile, error: dbError } = await supabase
        .from('impact_evidence_files')
        .insert({
          impact_score_id: impactScoreId,
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
      const { error: dbError } = await supabase
        .from('impact_evidence_files')
        .delete()
        .eq('id', fileId);

      if (dbError) throw dbError;

      const pathMatch = filePath.match(/impact-evidence\/(.+)$/);
      if (pathMatch) {
        await supabase.storage
          .from('impact-evidence')
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

      {!disabled && (
        <label className="cursor-pointer">
          <input
            type="file"
            className="hidden"
            onChange={handleFileUpload}
            disabled={uploading || !impactScoreId}
          />
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="h-7 text-xs gap-1"
            disabled={uploading || !impactScoreId}
            asChild
          >
            <span>
              {uploading ? (
                <Loader2 className="w-3 h-3 animate-spin" />
              ) : (
                <Paperclip className="w-3 h-3" />
              )}
              แนบหลักฐาน
            </span>
          </Button>
        </label>
      )}
      
      {!impactScoreId && !disabled && (
        <span className="text-xs text-muted-foreground">(บันทึกก่อนแนบไฟล์)</span>
      )}
    </div>
  );
}
