import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { DollarSign, Building2, MapPin, Landmark } from "lucide-react";
import { BudgetChart, DrillLevel } from "@/components/reports/BudgetChart";

// Types
interface BudgetRecord {
  id: string;
  hospital_id: string | null;
  health_office_id: string | null;
  fiscal_year: number;
  category_id: string;
  budget_amount: number;
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

export default function BudgetReportChart() {
  const { profile } = useAuth();
  const [fiscalYear, setFiscalYear] = useState(getCurrentFiscalYear());
  const [currentDrillLevel, setCurrentDrillLevel] = useState<DrillLevel>('region');
  const [selectedRegionId, setSelectedRegionId] = useState<string | null>(null);
  const [selectedProvinceId, setSelectedProvinceId] = useState<string | null>(null);
  const [initialFiltersSet, setInitialFiltersSet] = useState(false);

  const fiscalYears = Array.from({ length: 9 }, (_, i) => getCurrentFiscalYear() - 4 + i);

  // Fetch budget records
  const { data: budgetRecords = [], isLoading: isLoadingBudget } = useQuery({
    queryKey: ["budget-records-chart", fiscalYear],
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
  const isProvincial = userRole === "provincial" || userRole === "ceo";
  const isRegional = userRole === "regional" || userRole === "supervisor";
  const isCentralAdmin = userRole === "central_admin";

  // Auto-set initial drill level and filters based on role
  useMemo(() => {
    if (initialFiltersSet) return;
    if (isProvincial && profile?.province_id) {
      setCurrentDrillLevel('hospital');
      setSelectedProvinceId(profile.province_id);
      setInitialFiltersSet(true);
    } else if (isRegional && profile?.health_region_id) {
      setCurrentDrillLevel('province');
      setSelectedRegionId(profile.health_region_id);
      setInitialFiltersSet(true);
    } else if (isOrgLevel) {
      setCurrentDrillLevel('hospital');
      setInitialFiltersSet(true);
    }
  }, [isProvincial, isRegional, isOrgLevel, profile, initialFiltersSet]);

  // Calculate summary statistics
  const summaryStats = useMemo(() => {
    const hospitalMap = new Map(hospitals.map((h) => [h.id, h]));
    const officeMap = new Map(healthOffices.map((o) => [o.id, o]));
    const provinceMap = new Map(provinces.map((p) => [p.id, p]));

    let filteredRecords = budgetRecords;

    // Filter based on user role
    if (isOrgLevel) {
      const orgId = profile?.hospital_id || profile?.health_office_id;
      filteredRecords = budgetRecords.filter(
        (r) => r.hospital_id === orgId || r.health_office_id === orgId
      );
    } else if (isProvincial) {
      filteredRecords = budgetRecords.filter((r) => {
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
      filteredRecords = budgetRecords.filter((r) => {
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

    // Calculate totals
    const totalBudget = filteredRecords.reduce((sum, r) => sum + (Number(r.budget_amount) || 0), 0);
    
    const unitIds = new Set<string>();
    filteredRecords.forEach((r) => {
      if (r.hospital_id) unitIds.add(r.hospital_id);
      if (r.health_office_id) unitIds.add(r.health_office_id);
    });

    const provinceIds = new Set<string>();
    filteredRecords.forEach((r) => {
      if (r.hospital_id) {
        const hospital = hospitalMap.get(r.hospital_id);
        if (hospital) provinceIds.add(hospital.province_id);
      }
      if (r.health_office_id) {
        const office = officeMap.get(r.health_office_id);
        if (office?.province_id) provinceIds.add(office.province_id);
      }
    });

    const regionIds = new Set<string>();
    provinceIds.forEach((pId) => {
      const province = provinceMap.get(pId);
      if (province) regionIds.add(province.health_region_id);
    });

    return {
      totalBudget,
      unitCount: unitIds.size,
      provinceCount: provinceIds.size,
      regionCount: regionIds.size,
    };
  }, [budgetRecords, hospitals, healthOffices, provinces, profile, isOrgLevel, isProvincial, isRegional]);

  // Filter data based on drill level for chart
  const filteredBudgetRecords = useMemo(() => {
    const hospitalMap = new Map(hospitals.map((h) => [h.id, h]));
    const officeMap = new Map(healthOffices.map((o) => [o.id, o]));
    const provinceMap = new Map(provinces.map((p) => [p.id, p]));

    let records = budgetRecords;

    // Apply role-based filtering
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

    return records;
  }, [budgetRecords, hospitals, healthOffices, provinces, profile, isOrgLevel, isProvincial, isRegional]);

  // Filter regions/provinces based on user role
  const filteredRegions = useMemo(() => {
    if (isRegional && profile?.health_region_id) {
      return healthRegions.filter((r) => r.id === profile.health_region_id);
    }
    return healthRegions;
  }, [healthRegions, isRegional, profile]);

  const filteredProvinces = useMemo(() => {
    if (isProvincial && profile?.province_id) {
      return provinces.filter((p) => p.id === profile.province_id);
    }
    if (isRegional && profile?.health_region_id) {
      return provinces.filter((p) => p.health_region_id === profile.health_region_id);
    }
    return provinces;
  }, [provinces, isProvincial, isRegional, profile]);

  const handleDrillChange = (level: DrillLevel, regionId: string | null, provinceId: string | null) => {
    setCurrentDrillLevel(level);
    setSelectedRegionId(regionId);
    setSelectedProvinceId(provinceId);
  };

  // Access control for drill-down
  const canDrillToProvince = (regionId: string) => {
    if (isCentralAdmin) return true;
    if (isRegional && profile?.health_region_id === regionId) return true;
    // Provincial can view their own province (within their region)
    if (isProvincial && profile?.province_id) {
      const userProvince = provinces.find((p) => p.id === profile.province_id);
      return userProvince?.health_region_id === regionId;
    }
    return false;
  };

  const canDrillToHospital = (provinceId: string) => {
    if (isCentralAdmin) return true;
    if (isProvincial && profile?.province_id === provinceId) return true;
    if (isRegional) {
      const province = provinces.find((p) => p.id === provinceId);
      return province?.health_region_id === profile?.health_region_id;
    }
    return false;
  };

  if (isLoadingBudget) {
    return (
      <DashboardLayout>
        <div className="space-y-6 p-6">
          <Skeleton className="h-8 w-64" />
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            {[1, 2, 3, 4].map((i) => (
              <Skeleton key={i} className="h-24" />
            ))}
          </div>
          <Skeleton className="h-[500px]" />
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="space-y-6 p-6">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold">กราฟงบประมาณประจำปี</h1>
            <p className="text-muted-foreground">
              แสดงงบประมาณเปรียบเทียบรายเขต จังหวัด และหน่วยงาน
            </p>
          </div>
          <div className="flex items-center gap-4">
            <Select value={fiscalYear.toString()} onValueChange={(v) => setFiscalYear(parseInt(v))}>
              <SelectTrigger className="w-48">
                <SelectValue placeholder="เลือกปีงบประมาณ" />
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

        {/* Summary Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
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
              <CardTitle className="text-sm font-medium">จังหวัด</CardTitle>
              <MapPin className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{summaryStats.provinceCount}</div>
              <p className="text-xs text-muted-foreground">จังหวัด</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">เขตสุขภาพ</CardTitle>
              <Landmark className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{summaryStats.regionCount}</div>
              <p className="text-xs text-muted-foreground">เขต</p>
            </CardContent>
          </Card>
        </div>

        {/* Budget Chart */}
        <BudgetChart
          healthRegions={filteredRegions}
          provinces={filteredProvinces}
          hospitals={hospitals}
          healthOffices={healthOffices}
          budgetRecords={filteredBudgetRecords}
          selectedFiscalYear={fiscalYear}
          onDrillChange={handleDrillChange}
          canDrillToProvince={canDrillToProvince}
          canDrillToHospital={canDrillToHospital}
        />
      </div>
    </DashboardLayout>
  );
}
