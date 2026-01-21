import { useState, useEffect } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Plus, Pencil, Trash2, Award, Upload, FileText, X, Eye, ChevronDown, ChevronUp, Download } from "lucide-react";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { format } from "date-fns";
import { th } from "date-fns/locale";

interface Personnel {
  id: string;
  title_prefix: string | null;
  first_name: string;
  last_name: string;
  position: string | null;
  phone: string | null;
  start_date: string | null;
  hospital_id: string | null;
  health_office_id: string | null;
  created_at: string;
}

const TITLE_PREFIXES = ["นาย", "นาง", "นางสาว"] as const;

interface Certificate {
  id: string;
  personnel_id: string;
  certificate_name: string;
  issue_date: string | null;
  file_path: string | null;
  file_name: string | null;
  file_size: number | null;
}

export default function PersonnelPage() {
  const { profile, user } = useAuth();
  const [personnel, setPersonnel] = useState<Personnel[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [addCertificateDialogOpen, setAddCertificateDialogOpen] = useState(false);
  const [selectedPersonnel, setSelectedPersonnel] = useState<Personnel | null>(null);
  const [expandedPersonnelId, setExpandedPersonnelId] = useState<string | null>(null);
  const [certificatesMap, setCertificatesMap] = useState<Record<string, Certificate[]>>({});
  const [loadingCertificatesFor, setLoadingCertificatesFor] = useState<string | null>(null);

  // Form state
  const [formData, setFormData] = useState({
    title_prefix: "",
    first_name: "",
    last_name: "",
    position: "",
    phone: "",
    start_date: "",
  });

  // Certificate form state
  const [newCertificate, setNewCertificate] = useState({
    name: "",
    issue_date: "",
    file: null as File | null,
  });
  const [uploadingCertificate, setUploadingCertificate] = useState(false);

  useEffect(() => {
    fetchPersonnel();
  }, [profile]);

  const fetchPersonnel = async () => {
    if (!profile) return;

    setLoading(true);
    try {
      let query = supabase.from("personnel").select("*");

      if (profile.hospital_id) {
        query = query.eq("hospital_id", profile.hospital_id);
      } else if (profile.health_office_id) {
        query = query.eq("health_office_id", profile.health_office_id);
      }

      const { data, error } = await query.order("created_at", { ascending: false });

      if (error) throw error;
      setPersonnel(data || []);
    } catch (error: any) {
      console.error("Error fetching personnel:", error);
      toast.error("ไม่สามารถโหลดข้อมูลบุคลากรได้");
    } finally {
      setLoading(false);
    }
  };

  const fetchCertificates = async (personnelId: string) => {
    setLoadingCertificatesFor(personnelId);
    try {
      const { data, error } = await supabase
        .from("personnel_certificates")
        .select("*")
        .eq("personnel_id", personnelId)
        .order("created_at", { ascending: false });

      if (error) throw error;
      setCertificatesMap(prev => ({ ...prev, [personnelId]: data || [] }));
    } catch (error: any) {
      console.error("Error fetching certificates:", error);
      toast.error("ไม่สามารถโหลดข้อมูลใบประกาศได้");
    } finally {
      setLoadingCertificatesFor(null);
    }
  };

  const handleToggleCertificates = async (personnelId: string) => {
    if (expandedPersonnelId === personnelId) {
      setExpandedPersonnelId(null);
    } else {
      setExpandedPersonnelId(personnelId);
      if (!certificatesMap[personnelId]) {
        await fetchCertificates(personnelId);
      }
    }
  };

  const handleOpenDialog = (person?: Personnel) => {
    if (person) {
      setSelectedPersonnel(person);
      setFormData({
        title_prefix: person.title_prefix || "",
        first_name: person.first_name,
        last_name: person.last_name,
        position: person.position || "",
        phone: person.phone || "",
        start_date: person.start_date || "",
      });
    } else {
      setSelectedPersonnel(null);
      setFormData({
        title_prefix: "",
        first_name: "",
        last_name: "",
        position: "",
        phone: "",
        start_date: "",
      });
    }
    setDialogOpen(true);
  };

  const handleOpenAddCertificateDialog = (person: Personnel) => {
    setSelectedPersonnel(person);
    setAddCertificateDialogOpen(true);
  };

  const handleSave = async () => {
    if (!formData.first_name.trim() || !formData.last_name.trim()) {
      toast.error("กรุณากรอกชื่อและนามสกุล");
      return;
    }

    try {
      const payload: any = {
        title_prefix: formData.title_prefix || null,
        first_name: formData.first_name.trim(),
        last_name: formData.last_name.trim(),
        position: formData.position.trim() || null,
        phone: formData.phone.trim() || null,
        start_date: formData.start_date || null,
        user_id: user?.id,
      };

      if (profile?.hospital_id) {
        payload.hospital_id = profile.hospital_id;
      } else if (profile?.health_office_id) {
        payload.health_office_id = profile.health_office_id;
      }

      if (selectedPersonnel) {
        // Update
        const { error } = await supabase
          .from("personnel")
          .update(payload)
          .eq("id", selectedPersonnel.id);

        if (error) throw error;
        toast.success("แก้ไขข้อมูลบุคลากรสำเร็จ");
      } else {
        // Insert
        const { error } = await supabase.from("personnel").insert(payload);

        if (error) throw error;
        toast.success("เพิ่มบุคลากรสำเร็จ");
      }

      setDialogOpen(false);
      fetchPersonnel();
    } catch (error: any) {
      console.error("Error saving personnel:", error);
      toast.error("ไม่สามารถบันทึกข้อมูลได้");
    }
  };

  const handleDelete = async () => {
    if (!selectedPersonnel) return;

    try {
      // First delete all certificates files
      const { data: certs } = await supabase
        .from("personnel_certificates")
        .select("file_path")
        .eq("personnel_id", selectedPersonnel.id);

      if (certs) {
        for (const cert of certs) {
          if (cert.file_path) {
            await supabase.storage.from("certificates").remove([cert.file_path]);
          }
        }
      }

      // Delete personnel (certificates will cascade delete)
      const { error } = await supabase
        .from("personnel")
        .delete()
        .eq("id", selectedPersonnel.id);

      if (error) throw error;
      toast.success("ลบข้อมูลบุคลากรสำเร็จ");
      setDeleteDialogOpen(false);
      setSelectedPersonnel(null);
      fetchPersonnel();
    } catch (error: any) {
      console.error("Error deleting personnel:", error);
      toast.error("ไม่สามารถลบข้อมูลได้");
    }
  };

  const handleAddCertificate = async () => {
    if (!selectedPersonnel || !newCertificate.name.trim()) {
      toast.error("กรุณากรอกชื่อใบประกาศ");
      return;
    }

    setUploadingCertificate(true);
    try {
      let filePath = null;
      let fileName = null;
      let fileSize = null;

      // Upload file if provided
      if (newCertificate.file) {
        const fileExt = newCertificate.file.name.split(".").pop();
        const uniqueName = `${selectedPersonnel.id}/${Date.now()}.${fileExt}`;

        const { error: uploadError } = await supabase.storage
          .from("certificates")
          .upload(uniqueName, newCertificate.file);

        if (uploadError) throw uploadError;

        filePath = uniqueName;
        fileName = newCertificate.file.name;
        fileSize = newCertificate.file.size;
      }

      const { error } = await supabase.from("personnel_certificates").insert({
        personnel_id: selectedPersonnel.id,
        certificate_name: newCertificate.name.trim(),
        issue_date: newCertificate.issue_date || null,
        file_path: filePath,
        file_name: fileName,
        file_size: fileSize,
      });

      if (error) throw error;

      toast.success("เพิ่มใบประกาศสำเร็จ");
      setNewCertificate({ name: "", issue_date: "", file: null });
      setAddCertificateDialogOpen(false);
      // Refresh certificates for this personnel
      setCertificatesMap(prev => ({ ...prev, [selectedPersonnel.id]: [] }));
      fetchCertificates(selectedPersonnel.id);
    } catch (error: any) {
      console.error("Error adding certificate:", error);
      toast.error("ไม่สามารถเพิ่มใบประกาศได้");
    } finally {
      setUploadingCertificate(false);
    }
  };

  const handleDeleteCertificate = async (cert: Certificate) => {
    try {
      // Delete file from storage if exists
      if (cert.file_path) {
        await supabase.storage.from("certificates").remove([cert.file_path]);
      }

      const { error } = await supabase
        .from("personnel_certificates")
        .delete()
        .eq("id", cert.id);

      if (error) throw error;

      toast.success("ลบใบประกาศสำเร็จ");
      // Refresh certificates for the personnel who owns this certificate
      const personnelId = cert.personnel_id;
      setCertificatesMap(prev => ({ ...prev, [personnelId]: [] }));
      fetchCertificates(personnelId);
    } catch (error: any) {
      console.error("Error deleting certificate:", error);
      toast.error("ไม่สามารถลบใบประกาศได้");
    }
  };

  const handleDownloadCertificate = async (cert: Certificate) => {
    if (!cert.file_path) return;

    try {
      const { data, error } = await supabase.storage
        .from("certificates")
        .download(cert.file_path);

      if (error) throw error;
      
      // Create download link
      const url = URL.createObjectURL(data);
      const a = document.createElement('a');
      a.href = url;
      a.download = cert.file_name || cert.file_path.split('/').pop() || 'certificate';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (error: any) {
      console.error("Error downloading file:", error);
      toast.error("ไม่สามารถดาวน์โหลดไฟล์ได้");
    }
  };

  const formatDate = (dateStr: string | null) => {
    if (!dateStr) return "-";
    try {
      return format(new Date(dateStr), "d MMMM yyyy", { locale: th });
    } catch {
      return dateStr;
    }
  };

  const formatFileSize = (bytes: number | null) => {
    if (!bytes) return "";
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  return (
    <DashboardLayout>
      <div className="p-6 space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-foreground">บุคลากรในหน่วยงาน</h1>
            <p className="text-muted-foreground">
              จัดการข้อมูลบุคลากรและใบประกาศที่ได้รับ
            </p>
          </div>
          <Button onClick={() => handleOpenDialog()}>
            <Plus className="h-4 w-4 mr-2" />
            เพิ่มบุคลากร
          </Button>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>รายชื่อบุคลากร ({personnel.length} คน)</CardTitle>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="flex justify-center py-8">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
              </div>
            ) : personnel.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                ยังไม่มีข้อมูลบุคลากร
              </div>
            ) : (
              <div className="space-y-0">
                {/* Header Row */}
                <div className="grid grid-cols-[1fr_1fr_1fr_1fr_auto_auto] gap-4 p-4 bg-muted/50 border-b font-medium text-sm">
                  <div>ชื่อ-นามสกุล</div>
                  <div>ตำแหน่ง</div>
                  <div>เบอร์โทร</div>
                  <div>วันที่เริ่มทำงาน</div>
                  <div className="w-[130px] text-center">ใบประกาศ</div>
                  <div className="w-[88px] text-right">จัดการ</div>
                </div>
                {personnel.map((person) => {
                  const isExpanded = expandedPersonnelId === person.id;
                  const personCertificates = certificatesMap[person.id] || [];
                  const isLoadingCerts = loadingCertificatesFor === person.id;
                  
                  return (
                    <Collapsible key={person.id} open={isExpanded}>
                      <div className="border-b">
                        <div className="grid grid-cols-[1fr_1fr_1fr_1fr_auto_auto] gap-4 p-4 items-center">
                          <div className="font-medium">
                            {person.title_prefix ? `${person.title_prefix}` : ''}{person.first_name} {person.last_name}
                          </div>
                          <div className="text-muted-foreground">{person.position || "-"}</div>
                          <div className="text-muted-foreground">{person.phone || "-"}</div>
                          <div className="text-muted-foreground">{formatDate(person.start_date)}</div>
                          <div className="w-[130px]">
                            <CollapsibleTrigger asChild>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => handleToggleCertificates(person.id)}
                                className="flex items-center gap-1"
                              >
                                <Award className="h-4 w-4" />
                                ดูใบประกาศ
                                {isExpanded ? (
                                  <ChevronUp className="h-4 w-4" />
                                ) : (
                                  <ChevronDown className="h-4 w-4" />
                                )}
                              </Button>
                            </CollapsibleTrigger>
                          </div>
                          <div className="w-[88px] flex items-center justify-end gap-2">
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => handleOpenDialog(person)}
                            >
                              <Pencil className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => {
                                setSelectedPersonnel(person);
                                setDeleteDialogOpen(true);
                              }}
                            >
                              <Trash2 className="h-4 w-4 text-destructive" />
                            </Button>
                          </div>
                        </div>
                        <CollapsibleContent>
                          <div className="bg-muted/30 border-t px-4 py-3">
                            {isLoadingCerts ? (
                              <div className="flex justify-center py-4">
                                <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-primary"></div>
                              </div>
                            ) : personCertificates.length === 0 ? (
                              <div className="flex items-center justify-between py-2">
                                <p className="text-sm text-muted-foreground">ยังไม่มีใบประกาศ</p>
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={() => handleOpenAddCertificateDialog(person)}
                                >
                                  <Plus className="h-4 w-4 mr-1" />
                                  เพิ่มใบประกาศ
                                </Button>
                              </div>
                            ) : (
                              <div className="space-y-2">
                                <div className="flex items-center justify-between mb-2">
                                  <span className="text-sm font-medium">รายการใบประกาศ ({personCertificates.length})</span>
                                  <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={() => handleOpenAddCertificateDialog(person)}
                                  >
                                    <Plus className="h-4 w-4 mr-1" />
                                    เพิ่มใบประกาศ
                                  </Button>
                                </div>
                                <Table>
                                  <TableHeader>
                                    <TableRow>
                                      <TableHead>ชื่อใบประกาศ</TableHead>
                                      <TableHead>วันที่ได้รับ</TableHead>
                                      <TableHead>ไฟล์หลักฐาน</TableHead>
                                      <TableHead className="text-right">จัดการ</TableHead>
                                    </TableRow>
                                  </TableHeader>
                                  <TableBody>
                                    {personCertificates.map((cert) => (
                                      <TableRow key={cert.id}>
                                        <TableCell className="font-medium">
                                          <div className="flex items-center gap-2">
                                            <Award className="h-4 w-4 text-primary" />
                                            {cert.certificate_name}
                                          </div>
                                        </TableCell>
                                        <TableCell>
                                          {cert.issue_date ? formatDate(cert.issue_date) : "-"}
                                        </TableCell>
                                        <TableCell>
                                          {cert.file_path ? (
                                            <Button
                                              variant="ghost"
                                              size="sm"
                                              onClick={() => handleDownloadCertificate(cert)}
                                              className="text-primary"
                                            >
                                              <Download className="h-4 w-4 mr-1" />
                                              โหลดไฟล์
                                            </Button>
                                          ) : (
                                            <span className="text-muted-foreground text-sm">-</span>
                                          )}
                                        </TableCell>
                                        <TableCell className="text-right">
                                          <Button
                                            variant="ghost"
                                            size="icon"
                                            onClick={() => handleDeleteCertificate(cert)}
                                          >
                                            <Trash2 className="h-4 w-4 text-destructive" />
                                          </Button>
                                        </TableCell>
                                      </TableRow>
                                    ))}
                                  </TableBody>
                                </Table>
                              </div>
                            )}
                          </div>
                        </CollapsibleContent>
                      </div>
                    </Collapsible>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Add/Edit Personnel Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>
              {selectedPersonnel ? "แก้ไขข้อมูลบุคลากร" : "เพิ่มบุคลากรใหม่"}
            </DialogTitle>
            <DialogDescription>
              กรอกข้อมูลบุคลากรในหน่วยงาน
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="grid grid-cols-[100px_1fr_1fr] gap-4">
              <div className="space-y-2">
                <Label>คำนำหน้า</Label>
                <Select
                  value={formData.title_prefix}
                  onValueChange={(value) =>
                    setFormData({ ...formData, title_prefix: value })
                  }
                >
                  <SelectTrigger>
                    <SelectValue placeholder="เลือก" />
                  </SelectTrigger>
                  <SelectContent>
                    {TITLE_PREFIXES.map((prefix) => (
                      <SelectItem key={prefix} value={prefix}>
                        {prefix}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="first_name">ชื่อ *</Label>
                <Input
                  id="first_name"
                  value={formData.first_name}
                  onChange={(e) =>
                    setFormData({ ...formData, first_name: e.target.value })
                  }
                  placeholder="ชื่อ"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="last_name">นามสกุล *</Label>
                <Input
                  id="last_name"
                  value={formData.last_name}
                  onChange={(e) =>
                    setFormData({ ...formData, last_name: e.target.value })
                  }
                  placeholder="นามสกุล"
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="position">ตำแหน่ง</Label>
              <Input
                id="position"
                value={formData.position}
                onChange={(e) =>
                  setFormData({ ...formData, position: e.target.value })
                }
                placeholder="ตำแหน่ง"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="phone">เบอร์โทร</Label>
              <Input
                id="phone"
                value={formData.phone}
                onChange={(e) =>
                  setFormData({ ...formData, phone: e.target.value })
                }
                placeholder="เบอร์โทร"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="start_date">วันที่เริ่มทำงาน</Label>
              <Input
                id="start_date"
                type="date"
                value={formData.start_date}
                onChange={(e) =>
                  setFormData({ ...formData, start_date: e.target.value })
                }
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>
              ยกเลิก
            </Button>
            <Button onClick={handleSave}>บันทึก</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>ยืนยันการลบ</AlertDialogTitle>
            <AlertDialogDescription>
              คุณต้องการลบข้อมูล {selectedPersonnel?.first_name}{" "}
              {selectedPersonnel?.last_name} ใช่หรือไม่?
              การกระทำนี้ไม่สามารถยกเลิกได้
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>ยกเลิก</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              ลบ
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Add Certificate Dialog */}
      <Dialog open={addCertificateDialogOpen} onOpenChange={setAddCertificateDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>
              เพิ่มใบประกาศ - {selectedPersonnel?.first_name} {selectedPersonnel?.last_name}
            </DialogTitle>
            <DialogDescription>
              กรอกข้อมูลใบประกาศที่ได้รับ
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="cert_name">ชื่อใบประกาศ *</Label>
              <Input
                id="cert_name"
                value={newCertificate.name}
                onChange={(e) =>
                  setNewCertificate({ ...newCertificate, name: e.target.value })
                }
                placeholder="เช่น ใบรับรอง PDPA"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="cert_date">วันที่ได้รับ</Label>
              <Input
                id="cert_date"
                type="date"
                value={newCertificate.issue_date}
                onChange={(e) =>
                  setNewCertificate({ ...newCertificate, issue_date: e.target.value })
                }
              />
            </div>
            <div className="space-y-2">
              <Label>แนบไฟล์ใบประกาศ (ไม่บังคับ)</Label>
              <div className="flex items-center gap-2">
                <Input
                  type="file"
                  accept=".pdf,.jpg,.jpeg,.png"
                  onChange={(e) =>
                    setNewCertificate({
                      ...newCertificate,
                      file: e.target.files?.[0] || null,
                    })
                  }
                  className="flex-1"
                />
                {newCertificate.file && (
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() =>
                      setNewCertificate({ ...newCertificate, file: null })
                    }
                  >
                    <X className="h-4 w-4" />
                  </Button>
                )}
              </div>
              {newCertificate.file && (
                <p className="text-xs text-muted-foreground">
                  {newCertificate.file.name} ({formatFileSize(newCertificate.file.size)})
                </p>
              )}
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAddCertificateDialogOpen(false)}>
              ยกเลิก
            </Button>
            <Button
              onClick={handleAddCertificate}
              disabled={uploadingCertificate}
            >
              {uploadingCertificate ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                  กำลังอัพโหลด...
                </>
              ) : (
                <>
                  <Plus className="h-4 w-4 mr-2" />
                  เพิ่มใบประกาศ
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </DashboardLayout>
  );
}
