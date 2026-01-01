import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell, LabelList } from 'recharts';
import { BarChart3, ChevronLeft } from 'lucide-react';

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

interface Assessment {
  id: string;
  hospital_id: string;
  total_score: number | null;
  fiscal_year: number;
  assessment_period: string;
}

export type DrillLevel = 'region' | 'province' | 'hospital';

interface ScoreChartProps {
  healthRegions: HealthRegion[];
  provinces: Province[];
  hospitals: Hospital[];
  assessments: Assessment[];
  onDrillChange?: (level: DrillLevel, regionId: string | null, provinceId: string | null) => void;
  selectedFiscalYear?: string;
}


interface ChartData {
  id: string;
  name: string;
  score: number;
  color: string;
}

const COLORS = [
  '#60A5FA', // blue
  '#F97316', // orange
  '#22C55E', // green
  '#FBBF24', // yellow
  '#06B6D4', // cyan
  '#EC4899', // pink
  '#8B5CF6', // violet
  '#10B981', // emerald
  '#EF4444', // red
  '#3B82F6', // blue-500
  '#A855F7', // purple
  '#14B8A6', // teal
  '#F59E0B', // amber
];

export function ScoreChart({ healthRegions, provinces, hospitals, assessments, onDrillChange, selectedFiscalYear }: ScoreChartProps) {
  const [drillLevel, setDrillLevel] = useState<DrillLevel>('region');
  const [selectedRegion, setSelectedRegion] = useState<HealthRegion | null>(null);
  const [selectedProvince, setSelectedProvince] = useState<Province | null>(null);

  // Helper function to get the latest assessment for each hospital
  const getLatestAssessmentPerHospital = (allAssessments: Assessment[]): Assessment[] => {
    const latestMap = new Map<string, Assessment>();
    
    for (const assessment of allAssessments) {
      const existing = latestMap.get(assessment.hospital_id);
      if (!existing) {
        latestMap.set(assessment.hospital_id, assessment);
      } else {
        // Compare by fiscal_year first, then by assessment_period
        if (
          assessment.fiscal_year > existing.fiscal_year ||
          (assessment.fiscal_year === existing.fiscal_year && 
           assessment.assessment_period > existing.assessment_period)
        ) {
          latestMap.set(assessment.hospital_id, assessment);
        }
      }
    }
    
    return Array.from(latestMap.values());
  };

  // Get latest assessments only
  const latestAssessments = getLatestAssessmentPerHospital(assessments);

  // Calculate average score for a set of hospital IDs (using latest assessments)
  const calculateAverageScore = (hospitalIds: string[]): number => {
    const relevantAssessments = latestAssessments.filter(a => 
      hospitalIds.includes(a.hospital_id) && a.total_score !== null
    );
    
    if (relevantAssessments.length === 0) return 0;
    
    // Return average of latest scores
    const sum = relevantAssessments.reduce((acc, a) => acc + (a.total_score || 0), 0);
    return sum / relevantAssessments.length;
  };

  // Get data based on drill level
  const getChartData = (): ChartData[] => {
    if (drillLevel === 'region') {
      return healthRegions.map((region, index) => {
        const regionProvinces = provinces.filter(p => p.health_region_id === region.id);
        const regionHospitals = hospitals.filter(h => 
          regionProvinces.some(p => p.id === h.province_id)
        );
        const hospitalIds = regionHospitals.map(h => h.id);
        
        return {
          id: region.id,
          name: `เขต ${region.region_number}`,
          score: calculateAverageScore(hospitalIds),
          color: COLORS[index % COLORS.length],
        };
      });
    }

    if (drillLevel === 'province' && selectedRegion) {
      const regionProvinces = provinces.filter(p => p.health_region_id === selectedRegion.id);
      
      return regionProvinces.map((province, index) => {
        const provinceHospitals = hospitals.filter(h => h.province_id === province.id);
        const hospitalIds = provinceHospitals.map(h => h.id);
        
        return {
          id: province.id,
          name: province.name,
          score: calculateAverageScore(hospitalIds),
          color: COLORS[index % COLORS.length],
        };
      });
    }

    if (drillLevel === 'hospital' && selectedProvince) {
      const provinceHospitals = hospitals.filter(h => h.province_id === selectedProvince.id);
      
      return provinceHospitals.map((hospital, index) => {
        const assessment = latestAssessments.find(a => a.hospital_id === hospital.id);
        
        return {
          id: hospital.id,
          name: hospital.name,
          score: assessment?.total_score || 0,
          color: COLORS[index % COLORS.length],
        };
      });
    }

    return [];
  };

  const handleBarClick = (data: ChartData) => {
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
    const fiscalYearLabel = selectedFiscalYear && selectedFiscalYear !== 'all' 
      ? `(ปีงบประมาณ ${parseInt(selectedFiscalYear) + 543})` 
      : '(ทุกปีงบประมาณ)';
    
    if (drillLevel === 'region') {
      return `คะแนนรวมรายเขตสุขภาพ ${fiscalYearLabel}`;
    }
    if (drillLevel === 'province' && selectedRegion) {
      return `คะแนนรวมรายจังหวัด - เขตสุขภาพที่ ${selectedRegion.region_number} ${fiscalYearLabel}`;
    }
    if (drillLevel === 'hospital' && selectedProvince) {
      return `คะแนนรายโรงพยาบาล - ${selectedProvince.name} ${fiscalYearLabel}`;
    }
    return 'คะแนนรวม';
  };

  const chartData = getChartData();

  // Custom tick component for clickable X-axis labels
  const CustomXAxisTick = ({ x, y, payload }: any) => {
    const dataItem = chartData.find(d => d.name === payload.value);
    const isClickable = drillLevel !== 'hospital';
    
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
            คะแนน: <span className="font-bold">{payload[0].value.toFixed(2)}</span> / 10
          </p>
        </div>
      );
    }
    return null;
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <BarChart3 className="w-5 h-5" />
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
                margin={{ top: 20, right: 30, left: 20, bottom: 60 }}
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
                  domain={[0, 10]} 
                  tick={{ fontSize: 12 }}
                  className="fill-foreground"
                  label={{ 
                    value: 'คะแนน', 
                    angle: -90, 
                    position: 'insideLeft',
                    style: { textAnchor: 'middle' }
                  }}
                />
                <Tooltip content={<CustomTooltip />} />
                <Bar 
                  dataKey="score" 
                  radius={[4, 4, 0, 0]}
                  cursor={drillLevel !== 'hospital' ? 'pointer' : 'default'}
                >
                  {chartData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                  <LabelList 
                    dataKey="score" 
                    position="top" 
                    formatter={(value: number) => value.toFixed(2)}
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
