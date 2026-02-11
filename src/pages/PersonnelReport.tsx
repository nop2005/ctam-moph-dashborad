import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { SearchableSelect } from "@/components/ui/searchable-select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { FileSpreadsheet, RotateCcw, Users } from "lucide-react";
import * as XLSX from "xlsx";

// Position options (same as Personnel page)
const POSITION_OPTIONS = [
  { value: "all", label: "ทุกตำแหน่ง" },
  { value: "นักวิชาการคอมพิวเตอร์", label: "นักวิชาการคอมพิวเตอร์" },
  { value: "นักวิชาการสถิติ", label: "นักวิชาการสถิติ" },
  { value: "เจ้าพนักงานเวชสถิติ", label: "เจ้าพนักงานเวชสถิติ" },
  { value: "นวก.สาธารณสุข(เวชสถิติ)", label: "นวก.สาธารณสุข(เวชสถิติ)" },
  { value: "นวก.สาธารณสุข", label: "นวก.สาธารณสุข" },
  { value: "เจ้าพนักงานเครื่องคอมพิวเตอร์", label: "เจ้าพนักงานเครื่องคอมพิวเตอร์" },
  { value: "เจ้าพนักงานธุรการ", label: "เจ้าพนักงานธุรการ" },
  { value: "นักเทคโนโลยีสารสนเทศ", label: "นักเทคโนโลยีสารสนเทศ" },
  { value: "พยาบาลวิชาชีพ", label: "พยาบาลวิชาชีพ" },
  { value: "นักวิเคราะห์นโยบายและแผน", label: "นักวิเคราะห์นโยบายและแผน" },
  { value: "นายแพทย์", label: "นายแพทย์" },
];

