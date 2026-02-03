import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { DollarSign, Building2, Layers, Filter, MapPin } from "lucide-react";
import { BudgetPieChart } from "@/components/reports/BudgetPieChart";
import { SearchableSelect } from "@/components/ui/searchable-select";

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

export default function BudgetReportPieChart() {
  const { profile } = useAuth();
  const [fiscalYear, setFiscalYear] = useState(getCurrentFiscalYear());
  const [selectedRegion, setSelectedRegion] = useState<string>("all");
  const [selectedProvince, setSelectedProvince] = useState<string>("all");
  const [selectedUnit, setSelectedUnit] = useState<string>("all");
  const [initialFiltersSet, setInitialFiltersSet] = useState(false);

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
    queryKey: ["budget-records-pie", fiscalYear],
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
      const { data, error } = await supabase.from("hospitals").select("*").order("name");
      if (error) throw error;
      return data as Hospital[];
    },
  });

  const { data: healthOffices = [] } = useQuery({
    queryKey: ["health-offices"],
    queryFn: async () => {
      const { data, error } = await supabase.from("health_offices").select("*").order("name");
      if (error) throw error;
      return data as HealthOffice[];
    },
  });

  const { data: provinces = [] } = useQuery({
    queryKey: ["provinces"],
    queryFn: async () => {
      const { data, error } = await supabase.from("provinces").select("*").order("name");
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

  // Auto-set initial filters based on role
  useMemo(() => {
    if (initialFiltersSet) return;
    if (isProvincial && profile?.province_id) {
      setSelectedProvince(profile.province_id);
      setInitialFiltersSet(true);
    } else if (isRegional && profile?.health_region_id) {
      setSelectedRegion(profile.health_region_id);
      setInitialFiltersSet(true);
    } else if (isOrgLevel) {
      setInitialFiltersSet(true);
    }
  }, [isProvincial, isRegional, isOrgLevel, profile, initialFiltersSet]);

  // Filter provinces based on selected region
  const filteredProvinces = useMemo(() => {
    if (selectedRegion === "all") return provinces;
    return provinces.filter((p) => p.health_region_id === selectedRegion);
  }, [provinces, selectedRegion]);

  // Filter units (hospitals + health offices) based on selected province
  const filteredUnits = useMemo(() => {
    let targetProvinces = filteredProvinces;
    if (selectedProvince !== "all") {
      targetProvinces = provinces.filter((p) => p.id === selectedProvince);
    }
    const provinceIds = new Set(targetProvinces.map((p) => p.id));

    const hospitalsInScope = hospitals.filter((h) => provinceIds.has(h.province_id));
    const officesInScope = healthOffices.filter((ho) => ho.province_id && provinceIds.has(ho.province_id));

    return [
      ...hospitalsInScope.map((h) => ({ id: h.id, name: h.name, type: "hospital" as const })),
      ...officesInScope.map((ho) => ({ id: ho.id, name: ho.name, type: "health_office" as const })),
    ];
  }, [hospitals, healthOffices, filteredProvinces, selectedProvince, provinces]);

  // Apply role-based restrictions
  const accessibleRegions = useMemo(() => {
    if (isRegional && profile?.health_region_id) {
      return healthRegions.filter((r) => r.id === profile.health_region_id);
    }
    return healthRegions;
  }, [healthRegions, isRegional, profile]);

  const accessibleProvinces = useMemo(() => {
    if (isProvincial && profile?.province_id) {
      return provinces.filter((p) => p.id === profile.province_id);
    }
    if (isRegional && profile?.health_region_id) {
      return provinces.filter((p) => p.health_region_id === profile.health_region_id);
    }
    return filteredProvinces;
  }, [provinces, filteredProvinces, isProvincial, isRegional, profile]);

  // Filter budget records based on selections
  const filteredBudgetRecords = useMemo(() => {
    const hospitalMap = new Map(hospitals.map((h) => [h.id, h]));
    const officeMap = new Map(healthOffices.map((o) => [o.id, o]));
    const provinceMap = new Map(provinces.map((p) => [p.id, p]));

    let records = budgetRecords;

    // Apply role-based filtering first
    if (isOrgLevel) {
      const orgId = profile?.hospital_id || profile?.health_office_id;
      records = records.filter((r) => r.hospital_id === orgId || r.health_office_id === orgId);
    } else if (isProvincial) {
      records = records.filter((r) => {
        if (r.hospital_id) {
          const hospital = hospitalMap.get(r.hospital_id);
          return hospital?.province_id === profile?.province_id;
        }
        if (r.health_office_id) {
          const office = officeMap.get(r.health_office_id);
          return office?.province_id === profile?.province_id;
        }
        return false;
      });
    } else if (isRegional) {
      records = records.filter((r) => {
        if (r.hospital_id) {
          const hospital = hospitalMap.get(r.hospital_id);
          if (hospital) {
            const province = provinceMap.get(hospital.province_id);
            return province?.health_region_id === profile?.health_region_id;
          }
        }
        if (r.health_office_id) {
          const office = officeMap.get(r.health_office_id);
          return office?.health_region_id === profile?.health_region_id;
        }
        return false;
      });
    }

    // Apply user filter selections
    if (selectedUnit !== "all") {
      records = records.filter((r) => r.hospital_id === selectedUnit || r.health_office_id === selectedUnit);
    } else if (selectedProvince !== "all") {
      records = records.filter((r) => {
        if (r.hospital_id) {
          const hospital = hospitalMap.get(r.hospital_id);
          return hospital?.province_id === selectedProvince;
        }
        if (r.health_office_id) {
          const office = officeMap.get(r.health_office_id);
          return office?.province_id === selectedProvince;
        }
        return false;
      });
    } else if (selectedRegion !== "all") {
      records = records.filter((r) => {
        if (r.hospital_id) {
          const hospital = hospitalMap.get(r.hospital_id);
          if (hospital) {
            const province = provinceMap.get(hospital.province_id);
            return province?.health_region_id === selectedRegion;
          }
        }
        if (r.health_office_id) {
          const office = officeMap.get(r.health_office_id);
          return office?.health_region_id === selectedRegion;
        }
        return false;
      });
    }

    return records;
  }, [budgetRecords, hospitals, healthOffices, provinces, profile, isOrgLevel, isProvincial, isRegional, selectedRegion, selectedProvince, selectedUnit]);

  // Calculate summary statistics
  const summaryStats = useMemo(() => {
    const totalBudget = filteredBudgetRecords.reduce((sum, r) => sum + (Number(r.budget_amount) || 0), 0);
    
    const unitIds = new Set<string>();
    filteredBudgetRecords.forEach((r) => {
      if (r.hospital_id) unitIds.add(r.hospital_id);
      if (r.health_office_id) unitIds.add(r.health_office_id);
    });

    const categoriesWithBudget = new Set<string>();
    filteredBudgetRecords.forEach((r) => {
      if (r.budget_amount > 0) {
        categoriesWithBudget.add(r.category_id);
      }
    });

    return {
      totalBudget,
      unitCount: unitIds.size,
      categoryCount: categoriesWithBudget.size,
    };
  }, [filteredBudgetRecords]);

  // Generate chart title based on selection
  const chartTitle = useMemo(() => {
    if (selectedUnit !== "all") {
      const unit = filteredUnits.find((u) => u.id === selectedUnit);
      return `สัดส่วนงบประมาณ - ${unit?.name || "หน่วยงาน"}`;
    }
    if (selectedProvince !== "all") {
      const province = provinces.find((p) => p.id === selectedProvince);
      return `สัดส่วนงบประมาณ - ${province?.name || "จังหวัด"}`;
    }
    if (selectedRegion !== "all") {
      const region = healthRegions.find((r) => r.id === selectedRegion);
      return `สัดส่วนงบประมาณ - เขตสุขภาพที่ ${region?.region_number || ""}`;
    }
    return "สัดส่วนงบประมาณตามหมวดหมู่ CTAM (ทั้งประเทศ)";
  }, [selectedRegion, selectedProvince, selectedUnit, healthRegions, provinces, filteredUnits]);

  // Reset dependent filters when parent changes
  const handleRegionChange = (value: string) => {
    setSelectedRegion(value);
    setSelectedProvince("all");
    setSelectedUnit("all");
  };

  const handleProvinceChange = (value: string) => {
    setSelectedProvince(value);
    setSelectedUnit("all");
  };

  // Build options for SearchableSelect
  const regionOptions = useMemo(() => [
    { value: "all", label: "ทุกเขตสุขภาพ" },
    ...accessibleRegions.map((r) => ({ value: r.id, label: `เขต ${r.region_number}` })),
  ], [accessibleRegions]);

  const provinceOptions = useMemo(() => [
    { value: "all", label: "ทุกจังหวัด" },
    ...accessibleProvinces.map((p) => ({ value: p.id, label: p.name })),
  ], [accessibleProvinces]);

  const unitOptions = useMemo(() => [
    { value: "all", label: "ทุกหน่วยงาน" },
    ...filteredUnits.map((u) => ({ value: u.id, label: u.name })),
  ], [filteredUnits]);

  if (isLoadingBudget) {
    return (
      <DashboardLayout>
        <div className="space-y-6 p-6">
          <Skeleton className="h-8 w-64" />
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {[1, 2, 3].map((i) => (
              <Skeleton key={i} className="h-24" />
            ))}
          </div>
          <Skeleton className="h-[600px]" />
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="space-y-6 p-6">
        {/* Header */}
        <div>
          <h1 className="text-2xl font-bold">สัดส่วนงบประมาณตามหมวดหมู่ CTAM</h1>
          <p className="text-muted-foreground">
            แสดงสัดส่วนงบประมาณแยกตาม 17 หมวดหมู่ พร้อมตัวกรองรายเขต จังหวัด และหน่วยงาน
          </p>
        </div>

        {/* Filters */}
        <Card>
          <CardHeader className="pb-4">
            <CardTitle className="text-base flex items-center gap-2">
              <Filter className="w-4 h-4" />
              ตัวกรอง
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <div className="w-full">
                <label className="text-sm font-medium mb-1.5 block">เขตสุขภาพ</label>
                <SearchableSelect
                  options={regionOptions}
                  value={selectedRegion}
                  onValueChange={handleRegionChange}
                  placeholder="ทุกเขตสุขภาพ"
                  searchPlaceholder="ค้นหาเขต..."
                  disabled={isProvincial || isOrgLevel}
                />
              </div>

              <div className="w-full">
                <label className="text-sm font-medium mb-1.5 block">จังหวัด</label>
                <SearchableSelect
                  options={provinceOptions}
                  value={selectedProvince}
                  onValueChange={handleProvinceChange}
                  placeholder="ทุกจังหวัด"
                  searchPlaceholder="ค้นหาจังหวัด..."
                  disabled={isProvincial || isOrgLevel}
                />
              </div>

              <div className="w-full">
                <label className="text-sm font-medium mb-1.5 block">หน่วยงาน</label>
                <SearchableSelect
                  options={unitOptions}
                  value={selectedUnit}
                  onValueChange={setSelectedUnit}
                  placeholder="ทุกหน่วยงาน"
                  searchPlaceholder="ค้นหาหน่วยงาน..."
                  disabled={isOrgLevel}
                />
              </div>

              <div className="w-full">
                <label className="text-sm font-medium mb-1.5 block">ปีงบประมาณ</label>
                <Select value={fiscalYear.toString()} onValueChange={(v) => setFiscalYear(parseInt(v))}>
                  <SelectTrigger className="h-9 text-sm">
                    <SelectValue placeholder="เลือกปีงบประมาณ" />
                  </SelectTrigger>
                  <SelectContent className="bg-background z-50">
                    {fiscalYears.map((year) => (
                      <SelectItem key={year} value={year.toString()} className="text-sm">
                        ปีงบประมาณ {year}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Summary Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">งบประมาณรวม</CardTitle>
              <DollarSign className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-primary">
                {formatCurrency(summaryStats.totalBudget)}
              </div>
              <p className="text-xs text-muted-foreground">บาท</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">จำนวนหน่วยงาน</CardTitle>
              <Building2 className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{summaryStats.unitCount}</div>
              <p className="text-xs text-muted-foreground">หน่วยงาน</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">หมวดหมู่ที่มีงบประมาณ</CardTitle>
              <Layers className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{summaryStats.categoryCount}</div>
              <p className="text-xs text-muted-foreground">จาก 17 หมวดหมู่</p>
            </CardContent>
          </Card>
        </div>

        {/* Budget Pie Chart */}
        <BudgetPieChart
          categories={categories}
          budgetRecords={filteredBudgetRecords}
          selectedFiscalYear={fiscalYear}
          title={chartTitle}
        />
      </div>
    </DashboardLayout>
  );
}
