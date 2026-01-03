import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { PublicLayout } from '@/components/layout/PublicLayout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Download, FileText, Pin, BookOpen } from 'lucide-react';
import { format } from 'date-fns';
import { th } from 'date-fns/locale';

interface ManualFile {
  id: string;
  title: string;
  description: string | null;
  file_name: string;
  file_path: string;
  file_size: number;
  pinned: boolean;
  updated_at: string;
}

export default function PublicInspectionManual() {
  const { data: manualFiles, isLoading } = useQuery({
    queryKey: ['public-inspection-manual-files'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('inspection_manual_files')
        .select('*')
        .order('pinned', { ascending: false })
        .order('updated_at', { ascending: false });
      
      if (error) throw error;
      return data as ManualFile[];
    },
  });

  const handleDownload = async (file: ManualFile) => {
    const { data } = await supabase.storage
      .from('inspection-manuals')
      .getPublicUrl(file.file_path);
    
    if (data?.publicUrl) {
      window.open(data.publicUrl, '_blank');
    }
  };

  const formatFileSize = (bytes: number): string => {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
  };

  return (
    <PublicLayout>
      <div className="space-y-6">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-primary/10 rounded-lg">
            <BookOpen className="h-6 w-6 text-primary" />
          </div>
          <div>
            <h1 className="text-2xl font-bold tracking-tight">คู่มือเอกสารตรวจราชการ</h1>
            <p className="text-muted-foreground">
              เอกสารและคู่มือสำหรับการตรวจราชการด้านความมั่นคงปลอดภัยไซเบอร์
            </p>
          </div>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <FileText className="h-5 w-5" />
              รายการเอกสาร
            </CardTitle>
            <CardDescription>
              ดาวน์โหลดเอกสารและคู่มือที่เกี่ยวข้องกับการตรวจราชการ
            </CardDescription>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="text-center py-8 text-muted-foreground">
                กำลังโหลดข้อมูล...
              </div>
            ) : !manualFiles || manualFiles.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                ยังไม่มีเอกสารในระบบ
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-[40%]">ชื่อเอกสาร</TableHead>
                    <TableHead>คำอธิบาย</TableHead>
                    <TableHead className="w-[150px]">วันที่อัปเดต</TableHead>
                    <TableHead className="w-[100px] text-right">ดาวน์โหลด</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {manualFiles.map((file) => (
                    <TableRow key={file.id}>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          {file.pinned && (
                            <Pin className="h-4 w-4 text-primary flex-shrink-0" />
                          )}
                          <span className="font-medium">{file.title}</span>
                        </div>
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {file.description || '-'}
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {format(new Date(file.updated_at), 'd MMM yyyy', { locale: th })}
                      </TableCell>
                      <TableCell className="text-right">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleDownload(file)}
                        >
                          <Download className="h-4 w-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </div>
    </PublicLayout>
  );
}