export default function PersonnelReport() {
  const { profile } = useAuth();

  // Filter states
  const [selectedRegion, setSelectedRegion] = useState<string>("all");
  const [selectedProvince, setSelectedProvince] = useState<string>("all");
  const [selectedUnit, setSelectedUnit] = useState<string>("all");
  const [selectedPosition, setSelectedPosition] = useState<string>("all");

  // Determine role-based access
  const isCentralAdmin = profile?.role === "central_admin";
  const isRegionalAdmin = profile?.role === "regional";
  const isProvincialAdmin = profile?.role === "provincial" || profile?.role === "ceo";

  // Fetch health regions
  const { data: regions = [] } = useQuery({
    queryKey: ["health-regions"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("health_regions")
        .select("*")
        .order("region_number");
      if (error) throw error;
      return data;
    },
  });

  // Fetch provinces
  const { data: provinces = [] } = useQuery({
    queryKey: ["provinces"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("provinces")
        .select("*, health_regions(id, name, region_number)")
        .order("name");
      if (error) throw error;
      return data;
    },
  });

  // Fetch hospitals
  const { data: hospitals = [] } = useQuery({
    queryKey: ["hospitals"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("hospitals")
        .select("*, provinces(id, name, health_region_id)")
        .order("name");
      if (error) throw error;
      return data;
    },
  });

  // Fetch health offices
  const { data: healthOffices = [] } = useQuery({
    queryKey: ["health-offices"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("health_offices")
        .select("*, provinces(id, name, health_region_id)")
        .order("name");
      if (error) throw error;
      return data;
    },
  });

  // Fetch personnel with hospital/health_office relations
  const { data: personnel = [], isLoading: personnelLoading } = useQuery({
    queryKey: ["personnel-report"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("personnel")
        .select(`
          *,
          hospitals(id, name, province_id, provinces(id, name, health_region_id)),
          health_offices(id, name, province_id, provinces(id, name, health_region_id))
        `)
        .order("first_name");
      if (error) throw error;
      return data;
    },
  });

  // Fetch certificates
  const { data: certificates = [] } = useQuery({
    queryKey: ["personnel-certificates-all"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("personnel_certificates")
        .select("*")
        .order("certificate_name");
      if (error) throw error;
      return data;
    },
  });

  // Group certificates by personnel_id
  const certificatesByPersonnel = useMemo(() => {
    const grouped: Record<string, { count: number; names: string[] }> = {};
    certificates.forEach((cert) => {
      if (!grouped[cert.personnel_id]) {
        grouped[cert.personnel_id] = { count: 0, names: [] };
      }
      grouped[cert.personnel_id].count++;
      grouped[cert.personnel_id].names.push(cert.certificate_name);
    });
    return grouped;
  }, [certificates]);

  // Build region options
  const regionOptions = useMemo(() => {
    let filteredRegions = regions;
    
    // Regional admin can only see their region
    if (isRegionalAdmin && profile?.health_region_id) {
      filteredRegions = regions.filter((r) => r.id === profile.health_region_id);
    }
    
    const options = filteredRegions.map((r) => ({
      value: r.id,
      label: `เขต ${r.region_number} - ${r.name}`,
    }));
    
    if (isCentralAdmin) {
      return [{ value: "all", label: "ทุกเขตสุขภาพ" }, ...options];
    }
    return options;
  }, [regions, profile, isCentralAdmin, isRegionalAdmin]);

  // Build province options (filtered by selected region)
  const provinceOptions = useMemo(() => {
    let filteredProvinces = provinces;
    
    // Provincial admin can only see their province
    if (isProvincialAdmin && profile?.province_id) {
      filteredProvinces = provinces.filter((p) => p.id === profile.province_id);
    } else if (selectedRegion !== "all") {
      filteredProvinces = provinces.filter((p) => p.health_region_id === selectedRegion);
    } else if (isRegionalAdmin && profile?.health_region_id) {
      filteredProvinces = provinces.filter((p) => p.health_region_id === profile.health_region_id);
    }
    
    const options = filteredProvinces.map((p) => ({
      value: p.id,
      label: p.name,
    }));
    
    if (!isProvincialAdmin) {
      return [{ value: "all", label: "ทุกจังหวัด" }, ...options];
    }
    return options;
  }, [provinces, selectedRegion, profile, isProvincialAdmin, isRegionalAdmin]);

  // Build unit options (hospitals + health_offices filtered by province)
  const unitOptions = useMemo(() => {
    let filteredHospitals = hospitals;
    let filteredHealthOffices = healthOffices;
    
    if (selectedProvince !== "all") {
      filteredHospitals = hospitals.filter((h) => h.province_id === selectedProvince);
      filteredHealthOffices = healthOffices.filter((ho) => ho.province_id === selectedProvince);
    } else if (selectedRegion !== "all") {
      filteredHospitals = hospitals.filter((h) => h.provinces?.health_region_id === selectedRegion);
      filteredHealthOffices = healthOffices.filter((ho) => ho.provinces?.health_region_id === selectedRegion);
    } else if (isRegionalAdmin && profile?.health_region_id) {
      filteredHospitals = hospitals.filter((h) => h.provinces?.health_region_id === profile.health_region_id);
      filteredHealthOffices = healthOffices.filter((ho) => ho.provinces?.health_region_id === profile.health_region_id);
    } else if (isProvincialAdmin && profile?.province_id) {
      filteredHospitals = hospitals.filter((h) => h.province_id === profile.province_id);
      filteredHealthOffices = healthOffices.filter((ho) => ho.province_id === profile.province_id);
    }
    
    const hospitalOptions = filteredHospitals.map((h) => ({
      value: `hospital_${h.id}`,
      label: `🏥 ${h.name}`,
    }));
    
    const healthOfficeOptions = filteredHealthOffices.map((ho) => ({
      value: `health_office_${ho.id}`,
      label: `🏢 ${ho.name}`,
    }));
    
    return [
      { value: "all", label: "ทุกหน่วยงาน" },
      ...hospitalOptions,
      ...healthOfficeOptions,
    ];
  }, [hospitals, healthOffices, selectedProvince, selectedRegion, profile, isRegionalAdmin, isProvincialAdmin]);

  // Filter personnel based on selections
  const filteredPersonnel = useMemo(() => {
    return personnel.filter((p) => {
      // Get province info
      const hospitalProvince = p.hospitals?.provinces;
      const healthOfficeProvince = p.health_offices?.provinces;
      const provinceId = p.hospitals?.province_id || p.health_offices?.province_id;
      const regionId = hospitalProvince?.health_region_id || healthOfficeProvince?.health_region_id;
      
      // Role-based filtering
      if (isProvincialAdmin && profile?.province_id) {
        if (provinceId !== profile.province_id) return false;
      }
      if (isRegionalAdmin && profile?.health_region_id) {
        if (regionId !== profile.health_region_id) return false;
      }
      
      // Filter by region
      if (selectedRegion !== "all" && regionId !== selectedRegion) return false;
      
      // Filter by province
      if (selectedProvince !== "all" && provinceId !== selectedProvince) return false;
      
      // Filter by unit
      if (selectedUnit !== "all") {
        if (selectedUnit.startsWith("hospital_")) {
          const hospitalId = selectedUnit.replace("hospital_", "");
          if (p.hospital_id !== hospitalId) return false;
        } else if (selectedUnit.startsWith("health_office_")) {
          const healthOfficeId = selectedUnit.replace("health_office_", "");
          if (p.health_office_id !== healthOfficeId) return false;
        }
      }
      
      // Filter by position
      if (selectedPosition !== "all" && p.position !== selectedPosition) return false;
      
      return true;
    });
  }, [personnel, selectedRegion, selectedProvince, selectedUnit, selectedPosition, profile, isProvincialAdmin, isRegionalAdmin]);

  // Handle cascade reset
  const handleRegionChange = (value: string) => {
    setSelectedRegion(value);
    setSelectedProvince("all");
    setSelectedUnit("all");
  };

  const handleProvinceChange = (value: string) => {
    setSelectedProvince(value);
    setSelectedUnit("all");
  };

  // Clear all filters
  const handleClearFilters = () => {
    if (!isRegionalAdmin) setSelectedRegion("all");
    if (!isProvincialAdmin) setSelectedProvince("all");
    setSelectedUnit("all");
    setSelectedPosition("all");
  };

  // Format date to Thai Buddhist Era
  const formatThaiDate = (dateString: string | null) => {
    if (!dateString) return "-";
    const date = new Date(dateString);
    const thaiYear = date.getFullYear() + 543;
    return `${date.getDate()}/${date.getMonth() + 1}/${thaiYear}`;
  };

  // Get unit name
  const getUnitName = (p: typeof personnel[0]) => {
    return p.hospitals?.name || p.health_offices?.name || "-";
  };

  // Get province name
  const getProvinceName = (p: typeof personnel[0]) => {
    return p.hospitals?.provinces?.name || p.health_offices?.provinces?.name || "-";
  };

  // Export to Excel
  const handleExportExcel = () => {
    const exportData = filteredPersonnel.map((p, index) => {
      const certInfo = certificatesByPersonnel[p.id] || { count: 0, names: [] };
      return {
        ลำดับ: index + 1,
        "ชื่อ-นามสกุล": `${p.title_prefix || ""}${p.first_name} ${p.last_name}`,
        หน่วยงาน: getUnitName(p),
        จังหวัด: getProvinceName(p),
        ตำแหน่ง: p.position || "-",
        เบอร์โทร: p.phone || "-",
        วันที่เริ่มทำงาน: formatThaiDate(p.start_date),
        จำนวนใบรับรอง: certInfo.count,
        ชื่อใบรับรอง: certInfo.names.join(", ") || "-",
      };
    });

    const ws = XLSX.utils.json_to_sheet(exportData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "รายงานบุคลากร");
    XLSX.writeFile(wb, `รายงานบุคลากร_${new Date().toISOString().split("T")[0]}.xlsx`);
  };

  // Set default values based on role
  useMemo(() => {
    if (isRegionalAdmin && profile?.health_region_id && selectedRegion === "all") {
      setSelectedRegion(profile.health_region_id);
    }
    if (isProvincialAdmin && profile?.province_id && selectedProvince === "all") {
      setSelectedProvince(profile.province_id);
    }
  }, [profile, isRegionalAdmin, isProvincialAdmin]);

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
              <Users className="h-6 w-6" />
              รายงานบุคลากร
            </h1>
            <p className="text-muted-foreground mt-1">
              แสดงข้อมูลบุคลากรพร้อมจำนวนและชื่อใบรับรอง
            </p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={handleClearFilters}>
              <RotateCcw className="h-4 w-4 mr-2" />
              ล้างตัวกรอง
            </Button>
            <Button onClick={handleExportExcel} disabled={filteredPersonnel.length === 0}>
              <FileSpreadsheet className="h-4 w-4 mr-2" />
              Export Excel
            </Button>
          </div>
        </div>

        {/* Filters */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">ตัวกรอง</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              {/* Region Filter */}
              <div className="space-y-2">
                <Label>เขตสุขภาพ</Label>
                <SearchableSelect
                  options={regionOptions}
                  value={selectedRegion}
                  onValueChange={handleRegionChange}
                  placeholder="เลือกเขตสุขภาพ"
                  disabled={isRegionalAdmin || isProvincialAdmin}
                />
              </div>

              {/* Province Filter */}
              <div className="space-y-2">
                <Label>จังหวัด</Label>
                <SearchableSelect
                  options={provinceOptions}
                  value={selectedProvince}
                  onValueChange={handleProvinceChange}
                  placeholder="เลือกจังหวัด"
                  disabled={isProvincialAdmin}
                />
              </div>

              {/* Unit Filter */}
              <div className="space-y-2">
                <Label>หน่วยงาน</Label>
                <SearchableSelect
                  options={unitOptions}
                  value={selectedUnit}
                  onValueChange={setSelectedUnit}
                  placeholder="เลือกหน่วยงาน"
                />
              </div>

              {/* Position Filter */}
              <div className="space-y-2">
                <Label>ตำแหน่ง</Label>
                <SearchableSelect
                  options={POSITION_OPTIONS}
                  value={selectedPosition}
                  onValueChange={setSelectedPosition}
                  placeholder="เลือกตำแหน่ง"
                />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Results Summary */}
        <div className="text-sm text-muted-foreground">
          พบบุคลากรทั้งหมด <span className="font-semibold text-foreground">{filteredPersonnel.length}</span> คน
        </div>

        {/* Data Table */}
        <Card>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-16 text-center">ลำดับ</TableHead>
                    <TableHead>ชื่อ-นามสกุล</TableHead>
                    <TableHead>หน่วยงาน</TableHead>
                    <TableHead>จังหวัด</TableHead>
                    <TableHead>ตำแหน่ง</TableHead>
                    <TableHead>เบอร์โทร</TableHead>
                    <TableHead>วันที่เริ่มทำงาน</TableHead>
                    <TableHead className="text-center">จำนวนใบรับรอง</TableHead>
                    <TableHead>ชื่อใบรับรอง</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {personnelLoading ? (
                    <TableRow>
                      <TableCell colSpan={9} className="text-center py-8">
                        <div className="flex items-center justify-center gap-2">
                          <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-primary"></div>
                          <span>กำลังโหลดข้อมูล...</span>
                        </div>
                      </TableCell>
                    </TableRow>
                  ) : filteredPersonnel.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={9} className="text-center py-8 text-muted-foreground">
                        ไม่พบข้อมูลบุคลากร
                      </TableCell>
                    </TableRow>
                  ) : (
                    filteredPersonnel.map((p, index) => {
                      const certInfo = certificatesByPersonnel[p.id] || { count: 0, names: [] };
                      return (
                        <TableRow key={p.id}>
                          <TableCell className="text-center">{index + 1}</TableCell>
                          <TableCell className="font-medium">
                            {p.title_prefix || ""}{p.first_name} {p.last_name}
                          </TableCell>
                          <TableCell>{getUnitName(p)}</TableCell>
                          <TableCell>{getProvinceName(p)}</TableCell>
                          <TableCell>{p.position || "-"}</TableCell>
                          <TableCell>{p.phone || "-"}</TableCell>
                          <TableCell>{formatThaiDate(p.start_date)}</TableCell>
                          <TableCell className="text-center">
                            <span className={`inline-flex items-center justify-center min-w-[24px] h-6 rounded-full text-xs font-medium ${
                              certInfo.count > 0 
                                ? "bg-primary/10 text-primary" 
                                : "bg-muted text-muted-foreground"
                            }`}>
                              {certInfo.count}
                            </span>
                          </TableCell>
                          <TableCell className="max-w-xs">
                            <span className="text-sm text-muted-foreground truncate block" title={certInfo.names.join(", ")}>
                              {certInfo.names.join(", ") || "-"}
                            </span>
                          </TableCell>
                        </TableRow>
                      );
                    })
                  )}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}
