import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { BookOpen, Download, Plus, Pin, PinOff, Trash2, Loader2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from '@/hooks/use-toast';

interface ManualFile {
  id: string;
  title: string;
  description: string | null;
  file_name: string;
  file_path: string;
  file_size: number | null;
  file_type: string | null;
  pinned: boolean;
  updated_at: string;
  created_at: string;
}

export default function InspectionManual() {
  const { profile } = useAuth();
  const queryClient = useQueryClient();
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [isUploading, setIsUploading] = useState(false);

  const isCentralAdmin = profile?.role === 'central_admin';

  // Fetch manual files from database
  const { data: documents = [], isLoading } = useQuery({
    queryKey: ['inspection-manual-files'],
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

  // Upload file mutation
  const uploadMutation = useMutation({
    mutationFn: async ({ title, description, file }: { title: string; description: string; file: File }) => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('ไม่พบข้อมูลผู้ใช้');

      // Upload file to storage
      const fileExt = file.name.split('.').pop();
      const fileName = `${Date.now()}-${Math.random().toString(36).substring(7)}.${fileExt}`;
      const filePath = `manuals/${fileName}`;

      const { error: uploadError } = await supabase.storage
        .from('inspection-manual')
        .upload(filePath, file);

      if (uploadError) throw uploadError;

      // Insert record into database
      const { error: dbError } = await supabase
        .from('inspection_manual_files')
        .insert({
          title,
          description: description || null,
          file_name: file.name,
          file_path: filePath,
          file_size: file.size,
          file_type: file.type,
          uploaded_by: user.id,
          pinned: false,
        });

      if (dbError) throw dbError;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['inspection-manual-files'] });
      toast({ title: 'อัปโหลดสำเร็จ', description: 'เพิ่มเอกสารเรียบร้อยแล้ว' });
      setIsDialogOpen(false);
      setTitle('');
      setDescription('');
      setFile(null);
    },
    onError: (error) => {
      toast({ title: 'เกิดข้อผิดพลาด', description: error.message, variant: 'destructive' });
    },
  });

  // Toggle pin mutation
  const togglePinMutation = useMutation({
    mutationFn: async ({ id, pinned }: { id: string; pinned: boolean }) => {
      const { error } = await supabase
        .from('inspection_manual_files')
        .update({ pinned: !pinned })
        .eq('id', id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['inspection-manual-files'] });
      toast({ title: 'สำเร็จ', description: 'อัปเดตการปักหมุดเรียบร้อยแล้ว' });
    },
    onError: (error) => {
      toast({ title: 'เกิดข้อผิดพลาด', description: error.message, variant: 'destructive' });
    },
  });

  // Delete file mutation
  const deleteMutation = useMutation({
    mutationFn: async ({ id, filePath }: { id: string; filePath: string }) => {
      // Delete from storage
      const { error: storageError } = await supabase.storage
        .from('inspection-manual')
        .remove([filePath]);

      if (storageError) console.error('Storage delete error:', storageError);

      // Delete from database
      const { error: dbError } = await supabase
        .from('inspection_manual_files')
        .delete()
        .eq('id', id);

      if (dbError) throw dbError;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['inspection-manual-files'] });
      toast({ title: 'ลบสำเร็จ', description: 'ลบเอกสารเรียบร้อยแล้ว' });
    },
    onError: (error) => {
      toast({ title: 'เกิดข้อผิดพลาด', description: error.message, variant: 'destructive' });
    },
  });

  const handleUpload = async () => {
    if (!title.trim() || !file) {
      toast({ title: 'กรุณากรอกข้อมูล', description: 'กรุณากรอกชื่อเอกสารและเลือกไฟล์', variant: 'destructive' });
      return;
    }

    setIsUploading(true);
    await uploadMutation.mutateAsync({ title, description, file });
    setIsUploading(false);
  };

  const handleDownload = async (doc: ManualFile) => {
    const { data } = supabase.storage
      .from('inspection-manual')
      .getPublicUrl(doc.file_path);

    if (data?.publicUrl) {
      window.open(data.publicUrl, '_blank');
    } else {
      toast({ title: 'เกิดข้อผิดพลาด', description: 'ไม่สามารถดาวน์โหลดไฟล์ได้', variant: 'destructive' });
    }
  };

  const formatFileSize = (bytes: number | null) => {
    if (!bytes) return '-';
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  return (
    <DashboardLayout>
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">คู่มือเอกสารสำหรับการนิเทศ</h1>
          <p className="text-muted-foreground">เอกสารและคู่มือสำหรับการตรวจราชการและการนิเทศ</p>
        </div>

        {isCentralAdmin && (
          <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
            <DialogTrigger asChild>
              <Button className="gap-2">
                <Plus className="h-4 w-4" />
                เพิ่มเอกสาร
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>เพิ่มเอกสารคู่มือ</DialogTitle>
              </DialogHeader>
              <div className="space-y-4">
                <div>
                  <label className="text-sm font-medium">ชื่อเอกสาร *</label>
                  <Input
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    placeholder="กรอกชื่อเอกสาร"
                  />
                </div>
                <div>
                  <label className="text-sm font-medium">รายละเอียด</label>
                  <Textarea
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    placeholder="กรอกรายละเอียด (ไม่บังคับ)"
                    rows={3}
                  />
                </div>
                <div>
                  <label className="text-sm font-medium">ไฟล์เอกสาร *</label>
                  <Input
                    type="file"
                    onChange={(e) => setFile(e.target.files?.[0] || null)}
                    accept=".pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx"
                  />
                  <p className="text-xs text-muted-foreground mt-1">
                    รองรับไฟล์ PDF, Word, Excel, PowerPoint
                  </p>
                </div>
                <Button
                  onClick={handleUpload}
                  disabled={isUploading || !title.trim() || !file}
                  className="w-full"
                >
                  {isUploading ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      กำลังอัปโหลด...
                    </>
                  ) : (
                    'อัปโหลด'
                  )}
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        )}
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <BookOpen className="h-5 w-5" />
            รายการเอกสาร
          </CardTitle>
          <CardDescription>
            ดาวน์โหลดเอกสารและคู่มือที่จำเป็นสำหรับการนิเทศ
          </CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : documents.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              ยังไม่มีเอกสารในระบบ
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-8"></TableHead>
                  <TableHead>ชื่อเอกสาร</TableHead>
                  <TableHead>รายละเอียด</TableHead>
                  <TableHead>ขนาดไฟล์</TableHead>
                  <TableHead>วันที่อัปเดต</TableHead>
                  <TableHead className="text-right">ดำเนินการ</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {documents.map((doc) => (
                  <TableRow key={doc.id}>
                    <TableCell>
                      {doc.pinned && <Pin className="h-4 w-4 text-primary" />}
                    </TableCell>
                    <TableCell className="font-medium">{doc.title}</TableCell>
                    <TableCell className="text-muted-foreground max-w-xs truncate">
                      {doc.description || '-'}
                    </TableCell>
                    <TableCell>{formatFileSize(doc.file_size)}</TableCell>
                    <TableCell>
                      {new Date(doc.updated_at).toLocaleDateString('th-TH')}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          className="gap-2"
                          onClick={() => handleDownload(doc)}
                        >
                          <Download className="h-4 w-4" />
                          ดาวน์โหลด
                        </Button>
                        {isCentralAdmin && (
                          <>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => togglePinMutation.mutate({ id: doc.id, pinned: doc.pinned })}
                              title={doc.pinned ? 'ยกเลิกปักหมุด' : 'ปักหมุด'}
                            >
                              {doc.pinned ? (
                                <PinOff className="h-4 w-4" />
                              ) : (
                                <Pin className="h-4 w-4" />
                              )}
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => deleteMutation.mutate({ id: doc.id, filePath: doc.file_path })}
                              className="text-destructive hover:text-destructive"
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </DashboardLayout>
  );
}
