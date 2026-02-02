import { useMemo, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, Legend } from 'recharts';
import { ChevronLeft, PieChart as PieChartIcon } from 'lucide-react';

interface HealthRegion {
  id: string;
  name: string;
  region_number: number;
}

interface Province {
  id: string;
  name: string;
  health_region_id: string;
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

interface CtamCategory {
  id: string;
  code: string;
  name_th: string;
  order_number: number;
}

interface BudgetRecord {
  id: string;
  hospital_id: string | null;
  health_office_id: string | null;
  fiscal_year: number;
  category_id: string;
  budget_amount: number;
}

export type DrillLevel = 'region' | 'province' | 'hospital';

interface BudgetPieChartProps {
  healthRegions: HealthRegion[];
  provinces: Province[];
  hospitals: Hospital[];
  healthOffices?: HealthOffice[];
  categories: CtamCategory[];
  budgetRecords: BudgetRecord[];
  onDrillChange?: (level: DrillLevel, regionId: string | null, provinceId: string | null) => void;
  selectedFiscalYear?: number;
  canDrillToProvince?: (regionId: string) => boolean;
  canDrillToHospital?: (provinceId: string) => boolean;
}

interface PieData {
  name: string;
  value: number;
  color: string;
  categoryId: string;
}

// Color palette for 17 categories
const CATEGORY_COLORS = [
  '#3B82F6', '#22C55E', '#EF4444', '#F59E0B', '#8B5CF6',
  '#EC4899', '#06B6D4', '#84CC16', '#F97316', '#6366F1',
  '#14B8A6', '#A855F7', '#EAB308', '#0EA5E9', '#D946EF',
  '#10B981', '#FB7185',
];

const formatCurrency = (amount: number) => {
  return new Intl.NumberFormat('th-TH', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount);
};

const formatShortCurrency = (amount: number) => {
  if (amount >= 1000000) {
    return `${(amount / 1000000).toFixed(2)} ล้าน`;
  }
  if (amount >= 1000) {
    return `${(amount / 1000).toFixed(0)} พัน`;
  }
  return amount.toFixed(0);
};

export function BudgetPieChart({ 
  healthRegions, 
  provinces, 
  hospitals, 
  healthOffices = [], 
  categories,
  budgetRecords, 
  onDrillChange, 
  selectedFiscalYear,
  canDrillToProvince,
  canDrillToHospital 
}: BudgetPieChartProps) {
  const [drillLevel, setDrillLevel] = useState<DrillLevel>('region');
  const [selectedRegion, setSelectedRegion] = useState<HealthRegion | null>(null);
  const [selectedProvince, setSelectedProvince] = useState<Province | null>(null);
  const [selectedHospitalId, setSelectedHospitalId] = useState<string | null>(null);

  // Get hospital province mapping
  const hospitalProvinceMap = useMemo(() => {
    const map = new Map<string, string>();
    hospitals.forEach(h => map.set(h.id, h.province_id));
    return map;
  }, [hospitals]);

  // Get health office province/region mapping
  const healthOfficeMap = useMemo(() => {
    const map = new Map<string, { provinceId: string | null; regionId: string }>();
    healthOffices.forEach(ho => map.set(ho.id, { provinceId: ho.province_id, regionId: ho.health_region_id }));
    return map;
  }, [healthOffices]);

  // Get province region mapping
  const provinceRegionMap = useMemo(() => {
    const map = new Map<string, string>();
    provinces.forEach(p => map.set(p.id, p.health_region_id));
    return map;
  }, [provinces]);

  // Category map for lookup
  const categoryMap = useMemo(() => {
    const map = new Map<string, CtamCategory>();
    categories.forEach(c => map.set(c.id, c));
    return map;
  }, [categories]);

  // Filter budget records based on current drill level
  const filteredRecords = useMemo(() => {
    let records = budgetRecords;

    if (drillLevel === 'province' && selectedRegion) {
      // Filter to selected region
      records = records.filter(r => {
        if (r.hospital_id) {
          const provinceId = hospitalProvinceMap.get(r.hospital_id);
          if (provinceId) {
            return provinceRegionMap.get(provinceId) === selectedRegion.id;
          }
        }
        if (r.health_office_id) {
          const officeInfo = healthOfficeMap.get(r.health_office_id);
          return officeInfo?.regionId === selectedRegion.id;
        }
        return false;
      });
    } else if (drillLevel === 'hospital' && selectedProvince) {
      // Filter to selected province
      records = records.filter(r => {
        if (r.hospital_id) {
          return hospitalProvinceMap.get(r.hospital_id) === selectedProvince.id;
        }
        if (r.health_office_id) {
          const officeInfo = healthOfficeMap.get(r.health_office_id);
          return officeInfo?.provinceId === selectedProvince.id;
        }
        return false;
      });

      // If a specific hospital is selected, filter to that
      if (selectedHospitalId) {
        records = records.filter(r => 
          r.hospital_id === selectedHospitalId || r.health_office_id === selectedHospitalId
        );
      }
    }

    return records;
  }, [budgetRecords, drillLevel, selectedRegion, selectedProvince, selectedHospitalId, hospitalProvinceMap, healthOfficeMap, provinceRegionMap]);

  // Aggregate by category
  const pieData = useMemo((): PieData[] => {
    const categoryTotals = new Map<string, number>();
    
    filteredRecords.forEach(record => {
      const current = categoryTotals.get(record.category_id) || 0;
      categoryTotals.set(record.category_id, current + (Number(record.budget_amount) || 0));
    });

    // Sort by order_number and create pie data
    return categories
      .sort((a, b) => a.order_number - b.order_number)
      .map((cat, index) => ({
        name: `${cat.order_number}. ${cat.name_th}`,
        value: categoryTotals.get(cat.id) || 0,
        color: CATEGORY_COLORS[index % CATEGORY_COLORS.length],
        categoryId: cat.id,
      }))
      .filter(d => d.value > 0); // Only show categories with budget
  }, [filteredRecords, categories]);

  // Get units for hospital level drill-down
  const unitsInProvince = useMemo(() => {
    if (drillLevel !== 'hospital' || !selectedProvince) return [];

    const provinceHospitals = hospitals.filter(h => h.province_id === selectedProvince.id);
    const provinceHealthOffices = healthOffices.filter(ho => ho.province_id === selectedProvince.id);

    return [
      ...provinceHospitals.map(h => ({ id: h.id, name: h.name, type: 'hospital' as const })),
      ...provinceHealthOffices.map(ho => ({ id: ho.id, name: ho.name, type: 'health_office' as const })),
    ];
  }, [drillLevel, selectedProvince, hospitals, healthOffices]);

  // Get regions for region level
  const regionsData = useMemo(() => {
    return healthRegions.map(r => ({
      id: r.id,
      name: `เขต ${r.region_number}`,
      canDrill: canDrillToProvince ? canDrillToProvince(r.id) : true,
    }));
  }, [healthRegions, canDrillToProvince]);

  // Get provinces for province level
  const provincesData = useMemo(() => {
    if (!selectedRegion) return [];
    return provinces
      .filter(p => p.health_region_id === selectedRegion.id)
      .map(p => ({
        id: p.id,
        name: p.name,
        canDrill: canDrillToHospital ? canDrillToHospital(p.id) : true,
      }));
  }, [selectedRegion, provinces, canDrillToHospital]);

  const handleRegionClick = (regionId: string) => {
    const region = healthRegions.find(r => r.id === regionId);
    if (region) {
      setSelectedRegion(region);
      setDrillLevel('province');
      onDrillChange?.('province', region.id, null);
    }
  };

  const handleProvinceClick = (provinceId: string) => {
    const province = provinces.find(p => p.id === provinceId);
    if (province) {
      setSelectedProvince(province);
      setSelectedHospitalId(null);
      setDrillLevel('hospital');
      onDrillChange?.('hospital', selectedRegion?.id || null, province.id);
    }
  };

  const handleUnitClick = (unitId: string) => {
    setSelectedHospitalId(unitId === selectedHospitalId ? null : unitId);
  };

  const handleBack = () => {
    if (selectedHospitalId) {
      setSelectedHospitalId(null);
    } else if (drillLevel === 'hospital') {
      setSelectedProvince(null);
      setDrillLevel('province');
      onDrillChange?.('province', selectedRegion?.id || null, null);
    } else if (drillLevel === 'province') {
      setSelectedRegion(null);
      setDrillLevel('region');
      onDrillChange?.('region', null, null);
    }
  };

  const getTitle = () => {
    const fiscalYearLabel = selectedFiscalYear 
      ? `(ปีงบประมาณ ${selectedFiscalYear})` 
      : '';
    
    if (selectedHospitalId) {
      const unit = unitsInProvince.find(u => u.id === selectedHospitalId);
      return `สัดส่วนงบประมาณ - ${unit?.name || ''} ${fiscalYearLabel}`;
    }
    if (drillLevel === 'region') {
      return `สัดส่วนงบประมาณตามหมวดหมู่ CTAM (ทั้งประเทศ) ${fiscalYearLabel}`;
    }
    if (drillLevel === 'province' && selectedRegion) {
      return `สัดส่วนงบประมาณ - เขตสุขภาพที่ ${selectedRegion.region_number} ${fiscalYearLabel}`;
    }
    if (drillLevel === 'hospital' && selectedProvince) {
      return `สัดส่วนงบประมาณ - ${selectedProvince.name} ${fiscalYearLabel}`;
    }
    return 'สัดส่วนงบประมาณ';
  };

  const totalBudget = pieData.reduce((sum, d) => sum + d.value, 0);

  const CustomTooltip = ({ active, payload }: any) => {
    if (active && payload && payload.length) {
      const data = payload[0].payload;
      const percentage = ((data.value / totalBudget) * 100).toFixed(1);
      return (
        <div className="bg-background border rounded-lg p-3 shadow-lg max-w-xs">
          <p className="font-medium text-sm">{data.name}</p>
          <p className="text-primary text-sm">
            งบประมาณ: <span className="font-bold">{formatCurrency(data.value)}</span> บาท
          </p>
          <p className="text-muted-foreground text-sm">
            สัดส่วน: <span className="font-bold">{percentage}%</span>
          </p>
        </div>
      );
    }
    return null;
  };

  const renderCustomLegend = (props: any) => {
    const { payload } = props;
    return (
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-1 text-xs max-h-[200px] overflow-y-auto">
        {payload.map((entry: any, index: number) => (
          <div key={`legend-${index}`} className="flex items-center gap-2">
            <div 
              className="w-3 h-3 rounded-sm flex-shrink-0" 
              style={{ backgroundColor: entry.color }} 
            />
            <span className="truncate">{entry.value}</span>
          </div>
        ))}
      </div>
    );
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <PieChartIcon className="w-5 h-5" />
            {getTitle()}
          </CardTitle>
          {(drillLevel !== 'region' || selectedHospitalId) && (
            <Button variant="outline" size="sm" onClick={handleBack}>
              <ChevronLeft className="w-4 h-4 mr-1" />
              ย้อนกลับ
            </Button>
          )}
        </div>
        <p className="text-sm text-muted-foreground">
          งบประมาณรวม: <span className="font-bold text-primary">{formatCurrency(totalBudget)}</span> บาท
        </p>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
          {/* Drill-down navigation */}
          <div className="lg:col-span-1 space-y-4">
            {drillLevel === 'region' && (
              <div>
                <h4 className="font-medium mb-2 text-sm">เลือกเขตสุขภาพ</h4>
                <div className="space-y-1 max-h-[350px] overflow-y-auto">
                  {regionsData.map(region => (
                    <Button
                      key={region.id}
                      variant="ghost"
                      size="sm"
                      className="w-full justify-start text-left"
                      disabled={!region.canDrill}
                      onClick={() => handleRegionClick(region.id)}
                    >
                      {region.name}
                    </Button>
                  ))}
                </div>
              </div>
            )}

            {drillLevel === 'province' && (
              <div>
                <h4 className="font-medium mb-2 text-sm">เลือกจังหวัด</h4>
                <div className="space-y-1 max-h-[350px] overflow-y-auto">
                  {provincesData.map(province => (
                    <Button
                      key={province.id}
                      variant="ghost"
                      size="sm"
                      className="w-full justify-start text-left"
                      disabled={!province.canDrill}
                      onClick={() => handleProvinceClick(province.id)}
                    >
                      {province.name}
                    </Button>
                  ))}
                </div>
              </div>
            )}

            {drillLevel === 'hospital' && (
              <div>
                <h4 className="font-medium mb-2 text-sm">เลือกหน่วยงาน</h4>
                <div className="space-y-1 max-h-[350px] overflow-y-auto">
                  {unitsInProvince.map(unit => (
                    <Button
                      key={unit.id}
                      variant={selectedHospitalId === unit.id ? "secondary" : "ghost"}
                      size="sm"
                      className="w-full justify-start text-left"
                      onClick={() => handleUnitClick(unit.id)}
                    >
                      {unit.name}
                    </Button>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Pie Chart */}
          <div className="lg:col-span-3">
            {pieData.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">ไม่พบข้อมูลงบประมาณ</div>
            ) : (
              <div className="h-[400px] w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={pieData}
                      cx="50%"
                      cy="50%"
                      innerRadius={60}
                      outerRadius={120}
                      paddingAngle={2}
                      dataKey="value"
                      label={({ name, percent }) => `${(percent * 100).toFixed(0)}%`}
                      labelLine={false}
                    >
                      {pieData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip content={<CustomTooltip />} />
                    <Legend 
                      content={renderCustomLegend}
                      wrapperStyle={{ paddingTop: '20px' }}
                    />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            )}
          </div>
        </div>

        {/* Category breakdown table */}
        {pieData.length > 0 && (
          <div className="mt-6">
            <h4 className="font-medium mb-3">รายละเอียดงบประมาณแต่ละหมวดหมู่</h4>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b">
                    <th className="text-left py-2 px-2">หมวดหมู่</th>
                    <th className="text-right py-2 px-2">งบประมาณ (บาท)</th>
                    <th className="text-right py-2 px-2">สัดส่วน</th>
                  </tr>
                </thead>
                <tbody>
                  {pieData.map((item, index) => (
                    <tr key={item.categoryId} className="border-b hover:bg-muted/50">
                      <td className="py-2 px-2 flex items-center gap-2">
                        <div 
                          className="w-3 h-3 rounded-sm flex-shrink-0" 
                          style={{ backgroundColor: item.color }} 
                        />
                        {item.name}
                      </td>
                      <td className="text-right py-2 px-2 font-mono">
                        {formatCurrency(item.value)}
                      </td>
                      <td className="text-right py-2 px-2 text-muted-foreground">
                        {((item.value / totalBudget) * 100).toFixed(1)}%
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr className="font-bold bg-muted/30">
                    <td className="py-2 px-2">รวมทั้งหมด</td>
                    <td className="text-right py-2 px-2 font-mono">{formatCurrency(totalBudget)}</td>
                    <td className="text-right py-2 px-2">100%</td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
