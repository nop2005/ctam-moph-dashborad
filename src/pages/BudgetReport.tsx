import { useState, useMemo } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow, TableFooter } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ChevronLeft, Building2, MapPin, DollarSign, Users, Upload, Download, AlertCircle, CheckCircle2 } from "lucide-react";
import * as XLSX from "xlsx";
import { BudgetImportDialog } from "@/components/budget/BudgetImportDialog";

// Types
interface BudgetRecord {
  id: string;
  hospital_id: string | null;
  health_office_id: string | null;
  fiscal_year: number;
  category_id: string;
  budget_amount: number;
}

interface CtamCategory {
  id: string;
  code: string;
  name_th: string;
  order_number: number;
}

interface Hospital {
  id: string;
  name: string;
  code: string;
  province_id: string;
}

interface HealthOffice {
  id: string;
  name: string;
  code: string;
  province_id: string | null;
  health_region_id: string;
}

interface Province {
  id: string;
  name: string;
  code: string;
  health_region_id: string;
}

interface HealthRegion {
  id: string;
  name: string;
  region_number: number;
}

type DrillLevel = "region" | "province" | "unit" | "detail";

const getCurrentFiscalYear = () => {
  const now = new Date();
  const thaiYear = now.getFullYear() + 543;
  return now.getMonth() >= 9 ? thaiYear + 1 : thaiYear;
};

const formatCurrency = (amount: number) => {
  return new Intl.NumberFormat("th-TH", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount);
};

