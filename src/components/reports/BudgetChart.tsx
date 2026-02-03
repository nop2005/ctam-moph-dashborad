import { useMemo, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell, LabelList } from 'recharts';
import { BarChart3, ChevronLeft, DollarSign } from 'lucide-react';

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

interface BudgetRecord {
  id: string;
  hospital_id: string | null;
  health_office_id: string | null;
  fiscal_year: number;
  category_id: string;
  budget_amount: number;
}

export type DrillLevel = 'region' | 'province' | 'hospital';

interface BudgetChartProps {
  healthRegions: HealthRegion[];
  provinces: Province[];
  hospitals: Hospital[];
  healthOffices?: HealthOffice[];
  budgetRecords: BudgetRecord[];
  onDrillChange?: (level: DrillLevel, regionId: string | null, provinceId: string | null) => void;
  selectedFiscalYear?: number;
  canDrillToProvince?: (regionId: string) => boolean;
  canDrillToHospital?: (provinceId: string) => boolean;
}

interface ChartData {
  id: string;
  name: string;
  total: number;
  color: string;
  canDrill: boolean;
}

// Color gradient based on budget amount (relative to max)
const getColorByRank = (value: number, max: number): string => {
  if (max === 0) return '#94A3B8'; // gray if no data
  const ratio = value / max;
  if (ratio >= 0.7) return '#22C55E'; // green - high budget
  if (ratio >= 0.4) return '#3B82F6'; // blue - medium
  if (ratio >= 0.2) return '#FBBF24'; // yellow - low
  return '#EF4444'; // red - very low
};

const formatCurrency = (amount: number) => {
  if (amount >= 1000000) {
    return `${(amount / 1000000).toFixed(2)} ล้าน`;
  }
  if (amount >= 1000) {
    return `${(amount / 1000).toFixed(0)} พัน`;
  }
  return amount.toFixed(0);
};

const formatFullCurrency = (amount: number) => {
  return new Intl.NumberFormat('th-TH', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount);
};

