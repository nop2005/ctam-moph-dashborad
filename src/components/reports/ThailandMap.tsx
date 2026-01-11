import React, { useMemo } from 'react';
import { ComposableMap, Geographies, Geography, ZoomableGroup } from 'react-simple-maps';
import { Tooltip } from '@/components/ui/tooltip';
import { TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';

// Thailand province boundaries - simplified GeoJSON
const THAILAND_TOPO_URL = "https://raw.githubusercontent.com/apisit/thailand.json/master/thailand.json";

// Province code to name mapping (for matching with database)
const PROVINCE_NAME_MAP: Record<string, string> = {
  "Krabi": "กระบี่",
  "Bangkok": "กรุงเทพมหานคร",
  "Kanchanaburi": "กาญจนบุรี",
  "Kalasin": "กาฬสินธุ์",
  "Kamphaeng Phet": "กำแพงเพชร",
  "Khon Kaen": "ขอนแก่น",
  "Chanthaburi": "จันทบุรี",
  "Chachoengsao": "ฉะเชิงเทรา",
  "Chon Buri": "ชลบุรี",
  "Chai Nat": "ชัยนาท",
  "Chaiyaphum": "ชัยภูมิ",
  "Chumphon": "ชุมพร",
  "Chiang Rai": "เชียงราย",
  "Chiang Mai": "เชียงใหม่",
  "Trang": "ตรัง",
  "Trat": "ตราด",
  "Tak": "ตาก",
  "Nakhon Nayok": "นครนายก",
  "Nakhon Pathom": "นครปฐม",
  "Nakhon Phanom": "นครพนม",
  "Nakhon Ratchasima": "นครราชสีมา",
  "Nakhon Si Thammarat": "นครศรีธรรมราช",
  "Nakhon Sawan": "นครสวรรค์",
  "Nonthaburi": "นนทบุรี",
  "Narathiwat": "นราธิวาส",
  "Nan": "น่าน",
  "Bueng Kan": "บึงกาฬ",
  "Buri Ram": "บุรีรัมย์",
  "Pathum Thani": "ปทุมธานี",
  "Prachuap Khiri Khan": "ประจวบคีรีขันธ์",
  "Prachin Buri": "ปราจีนบุรี",
  "Pattani": "ปัตตานี",
  "Phra Nakhon Si Ayutthaya": "พระนครศรีอยุธยา",
  "Ayutthaya": "พระนครศรีอยุธยา",
  "Phayao": "พะเยา",
  "Phangnga": "พังงา",
  "Phang Nga": "พังงา",
  "Phatthalung": "พัทลุง",
  "Phichit": "พิจิตร",
  "Phitsanulok": "พิษณุโลก",
  "Phetchaburi": "เพชรบุรี",
  "Phetchabun": "เพชรบูรณ์",
  "Phrae": "แพร่",
  "Phuket": "ภูเก็ต",
  "Maha Sarakham": "มหาสารคาม",
  "Mukdahan": "มุกดาหาร",
  "Mae Hong Son": "แม่ฮ่องสอน",
  "Yasothon": "ยโสธร",
  "Yala": "ยะลา",
  "Roi Et": "ร้อยเอ็ด",
  "Ranong": "ระนอง",
  "Rayong": "ระยอง",
  "Ratchaburi": "ราชบุรี",
  "Lop Buri": "ลพบุรี",
  "Lopburi": "ลพบุรี",
  "Lampang": "ลำปาง",
  "Lamphun": "ลำพูน",
  "Loei": "เลย",
  "Si Sa Ket": "ศรีสะเกษ",
  "Sisaket": "ศรีสะเกษ",
  "Sakon Nakhon": "สกลนคร",
  "Songkhla": "สงขลา",
  "Satun": "สตูล",
  "Samut Prakan": "สมุทรปราการ",
  "Samut Songkhram": "สมุทรสงคราม",
  "Samut Sakhon": "สมุทรสาคร",
  "Sa Kaeo": "สระแก้ว",
  "Saraburi": "สระบุรี",
  "Sing Buri": "สิงห์บุรี",
  "Sukhothai": "สุโขทัย",
  "Suphan Buri": "สุพรรณบุรี",
  "Surat Thani": "สุราษฎร์ธานี",
  "Surin": "สุรินทร์",
  "Nong Khai": "หนองคาย",
  "Nong Bua Lam Phu": "หนองบัวลำภู",
  "Nong Bua Lamphu": "หนองบัวลำภู",
  "Ang Thong": "อ่างทอง",
  "Amnat Charoen": "อำนาจเจริญ",
  "Udon Thani": "อุดรธานี",
  "Uttaradit": "อุตรดิตถ์",
  "Uthai Thani": "อุทัยธานี",
  "Ubon Ratchathani": "อุบลราชธานี"
};

export interface ProvinceData {
  id: string;
  name: string;
  passedPercentage: number | null;
  totalUnits: number;
  passedAll17: number;
  assessed: number;
  healthRegionId: string;
}

export interface ThailandMapProps {
  provinceData: ProvinceData[];
  selectedRegion: string;
  selectedProvince: string;
  onProvinceClick?: (provinceId: string) => void;
  healthRegions: { id: string; region_number: number }[];
  provinces: { id: string; name: string; health_region_id: string }[];
}

const getProvinceColor = (passedPercentage: number | null, isSelected: boolean) => {
  if (passedPercentage === null) return '#9ca3af'; // Gray - no data
  if (passedPercentage === 100) return '#22c55e'; // Green - 100%
  if (passedPercentage >= 50) return '#eab308'; // Yellow - 50-99%
  return '#ef4444'; // Red - <50%
};

const ThailandMap: React.FC<ThailandMapProps> = ({
  provinceData,
  selectedRegion,
  selectedProvince,
  onProvinceClick,
  healthRegions,
  provinces
}) => {
  // Create a map from Thai province name to province data
  const provinceDataMap = useMemo(() => {
    const map = new Map<string, ProvinceData>();
    provinceData.forEach(p => {
      map.set(p.name, p);
    });
    return map;
  }, [provinceData]);

  // Get province IDs for the selected region to highlight/filter
  const regionProvinceIds = useMemo(() => {
    if (selectedRegion === 'all') return new Set<string>();
    return new Set(provinces.filter(p => p.health_region_id === selectedRegion).map(p => p.id));
  }, [selectedRegion, provinces]);

  // Calculate center and zoom based on selection
  const mapSettings = useMemo(() => {
    if (selectedProvince !== 'all') {
      // Zoom to specific province - we'd need province coordinates
      // For now, just zoom to region if available
      const province = provinces.find(p => p.id === selectedProvince);
      if (province) {
        // Get approximate center based on region
        const region = healthRegions.find(r => r.id === province.health_region_id);
        // Return default thailand view for now
        return { center: [100.5, 13.75] as [number, number], zoom: 1 };
      }
    }
    
    if (selectedRegion !== 'all') {
      // Zoom based on health region
      const region = healthRegions.find(r => r.id === selectedRegion);
      if (region) {
        const regionNumber = region.region_number;
        // Approximate centers for each health region
        const regionCenters: Record<number, { center: [number, number], zoom: number }> = {
          1: { center: [99.8, 18.5], zoom: 2.5 }, // Chiang Mai region
          2: { center: [100.2, 17.2], zoom: 2.5 }, // Phitsanulok region
          3: { center: [100.8, 14.5], zoom: 2.8 }, // Nakhon Sawan region
          4: { center: [100.5, 14.3], zoom: 2.8 }, // Saraburi region
          5: { center: [99.5, 13.5], zoom: 2.8 }, // Ratchaburi region
          6: { center: [101.8, 13.2], zoom: 2.8 }, // Rayong region
          7: { center: [102.8, 15.0], zoom: 2.5 }, // Khon Kaen region
          8: { center: [104.0, 16.0], zoom: 2.5 }, // Udon Thani region
          9: { center: [104.5, 15.2], zoom: 2.5 }, // Nakhon Ratchasima region
          10: { center: [105.0, 15.0], zoom: 2.5 }, // Ubon Ratchathani region
          11: { center: [99.0, 9.0], zoom: 2.5 }, // Surat Thani region
          12: { center: [100.5, 7.5], zoom: 2.5 }, // Songkhla region
          13: { center: [100.5, 13.75], zoom: 4 }, // Bangkok region
        };
        return regionCenters[regionNumber] || { center: [100.5, 13.75] as [number, number], zoom: 1 };
      }
    }
    
    // Default: show all Thailand
    return { center: [100.5, 13.75] as [number, number], zoom: 1 };
  }, [selectedRegion, selectedProvince, healthRegions, provinces]);

  const [hoveredProvince, setHoveredProvince] = React.useState<string | null>(null);
  const [tooltipContent, setTooltipContent] = React.useState<{
    name: string;
    percentage: number | null;
    total: number;
    passed: number;
    assessed: number;
  } | null>(null);

  return (
    <TooltipProvider>
      <div className="relative w-full h-full min-h-[400px]">
        <ComposableMap
          projection="geoMercator"
          projectionConfig={{
            scale: 2200,
            center: mapSettings.center
          }}
          className="w-full h-full"
        >
          <ZoomableGroup
            center={mapSettings.center}
            zoom={mapSettings.zoom}
            minZoom={0.5}
            maxZoom={8}
          >
            <Geographies geography={THAILAND_TOPO_URL}>
              {({ geographies }) =>
                geographies.map((geo) => {
                  const geoName = geo.properties?.name || geo.properties?.NAME_1 || '';
                  const thaiName = PROVINCE_NAME_MAP[geoName] || geoName;
                  const data = provinceDataMap.get(thaiName);
                  
                  // Check if this province is in the selected region
                  const isInSelectedRegion = selectedRegion === 'all' || 
                    (data && regionProvinceIds.has(data.id));
                  
                  // Dim provinces not in the selected region
                  const opacity = selectedRegion === 'all' || isInSelectedRegion ? 1 : 0.2;
                  
                  const isSelected = selectedProvince !== 'all' && data?.id === selectedProvince;
                  const fillColor = data 
                    ? getProvinceColor(data.passedPercentage, isSelected)
                    : '#9ca3af';

                  return (
                    <Geography
                      key={geo.rsmKey}
                      geography={geo}
                      fill={fillColor}
                      stroke="#ffffff"
                      strokeWidth={isSelected ? 2 : 0.5}
                      style={{
                        default: {
                          opacity,
                          outline: 'none',
                        },
                        hover: {
                          opacity: 1,
                          outline: 'none',
                          cursor: data && isInSelectedRegion ? 'pointer' : 'default',
                        },
                        pressed: {
                          opacity: 0.9,
                          outline: 'none',
                        },
                      }}
                      onMouseEnter={() => {
                        if (data) {
                          setHoveredProvince(thaiName);
                          setTooltipContent({
                            name: thaiName,
                            percentage: data.passedPercentage,
                            total: data.totalUnits,
                            passed: data.passedAll17,
                            assessed: data.assessed
                          });
                        }
                      }}
                      onMouseLeave={() => {
                        setHoveredProvince(null);
                        setTooltipContent(null);
                      }}
                      onClick={() => {
                        if (data && isInSelectedRegion && onProvinceClick) {
                          onProvinceClick(data.id);
                        }
                      }}
                    />
                  );
                })
              }
            </Geographies>
          </ZoomableGroup>
        </ComposableMap>

        {/* Tooltip */}
        {tooltipContent && (
          <div 
            className="absolute bg-popover text-popover-foreground border border-border rounded-lg shadow-lg p-3 text-sm pointer-events-none z-50"
            style={{
              left: '50%',
              top: '10px',
              transform: 'translateX(-50%)',
            }}
          >
            <div className="font-semibold text-base mb-1">{tooltipContent.name}</div>
            <div className="space-y-1 text-xs">
              <div className="flex justify-between gap-4">
                <span className="text-muted-foreground">หน่วยบริการทั้งหมด:</span>
                <span className="font-medium">{tooltipContent.total}</span>
              </div>
              <div className="flex justify-between gap-4">
                <span className="text-muted-foreground">ประเมินแล้ว:</span>
                <span className="font-medium">{tooltipContent.assessed}</span>
              </div>
              <div className="flex justify-between gap-4">
                <span className="text-muted-foreground">ผ่านครบ 17 ข้อ:</span>
                <span className="font-medium text-green-600">{tooltipContent.passed}</span>
              </div>
              {tooltipContent.percentage !== null && (
                <div className="flex justify-between gap-4">
                  <span className="text-muted-foreground">ร้อยละผ่าน:</span>
                  <span className={`font-medium ${
                    tooltipContent.percentage === 100 ? 'text-green-600' :
                    tooltipContent.percentage >= 50 ? 'text-yellow-600' :
                    'text-red-600'
                  }`}>
                    {tooltipContent.percentage.toFixed(1)}%
                  </span>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Map Legend */}
        <div className="absolute bottom-2 left-2 bg-background/95 border border-border rounded-lg p-2 text-xs space-y-1">
          <div className="font-medium mb-1">สัญลักษณ์</div>
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded bg-green-500" />
            <span>ผ่าน 100%</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded bg-yellow-500" />
            <span>ผ่าน 50-99%</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded bg-red-500" />
            <span>ผ่าน &lt;50%</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded bg-gray-400" />
            <span>ยังไม่ประเมิน</span>
          </div>
        </div>
      </div>
    </TooltipProvider>
  );
};

export default ThailandMap;
