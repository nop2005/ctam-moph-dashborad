import React, { useMemo, useState, useCallback } from 'react';
import { ComposableMap, Geographies, Geography, ZoomableGroup, Marker, Annotation } from 'react-simple-maps';
import { Tooltip } from '@/components/ui/tooltip';
import { TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { Button } from '@/components/ui/button';
import { ZoomIn, ZoomOut, Maximize2, Move } from 'lucide-react';

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

// Province coordinates for labels (approximate centers)
const PROVINCE_COORDINATES: Record<string, [number, number]> = {
  "กระบี่": [98.9, 8.1],
  "กรุงเทพมหานคร": [100.5, 13.75],
  "กาญจนบุรี": [99.5, 14.0],
  "กาฬสินธุ์": [103.5, 16.4],
  "กำแพงเพชร": [99.5, 16.5],
  "ขอนแก่น": [102.8, 16.4],
  "จันทบุรี": [102.1, 12.6],
  "ฉะเชิงเทรา": [101.1, 13.7],
  "ชลบุรี": [101.0, 13.4],
  "ชัยนาท": [100.1, 15.2],
  "ชัยภูมิ": [102.0, 16.0],
  "ชุมพร": [99.2, 10.5],
  "เชียงราย": [99.8, 19.9],
  "เชียงใหม่": [98.9, 18.8],
  "ตรัง": [99.6, 7.6],
  "ตราด": [102.5, 12.2],
  "ตาก": [99.0, 16.9],
  "นครนายก": [101.2, 14.2],
  "นครปฐม": [100.1, 13.8],
  "นครพนม": [104.8, 17.4],
  "นครราชสีมา": [102.1, 15.0],
  "นครศรีธรรมราช": [99.9, 8.4],
  "นครสวรรค์": [100.1, 15.7],
  "นนทบุรี": [100.5, 13.9],
  "นราธิวาส": [101.8, 6.4],
  "น่าน": [100.8, 18.8],
  "บึงกาฬ": [103.7, 18.4],
  "บุรีรัมย์": [103.1, 15.0],
  "ปทุมธานี": [100.5, 14.0],
  "ประจวบคีรีขันธ์": [99.8, 11.8],
  "ปราจีนบุรี": [101.4, 14.1],
  "ปัตตานี": [101.3, 6.9],
  "พระนครศรีอยุธยา": [100.5, 14.4],
  "พะเยา": [99.9, 19.2],
  "พังงา": [98.5, 8.5],
  "พัทลุง": [100.1, 7.6],
  "พิจิตร": [100.3, 16.4],
  "พิษณุโลก": [100.3, 16.8],
  "เพชรบุรี": [99.9, 13.1],
  "เพชรบูรณ์": [101.2, 16.4],
  "แพร่": [100.1, 18.1],
  "ภูเก็ต": [98.4, 7.9],
  "มหาสารคาม": [103.3, 16.2],
  "มุกดาหาร": [104.7, 16.5],
  "แม่ฮ่องสอน": [97.9, 19.3],
  "ยโสธร": [104.1, 15.8],
  "ยะลา": [101.3, 6.5],
  "ร้อยเอ็ด": [103.7, 16.1],
  "ระนอง": [98.6, 9.9],
  "ระยอง": [101.3, 12.7],
  "ราชบุรี": [99.8, 13.5],
  "ลพบุรี": [100.6, 14.8],
  "ลำปาง": [99.5, 18.3],
  "ลำพูน": [99.0, 18.6],
  "เลย": [101.7, 17.5],
  "ศรีสะเกษ": [104.3, 15.1],
  "สกลนคร": [104.1, 17.2],
  "สงขลา": [100.6, 7.2],
  "สตูล": [100.1, 6.6],
  "สมุทรปราการ": [100.6, 13.6],
  "สมุทรสงคราม": [100.0, 13.4],
  "สมุทรสาคร": [100.3, 13.5],
  "สระแก้ว": [102.1, 13.8],
  "สระบุรี": [100.9, 14.5],
  "สิงห์บุรี": [100.4, 14.9],
  "สุโขทัย": [99.8, 17.0],
  "สุพรรณบุรี": [100.0, 14.5],
  "สุราษฎร์ธานี": [99.3, 9.1],
  "สุรินทร์": [103.5, 14.9],
  "หนองคาย": [102.8, 17.9],
  "หนองบัวลำภู": [102.4, 17.2],
  "อ่างทอง": [100.4, 14.6],
  "อำนาจเจริญ": [104.6, 15.9],
  "อุดรธานี": [102.8, 17.4],
  "อุตรดิตถ์": [100.1, 17.6],
  "อุทัยธานี": [99.5, 15.4],
  "อุบลราชธานี": [105.0, 15.2]
};

const ThailandMap: React.FC<ThailandMapProps> = ({
  provinceData,
  selectedRegion,
  selectedProvince,
  onProvinceClick,
  healthRegions,
  provinces
}) => {
  // Zoom state for manual control
  const [zoom, setZoom] = useState(1);
  const [center, setCenter] = useState<[number, number]>([100.5, 13.75]);
  const [isPanning, setIsPanning] = useState(false);

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

  // Get province names to display on map
  const provincesToLabel = useMemo(() => {
    if (selectedProvince !== 'all') {
      // Show only the selected province name
      const province = provinces.find(p => p.id === selectedProvince);
      if (province) {
        return [province.name];
      }
      return [];
    }
    
    if (selectedRegion !== 'all') {
      // Show all provinces in the selected region
      return provinces
        .filter(p => p.health_region_id === selectedRegion)
        .map(p => p.name);
    }
    
    return [];
  }, [selectedRegion, selectedProvince, provinces]);

  // Calculate center and zoom based on selection
  const mapSettings = useMemo(() => {
    if (selectedProvince !== 'all') {
      // Zoom to specific province
      const province = provinces.find(p => p.id === selectedProvince);
      if (province && PROVINCE_COORDINATES[province.name]) {
        return { 
          center: PROVINCE_COORDINATES[province.name] as [number, number], 
          zoom: 5 
        };
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

  // Sync state when mapSettings change
  React.useEffect(() => {
    setZoom(mapSettings.zoom);
    setCenter(mapSettings.center);
  }, [mapSettings]);

  // Calculate font size based on zoom level
  const getFontSize = useCallback((baseSize: number = 8) => {
    const size = baseSize * Math.max(0.5, Math.min(2, zoom / 2));
    return Math.max(4, Math.min(14, size));
  }, [zoom]);

  // Map control handlers
  const handleZoomIn = useCallback(() => {
    setZoom(prev => Math.min(8, prev * 1.5));
  }, []);

  const handleZoomOut = useCallback(() => {
    setZoom(prev => Math.max(0.5, prev / 1.5));
  }, []);

  const handleFitToScreen = useCallback(() => {
    setZoom(mapSettings.zoom);
    setCenter(mapSettings.center);
  }, [mapSettings]);

  const togglePanning = useCallback(() => {
    setIsPanning(prev => !prev);
  }, []);

  const [hoveredProvince, setHoveredProvince] = useState<string | null>(null);
  const [tooltipContent, setTooltipContent] = useState<{
    name: string;
    percentage: number | null;
    total: number;
    passed: number;
    assessed: number;
  } | null>(null);

  return (
    <TooltipProvider>
      <div className="relative w-full h-full min-h-[400px]">
        {/* Map Controls - Top Right */}
        <div className="absolute top-2 right-2 z-10 flex flex-col gap-1 bg-background/95 border border-border rounded-lg p-1 shadow-md">
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8"
            onClick={handleZoomIn}
            title="ซูมเข้า"
          >
            <ZoomIn className="h-4 w-4" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8"
            onClick={handleZoomOut}
            title="ซูมออก"
          >
            <ZoomOut className="h-4 w-4" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8"
            onClick={handleFitToScreen}
            title="พอดีจอ"
          >
            <Maximize2 className="h-4 w-4" />
          </Button>
          <Button
            variant={isPanning ? "default" : "ghost"}
            size="icon"
            className="h-8 w-8"
            onClick={togglePanning}
            title="ขยับแผนที่"
          >
            <Move className="h-4 w-4" />
          </Button>
        </div>

        <ComposableMap
          projection="geoMercator"
          projectionConfig={{
            scale: 2200,
            center: mapSettings.center
          }}
          className="w-full h-full"
        >
          <ZoomableGroup
            center={center}
            zoom={zoom}
            minZoom={0.5}
            maxZoom={8}
            onMoveEnd={({ coordinates, zoom: newZoom }) => {
              setCenter(coordinates as [number, number]);
              setZoom(newZoom);
            }}
            filterZoomEvent={(evt) => isPanning || evt.type === "wheel"}
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

            {/* Province Labels */}
            {provincesToLabel.map(provinceName => {
              const coords = PROVINCE_COORDINATES[provinceName];
              if (!coords) return null;
              
              return (
                <Marker key={provinceName} coordinates={coords}>
                  <text
                    textAnchor="middle"
                    style={{
                      fontFamily: "'Noto Sans Thai', sans-serif",
                      fontSize: `${getFontSize(8)}px`,
                      fill: '#1e293b',
                      fontWeight: 500,
                      textShadow: '1px 1px 2px rgba(255,255,255,0.8), -1px -1px 2px rgba(255,255,255,0.8)',
                      pointerEvents: 'none'
                    }}
                    dy={2}
                  >
                    {provinceName}
                  </text>
                </Marker>
              );
            })}
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