export function BudgetChart({ 
  healthRegions, 
  provinces, 
  hospitals, 
  healthOffices = [], 
  budgetRecords, 
  onDrillChange, 
  selectedFiscalYear,
  canDrillToProvince,
  canDrillToHospital 
}: BudgetChartProps) {
  // Determine initial drill level based on available data
  const getInitialDrillLevel = (): DrillLevel => {
    // If only one region and we can drill into it, check provinces
    if (healthRegions.length === 1 && canDrillToProvince?.(healthRegions[0].id)) {
      // If only one province and we can drill into it, go to hospital level
      const regionProvinces = provinces.filter(p => p.health_region_id === healthRegions[0].id);
      if (regionProvinces.length === 1 && canDrillToHospital?.(regionProvinces[0].id)) {
        return 'hospital';
      }
      return 'province';
    }
    return 'region';
  };

  const getInitialRegion = (): HealthRegion | null => {
    if (healthRegions.length === 1) {
      return healthRegions[0];
    }
    return null;
  };

  const getInitialProvince = (): Province | null => {
    if (healthRegions.length === 1) {
      const regionProvinces = provinces.filter(p => p.health_region_id === healthRegions[0].id);
      if (regionProvinces.length === 1 && canDrillToHospital?.(regionProvinces[0].id)) {
        return regionProvinces[0];
      }
    }
    return null;
  };

  const [drillLevel, setDrillLevel] = useState<DrillLevel>(getInitialDrillLevel);
  const [selectedRegion, setSelectedRegion] = useState<HealthRegion | null>(getInitialRegion);
  const [selectedProvince, setSelectedProvince] = useState<Province | null>(getInitialProvince);

  // Calculate totals by unit
  const unitTotals = useMemo(() => {
    const totals = new Map<string, number>();
    
    budgetRecords.forEach(record => {
      const unitId = record.hospital_id || record.health_office_id;
      if (unitId) {
        const current = totals.get(unitId) || 0;
        totals.set(unitId, current + (Number(record.budget_amount) || 0));
      }
    });
    
    return totals;
  }, [budgetRecords]);

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

  // Calculate total by province
  const provinceTotals = useMemo(() => {
    const totals = new Map<string, number>();
    
    unitTotals.forEach((total, unitId) => {
      // Check if it's a hospital
      const provinceId = hospitalProvinceMap.get(unitId);
      if (provinceId) {
        const current = totals.get(provinceId) || 0;
        totals.set(provinceId, current + total);
        return;
      }
      
      // Check if it's a health office
      const officeInfo = healthOfficeMap.get(unitId);
      if (officeInfo?.provinceId) {
        const current = totals.get(officeInfo.provinceId) || 0;
        totals.set(officeInfo.provinceId, current + total);
      }
    });
    
    return totals;
  }, [unitTotals, hospitalProvinceMap, healthOfficeMap]);

  // Calculate total by region
  const regionTotals = useMemo(() => {
    const totals = new Map<string, number>();
    
    // Add from province totals
    provinceTotals.forEach((total, provinceId) => {
      const regionId = provinceRegionMap.get(provinceId);
      if (regionId) {
        const current = totals.get(regionId) || 0;
        totals.set(regionId, current + total);
      }
    });
    
    // Add health offices that might be directly under region
    unitTotals.forEach((total, unitId) => {
      const officeInfo = healthOfficeMap.get(unitId);
      if (officeInfo && !officeInfo.provinceId) {
        // Health office directly under region
        const current = totals.get(officeInfo.regionId) || 0;
        totals.set(officeInfo.regionId, current + total);
      }
    });
    
    return totals;
  }, [provinceTotals, provinceRegionMap, unitTotals, healthOfficeMap]);

  // Get chart data based on drill level
  const getChartData = (): ChartData[] => {
    if (drillLevel === 'region') {
      const data = healthRegions.map(region => ({
        id: region.id,
        name: `เขต ${region.region_number}`,
        total: regionTotals.get(region.id) || 0,
        color: '',
        canDrill: canDrillToProvince ? canDrillToProvince(region.id) : true,
      }));
      
      const maxTotal = Math.max(...data.map(d => d.total), 1);
      return data.map(d => ({
        ...d,
        color: getColorByRank(d.total, maxTotal),
      }));
    }

    if (drillLevel === 'province' && selectedRegion) {
      const regionProvinces = provinces.filter(p => p.health_region_id === selectedRegion.id);
      const data = regionProvinces.map(province => ({
        id: province.id,
        name: province.name,
        total: provinceTotals.get(province.id) || 0,
        color: '',
        canDrill: canDrillToHospital ? canDrillToHospital(province.id) : true,
      }));
      
      const maxTotal = Math.max(...data.map(d => d.total), 1);
      return data.map(d => ({
        ...d,
        color: getColorByRank(d.total, maxTotal),
      }));
    }

    if (drillLevel === 'hospital' && selectedProvince) {
      const provinceHospitals = hospitals.filter(h => h.province_id === selectedProvince.id);
      const provinceHealthOffices = healthOffices.filter(ho => ho.province_id === selectedProvince.id);
      
      const hospitalData = provinceHospitals.map(hospital => ({
        id: hospital.id,
        name: hospital.name,
        total: unitTotals.get(hospital.id) || 0,
        color: '',
        canDrill: false,
      }));

      const healthOfficeData = provinceHealthOffices.map(office => ({
        id: office.id,
        name: office.name,
        total: unitTotals.get(office.id) || 0,
        color: '',
        canDrill: false,
      }));

      const allData = [...hospitalData, ...healthOfficeData];
      const maxTotal = Math.max(...allData.map(d => d.total), 1);
      
      return allData.map(d => ({
        ...d,
        color: getColorByRank(d.total, maxTotal),
      }));
    }

    return [];
  };

  const handleBarClick = (data: ChartData) => {
    if (!data.canDrill) return;
    
    if (drillLevel === 'region') {
      const region = healthRegions.find(r => r.id === data.id);
      if (region) {
        setSelectedRegion(region);
        setDrillLevel('province');
        onDrillChange?.('province', region.id, null);
      }
    } else if (drillLevel === 'province') {
      const province = provinces.find(p => p.id === data.id);
      if (province) {
        setSelectedProvince(province);
        setDrillLevel('hospital');
        onDrillChange?.('hospital', selectedRegion?.id || null, province.id);
      }
    }
  };

  const handleBack = () => {
    if (drillLevel === 'hospital') {
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
    
    if (drillLevel === 'region') {
      return `งบประมาณรายเขตสุขภาพ ${fiscalYearLabel}`;
    }
    if (drillLevel === 'province' && selectedRegion) {
      return `งบประมาณรายจังหวัด - เขตสุขภาพที่ ${selectedRegion.region_number} ${fiscalYearLabel}`;
    }
    if (drillLevel === 'hospital' && selectedProvince) {
      return `งบประมาณรายหน่วยงาน - ${selectedProvince.name} ${fiscalYearLabel}`;
    }
    return 'งบประมาณ';
  };

  const chartData = getChartData();

  // Custom tick component for clickable X-axis labels
  const CustomXAxisTick = ({ x, y, payload }: any) => {
    const dataItem = chartData.find(d => d.name === payload.value);
    const isClickable = drillLevel !== 'hospital' && dataItem?.canDrill;
    
    return (
      <g transform={`translate(${x},${y})`}>
        <text
          x={0}
          y={0}
          dy={16}
          textAnchor="end"
          fill="hsl(var(--primary))"
          fontSize={12}
          transform="rotate(-45)"
          style={{ 
            cursor: isClickable ? 'pointer' : 'default',
            textDecoration: isClickable ? 'underline' : 'none',
            opacity: dataItem?.canDrill === false && drillLevel !== 'hospital' ? 0.4 : 1,
          }}
          onClick={() => {
            if (isClickable && dataItem) {
              handleBarClick(dataItem);
            }
          }}
        >
          {payload.value}
        </text>
      </g>
    );
  };

  const CustomTooltip = ({ active, payload }: any) => {
    if (active && payload && payload.length) {
      return (
        <div className="bg-background border rounded-lg p-3 shadow-lg">
          <p className="font-medium">{payload[0].payload.name}</p>
          <p className="text-primary">
            งบประมาณ: <span className="font-bold">{formatFullCurrency(payload[0].value)}</span> บาท
          </p>
        </div>
      );
    }
    return null;
  };

  // Calculate max value for Y-axis domain
  const maxValue = useMemo(() => {
    const max = Math.max(...chartData.map(d => d.total), 0);
    // Round up to nice number
    if (max === 0) return 100000;
    const magnitude = Math.pow(10, Math.floor(Math.log10(max)));
    return Math.ceil(max / magnitude) * magnitude;
  }, [chartData]);

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <DollarSign className="w-5 h-5" />
            {getTitle()}
          </CardTitle>
          {drillLevel !== 'region' && (
            <Button variant="outline" size="sm" onClick={handleBack}>
              <ChevronLeft className="w-4 h-4 mr-1" />
              ย้อนกลับ
            </Button>
          )}
        </div>
        {drillLevel !== 'hospital' && (
          <p className="text-sm text-muted-foreground">
            คลิกที่แท่งกราฟเพื่อดูรายละเอียด
          </p>
        )}
      </CardHeader>
      <CardContent>
        {chartData.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">ไม่พบข้อมูล</div>
        ) : (
          <div className="h-[400px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={chartData}
                margin={{ top: 20, right: 30, left: 60, bottom: 80 }}
                onClick={(state) => {
                  if (state && state.activePayload && state.activePayload.length > 0 && drillLevel !== 'hospital') {
                    handleBarClick(state.activePayload[0].payload);
                  }
                }}
              >
                <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                <XAxis 
                  dataKey="name" 
                  height={80}
                  interval={0}
                  tick={<CustomXAxisTick />}
                />
                <YAxis 
                  domain={[0, maxValue]} 
                  tick={{ fontSize: 12 }}
                  className="fill-foreground"
                  tickFormatter={(value) => formatCurrency(value)}
                  label={{ 
                    value: 'งบประมาณ (บาท)', 
                    angle: -90, 
                    position: 'insideLeft',
                    style: { textAnchor: 'middle' }
                  }}
                />
                <Tooltip content={<CustomTooltip />} />
                <Bar 
                  dataKey="total" 
                  radius={[4, 4, 0, 0]}
                  cursor="default"
                >
                  {chartData.map((entry, index) => (
                    <Cell 
                      key={`cell-${index}`} 
                      fill={entry.color} 
                      style={{ 
                        cursor: entry.canDrill ? 'pointer' : 'default',
                        opacity: entry.canDrill === false && drillLevel !== 'hospital' ? 0.4 : 1,
                      }}
                    />
                  ))}
                  <LabelList 
                    dataKey="total" 
                    position="top" 
                    formatter={(value: number) => formatCurrency(value)}
                    className="fill-foreground text-xs"
                  />
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
