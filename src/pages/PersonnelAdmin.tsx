import { useState, useEffect, useMemo } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Award, ChevronDown, ChevronUp, Download, X } from "lucide-react";
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

interface Certificate {
  id: string;
  personnel_id: string;
  certificate_name: string;
  issue_date: string | null;
  file_path: string | null;
  file_name: string | null;
  file_size: number | null;
}

interface Province {
  id: string;
  name: string;
  health_region_id: string;
}

interface Hospital {
  id: string;
  name: string;
  province_id: string;
}

const POSITIONS = [
  "นักวิชาการคอมพิวเตอร์",
  "นักวิชาการสถิติ",
  "เจ้าพนักงานเวชสถิติ",
  "นวก.สาธารณสุข(เวชสถิติ)",
  "นวก.สาธารณสุข",
  "เจ้าพนักงานเครื่องคอมพิวเตอร์",
  "เจ้าพนักงานธุรการ",
  "นักเทคโนโลยีสารสนเทศ",
  "พยาบาลวิชาชีพ",
  "นักวิเคราะห์นโยบายและแผน",
  "นายแพทย์",
] as const;

export default function PersonnelAdminPage() {
  const { profile } = useAuth();
  const [personnel, setPersonnel] = useState<Personnel[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedPersonnelId, setExpandedPersonnelId] = useState<string | null>(null);
  const [certificatesMap, setCertificatesMap] = useState<Record<string, Certificate[]>>({});
  const [loadingCertificatesFor, setLoadingCertificatesFor] = useState<string | null>(null);

  // Filter options
  const [provinces, setProvinces] = useState<Province[]>([]);
  const [hospitals, setHospitals] = useState<Hospital[]>([]);

  // Filter values
  const [selectedProvince, setSelectedProvince] = useState<string>("all");
  const [selectedHospital, setSelectedHospital] = useState<string>("all");
  const [selectedPosition, setSelectedPosition] = useState<string>("all");

  const isRegional = profile?.role === "regional";
  const isProvincial = profile?.role === "provincial";

  // Fetch provinces and hospitals for filters
  useEffect(() => {
    const fetchFilterOptions = async () => {
      if (!profile) return;

      try {
        // Fetch provinces
        let provinceQuery = supabase.from("provinces").select("id, name, health_region_id");
        
        if (isRegional && profile.health_region_id) {
          provinceQuery = provinceQuery.eq("health_region_id", profile.health_region_id);
        } else if (isProvincial && profile.province_id) {
          provinceQuery = provinceQuery.eq("id", profile.province_id);
        }

        const { data: provinceData, error: provinceError } = await provinceQuery.order("name");
        if (provinceError) throw provinceError;
        setProvinces(provinceData || []);

        // If provincial, pre-select their province
        if (isProvincial && profile.province_id) {
          setSelectedProvince(profile.province_id);
        }
      } catch (error: any) {
        console.error("Error fetching filter options:", error);
        toast.error("ไม่สามารถโหลดข้อมูลตัวกรองได้");
      }
    };

    fetchFilterOptions();
  }, [profile, isRegional, isProvincial]);

  // Fetch hospitals when province changes
  useEffect(() => {
    const fetchHospitals = async () => {
      if (!profile) return;

      try {
        let hospitalQuery = supabase.from("hospitals").select("id, name, province_id");

        if (selectedProvince !== "all") {
          hospitalQuery = hospitalQuery.eq("province_id", selectedProvince);
        } else if (isProvincial && profile.province_id) {
          hospitalQuery = hospitalQuery.eq("province_id", profile.province_id);
        } else if (isRegional && profile.health_region_id) {
          // Get hospitals from provinces in the region
          const { data: regionProvinces } = await supabase
            .from("provinces")
            .select("id")
            .eq("health_region_id", profile.health_region_id);
          
          if (regionProvinces) {
            const provinceIds = regionProvinces.map(p => p.id);
            hospitalQuery = hospitalQuery.in("province_id", provinceIds);
          }
        }

        const { data: hospitalData, error: hospitalError } = await hospitalQuery.order("name");
        if (hospitalError) throw hospitalError;
        setHospitals(hospitalData || []);
      } catch (error: any) {
        console.error("Error fetching hospitals:", error);
      }
    };

    fetchHospitals();
  }, [profile, selectedProvince, isRegional, isProvincial]);

  // Fetch personnel based on filters
  useEffect(() => {
    fetchPersonnel();
  }, [profile, selectedProvince, selectedHospital]);

  const fetchPersonnel = async () => {
    if (!profile) return;

    setLoading(true);
    try {
      // Build query to fetch personnel with hospital joins
      let query = supabase
        .from("personnel")
        .select(`
          *,
          hospitals!personnel_hospital_id_fkey (
            id,
            name,
            province_id,
            provinces!hospitals_province_id_fkey (
              id,
              name,
              health_region_id
            )
          )
        `);

      // Filter by hospital if selected
      if (selectedHospital !== "all") {
        query = query.eq("hospital_id", selectedHospital);
      } else if (selectedProvince !== "all") {
        // Get hospital IDs in the selected province
        const { data: hospitalIds } = await supabase
          .from("hospitals")
          .select("id")
          .eq("province_id", selectedProvince);
        
        if (hospitalIds && hospitalIds.length > 0) {
          query = query.in("hospital_id", hospitalIds.map(h => h.id));
        }
      } else if (isProvincial && profile.province_id) {
        // Get hospitals in the user's province
        const { data: hospitalIds } = await supabase
          .from("hospitals")
          .select("id")
          .eq("province_id", profile.province_id);
        
        if (hospitalIds && hospitalIds.length > 0) {
          query = query.in("hospital_id", hospitalIds.map(h => h.id));
        }
      } else if (isRegional && profile.health_region_id) {
        // Get hospitals in the user's region
        const { data: provinceIds } = await supabase
          .from("provinces")
          .select("id")
          .eq("health_region_id", profile.health_region_id);
        
        if (provinceIds && provinceIds.length > 0) {
          const { data: hospitalIds } = await supabase
            .from("hospitals")
            .select("id")
            .in("province_id", provinceIds.map(p => p.id));
          
          if (hospitalIds && hospitalIds.length > 0) {
            query = query.in("hospital_id", hospitalIds.map(h => h.id));
          }
        }
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

  // Filter personnel by position (client-side since position is simple filter)
  const filteredPersonnel = useMemo(() => {
    if (selectedPosition === "all") return personnel;
    return personnel.filter(p => p.position === selectedPosition);
  }, [personnel, selectedPosition]);

  // Count by position for filter dropdown
  const positionCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    personnel.forEach(p => {
      const pos = p.position || "ไม่ระบุ";
      counts[pos] = (counts[pos] || 0) + 1;
    });
    return counts;
  }, [personnel]);

  // Count by province
  const provinceCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    personnel.forEach((p: any) => {
      const provinceId = p.hospitals?.provinces?.id;
      if (provinceId) {
        counts[provinceId] = (counts[provinceId] || 0) + 1;
      }
    });
    return counts;
  }, [personnel]);

  // Count by hospital
  const hospitalCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    personnel.forEach(p => {
      if (p.hospital_id) {
        counts[p.hospital_id] = (counts[p.hospital_id] || 0) + 1;
      }
    });
    return counts;
  }, [personnel]);

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

  const handleDownloadCertificate = async (cert: Certificate) => {
    if (!cert.file_path) return;

    try {
      const { data, error } = await supabase.storage
        .from("certificates")
        .download(cert.file_path);

      if (error) throw error;
      
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
      const date = new Date(dateStr);
      const buddhistYear = date.getFullYear() + 543;
      const formatted = format(date, "d MMMM", { locale: th });
      return `${formatted} ${buddhistYear}`;
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

  const getHospitalName = (person: any) => {
    return person.hospitals?.name || "-";
  };

  const getProvinceName = (person: any) => {
    return person.hospitals?.provinces?.name || "-";
  };

  const clearFilters = () => {
    if (isProvincial && profile?.province_id) {
      setSelectedProvince(profile.province_id);
    } else {
      setSelectedProvince("all");
    }
    setSelectedHospital("all");
    setSelectedPosition("all");
  };

  return (
    <DashboardLayout>
      <div className="p-6 space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-foreground">บุคลากร</h1>
            <p className="text-muted-foreground">
              ข้อมูลบุคลากรใน{isRegional ? "เขตสุขภาพ" : "จังหวัด"}
            </p>
          </div>
        </div>

        {/* Filters */}
        <Card>
          <CardContent className="pt-6">
            <div className="flex flex-wrap gap-4 items-end">
              {/* Province Filter - Only show for regional */}
              {isRegional && (
                <div className="space-y-2 min-w-[200px]">
                  <label className="text-sm font-medium">จังหวัด</label>
                  <Select value={selectedProvince} onValueChange={(v) => { setSelectedProvince(v); setSelectedHospital("all"); }}>
                    <SelectTrigger>
                      <SelectValue placeholder="ทุกจังหวัด" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">ทุกจังหวัด ({personnel.length})</SelectItem>
                      {provinces.map((province) => (
                        <SelectItem key={province.id} value={province.id}>
                          {province.name} ({provinceCounts[province.id] || 0})
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}

              {/* Hospital Filter */}
              <div className="space-y-2 min-w-[250px]">
                <label className="text-sm font-medium">โรงพยาบาล</label>
                <Select value={selectedHospital} onValueChange={setSelectedHospital}>
                  <SelectTrigger>
                    <SelectValue placeholder="ทุกโรงพยาบาล" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">ทุกโรงพยาบาล</SelectItem>
                    {hospitals.map((hospital) => (
                      <SelectItem key={hospital.id} value={hospital.id}>
                        {hospital.name} ({hospitalCounts[hospital.id] || 0})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Position Filter */}
              <div className="space-y-2 min-w-[200px]">
                <label className="text-sm font-medium">ตำแหน่ง</label>
                <Select value={selectedPosition} onValueChange={setSelectedPosition}>
                  <SelectTrigger>
                    <SelectValue placeholder="ทุกตำแหน่ง" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">ทุกตำแหน่ง ({personnel.length})</SelectItem>
                    {POSITIONS.map((pos) => (
                      <SelectItem key={pos} value={pos}>
                        {pos} ({positionCounts[pos] || 0})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <Button variant="ghost" size="sm" onClick={clearFilters} className="h-10">
                <X className="h-4 w-4 mr-1" />
                ล้างตัวกรอง
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Personnel List */}
        <Card>
          <CardHeader>
            <CardTitle>รายชื่อบุคลากร ({filteredPersonnel.length} คน)</CardTitle>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="flex justify-center py-8">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
              </div>
            ) : filteredPersonnel.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                ไม่พบข้อมูลบุคลากร
              </div>
            ) : (
              <div className="space-y-0">
                {/* Header Row */}
                <div className="grid grid-cols-[1fr_1fr_1fr_1fr_1fr_1fr_auto] gap-4 p-4 bg-muted/50 border-b font-medium text-sm">
                  <div>ชื่อ-นามสกุล</div>
                  <div>โรงพยาบาล</div>
                  <div>จังหวัด</div>
                  <div>ตำแหน่ง</div>
                  <div>เบอร์โทร</div>
                  <div>วันที่เริ่มทำงาน</div>
                  <div className="w-[130px] text-center">ใบประกาศ</div>
                </div>
                {filteredPersonnel.map((person: any) => {
                  const isExpanded = expandedPersonnelId === person.id;
                  const personCertificates = certificatesMap[person.id] || [];
                  const isLoadingCerts = loadingCertificatesFor === person.id;
                  
                  return (
                    <Collapsible key={person.id} open={isExpanded}>
                      <div className="border-b">
                        <div className="grid grid-cols-[1fr_1fr_1fr_1fr_1fr_1fr_auto] gap-4 p-4 items-center">
                          <div className="font-medium">
                            {person.title_prefix ? `${person.title_prefix}` : ''}{person.first_name} {person.last_name}
                          </div>
                          <div className="text-muted-foreground text-sm">{getHospitalName(person)}</div>
                          <div className="text-muted-foreground text-sm">{getProvinceName(person)}</div>
                          <div className="text-muted-foreground text-sm">{person.position || "-"}</div>
                          <div className="text-muted-foreground text-sm">{person.phone || "-"}</div>
                          <div className="text-muted-foreground text-sm">{formatDate(person.start_date)}</div>
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
                        </div>
                        <CollapsibleContent>
                          <div className="bg-muted/30 p-4 border-t">
                            <div className="flex items-center justify-between mb-3">
                              <h4 className="font-medium text-sm">ใบประกาศ/ประกาศนียบัตร</h4>
                            </div>
                            {isLoadingCerts ? (
                              <div className="flex justify-center py-4">
                                <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-primary"></div>
                              </div>
                            ) : personCertificates.length === 0 ? (
                              <p className="text-sm text-muted-foreground">ยังไม่มีใบประกาศ</p>
                            ) : (
                              <div className="space-y-2">
                                {personCertificates.map((cert) => (
                                  <div
                                    key={cert.id}
                                    className="flex items-center justify-between p-3 bg-background rounded border"
                                  >
                                    <div className="flex-1">
                                      <p className="font-medium text-sm">{cert.certificate_name}</p>
                                      <div className="flex gap-4 text-xs text-muted-foreground mt-1">
                                        <span>วันที่ได้รับ: {formatDate(cert.issue_date)}</span>
                                        {cert.file_name && (
                                          <span className="flex items-center gap-1">
                                            📎 {cert.file_name}
                                            {cert.file_size && ` (${formatFileSize(cert.file_size)})`}
                                          </span>
                                        )}
                                      </div>
                                    </div>
                                    {cert.file_path && (
                                      <Button
                                        variant="ghost"
                                        size="sm"
                                        onClick={() => handleDownloadCertificate(cert)}
                                        className="text-primary"
                                      >
                                        <Download className="h-4 w-4 mr-1" />
                                        โหลดไฟล์
                                      </Button>
                                    )}
                                  </div>
                                ))}
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
    </DashboardLayout>
  );
}