export default function BudgetReport() {
  const { profile } = useAuth();
  const queryClient = useQueryClient();
  const [fiscalYear, setFiscalYear] = useState(getCurrentFiscalYear());
  const [drillLevel, setDrillLevel] = useState<DrillLevel>("region");
  const [selectedRegionId, setSelectedRegionId] = useState<string | null>(null);
  const [selectedProvinceId, setSelectedProvinceId] = useState<string | null>(null);
  const [selectedUnitId, setSelectedUnitId] = useState<string | null>(null);
  const [selectedUnitType, setSelectedUnitType] = useState<"hospital" | "health_office" | null>(null);
  const [showImportDialog, setShowImportDialog] = useState(false);
  const [initialFiltersSet, setInitialFiltersSet] = useState(false);
  const [showUnitsDialog, setShowUnitsDialog] = useState(false);
  const [unitsDialogType, setUnitsDialogType] = useState<"recorded" | "not_recorded">("recorded");

  const fiscalYears = Array.from({ length: 9 }, (_, i) => getCurrentFiscalYear() - 4 + i);

  // Fetch CTAM categories
  const { data: categories = [] } = useQuery({
    queryKey: ["ctam-categories"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("ctam_categories")
        .select("*")
        .order("order_number");
      if (error) throw error;
      return data as CtamCategory[];
    },
  });

  // Fetch budget records
  const { data: budgetRecords = [], isLoading: isLoadingBudget } = useQuery({
    queryKey: ["budget-records-report", fiscalYear],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("budget_records")
        .select("*")
        .eq("fiscal_year", fiscalYear);
      if (error) throw error;
      return data as BudgetRecord[];
    },
  });

  // Fetch reference data
  const { data: hospitals = [] } = useQuery({
    queryKey: ["hospitals"],
    queryFn: async () => {
      const { data, error } = await supabase.from("hospitals").select("*");
      if (error) throw error;
      return data as Hospital[];
    },
  });

  const { data: healthOffices = [] } = useQuery({
    queryKey: ["health-offices"],
    queryFn: async () => {
      const { data, error } = await supabase.from("health_offices").select("*");
      if (error) throw error;
      return data as HealthOffice[];
    },
  });

  const { data: provinces = [] } = useQuery({
    queryKey: ["provinces"],
    queryFn: async () => {
      const { data, error } = await supabase.from("provinces").select("*");
      if (error) throw error;
      return data as Province[];
    },
  });

  const { data: healthRegions = [] } = useQuery({
    queryKey: ["health-regions"],
    queryFn: async () => {
      const { data, error } = await supabase.from("health_regions").select("*").order("region_number");
      if (error) throw error;
      return data as HealthRegion[];
    },
  });

  // Determine user's view scope based on role
  const userRole = profile?.role;
  const isOrgLevel = userRole === "hospital_it" || userRole === "health_office";
  const isProvincial = userRole === "provincial";
  const isRegional = userRole === "regional" || userRole === "supervisor";
  const isCentralAdmin = userRole === "central_admin";
  const canImport = isCentralAdmin || isRegional;

  // Get initial drill level and auto-select province based on role
  useMemo(() => {
    if (initialFiltersSet) return;
    if (isOrgLevel) {
      setDrillLevel("detail");
      setInitialFiltersSet(true);
    } else if (isProvincial && profile?.province_id) {
      setDrillLevel("unit");
      setSelectedProvinceId(profile.province_id);
      setInitialFiltersSet(true);
    } else if (isRegional && profile?.health_region_id) {
      setDrillLevel("province");
      setSelectedRegionId(profile.health_region_id);
      setInitialFiltersSet(true);
    } else if (isCentralAdmin) {
      setDrillLevel("region");
      setInitialFiltersSet(true);
    }
  }, [isOrgLevel, isProvincial, isRegional, isCentralAdmin, profile, initialFiltersSet]);

  // Calculate aggregated data
  const aggregatedData = useMemo(() => {
    const hospitalMap = new Map(hospitals.map((h) => [h.id, h]));
    const officeMap = new Map(healthOffices.map((o) => [o.id, o]));
    const provinceMap = new Map(provinces.map((p) => [p.id, p]));
    const regionMap = new Map(healthRegions.map((r) => [r.id, r]));

    // Enrich budget records with location info
    const enrichedRecords = budgetRecords.map((record) => {
      let provinceId: string | null = null;
      let regionId: string | null = null;
      let unitName = "";
      let unitType: "hospital" | "health_office" = "hospital";

      if (record.hospital_id) {
        const hospital = hospitalMap.get(record.hospital_id);
        if (hospital) {
          provinceId = hospital.province_id;
          const province = provinceMap.get(hospital.province_id);
          regionId = province?.health_region_id || null;
          unitName = hospital.name;
          unitType = "hospital";
        }
      } else if (record.health_office_id) {
        const office = officeMap.get(record.health_office_id);
        if (office) {
          provinceId = office.province_id;
          regionId = office.health_region_id;
          unitName = office.name;
          unitType = "health_office";
        }
      }

      return {
        ...record,
        provinceId,
        regionId,
        unitName,
        unitType,
      };
    });

    // Aggregate by region
    const byRegion = new Map<string, { total: number; unitCount: Set<string> }>();
    healthRegions.forEach((r) => byRegion.set(r.id, { total: 0, unitCount: new Set() }));

    // Aggregate by province
    const byProvince = new Map<string, { total: number; unitCount: Set<string> }>();
    provinces.forEach((p) => byProvince.set(p.id, { total: 0, unitCount: new Set() }));

    // Aggregate by unit
    const byUnit = new Map<string, { total: number; type: "hospital" | "health_office"; name: string; provinceId: string | null }>();

    enrichedRecords.forEach((record) => {
      const unitKey = record.hospital_id || record.health_office_id || "";
      
      // Sum by unit
      if (!byUnit.has(unitKey)) {
        byUnit.set(unitKey, {
          total: 0,
          type: record.unitType,
          name: record.unitName,
          provinceId: record.provinceId,
        });
      }
      byUnit.get(unitKey)!.total += Number(record.budget_amount) || 0;

      // Sum by province
      if (record.provinceId && byProvince.has(record.provinceId)) {
        byProvince.get(record.provinceId)!.total += Number(record.budget_amount) || 0;
        byProvince.get(record.provinceId)!.unitCount.add(unitKey);
      }

      // Sum by region
      if (record.regionId && byRegion.has(record.regionId)) {
        byRegion.get(record.regionId)!.total += Number(record.budget_amount) || 0;
        byRegion.get(record.regionId)!.unitCount.add(unitKey);
      }
    });

    return { enrichedRecords, byRegion, byProvince, byUnit, hospitalMap, officeMap, provinceMap, regionMap };
  }, [budgetRecords, hospitals, healthOffices, provinces, healthRegions]);

  // Filter data based on drill level and selection
  const getFilteredRecords = () => {
    if (isOrgLevel) {
      // Show only own organization's data
      const orgId = profile?.hospital_id || profile?.health_office_id;
      return aggregatedData.enrichedRecords.filter(
        (r) => r.hospital_id === orgId || r.health_office_id === orgId
      );
    }

    if (selectedUnitId) {
      return aggregatedData.enrichedRecords.filter(
        (r) => r.hospital_id === selectedUnitId || r.health_office_id === selectedUnitId
      );
    }

    return aggregatedData.enrichedRecords;
  };

  const getProvinceRecords = () => {
    if (isProvincial) {
      return Array.from(aggregatedData.byProvince.entries())
        .filter(([id]) => id === profile?.province_id)
        .map(([id, data]) => ({
          id,
          name: aggregatedData.provinceMap.get(id)?.name || "",
          total: data.total,
          unitCount: data.unitCount.size,
        }));
    }

    // For regional users, use their health_region_id if no explicit selection
    const regionId = selectedRegionId || (isRegional ? profile?.health_region_id : null);
    
    if (regionId) {
      const provincesInRegion = provinces.filter((p) => p.health_region_id === regionId);
      return provincesInRegion.map((p) => ({
        id: p.id,
        name: p.name,
        total: aggregatedData.byProvince.get(p.id)?.total || 0,
        unitCount: aggregatedData.byProvince.get(p.id)?.unitCount.size || 0,
      }));
    }

    return [];
  };

  const getUnitRecords = () => {
    let targetProvinceId = selectedProvinceId;
    
    if (isProvincial && !targetProvinceId) {
      targetProvinceId = profile?.province_id || null;
    }

    // If we have a province selected, show units in that province
    if (targetProvinceId) {
      return Array.from(aggregatedData.byUnit.entries())
        .filter(([_, data]) => data.provinceId === targetProvinceId)
        .map(([id, data]) => ({
          id,
          name: data.name,
          type: data.type,
          total: data.total,
        }));
    }

    // For regional users at unit level without a province selected, show all units in region
    if (isRegional && !targetProvinceId) {
      const regionId = profile?.health_region_id;
      const provincesInRegion = provinces.filter((p) => p.health_region_id === regionId);
      const provinceIds = new Set(provincesInRegion.map((p) => p.id));
      
      return Array.from(aggregatedData.byUnit.entries())
        .filter(([_, data]) => data.provinceId && provinceIds.has(data.provinceId))
        .map(([id, data]) => ({
          id,
          name: data.name,
          type: data.type,
          total: data.total,
        }));
    }

    return [];
  };

  const getRegionRecords = () => {
    if (isRegional) {
      // Filter to user's region only
      return healthRegions
        .filter((r) => r.id === profile?.health_region_id)
        .map((r) => ({
          id: r.id,
          name: r.name,
          regionNumber: r.region_number,
          total: aggregatedData.byRegion.get(r.id)?.total || 0,
          unitCount: aggregatedData.byRegion.get(r.id)?.unitCount.size || 0,
        }));
    }

    return healthRegions.map((r) => ({
      id: r.id,
      name: r.name,
      regionNumber: r.region_number,
      total: aggregatedData.byRegion.get(r.id)?.total || 0,
      unitCount: aggregatedData.byRegion.get(r.id)?.unitCount.size || 0,
    }));
  };

  // Calculate totals
  const grandTotal = useMemo(() => {
    let records = aggregatedData.enrichedRecords;
    
    if (isOrgLevel) {
      const orgId = profile?.hospital_id || profile?.health_office_id;
      records = records.filter((r) => r.hospital_id === orgId || r.health_office_id === orgId);
    } else if (isProvincial) {
      records = records.filter((r) => r.provinceId === profile?.province_id);
    } else if (isRegional) {
      records = records.filter((r) => r.regionId === profile?.health_region_id);
    }

    return records.reduce((sum, r) => sum + (Number(r.budget_amount) || 0), 0);
  }, [aggregatedData.enrichedRecords, isOrgLevel, isProvincial, isRegional, profile]);

  // Count of units that have recorded budget
  const unitWithBudgetCount = useMemo(() => {
    const units = new Set<string>();
    let records = aggregatedData.enrichedRecords;
    
    if (isOrgLevel) {
      return 1;
    } else if (isProvincial) {
      records = records.filter((r) => r.provinceId === profile?.province_id);
    } else if (isRegional) {
      records = records.filter((r) => r.regionId === profile?.health_region_id);
    }

    records.forEach((r) => {
      if (r.hospital_id) units.add(r.hospital_id);
      if (r.health_office_id) units.add(r.health_office_id);
    });

    return units.size;
  }, [aggregatedData.enrichedRecords, isOrgLevel, isProvincial, isRegional, profile]);

  // Total units in scope (hospitals + health offices)
  const totalUnitsInScope = useMemo(() => {
    if (isOrgLevel) {
      return 1;
    }
    
    let filteredHospitals = hospitals;
    let filteredOffices = healthOffices;
    
    if (isProvincial && profile?.province_id) {
      filteredHospitals = hospitals.filter((h) => h.province_id === profile.province_id);
      filteredOffices = healthOffices.filter((o) => o.province_id === profile.province_id);
    } else if (isRegional && profile?.health_region_id) {
      const provincesInRegion = provinces.filter((p) => p.health_region_id === profile.health_region_id);
      const provinceIds = new Set(provincesInRegion.map((p) => p.id));
      filteredHospitals = hospitals.filter((h) => provinceIds.has(h.province_id));
      filteredOffices = healthOffices.filter((o) => o.health_region_id === profile.health_region_id);
    }
    
    return filteredHospitals.length + filteredOffices.length;
  }, [hospitals, healthOffices, provinces, isOrgLevel, isProvincial, isRegional, profile]);

  // Units without budget
  const unitsWithoutBudget = useMemo(() => {
    return Math.max(0, totalUnitsInScope - unitWithBudgetCount);
  }, [totalUnitsInScope, unitWithBudgetCount]);

  // Get list of units with budget and without budget for dialog
  const unitsWithBudgetList = useMemo(() => {
    const unitsWithRecords = new Set<string>();
    let records = aggregatedData.enrichedRecords;
    
    if (isProvincial && profile?.province_id) {
      records = records.filter((r) => r.provinceId === profile.province_id);
    } else if (isRegional && profile?.health_region_id) {
      records = records.filter((r) => r.regionId === profile.health_region_id);
    }
    
    records.forEach((r) => {
      if (r.hospital_id) unitsWithRecords.add(r.hospital_id);
      if (r.health_office_id) unitsWithRecords.add(r.health_office_id);
    });
    
    // Build list with names and types
    const result: { id: string; name: string; type: "hospital" | "health_office" }[] = [];
    
    unitsWithRecords.forEach((unitId) => {
      const hospital = aggregatedData.hospitalMap.get(unitId);
      if (hospital) {
        result.push({ id: unitId, name: hospital.name, type: "hospital" });
        return;
      }
      const office = aggregatedData.officeMap.get(unitId);
      if (office) {
        result.push({ id: unitId, name: office.name, type: "health_office" });
      }
    });
    
    return result.sort((a, b) => a.name.localeCompare(b.name, 'th'));
  }, [aggregatedData.enrichedRecords, aggregatedData.hospitalMap, aggregatedData.officeMap, isProvincial, isRegional, profile]);

  const unitsWithoutBudgetList = useMemo(() => {
    const unitsWithRecords = new Set<string>();
    let records = aggregatedData.enrichedRecords;
    
    if (isProvincial && profile?.province_id) {
      records = records.filter((r) => r.provinceId === profile.province_id);
    } else if (isRegional && profile?.health_region_id) {
      records = records.filter((r) => r.regionId === profile.health_region_id);
    }
    
    records.forEach((r) => {
      if (r.hospital_id) unitsWithRecords.add(r.hospital_id);
      if (r.health_office_id) unitsWithRecords.add(r.health_office_id);
    });
    
    // Get all units in scope
    let filteredHospitals = hospitals;
    let filteredOffices = healthOffices;
    
    if (isProvincial && profile?.province_id) {
      filteredHospitals = hospitals.filter((h) => h.province_id === profile.province_id);
      filteredOffices = healthOffices.filter((o) => o.province_id === profile.province_id);
    } else if (isRegional && profile?.health_region_id) {
      const provincesInRegion = provinces.filter((p) => p.health_region_id === profile.health_region_id);
      const provinceIds = new Set(provincesInRegion.map((p) => p.id));
      filteredHospitals = hospitals.filter((h) => provinceIds.has(h.province_id));
      filteredOffices = healthOffices.filter((o) => o.health_region_id === profile.health_region_id);
    }
    
    // Find units without budget
    const result: { id: string; name: string; type: "hospital" | "health_office" }[] = [];
    
    filteredHospitals.forEach((hospital) => {
      if (!unitsWithRecords.has(hospital.id)) {
        result.push({ id: hospital.id, name: hospital.name, type: "hospital" });
      }
    });
    
    filteredOffices.forEach((office) => {
      if (!unitsWithRecords.has(office.id)) {
        result.push({ id: office.id, name: office.name, type: "health_office" });
      }
    });
    
    return result.sort((a, b) => a.name.localeCompare(b.name, 'th'));
  }, [aggregatedData.enrichedRecords, hospitals, healthOffices, provinces, isProvincial, isRegional, profile]);

  const handleOpenUnitsDialog = (type: "recorded" | "not_recorded") => {
    setUnitsDialogType(type);
    setShowUnitsDialog(true);
  };

  // Handle drill navigation
  const handleRegionClick = (regionId: string) => {
    setSelectedRegionId(regionId);
    setDrillLevel("province");
  };

  const handleProvinceClick = (provinceId: string) => {
    setSelectedProvinceId(provinceId);
    setDrillLevel("unit");
  };

  const handleUnitClick = (unitId: string, unitType: "hospital" | "health_office") => {
    setSelectedUnitId(unitId);
    setSelectedUnitType(unitType);
    setDrillLevel("detail");
  };

  const handleBack = () => {
    if (drillLevel === "detail") {
      setSelectedUnitId(null);
      setSelectedUnitType(null);
      if (isOrgLevel) return;
      setDrillLevel("unit");
    } else if (drillLevel === "unit") {
      if (isProvincial) return;
      setSelectedProvinceId(null);
      setDrillLevel("province");
    } else if (drillLevel === "province") {
      if (isRegional) return;
      setSelectedRegionId(null);
      setDrillLevel("region");
    }
  };

  // Get breadcrumb
  const getBreadcrumb = () => {
    const parts: string[] = [];
    
    if (isCentralAdmin) {
      parts.push("ทั้งประเทศ");
    }
    
    if (selectedRegionId) {
      const region = aggregatedData.regionMap.get(selectedRegionId);
      parts.push(`เขตสุขภาพที่ ${region?.region_number || ""}`);
    } else if (isRegional && profile?.health_region_id) {
      const region = aggregatedData.regionMap.get(profile.health_region_id);
      parts.push(`เขตสุขภาพที่ ${region?.region_number || ""}`);
    }
    
    if (selectedProvinceId) {
      const province = aggregatedData.provinceMap.get(selectedProvinceId);
      parts.push(province?.name || "");
    } else if (isProvincial && profile?.province_id) {
      const province = aggregatedData.provinceMap.get(profile.province_id);
      parts.push(province?.name || "");
    }
    
    if (selectedUnitId) {
      if (selectedUnitType === "hospital") {
        const hospital = aggregatedData.hospitalMap.get(selectedUnitId);
        parts.push(hospital?.name || "");
      } else {
        const office = aggregatedData.officeMap.get(selectedUnitId);
        parts.push(office?.name || "");
      }
    } else if (isOrgLevel) {
      if (profile?.hospital_id) {
        const hospital = aggregatedData.hospitalMap.get(profile.hospital_id);
        parts.push(hospital?.name || "");
      } else if (profile?.health_office_id) {
        const office = aggregatedData.officeMap.get(profile.health_office_id);
        parts.push(office?.name || "");
      }
    }
    
    return parts.join(" > ");
  };

  // Render category detail table
  const renderCategoryTable = () => {
    const filteredRecords = getFilteredRecords();
    const categoryTotals = new Map<string, number>();
    
    filteredRecords.forEach((record) => {
      const current = categoryTotals.get(record.category_id) || 0;
      categoryTotals.set(record.category_id, current + (Number(record.budget_amount) || 0));
    });

    const total = Array.from(categoryTotals.values()).reduce((sum, val) => sum + val, 0);

    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">รายละเอียดงบประมาณตามหมวดหมู่ CTAM</CardTitle>
          <CardDescription>{getBreadcrumb()}</CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-16">ลำดับ</TableHead>
                <TableHead>หมวดหมู่</TableHead>
                <TableHead className="text-right">งบประมาณ (บาท)</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {categories.map((cat) => (
                <TableRow key={cat.id}>
                  <TableCell className="font-medium">{cat.order_number}</TableCell>
                  <TableCell>{cat.name_th}</TableCell>
                  <TableCell className="text-right font-mono">
                    {formatCurrency(categoryTotals.get(cat.id) || 0)}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
            <TableFooter>
              <TableRow>
                <TableCell colSpan={2} className="font-bold">รวมทั้งหมด</TableCell>
                <TableCell className="text-right font-bold font-mono">
                  {formatCurrency(total)}
                </TableCell>
              </TableRow>
            </TableFooter>
          </Table>
        </CardContent>
      </Card>
    );
  };

  // Render region table
  const renderRegionTable = () => {
    const regions = getRegionRecords();

    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">สรุปงบประมาณตามเขตสุขภาพ</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-24">เขตสุขภาพ</TableHead>
                <TableHead>ชื่อเขต</TableHead>
                <TableHead className="text-center">จำนวนหน่วยงาน</TableHead>
                <TableHead className="text-right">งบประมาณรวม (บาท)</TableHead>
                <TableHead className="w-24"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {regions.map((r) => (
                <TableRow key={r.id} className="cursor-pointer hover:bg-muted/50" onClick={() => handleRegionClick(r.id)}>
                  <TableCell className="font-medium">เขต {r.regionNumber}</TableCell>
                  <TableCell>{r.name}</TableCell>
                  <TableCell className="text-center">
                    <Badge variant="secondary">{r.unitCount}</Badge>
                  </TableCell>
                  <TableCell className="text-right font-mono">{formatCurrency(r.total)}</TableCell>
                  <TableCell>
                    <Button variant="ghost" size="sm">ดูรายละเอียด</Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
            <TableFooter>
              <TableRow>
                <TableCell colSpan={3} className="font-bold">รวมทั้งหมด</TableCell>
                <TableCell className="text-right font-bold font-mono">
                  {formatCurrency(regions.reduce((sum, r) => sum + r.total, 0))}
                </TableCell>
                <TableCell></TableCell>
              </TableRow>
            </TableFooter>
          </Table>
        </CardContent>
      </Card>
    );
  };

  // Render province table
  const renderProvinceTable = () => {
    const provinceRecords = getProvinceRecords();

    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">สรุปงบประมาณตามจังหวัด</CardTitle>
          <CardDescription>{getBreadcrumb()}</CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>จังหวัด</TableHead>
                <TableHead className="text-center">จำนวนหน่วยงาน</TableHead>
                <TableHead className="text-right">งบประมาณรวม (บาท)</TableHead>
                <TableHead className="w-24"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {provinceRecords.map((p) => (
                <TableRow key={p.id} className="cursor-pointer hover:bg-muted/50" onClick={() => handleProvinceClick(p.id)}>
                  <TableCell className="font-medium">{p.name}</TableCell>
                  <TableCell className="text-center">
                    <Badge variant="secondary">{p.unitCount}</Badge>
                  </TableCell>
                  <TableCell className="text-right font-mono">{formatCurrency(p.total)}</TableCell>
                  <TableCell>
                    <Button variant="ghost" size="sm">ดูรายละเอียด</Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
            <TableFooter>
              <TableRow>
                <TableCell colSpan={2} className="font-bold">รวมทั้งหมด</TableCell>
                <TableCell className="text-right font-bold font-mono">
                  {formatCurrency(provinceRecords.reduce((sum, p) => sum + p.total, 0))}
                </TableCell>
                <TableCell></TableCell>
              </TableRow>
            </TableFooter>
          </Table>
        </CardContent>
      </Card>
    );
  };

  // Render unit table
  const renderUnitTable = () => {
    const units = getUnitRecords();

    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">สรุปงบประมาณตามหน่วยงาน</CardTitle>
          <CardDescription>{getBreadcrumb()}</CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>หน่วยงาน</TableHead>
                <TableHead className="text-center">ประเภท</TableHead>
                <TableHead className="text-right">งบประมาณรวม (บาท)</TableHead>
                <TableHead className="w-24"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {units.map((u) => (
                <TableRow key={u.id} className="cursor-pointer hover:bg-muted/50" onClick={() => handleUnitClick(u.id, u.type)}>
                  <TableCell className="font-medium">{u.name}</TableCell>
                  <TableCell className="text-center">
                    <Badge variant={u.type === "hospital" ? "default" : "outline"}>
                      {u.type === "hospital" ? "โรงพยาบาล" : "สำนักงานสาธารณสุข"}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right font-mono">{formatCurrency(u.total)}</TableCell>
                  <TableCell>
                    <Button variant="ghost" size="sm">ดูรายละเอียด</Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
            <TableFooter>
              <TableRow>
                <TableCell colSpan={2} className="font-bold">รวมทั้งหมด</TableCell>
                <TableCell className="text-right font-bold font-mono">
                  {formatCurrency(units.reduce((sum, u) => sum + u.total, 0))}
                </TableCell>
                <TableCell></TableCell>
              </TableRow>
            </TableFooter>
          </Table>
        </CardContent>
      </Card>
    );
  };

  // Determine which table to render
  const renderMainContent = () => {
    if (isLoadingBudget) {
      return (
        <Card>
          <CardContent className="p-6">
            <div className="space-y-4">
              {Array.from({ length: 5 }).map((_, i) => (
                <Skeleton key={i} className="h-12 w-full" />
              ))}
            </div>
          </CardContent>
        </Card>
      );
    }

    if (drillLevel === "detail" || isOrgLevel) {
      return renderCategoryTable();
    }

    if (drillLevel === "unit") {
      return renderUnitTable();
    }

    if (drillLevel === "province") {
      return renderProvinceTable();
    }

    return renderRegionTable();
  };

  const canGoBack = () => {
    if (isOrgLevel) return false;
    if (isProvincial && drillLevel === "unit") return false;
    if (isRegional && drillLevel === "province") return false;
    if (isCentralAdmin && drillLevel === "region") return false;
    return drillLevel !== "region";
  };

  // Export to Excel
  const handleExportExcel = () => {
    const categoryMap = new Map(categories.map((c) => [c.id, c]));
    const rows: Record<string, unknown>[] = [];

    if (drillLevel === "detail" || isOrgLevel) {
      // Export category details
      const filteredRecords = getFilteredRecords();
      const categoryTotals = new Map<string, number>();
      filteredRecords.forEach((record) => {
        const current = categoryTotals.get(record.category_id) || 0;
        categoryTotals.set(record.category_id, current + (Number(record.budget_amount) || 0));
      });

      categories.forEach((cat) => {
        rows.push({
          "รหัส": cat.code,
          "หมวดหมู่": cat.name_th,
          "งบประมาณ (บาท)": categoryTotals.get(cat.id) || 0,
        });
      });
    } else if (drillLevel === "unit") {
      // Export unit data
      const unitRecords = getUnitRecords();
      unitRecords.forEach((unit) => {
        rows.push({
          "หน่วยงาน": unit.name,
          "ประเภท": unit.type === "hospital" ? "โรงพยาบาล" : "สำนักงานสาธารณสุข",
          "งบประมาณรวม (บาท)": unit.total,
        });
      });
    } else if (drillLevel === "province") {
      // Export province data
      const provinceRecords = getProvinceRecords();
      provinceRecords.forEach((prov) => {
        rows.push({
          "จังหวัด": prov.name,
          "จำนวนหน่วยงาน": prov.unitCount,
          "งบประมาณรวม (บาท)": prov.total,
        });
      });
    } else {
      // Export region data
      const regionRecords = getRegionRecords();
      regionRecords.forEach((reg) => {
        rows.push({
          "เขตสุขภาพ": `เขต ${reg.regionNumber}`,
          "จำนวนหน่วยงาน": reg.unitCount,
          "งบประมาณรวม (บาท)": reg.total,
        });
      });
    }

    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "รายงานงบประมาณ");
    XLSX.writeFile(wb, `รายงานงบประมาณ_ปี${fiscalYear}.xlsx`);
  };

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div className="flex items-center gap-4">
            {canGoBack() && (
              <Button variant="outline" size="icon" onClick={handleBack}>
                <ChevronLeft className="h-4 w-4" />
              </Button>
            )}
            <div>
              <h1 className="text-2xl font-bold tracking-tight">รายงานงบประมาณประจำปี</h1>
              <p className="text-muted-foreground">สรุปภาพรวมงบประมาณตามหมวดหมู่ CTAM</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" onClick={handleExportExcel}>
              <Download className="h-4 w-4 mr-2" />
              ส่งออก Excel
            </Button>
            {canImport && (
              <Button variant="outline" onClick={() => setShowImportDialog(true)}>
                <Upload className="h-4 w-4 mr-2" />
                นำเข้าจาก Excel
              </Button>
            )}
            <Select value={fiscalYear.toString()} onValueChange={(v) => setFiscalYear(Number(v))}>
              <SelectTrigger className="w-[220px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {fiscalYears.map((year) => (
                  <SelectItem key={year} value={year.toString()}>
                    ปีงบประมาณ {year}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Import Dialog */}
        <BudgetImportDialog
          open={showImportDialog}
          onOpenChange={setShowImportDialog}
          onSuccess={() => queryClient.invalidateQueries({ queryKey: ["budget-records-report"] })}
        />

        {/* Units List Dialog */}
        <Dialog open={showUnitsDialog} onOpenChange={setShowUnitsDialog}>
          <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                {unitsDialogType === "recorded" ? (
                  <>
                    <CheckCircle2 className="h-5 w-5 text-primary" />
                    หน่วยงานที่บันทึกงบประมาณแล้ว
                  </>
                ) : (
                  <>
                    <AlertCircle className="h-5 w-5 text-destructive" />
                    หน่วยงานที่ยังไม่ได้บันทึกงบประมาณ
                  </>
                )}
              </DialogTitle>
            </DialogHeader>
            <div className="mt-4">
              {(unitsDialogType === "recorded" ? unitsWithBudgetList : unitsWithoutBudgetList).length === 0 ? (
                <p className="text-center text-muted-foreground py-8">ไม่พบข้อมูล</p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-12">ลำดับ</TableHead>
                      <TableHead>ชื่อหน่วยงาน</TableHead>
                      <TableHead className="text-center">ประเภท</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {(unitsDialogType === "recorded" ? unitsWithBudgetList : unitsWithoutBudgetList).map((unit, index) => (
                      <TableRow key={unit.id}>
                        <TableCell className="font-medium">{index + 1}</TableCell>
                        <TableCell>{unit.name}</TableCell>
                        <TableCell className="text-center">
                          <Badge variant={unit.type === "hospital" ? "default" : "outline"}>
                            {unit.type === "hospital" ? "โรงพยาบาล" : "สำนักงานสาธารณสุข"}
                          </Badge>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </div>
          </DialogContent>
        </Dialog>

        {/* Summary Cards */}
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">งบประมาณรวม</CardTitle>
              <DollarSign className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{formatCurrency(grandTotal)}</div>
              <p className="text-xs text-muted-foreground">บาท</p>
            </CardContent>
          </Card>
          {!isOrgLevel && (
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">หน่วยงานทั้งหมด</CardTitle>
                <Building2 className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{totalUnitsInScope}</div>
                <p className="text-xs text-muted-foreground">หน่วยงานในขอบเขต</p>
              </CardContent>
            </Card>
          )}
          <Card 
            className={!isOrgLevel ? "cursor-pointer transition-colors hover:bg-muted/50" : ""}
            onClick={() => !isOrgLevel && handleOpenUnitsDialog("recorded")}
          >
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">หน่วยงานที่บันทึกแล้ว</CardTitle>
              <Users className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{unitWithBudgetCount}</div>
              <p className="text-xs text-muted-foreground">
                {!isOrgLevel ? "คลิกเพื่อดูรายชื่อ" : "หน่วยงานที่บันทึกงบประมาณ"}
              </p>
            </CardContent>
          </Card>
          {!isOrgLevel && (
            <Card 
              className="cursor-pointer transition-colors hover:bg-muted/50"
              onClick={() => handleOpenUnitsDialog("not_recorded")}
            >
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">ยังไม่ได้บันทึก</CardTitle>
                <AlertCircle className="h-4 w-4 text-destructive" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-destructive">{unitsWithoutBudget}</div>
                <p className="text-xs text-muted-foreground">คลิกเพื่อดูรายชื่อ</p>
              </CardContent>
            </Card>
          )}
        </div>

        {/* Main Content */}
        {renderMainContent()}
      </div>
    </DashboardLayout>
  );
}
