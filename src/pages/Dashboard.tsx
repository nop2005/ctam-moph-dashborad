import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { 
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { 
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { 
  FileText, 
  CheckCircle2, 
  Clock, 
  AlertTriangle,
  Plus,
  Eye,
  Loader2,
  RotateCcw,
  Mail,
  CheckSquare,
  Square,
  Download,
  Trash2,
  Pencil,
} from 'lucide-react';
import { Switch } from '@/components/ui/switch';
import { BannerCarousel } from '@/components/BannerCarousel';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Search, X, ChevronLeft, ChevronRight } from 'lucide-react';
import { format } from 'date-fns';
import { th } from 'date-fns/locale';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import type { Database } from '@/integrations/supabase/types';
import { useCertificatePdf } from '@/hooks/useCertificatePdf';


type Assessment = Database['public']['Tables']['assessments']['Row'];
type Hospital = Database['public']['Tables']['hospitals']['Row'];
type HealthOffice = Database['public']['Tables']['health_offices']['Row'];

interface AssessmentStats {
  total: number;
  draft: number;
  waitingProvincial: number;
  waitingRegional: number;
  approved: number;
  returned: number;
  neverSubmitted: number;
}

const statusLabels: Record<string, { label: string; className: string }> = {
  draft: { label: 'ร่าง', className: 'status-draft' },
  submitted: { label: 'รอตรวจสอบ', className: 'status-submitted' },
  approved_provincial: { label: 'สสจ.อนุมัติ', className: 'bg-info/10 text-info' },
  approved_regional: { label: 'เขตอนุมัติ', className: 'status-approved' },
  returned: { label: 'ตีกลับแก้ไข', className: 'status-returned' },
  completed: { label: 'เสร็จสิ้น', className: 'status-completed' },
};

// คำนวณปีงบประมาณปัจจุบัน (ถ้าเดือน >= ตุลาคม จะเป็นปีงบถัดไป)
const getCurrentFiscalYear = () => {
  const now = new Date();
  const month = now.getMonth(); // 0-11
  const year = now.getFullYear();
  return month >= 9 ? year + 1 : year; // ตุลาคมขึ้นไป = ปีงบถัดไป
};

// ---- In-memory cache เพื่อกัน remount แล้วโหลดใหม่ทุกครั้ง ----
// ใช้ร่วมกับเป้าหมาย: staleTime 60s, gcTime ~10m
const DASHBOARD_STALE_MS = 60_000;
const DASHBOARD_CACHE_MS = 10 * 60_000;

type DashboardCacheEntry = {
  ts: number;
  stats: AssessmentStats;
  assessments: (Assessment & { hospitals?: Hospital; health_offices?: HealthOffice })[];
  hospitals: Hospital[];
  healthOffice: HealthOffice | null;
};

const dashboardCache = new Map<string, DashboardCacheEntry>();
let fiscalYearsCache: { ts: number; years: number[] } | null = null;

// Export function to invalidate dashboard cache from other pages
export const invalidateDashboardCache = () => {
  dashboardCache.clear();
  fiscalYearsCache = null;
};

const getDashboardCacheKey = (p: any, fiscalYear: string) =>
  [p?.role, p?.province_id, p?.health_region_id, p?.hospital_id, p?.health_office_id, fiscalYear].join('|');

// Helper: ดึง cache แบบ sync สำหรับ initial state (เพื่อไม่ให้หมุน spinner ตอนสลับแท็บ)
const getInitialCacheState = (profile: any, fiscalYear: string) => {
  if (!profile) return null;
  const cacheKey = getDashboardCacheKey(profile, fiscalYear);
  const cached = dashboardCache.get(cacheKey);
  if (cached && Date.now() - cached.ts < DASHBOARD_CACHE_MS) {
    return cached;
  }
  return null;
};

export default function Dashboard() {
  const navigate = useNavigate();
  const { user, profile } = useAuth();
  const { toast } = useToast();

  // กำหนดปีงบประมาณเริ่มต้นก่อน เพื่อใช้ใน initial cache lookup
  const initialFiscalYear = getCurrentFiscalYear().toString();
  
  // ลอง hydrate จาก cache ทันที (sync) เพื่อไม่ให้มี spinner ตอนกลับมาจากแท็บอื่น
  const initialCache = getInitialCacheState(profile, initialFiscalYear);
  
  const [stats, setStats] = useState<AssessmentStats>(
    initialCache?.stats ?? {
      total: 0,
      draft: 0,
      waitingProvincial: 0,
      waitingRegional: 0,
      approved: 0,
      returned: 0,
      neverSubmitted: 0,
    }
  );
  // ถ้ามี cache -> loading = false ตั้งแต่แรก
  const [loading, setLoading] = useState(!initialCache);
  const [isRefetching, setIsRefetching] = useState(false); // สำหรับ background refresh
  const [selectedFiscalYear, setSelectedFiscalYear] = useState<string>(initialFiscalYear);
  const [fiscalYears, setFiscalYears] = useState<number[]>(
    fiscalYearsCache ? fiscalYearsCache.years : []
  );

  // Assessment list state - hydrate จาก cache ถ้ามี
  const [assessments, setAssessments] = useState<(Assessment & { hospitals?: Hospital; health_offices?: HealthOffice })[]>(
    initialCache?.assessments ?? []
  );
  const [hospitals, setHospitals] = useState<Hospital[]>(initialCache?.hospitals ?? []);
  const [healthOffice, setHealthOffice] = useState<HealthOffice | null>(initialCache?.healthOffice ?? null);
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [selectedHospital, setSelectedHospital] = useState<string>('');
  const [selectedYear, setSelectedYear] = useState<string>(new Date().getFullYear().toString());
  const [creating, setCreating] = useState(false);
  const [nextPeriod, setNextPeriod] = useState<string>('1');
  const [statusFilter, setStatusFilter] = useState<string | null>(null);
  const [dataUpdatedFilter, setDataUpdatedFilter] = useState<string>('all'); // 'all' | 'updated' | 'not_updated'
  
  // Return for revision dialog state
  const [returnDialogOpen, setReturnDialogOpen] = useState(false);
  const [selectedAssessmentForReturn, setSelectedAssessmentForReturn] = useState<(Assessment & { hospitals?: Hospital; health_offices?: HealthOffice }) | null>(null);
  const [returnComment, setReturnComment] = useState('');

  // Regional admin edit confirmation dialog state
  const [regionalEditDialogOpen, setRegionalEditDialogOpen] = useState(false);
  const [selectedAssessmentForEdit, setSelectedAssessmentForEdit] = useState<(Assessment & { hospitals?: Hospital; health_offices?: HealthOffice }) | null>(null);
  const [returning, setReturning] = useState(false);

  // Email sending state (for regional admin)
  const [selectedAssessmentIds, setSelectedAssessmentIds] = useState<Set<string>>(new Set());
  const [emailDialogOpen, setEmailDialogOpen] = useState(false);
  const [sendingEmail, setSendingEmail] = useState(false);
  const [emailSentFilter, setEmailSentFilter] = useState<string>('all'); // 'all' | 'sent' | 'not_sent'

  // Search and additional filters
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [provinceFilter, setProvinceFilter] = useState<string>('all');
  const [regionFilter, setRegionFilter] = useState<string>('all');
  const [provincesList, setProvincesList] = useState<{ id: string; name: string; health_region_id: string }[]>([]);
  const [regionsList, setRegionsList] = useState<{ id: string; region_number: number; name: string }[]>([]);

  // Pagination
  const [pageSize, setPageSize] = useState<number>(20);
  const [currentPage, setCurrentPage] = useState<number>(1);

  // Certificate PDF generation
  const { isGenerating: isGeneratingCertificate, fetchAndGenerateCertificate } = useCertificatePdf();

  const currentYear = new Date().getFullYear();
  const years = [currentYear - 1, currentYear, currentYear + 1];

  // Fetch available fiscal years (cache 10 นาที เพื่อกันยิงซ้ำตอนสลับหน้า/แท็บ)
  useEffect(() => {
    const now = Date.now();
    if (fiscalYearsCache && now - fiscalYearsCache.ts < DASHBOARD_CACHE_MS) {
      setFiscalYears(fiscalYearsCache.years);
      return;
    }

    const fetchFiscalYears = async () => {
      const { data, error } = await supabase
        .from('assessments')
        .select('fiscal_year');

      if (!error && data) {
        const uniqueYears = [...new Set(data.map(a => a.fiscal_year))].sort((a, b) => b - a);
        fiscalYearsCache = { ts: Date.now(), years: uniqueYears };
        setFiscalYears(uniqueYears);
      }
    };

    fetchFiscalYears();
  }, []);

  // Fetch provinces and regions for filters
  useEffect(() => {
    const fetchPlaces = async () => {
      const [{ data: provs }, { data: regs }] = await Promise.all([
        supabase.from('provinces').select('id, name, health_region_id').order('name'),
        supabase.from('health_regions').select('id, region_number, name').order('region_number'),
      ]);
      if (provs) setProvincesList(provs);
      if (regs) setRegionsList(regs);
    };
    fetchPlaces();
  }, []);

  // Reset to first page when filters change
  useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery, provinceFilter, regionFilter, statusFilter, dataUpdatedFilter, emailSentFilter, selectedFiscalYear, pageSize]);

  useEffect(() => {
    let cancelled = false;

    const fetchData = async () => {
      if (!profile) {
        // ถ้า profile ยังไม่มา แต่เรามี cache อยู่แล้ว ก็ไม่ต้องแสดง spinner
        // (สลับแท็บกลับมา auth อาจยังไม่ hydrate profile แต่ UI ควรแสดงข้อมูลเก่าได้)
        return;
      }

      const cacheKey = getDashboardCacheKey(profile, selectedFiscalYear);
      const now = Date.now();
      const cached = dashboardCache.get(cacheKey);

      // เก็บค่าล่าสุดไว้ในตัวแปร local เพื่อเขียนลง cache ได้ถูกต้อง (กัน state async ทำให้ cache เป็น 0)
      let nextCacheStats: AssessmentStats = cached?.stats ?? stats;
      let nextCacheAssessments: (Assessment & { hospitals?: Hospital; health_offices?: HealthOffice })[] =
        cached?.assessments ?? assessments;
      let nextCacheHospitals: Hospital[] = cached?.hospitals ?? hospitals;
      let nextCacheHealthOffice: HealthOffice | null = cached?.healthOffice ?? healthOffice;

      // 1) Hydrate จาก cache ทันที เพื่อไม่ให้หน้า "หมุน" ทุกครั้งที่สลับแท็บ/สลับเมนู
      if (cached && now - cached.ts < DASHBOARD_CACHE_MS) {
        nextCacheStats = cached.stats;
        nextCacheAssessments = cached.assessments;
        nextCacheHospitals = cached.hospitals;
        nextCacheHealthOffice = cached.healthOffice;

        setStats(cached.stats);
        setAssessments(cached.assessments);
        setHospitals(cached.hospitals);
        setHealthOffice(cached.healthOffice);
        setLoading(false);

        // 2) ถ้ายังไม่ stale (60s) ก็ไม่ต้องยิง API ซ้ำเลย
        if (now - cached.ts < DASHBOARD_STALE_MS) {
          return;
        }
      }

      try {
        // Full-page spinner เฉพาะครั้งแรกจริง ๆ (ไม่มี cache หรือ cache หมดอายุ)
        // สำคัญ: ไม่ setLoading(true) ถ้ามี data อยู่แล้ว เพื่อกัน spinner ตอนสลับแท็บ
        const hasExistingData = nextCacheAssessments.length > 0 || nextCacheStats.total > 0;
        if (!cached && !hasExistingData) {
          setLoading(true);
        } else if (cached) {
          setIsRefetching(true);
        }

        // Build query for stats - include hospital/health_office for filtering
        let statsQuery = supabase
          .from('assessments')
          .select('id, status, fiscal_year, hospital_id, health_office_id, hospitals(province_id, provinces(health_region_id)), health_offices(province_id, health_region_id)');

        // Filter by fiscal year if not "all"
        if (selectedFiscalYear !== 'all') {
          statsQuery = statsQuery.eq('fiscal_year', parseInt(selectedFiscalYear));
        }

        const { data: statsData, error: statsError } = await statsQuery;

        if (statsError) {
          console.error('Error fetching stats:', statsError);
        } else if (statsData) {
          // Filter stats based on user role and scope
          let filteredStats = statsData;
          
          if (profile?.role === 'provincial' && profile.province_id) {
            // Provincial: only count assessments from their province
            filteredStats = statsData.filter(a => {
              if (a.hospital_id && a.hospitals) {
                return (a.hospitals as any).province_id === profile.province_id;
              }
              if (a.health_office_id && a.health_offices) {
                return (a.health_offices as any).province_id === profile.province_id;
              }
              return false;
            });
          } else if (profile?.role === 'regional' && profile.health_region_id) {
            // Regional: count all assessments from their region
            filteredStats = statsData.filter(a => {
              if (a.hospital_id && a.hospitals && (a.hospitals as any).provinces) {
                return (a.hospitals as any).provinces.health_region_id === profile.health_region_id;
              }
              if (a.health_office_id && a.health_offices) {
                return (a.health_offices as any).health_region_id === profile.health_region_id;
              }
              return false;
            });
          } else if (profile?.role === 'supervisor' && profile.health_region_id) {
            // Supervisor: same as regional
            filteredStats = statsData.filter(a => {
              if (a.hospital_id && a.hospitals && (a.hospitals as any).provinces) {
                return (a.hospitals as any).provinces.health_region_id === profile.health_region_id;
              }
              if (a.health_office_id && a.health_offices) {
                return (a.health_offices as any).health_region_id === profile.health_region_id;
              }
              return false;
            });
          } else if (profile?.role === 'hospital_it' && profile.hospital_id) {
            // Hospital IT: only their hospital
            filteredStats = statsData.filter(a => a.hospital_id === profile.hospital_id);
          } else if (profile?.role === 'health_office' && profile.health_office_id) {
            // Health office: only their office + hospitals in their province
            filteredStats = statsData.filter(a => {
              if (a.health_office_id === profile.health_office_id) return true;
              if (a.hospital_id && a.hospitals) {
                return (a.hospitals as any).province_id === profile.province_id;
              }
              return false;
            });
          }
          // central_admin sees everything (no filter)

          const total = filteredStats.length;
          const draft = filteredStats.filter(a => a.status === 'draft').length;
          const waitingProvincial = filteredStats.filter(a => a.status === 'submitted').length;
          const waitingRegional = filteredStats.filter(a => a.status === 'approved_provincial').length;
          const approved = filteredStats.filter(a => a.status === 'approved_regional' || a.status === 'completed').length;
          const returned = filteredStats.filter(a => a.status === 'returned').length;

          // Count units that never submitted: fetch total units in scope, subtract units with assessments
          let totalUnitsInScope = 0;
          const unitIdsWithAssessment = new Set<string>();
          filteredStats.forEach(a => {
            if (a.hospital_id) unitIdsWithAssessment.add(a.hospital_id);
            if (a.health_office_id) unitIdsWithAssessment.add(a.health_office_id);
          });

          if (profile?.role === 'hospital_it') {
            totalUnitsInScope = 1;
          } else if (profile?.role === 'health_office') {
            // Count hospitals in their province + their own office
            const { count: hospCount } = await supabase
              .from('hospitals')
              .select('id', { count: 'exact', head: true })
              .eq('province_id', profile.province_id!);
            totalUnitsInScope = (hospCount || 0) + 1; // +1 for the health office itself
          } else if (profile?.role === 'provincial' && profile.province_id) {
            const { count: hospCount } = await supabase
              .from('hospitals')
              .select('id', { count: 'exact', head: true })
              .eq('province_id', profile.province_id);
            const { count: hoCount } = await supabase
              .from('health_offices')
              .select('id', { count: 'exact', head: true })
              .eq('province_id', profile.province_id);
            totalUnitsInScope = (hospCount || 0) + (hoCount || 0);
          } else if ((profile?.role === 'regional' || profile?.role === 'supervisor') && profile.health_region_id) {
            const { data: regionProvinces } = await supabase
              .from('provinces')
              .select('id')
              .eq('health_region_id', profile.health_region_id);
            const provinceIds = (regionProvinces || []).map(p => p.id);
            if (provinceIds.length > 0) {
              const { count: hospCount } = await supabase
                .from('hospitals')
                .select('id', { count: 'exact', head: true })
                .in('province_id', provinceIds);
              const { count: hoCount } = await supabase
                .from('health_offices')
                .select('id', { count: 'exact', head: true })
                .eq('health_region_id', profile.health_region_id);
              totalUnitsInScope = (hospCount || 0) + (hoCount || 0);
            }
          } else if (profile?.role === 'central_admin') {
            const { count: hospCount } = await supabase
              .from('hospitals')
              .select('id', { count: 'exact', head: true });
            const { count: hoCount } = await supabase
              .from('health_offices')
              .select('id', { count: 'exact', head: true });
            totalUnitsInScope = (hospCount || 0) + (hoCount || 0);
          }

          const neverSubmitted = Math.max(0, totalUnitsInScope - unitIdsWithAssessment.size);
          const computedStats = { total, draft, waitingProvincial, waitingRegional, approved, returned, neverSubmitted };
          nextCacheStats = computedStats;
          setStats(computedStats);
        }

        // Load assessments list - provincial จะเห็นเฉพาะจังหวัดตัวเอง
        const { data: assessmentsData, error: assessError } = await supabase
          .from('assessments')
          .select('*, hospitals(*), health_offices(*)')
          .order('created_at', { ascending: false });

        if (assessError) {
          console.error('Error loading assessments:', assessError);
        } else {
          // Filter assessments based on user role
          let filtered = assessmentsData || [];
          
          if (profile?.role === 'hospital_it' && profile.hospital_id) {
            // Hospital IT: only show their hospital's assessments
            filtered = (assessmentsData || []).filter(a => a.hospital_id === profile.hospital_id);
          } else if (profile?.role === 'provincial' && profile.province_id) {
            // Provincial: show assessments from their province
            filtered = (assessmentsData || []).filter(a => {
              // Filter hospital assessments by province
              if (a.hospital_id && a.hospitals) {
                return (a.hospitals as Hospital).province_id === profile.province_id;
              }
              // Filter health office assessments by province
              if (a.health_office_id && a.health_offices) {
                return (a.health_offices as HealthOffice).province_id === profile.province_id;
              }
              return false;
            });
          } else if (profile?.role === 'health_office' && profile.health_office_id) {
            // Health office: only show their health office's assessments
            filtered = (assessmentsData || []).filter(a => a.health_office_id === profile.health_office_id);
          }
          // central_admin, regional, supervisor see all
          const computedAssessments = filtered;
          nextCacheAssessments = computedAssessments;
          setAssessments(computedAssessments);
        }

        // Load hospitals for create dialog
        if (profile?.role === 'hospital_it' && profile.hospital_id) {
          const { data: hospitalData } = await supabase
            .from('hospitals')
            .select('*')
            .eq('id', profile.hospital_id);
          nextCacheHospitals = hospitalData || [];
          setHospitals(nextCacheHospitals);
          if (hospitalData?.[0]) {
            setSelectedHospital(hospitalData[0].id);
            const hospitalAssessments = (assessmentsData || []).filter(
              a => a.hospital_id === hospitalData[0].id && 
                   a.fiscal_year === parseInt(selectedYear)
            );
            setNextPeriod((hospitalAssessments.length + 1).toString());
          }
        } else if (profile?.role === 'health_office' && profile.health_office_id) {
          const { data: healthOfficeData } = await supabase
            .from('health_offices')
            .select('*')
            .eq('id', profile.health_office_id)
            .maybeSingle();
          nextCacheHealthOffice = healthOfficeData;
          setHealthOffice(healthOfficeData);
          
          if (healthOfficeData) {
            const healthOfficeAssessments = (assessmentsData || []).filter(
              a => a.health_office_id === healthOfficeData.id && 
                   a.fiscal_year === parseInt(selectedYear)
            );
            setNextPeriod((healthOfficeAssessments.length + 1).toString());
          }
        } else if (profile?.role === 'central_admin') {
          const { data: hospitalsData } = await supabase
            .from('hospitals')
            .select('*')
            .order('name');
          nextCacheHospitals = hospitalsData || [];
          setHospitals(nextCacheHospitals);
        }

      } catch (error) {
        console.error('Error:', error);
      } finally {
        if (!cancelled) {
          setLoading(false);
          setIsRefetching(false);

          // เขียน cache สำหรับ view ปัจจุบัน (กัน remount แล้วหน้าโหลดใหม่)
          if (profile) {
            const cacheKey = getDashboardCacheKey(profile, selectedFiscalYear);
            dashboardCache.set(cacheKey, {
              ts: Date.now(),
              stats: nextCacheStats,
              assessments: nextCacheAssessments,
              hospitals: nextCacheHospitals,
              healthOffice: nextCacheHealthOffice,
            });
          }
        }
      }
    };

    fetchData();
    return () => {
      cancelled = true;
    };
  }, [profile, selectedFiscalYear]);

  // Calculate next assessment period when hospital or year changes
  useEffect(() => {
    if (profile?.role === 'health_office' && healthOffice && selectedYear) {
      const healthOfficeAssessments = assessments.filter(
        a => a.health_office_id === healthOffice.id && 
             a.fiscal_year === parseInt(selectedYear)
      );
      setNextPeriod((healthOfficeAssessments.length + 1).toString());
    } else if (selectedHospital && selectedYear) {
      const hospitalAssessments = assessments.filter(
        a => a.hospital_id === selectedHospital && 
             a.fiscal_year === parseInt(selectedYear)
      );
      setNextPeriod((hospitalAssessments.length + 1).toString());
    }
  }, [selectedHospital, selectedYear, assessments, healthOffice, profile?.role]);

  // Check if user can create new assessment (max 2 per fiscal year)
  const canCreateAssessment = (): boolean => {
    const isHealthOfficeUser = profile?.role === 'health_office';
    const targetYear = parseInt(selectedYear);
    
    let existingCount = 0;
    if (isHealthOfficeUser && healthOffice) {
      existingCount = assessments.filter(
        a => a.health_office_id === healthOffice.id && a.fiscal_year === targetYear
      ).length;
    } else if (selectedHospital) {
      existingCount = assessments.filter(
        a => a.hospital_id === selectedHospital && a.fiscal_year === targetYear
      ).length;
    }
    
    return existingCount < 2;
  };

  // Get current assessment count for the selected year
  const getAssessmentCountForYear = (): number => {
    const isHealthOfficeUser = profile?.role === 'health_office';
    const targetYear = parseInt(selectedYear);
    
    if (isHealthOfficeUser && healthOffice) {
      return assessments.filter(
        a => a.health_office_id === healthOffice.id && a.fiscal_year === targetYear
      ).length;
    } else if (profile?.role === 'hospital_it' && profile.hospital_id) {
      return assessments.filter(
        a => a.hospital_id === profile.hospital_id && a.fiscal_year === targetYear
      ).length;
    }
    return 0;
  };

  const handleCreateAssessment = async () => {
    const isHealthOfficeUser = profile?.role === 'health_office';
    if (!isHealthOfficeUser && !selectedHospital) {
      toast({ title: 'กรุณากรอกข้อมูลให้ครบ', variant: 'destructive' });
      return;
    }
    if (isHealthOfficeUser && !healthOffice) {
      toast({ title: 'ไม่พบข้อมูลหน่วยงาน', variant: 'destructive' });
      return;
    }
    if (!selectedYear) {
      toast({ title: 'กรุณาเลือกปีงบประมาณ', variant: 'destructive' });
      return;
    }

    // Check max 2 assessments per fiscal year
    if (!canCreateAssessment()) {
      toast({ 
        title: 'ไม่สามารถสร้างแบบประเมินได้', 
        description: `หน่วยงานของท่านมีแบบประเมินครบ 2 ครั้งต่อปีงบประมาณ ${selectedYear} แล้ว`,
        variant: 'destructive' 
      });
      return;
    }

    try {
      setCreating(true);

      const insertData: any = {
        fiscal_year: parseInt(selectedYear),
        assessment_period: nextPeriod,
        created_by: profile?.id,
        status: 'draft',
      };

      if (isHealthOfficeUser && healthOffice) {
        insertData.health_office_id = healthOffice.id;
      } else {
        insertData.hospital_id = selectedHospital;
      }

      const { data: newAssessment, error: createError } = await supabase
        .from('assessments')
        .insert(insertData)
        .select()
        .single();

      if (createError) throw createError;

      const { data: categories } = await supabase
        .from('ctam_categories')
        .select('id')
        .order('order_number');

      if (categories) {
        const items = categories.map(cat => ({
          assessment_id: newAssessment.id,
          category_id: cat.id,
          status: 'fail' as const,
          score: 0,
        }));

        const { error: itemsError } = await supabase
          .from('assessment_items')
          .insert(items);

        if (itemsError) throw itemsError;
      }

      toast({ title: 'สร้างแบบประเมินสำเร็จ' });
      setCreateDialogOpen(false);
      navigate(`/assessment/${newAssessment.id}`);

    } catch (error: any) {
      console.error('Error creating assessment:', error);
      toast({ title: 'เกิดข้อผิดพลาด', description: error.message, variant: 'destructive' });
    } finally {
      setCreating(false);
    }
  };

  // Handle return for revision by provincial admin
  const handleReturnForRevision = async () => {
    if (!selectedAssessmentForReturn || !profile) return;
    
    try {
      setReturning(true);
      
      const fromStatus = selectedAssessmentForReturn.status;
      
      // Update assessment status to 'returned' and clear section approvals
      const { error: updateError } = await supabase
        .from('assessments')
        .update({
          status: 'returned',
          quantitative_approved_by: null,
          quantitative_approved_at: null,
          qualitative_approved_by: null,
          qualitative_approved_at: null,
          impact_approved_by: null,
          impact_approved_at: null,
          provincial_approved_by: null,
          provincial_approved_at: null,
          regional_approved_by: null,
          regional_approved_at: null,
        })
        .eq('id', selectedAssessmentForReturn.id);

      if (updateError) throw updateError;

      // Log to approval history
      const { error: historyError } = await supabase
        .from('approval_history')
        .insert({
          assessment_id: selectedAssessmentForReturn.id,
          action: 'return_for_revision',
          performed_by: profile.id,
          from_status: fromStatus,
          to_status: 'returned',
          comment: returnComment || 'ส่งกลับให้แก้ไข'
        });

      if (historyError) throw historyError;

      toast({ 
        title: 'ส่งกลับสำเร็จ', 
        description: 'แบบประเมินถูกส่งกลับให้โรงพยาบาลแก้ไขเรียบร้อยแล้ว' 
      });

      // Refresh data
      const { data: assessmentsData } = await supabase
        .from('assessments')
        .select('*, hospitals(*), health_offices(*)')
        .order('created_at', { ascending: false });
      
      // Re-apply role-based filtering for provincial admin
      let filtered = assessmentsData || [];
      if (profile?.role === 'provincial' && profile.province_id) {
        filtered = (assessmentsData || []).filter(a => {
          if (a.hospital_id && a.hospitals) {
            return (a.hospitals as Hospital).province_id === profile.province_id;
          }
          if (a.health_office_id && a.health_offices) {
            return (a.health_offices as HealthOffice).province_id === profile.province_id;
          }
          return false;
        });
      }
      
      // Update stats after filtering
      const total = filtered.length;
      const draft = filtered.filter(a => a.status === 'draft').length;
      const waitingProvincial = filtered.filter(a => a.status === 'submitted').length;
      const waitingRegional = filtered.filter(a => a.status === 'approved_provincial').length;
      const approved = filtered.filter(a => a.status === 'approved_regional' || a.status === 'completed').length;
      const returned = filtered.filter(a => a.status === 'returned').length;
      setStats(prev => ({ ...prev, total, draft, waitingProvincial, waitingRegional, approved, returned }));
      
      setAssessments(filtered);
      setReturnDialogOpen(false);
      setSelectedAssessmentForReturn(null);
      setReturnComment('');
    } catch (error: any) {
      console.error('Error returning assessment:', error);
      toast({ 
        title: 'เกิดข้อผิดพลาด', 
        description: error.message, 
        variant: 'destructive' 
      });
    } finally {
      setReturning(false);
    }
  };

  // Handle send email to ศทส.สป.
  const handleSendEmail = async () => {
    if (selectedAssessmentIds.size === 0) return;
    
    try {
      setSendingEmail(true);
      
      const { data, error } = await supabase.functions.invoke('send-assessment-report', {
        body: { assessment_ids: Array.from(selectedAssessmentIds) },
      });

      if (error) throw error;

      toast({ 
        title: 'ส่งอีเมลสำเร็จ', 
        description: `ส่งรายงานไปยัง ศทส.สป. แล้ว ${selectedAssessmentIds.size} รายการ` 
      });

      // Refresh assessments to show updated email_sent_at
      const { data: assessmentsData } = await supabase
        .from('assessments')
        .select('*, hospitals(*), health_offices(*)')
        .order('created_at', { ascending: false });
      
      // Re-apply role-based filtering
      let filtered = assessmentsData || [];
      if (profile?.role === 'regional' && profile.health_region_id) {
        filtered = (assessmentsData || []).filter(a => {
          if (a.hospital_id && (a as any).hospitals?.provinces) {
            return (a as any).hospitals.provinces.health_region_id === profile.health_region_id;
          }
          if (a.health_office_id && (a as any).health_offices) {
            return (a as any).health_offices.health_region_id === profile.health_region_id;
          }
          return false;
        });
      }
      
      setAssessments(filtered);
      setSelectedAssessmentIds(new Set());
      setEmailDialogOpen(false);
    } catch (error: any) {
      console.error('Error sending email:', error);
      toast({ 
        title: 'เกิดข้อผิดพลาด', 
        description: error.message || 'ไม่สามารถส่งอีเมลได้', 
        variant: 'destructive' 
      });
    } finally {
      setSendingEmail(false);
    }
  };

  // Toggle select assessment for email
  const toggleSelectAssessment = (assessmentId: string) => {
    setSelectedAssessmentIds(prev => {
      const newSet = new Set(prev);
      if (newSet.has(assessmentId)) {
        newSet.delete(assessmentId);
      } else {
        newSet.add(assessmentId);
      }
      return newSet;
    });
  };

  // Select/Deselect all visible approved assessments
  const selectAllApproved = () => {
    const approvedIds = filteredAssessments
      .filter(a => a.status === 'approved_regional' || a.status === 'completed')
      .map(a => a.id);
    setSelectedAssessmentIds(new Set(approvedIds));
  };

  const deselectAll = () => {
    setSelectedAssessmentIds(new Set());
  };

  // Check if user can return assessment for revision
  const canReturnForRevision = (assessment: Assessment) => {
    if (profile?.role !== 'provincial') return false;
    // Allow returning assessments that are approved by regional or completed
    return assessment.status === 'approved_regional' || assessment.status === 'completed';
  };

  // Check if assessment can be selected for email (regional admin only, approved/completed status)
  const canSelectForEmail = (assessment: Assessment) => {
    if (profile?.role !== 'regional') return false;
    return assessment.status === 'approved_regional' || assessment.status === 'completed';
  };

  // Check if user can delete assessment based on role and ownership
  const canDeleteAssessment = (assessment: Assessment & { hospitals?: Hospital; health_offices?: HealthOffice }) => {
    if (!profile) return false;
    if (profile.role === 'central_admin') return true;
    if (profile.role === 'hospital_it') {
      return !!profile.hospital_id && assessment.hospital_id === profile.hospital_id;
    }
    if (profile.role === 'health_office') {
      return !!profile.health_office_id && assessment.health_office_id === profile.health_office_id;
    }
    if (profile.role === 'provincial') {
      const provinceId = profile.province_id;
      if (!provinceId) return false;
      const hospital = (assessment as any).hospitals as Hospital | undefined;
      const office = (assessment as any).health_offices as HealthOffice | undefined;
      if (hospital && hospital.province_id === provinceId) return true;
      if (office && office.province_id === provinceId) return true;
      return false;
    }
    if (profile.role === 'regional') {
      const regionId = profile.health_region_id;
      if (!regionId) return false;
      const hospital = (assessment as any).hospitals as Hospital | undefined;
      const office = (assessment as any).health_offices as HealthOffice | undefined;
      if (office && office.health_region_id === regionId) return true;
      if (hospital) {
        const province = provincesList.find(p => p.id === hospital.province_id);
        if (province && province.health_region_id === regionId) return true;
      }
      return false;
    }
    return false;
  };

  // Delete dialog state
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [selectedAssessmentForDelete, setSelectedAssessmentForDelete] = useState<(Assessment & { hospitals?: Hospital; health_offices?: HealthOffice }) | null>(null);
  const [deleting, setDeleting] = useState(false);

  const handleDeleteAssessment = async () => {
    if (!selectedAssessmentForDelete) return;
    setDeleting(true);
    try {
      const { error } = await supabase
        .from('assessments')
        .delete()
        .eq('id', selectedAssessmentForDelete.id);
      if (error) throw error;

      setAssessments(prev => prev.filter(a => a.id !== selectedAssessmentForDelete.id));
      invalidateDashboardCache();

      toast({
        title: 'ลบแบบประเมินเรียบร้อย',
        description: 'แบบประเมินและข้อมูลที่เกี่ยวข้องถูกลบแล้ว',
      });
      setDeleteDialogOpen(false);
      setSelectedAssessmentForDelete(null);
    } catch (err: any) {
      toast({
        title: 'ลบไม่สำเร็จ',
        description: err?.message || 'ไม่สามารถลบแบบประเมินได้',
        variant: 'destructive',
      });
    } finally {
      setDeleting(false);
    }
  };

  const canCreate = profile?.role === 'hospital_it' || profile?.role === 'central_admin' || profile?.role === 'health_office';

  const statsDisplay = [
    { 
      label: 'แบบประเมินทั้งหมด', 
      value: loading ? '-' : stats.total.toString(), 
      icon: FileText, 
      color: 'text-primary',
      bgColor: 'bg-primary/10',
      filterValue: null, // Show all
    },
    { 
      label: 'ร่าง', 
      value: loading ? '-' : stats.draft.toString(), 
      icon: FileText, 
      color: 'text-muted-foreground',
      bgColor: 'bg-muted',
      filterValue: 'draft',
    },
    { 
      label: 'รอ สสจ. ตรวจสอบ', 
      value: loading ? '-' : stats.waitingProvincial.toString(), 
      icon: Clock, 
      color: 'text-warning',
      bgColor: 'bg-warning/10',
      filterValue: 'submitted',
    },
    { 
      label: 'รอ เขตสุขภาพ ตรวจสอบ', 
      value: loading ? '-' : stats.waitingRegional.toString(), 
      icon: Clock, 
      color: 'text-primary',
      bgColor: 'bg-primary/10',
      filterValue: 'approved_provincial',
    },
    { 
      label: 'อนุมัติแล้ว', 
      value: loading ? '-' : stats.approved.toString(), 
      icon: CheckCircle2, 
      color: 'text-success',
      bgColor: 'bg-success/10',
      filterValue: 'approved',
    },
    { 
      label: 'ต้องแก้ไข', 
      value: loading ? '-' : stats.returned.toString(), 
      icon: AlertTriangle, 
      color: 'text-destructive',
      bgColor: 'bg-destructive/10',
      filterValue: 'returned',
    },
    { 
      label: 'ยังไม่เคยส่ง', 
      value: loading ? '-' : stats.neverSubmitted.toString(), 
      icon: FileText, 
      color: 'text-muted-foreground',
      bgColor: 'bg-muted/50',
      filterValue: 'never_submitted',
    },
  ];

  // Build province -> region map for region filter
  const provinceToRegion = new Map(provincesList.map(p => [p.id, p.health_region_id]));

  // Filter assessments based on all filters (search, province, region, status, etc.)
  const filteredAssessments = assessments.filter(assessment => {
    if (selectedFiscalYear !== 'all' && assessment.fiscal_year !== parseInt(selectedFiscalYear)) {
      return false;
    }
    if (profile?.role === 'central_admin' && dataUpdatedFilter !== 'all') {
      if (dataUpdatedFilter === 'updated' && !assessment.data_updated) return false;
      if (dataUpdatedFilter === 'not_updated' && assessment.data_updated) return false;
    }
    if ((profile?.role === 'central_admin' || profile?.role === 'regional') && emailSentFilter !== 'all') {
      if (emailSentFilter === 'sent' && !(assessment as any).email_sent_at) return false;
      if (emailSentFilter === 'not_sent' && (assessment as any).email_sent_at) return false;
    }
    // Search by hospital/health office name
    if (searchQuery.trim()) {
      const q = searchQuery.trim().toLowerCase();
      const name = ((assessment as any).hospitals?.name || (assessment as any).health_offices?.name || '').toLowerCase();
      if (!name.includes(q)) return false;
    }
    // Province filter
    if (provinceFilter !== 'all') {
      const provinceId =
        (assessment as any).hospitals?.province_id ||
        (assessment as any).health_offices?.province_id ||
        null;
      if (provinceId !== provinceFilter) return false;
    }
    // Region filter (derive from province)
    if (regionFilter !== 'all') {
      const ho = (assessment as any).health_offices;
      const provinceId =
        (assessment as any).hospitals?.province_id ||
        ho?.province_id ||
        null;
      const regionId = ho?.health_region_id || (provinceId ? provinceToRegion.get(provinceId) : null);
      if (regionId !== regionFilter) return false;
    }
    if (!statusFilter) return true;
    if (statusFilter === 'approved') {
      return assessment.status === 'approved_regional' || assessment.status === 'completed';
    }
    return assessment.status === statusFilter;
  });

  // Pagination
  const totalPages = Math.max(1, Math.ceil(filteredAssessments.length / pageSize));
  const safePage = Math.min(currentPage, totalPages);
  const pagedAssessments = filteredAssessments.slice((safePage - 1) * pageSize, safePage * pageSize);

  // Fallback score map: for each unit, the most recent assessment that has a real total_score.
  // Used when the current/latest assessment's total_score is null (e.g., a newly approved round
  // whose scores haven't been computed yet) — show the prior valid score instead of "-".
  const parsePeriod = (p?: string | null) => {
    if (!p) return 0;
    const m = String(p).match(/\d+/);
    return m ? Number(m[0]) : 0;
  };
  const fallbackScoreByUnit = new Map<string, number>();
  const sortedForFallback = [...assessments]
    .filter(a => a.total_score !== null && a.total_score !== undefined)
    .sort((a, b) => {
      if (a.fiscal_year !== b.fiscal_year) return b.fiscal_year - a.fiscal_year;
      const pd = parsePeriod(b.assessment_period) - parsePeriod(a.assessment_period);
      if (pd !== 0) return pd;
      return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
    });
  for (const a of sortedForFallback) {
    const unitId = (a.hospital_id || a.health_office_id) as string | null;
    if (!unitId) continue;
    if (!fallbackScoreByUnit.has(unitId)) {
      fallbackScoreByUnit.set(unitId, Number(a.total_score));
    }
  }

  // Provinces visible in current region filter
  const visibleProvinces = provincesList.filter(p =>
    regionFilter === 'all' ? true : p.health_region_id === regionFilter
  );

  const hasCachedView = !!profile && dashboardCache.has(getDashboardCacheKey(profile, selectedFiscalYear));

  // Full page loading เฉพาะครั้งแรก (ไม่มี cache)
  if (loading && !hasCachedView) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center min-h-[400px]">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
          <span className="ml-2 text-muted-foreground">กำลังโหลดข้อมูล...</span>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      {/* Small refetching indicator - ไม่บังหน้า */}
      {isRefetching && (
        <div className="fixed top-4 right-4 z-50 flex items-center gap-2 bg-background/80 backdrop-blur-sm border rounded-full px-3 py-1.5 shadow-sm">
          <Loader2 className="w-4 h-4 animate-spin text-primary" />
          <span className="text-xs text-muted-foreground">กำลังอัปเดต...</span>
        </div>
      )}

      {/* Banner Carousel */}
      <BannerCarousel className="mb-6" />

      {/* Welcome Section */}
      <div className="mb-8 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold mb-2">
            สวัสดี, {profile?.full_name || 'ผู้ใช้งาน'}
          </h2>
          <p className="text-muted-foreground">
            ยินดีต้อนรับสู่ระบบประเมินความปลอดภัยไซเบอร์ CTAM+
          </p>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-sm text-muted-foreground whitespace-nowrap">ปีงบประมาณ:</span>
          <Select value={selectedFiscalYear} onValueChange={setSelectedFiscalYear}>
            <SelectTrigger className="w-[140px]">
              <SelectValue placeholder="เลือกปีงบ" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">ทุกปีงบประมาณ</SelectItem>
              {fiscalYears.map(year => (
                <SelectItem key={year} value={year.toString()}>
                  พ.ศ. {year + 543}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-7 gap-4 mb-8">
        {statsDisplay.map((stat, index) => (
          <Card 
            key={index} 
            className={`card-hover cursor-pointer transition-all ${
              statusFilter === stat.filterValue 
                ? 'ring-2 ring-primary ring-offset-2' 
                : ''
            }`}
            onClick={() => setStatusFilter(stat.filterValue)}
          >
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-2xl font-bold">{stat.value}</p>
                  <p className="text-sm text-muted-foreground">{stat.label}</p>
                </div>
                <div className={`w-12 h-12 rounded-xl ${stat.bgColor} flex items-center justify-center`}>
                  <stat.icon className={`w-6 h-6 ${stat.color}`} />
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Assessments Table */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 flex-wrap gap-4">
          <div>
            <CardTitle>
              รายการแบบประเมิน
              {statusFilter && (
                <Badge variant="secondary" className="ml-2 font-normal">
                  {statsDisplay.find(s => s.filterValue === statusFilter)?.label}
                </Badge>
              )}
              {profile?.role === 'central_admin' && dataUpdatedFilter !== 'all' && (
                <Badge variant={dataUpdatedFilter === 'updated' ? 'default' : 'outline'} className="ml-2 font-normal">
                  {dataUpdatedFilter === 'updated' ? 'อัพเดดแล้ว' : 'ยังไม่อัพเดด'}
                </Badge>
              )}
              {profile?.role === 'central_admin' && emailSentFilter !== 'all' && (
                <Badge variant={emailSentFilter === 'sent' ? 'default' : 'outline'} className="ml-2 font-normal">
                  {emailSentFilter === 'sent' ? 'ส่งอีเมลแล้ว' : 'ยังไม่ส่งอีเมล'}
                </Badge>
              )}
            </CardTitle>
            <CardDescription>
              {filteredAssessments.length} รายการ
              {profile?.role === 'regional' && selectedAssessmentIds.size > 0 && (
                <span className="ml-2 text-primary font-medium">
                  (เลือก {selectedAssessmentIds.size} รายการ)
                </span>
              )}
            </CardDescription>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            {/* Regional admin email controls */}
            {profile?.role === 'regional' && (
              <>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={selectAllApproved}
                >
                  <CheckSquare className="w-4 h-4 mr-1" />
                  เลือกทั้งหมด
                </Button>
                {selectedAssessmentIds.size > 0 && (
                  <>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={deselectAll}
                    >
                      <Square className="w-4 h-4 mr-1" />
                      ยกเลิกเลือก
                    </Button>
                    <Button
                      size="sm"
                      onClick={() => setEmailDialogOpen(true)}
                    >
                      <Mail className="w-4 h-4 mr-2" />
                      ส่งอีเมล ศทส.สป. ({selectedAssessmentIds.size})
                    </Button>
                  </>
                )}
              </>
            )}
            {/* Central admin filters */}
            {profile?.role === 'central_admin' && (
              <>
                <Select value={emailSentFilter} onValueChange={setEmailSentFilter}>
                  <SelectTrigger className="w-[160px]">
                    <SelectValue placeholder="กรองสถานะส่งอีเมล" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">ทั้งหมด</SelectItem>
                    <SelectItem value="sent">ส่งอีเมลแล้ว</SelectItem>
                    <SelectItem value="not_sent">ยังไม่ส่งอีเมล</SelectItem>
                  </SelectContent>
                </Select>
                <Select value={dataUpdatedFilter} onValueChange={setDataUpdatedFilter}>
                  <SelectTrigger className="w-[180px]">
                    <SelectValue placeholder="กรองสถานะอัพเดด" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">ทั้งหมด</SelectItem>
                    <SelectItem value="updated">อัพเดดข้อมูลเเล้ว</SelectItem>
                    <SelectItem value="not_updated">ยังไม่อัพเดด</SelectItem>
                  </SelectContent>
                </Select>
              </>
            )}
            {canCreate && (
              <Dialog open={createDialogOpen} onOpenChange={setCreateDialogOpen}>
              <DialogTrigger asChild>
                <Button>
                  <Plus className="w-4 h-4 mr-2" />
                  สร้างแบบประเมินใหม่
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>สร้างแบบประเมินใหม่</DialogTitle>
                  <DialogDescription>
                    {profile?.role === 'health_office' 
                      ? 'สร้างแบบประเมินสำหรับหน่วยงานของคุณ'
                      : 'เลือกโรงพยาบาล และปีงบประมาณ'
                    }
                  </DialogDescription>
                </DialogHeader>
                <div className="space-y-4 py-4">
                  {profile?.role === 'health_office' && healthOffice && (
                    <div className="space-y-2">
                      <Label>หน่วยงาน</Label>
                      <div className="h-10 px-3 py-2 border rounded-md bg-muted text-muted-foreground flex items-center">
                        {healthOffice.name}
                      </div>
                    </div>
                  )}
                  {profile?.role === 'central_admin' && (
                    <div className="space-y-2">
                      <Label>โรงพยาบาล</Label>
                      <Select value={selectedHospital} onValueChange={setSelectedHospital}>
                        <SelectTrigger>
                          <SelectValue placeholder="เลือกโรงพยาบาล" />
                        </SelectTrigger>
                        <SelectContent>
                          {hospitals.map(h => (
                            <SelectItem key={h.id} value={h.id}>{h.name}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  )}
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>ปีงบประมาณ</Label>
                      <Select value={selectedYear} onValueChange={setSelectedYear}>
                        <SelectTrigger>
                          <SelectValue placeholder="เลือกปี" />
                        </SelectTrigger>
                        <SelectContent>
                          {years.map(y => (
                            <SelectItem key={y} value={y.toString()}>{y + 543}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label>ครั้งที่ประเมิน</Label>
                      <div className="h-10 px-3 py-2 border rounded-md bg-muted text-muted-foreground flex items-center">
                        ครั้งที่ {nextPeriod}/{parseInt(selectedYear) + 543}
                      </div>
                    </div>
                  </div>
                  {/* Warning when max assessments reached */}
                  {getAssessmentCountForYear() >= 2 && (
                    <div className="p-3 bg-destructive/10 border border-destructive/20 rounded-md">
                      <p className="text-sm text-destructive font-medium">
                        ⚠️ หน่วยงานของท่านมีแบบประเมินครบ 2 ครั้งต่อปีงบประมาณ {parseInt(selectedYear) + 543} แล้ว
                      </p>
                      <p className="text-xs text-destructive/80 mt-1">
                        ไม่สามารถสร้างแบบประเมินเพิ่มในปีงบประมาณนี้ได้
                      </p>
                    </div>
                  )}
                </div>
                <DialogFooter>
                  <Button variant="outline" onClick={() => setCreateDialogOpen(false)}>
                    ยกเลิก
                  </Button>
                  <Button 
                    onClick={handleCreateAssessment} 
                    disabled={creating || getAssessmentCountForYear() >= 2}
                  >
                    {creating && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                    สร้างแบบประเมิน
                  </Button>
                </DialogFooter>
              </DialogContent>
              </Dialog>
            )}
          </div>
        </CardHeader>
        <CardContent>
          {/* Search & filter row */}
          <div className="flex flex-col md:flex-row gap-3 mb-4">
            <div className="relative flex-1 min-w-[220px]">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                type="text"
                placeholder="ค้นหาชื่อโรงพยาบาล / หน่วยงาน..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9 pr-9"
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => setSearchQuery('')}
                  className="absolute right-2 top-1/2 -translate-y-1/2 p-1 rounded hover:bg-muted text-muted-foreground"
                  aria-label="ล้างคำค้นหา"
                >
                  <X className="w-4 h-4" />
                </button>
              )}
            </div>
            <Select
              value={regionFilter}
              onValueChange={(v) => {
                setRegionFilter(v);
                // Reset province if it no longer belongs to selected region
                if (v !== 'all' && provinceFilter !== 'all') {
                  const p = provincesList.find(x => x.id === provinceFilter);
                  if (!p || p.health_region_id !== v) setProvinceFilter('all');
                }
              }}
            >
              <SelectTrigger className="w-full md:w-[200px]">
                <SelectValue placeholder="เขตสุขภาพ" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">ทุกเขตสุขภาพ</SelectItem>
                {regionsList.map(r => (
                  <SelectItem key={r.id} value={r.id}>
                    เขตสุขภาพที่ {r.region_number}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={provinceFilter} onValueChange={setProvinceFilter}>
              <SelectTrigger className="w-full md:w-[200px]">
                <SelectValue placeholder="จังหวัด" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">ทุกจังหวัด</SelectItem>
                {visibleProvinces.map(p => (
                  <SelectItem key={p.id} value={p.id}>
                    {p.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {(searchQuery || regionFilter !== 'all' || provinceFilter !== 'all') && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  setSearchQuery('');
                  setRegionFilter('all');
                  setProvinceFilter('all');
                }}
              >
                <X className="w-4 h-4 mr-1" />
                ล้างตัวกรอง
              </Button>
            )}
          </div>

          {loading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
            </div>
          ) : filteredAssessments.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <FileText className="w-12 h-12 mx-auto mb-4 opacity-50" />
              <p>{statusFilter ? 'ไม่มีรายการตามเงื่อนไขที่เลือก' : 'ยังไม่มีแบบประเมิน'}</p>
              {statusFilter && (
                <Button 
                  variant="outline" 
                  className="mt-4"
                  onClick={() => setStatusFilter(null)}
                >
                  ดูทั้งหมด
                </Button>
              )}
              {!statusFilter && canCreate && (
                <Button 
                  variant="outline" 
                  className="mt-4"
                  onClick={() => setCreateDialogOpen(true)}
                >
                  <Plus className="w-4 h-4 mr-2" />
                  สร้างแบบประเมินแรก
                </Button>
              )}
            </div>
          ) : (
            <TooltipProvider>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>โรงพยาบาล</TableHead>
                  <TableHead>ครั้งที่ประเมิน</TableHead>
                  <TableHead>สถานะ</TableHead>
                  <TableHead>คะแนนรวม (10)</TableHead>
                  <TableHead>วันที่สร้าง</TableHead>
                  <TableHead className="text-right">การดำเนินการ</TableHead>
                  {(profile?.role === 'central_admin' || profile?.role === 'regional') && (
                    <TableHead className="text-center">สถานะส่งอีเมล</TableHead>
                  )}
                  {profile?.role === 'central_admin' && (
                    <TableHead className="text-center">ศทส.อัพเดดเเดชบอร์ดกลางเเล้ว</TableHead>
                  )}
                  {profile?.role === 'regional' && (
                    <TableHead className="text-center w-16">ส่งเมล์รายงานไป ศทส.</TableHead>
                  )}
                </TableRow>
              </TableHeader>
              <TableBody>
                {pagedAssessments.map((assessment) => {
                  const status = statusLabels[assessment.status] || statusLabels.draft;
                  const emailSentAt = (assessment as any).email_sent_at;
                  return (
                    <TableRow key={assessment.id}>
                      <TableCell className="font-medium">
                        {(assessment as any).hospitals?.name || (assessment as any).health_offices?.name || '-'}
                      </TableCell>
                      <TableCell>
                        {assessment.assessment_period}/{assessment.fiscal_year + 543}
                      </TableCell>
                      <TableCell>
                        <Badge className={status.className}>{status.label}</Badge>
                      </TableCell>
                      <TableCell>
                        {(() => {
                          if (assessment.total_score !== null && assessment.total_score !== undefined) {
                            return Number(assessment.total_score).toFixed(2);
                          }
                          const unitId = (assessment.hospital_id || assessment.health_office_id) as string | null;
                          const fallback = unitId ? fallbackScoreByUnit.get(unitId) : undefined;
                          if (fallback !== undefined) {
                            return (
                              <span title="คะแนนล่าสุดที่บันทึกไว้ (ครั้งก่อน)">
                                {fallback.toFixed(2)}
                              </span>
                            );
                          }
                          return '-';
                        })()}
                      </TableCell>
                      <TableCell>
                        {format(new Date(assessment.created_at), 'd MMM yyyy', { locale: th })}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-1">
                          {(() => {
                            const showEdit = assessment.status === 'draft' || profile?.role === 'regional';
                            return (
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => {
                                  const isRegionalEditOnApproved =
                                    profile?.role === 'regional' && assessment.status !== 'draft';
                                  if (isRegionalEditOnApproved) {
                                    setSelectedAssessmentForEdit(assessment);
                                    setRegionalEditDialogOpen(true);
                                  } else {
                                    navigate(`/assessment/${assessment.id}`);
                                  }
                                }}
                                className={profile?.role === 'regional' && assessment.status !== 'draft' ? 'text-primary hover:text-primary' : ''}
                              >
                                {showEdit ? <Pencil className="w-4 h-4 mr-2" /> : <Eye className="w-4 h-4 mr-2" />}
                                {showEdit ? 'แก้ไข' : 'ดู'}
                              </Button>
                            );
                          })()}
                          {canReturnForRevision(assessment) && (
                            <Button
                              variant="ghost"
                              size="sm"
                              className="text-warning hover:text-warning"
                              onClick={() => {
                                setSelectedAssessmentForReturn(assessment);
                                setReturnDialogOpen(true);
                              }}
                            >
                              <RotateCcw className="w-4 h-4 mr-1" />
                              ส่งกลับไปแก้ไข
                            </Button>
                          )}
                          {canDeleteAssessment(assessment) && (
                            <Button
                              variant="ghost"
                              size="sm"
                              className="text-destructive hover:text-destructive"
                              onClick={() => {
                                setSelectedAssessmentForDelete(assessment);
                                setDeleteDialogOpen(true);
                              }}
                            >
                              <Trash2 className="w-4 h-4 mr-1" />
                              ลบ
                            </Button>
                          )}
                        </div>
                      </TableCell>
                      {(profile?.role === 'central_admin' || profile?.role === 'regional') && (
                        <TableCell className="text-center">
                          {emailSentAt ? (
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <Badge className="bg-success/10 text-success cursor-help">
                                  <Mail className="w-3 h-3 mr-1" />
                                  ส่งแล้ว
                                </Badge>
                              </TooltipTrigger>
                              <TooltipContent>
                                <p>ส่งเมื่อ {format(new Date(emailSentAt), 'd MMM yyyy HH:mm', { locale: th })}</p>
                              </TooltipContent>
                            </Tooltip>
                          ) : (
                            <Badge variant="outline" className="text-muted-foreground">
                              ยังไม่ส่ง
                            </Badge>
                          )}
                        </TableCell>
                      )}
                      {profile?.role === 'central_admin' && (
                        <TableCell className="text-center">
                          <Switch
                            checked={assessment.data_updated || false}
                            onCheckedChange={async (checked) => {
                              try {
                                const { error } = await supabase
                                  .from('assessments')
                                  .update({ data_updated: checked })
                                  .eq('id', assessment.id);
                                
                                if (error) throw error;
                                
                                setAssessments(prev => prev.map(a => 
                                  a.id === assessment.id 
                                    ? { ...a, data_updated: checked }
                                    : a
                                ));
                                
                                toast({
                                  title: checked ? 'เปิดสถานะอัพเดดข้อมูลเเล้ว' : 'ปิดสถานะอัพเดดข้อมูล',
                                });
                              } catch (error: any) {
                                toast({
                                  title: 'เกิดข้อผิดพลาด',
                                  description: error.message,
                                  variant: 'destructive',
                                });
                              }
                            }}
                          />
                        </TableCell>
                      )}
                      {profile?.role === 'regional' && (
                        <TableCell className="text-center">
                          {canSelectForEmail(assessment) && (
                            <Checkbox
                              checked={selectedAssessmentIds.has(assessment.id)}
                              onCheckedChange={() => toggleSelectAssessment(assessment.id)}
                            />
                          )}
                        </TableCell>
                      )}
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
            </TooltipProvider>
          )}

          {/* Pagination controls */}
          {filteredAssessments.length > 0 && (
            <div className="flex flex-col sm:flex-row items-center justify-between gap-3 mt-4 pt-4 border-t">
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <span>แสดง</span>
                <Select value={pageSize.toString()} onValueChange={(v) => setPageSize(parseInt(v))}>
                  <SelectTrigger className="w-[80px] h-8">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="20">20</SelectItem>
                    <SelectItem value="50">50</SelectItem>
                    <SelectItem value="100">100</SelectItem>
                  </SelectContent>
                </Select>
                <span>
                  รายการ ({(safePage - 1) * pageSize + 1}-
                  {Math.min(safePage * pageSize, filteredAssessments.length)} จาก{' '}
                  {filteredAssessments.length})
                </span>
              </div>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                  disabled={safePage <= 1}
                >
                  <ChevronLeft className="w-4 h-4" />
                  ก่อนหน้า
                </Button>
                <span className="text-sm text-muted-foreground">
                  หน้า {safePage} / {totalPages}
                </span>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                  disabled={safePage >= totalPages}
                >
                  ถัดไป
                  <ChevronRight className="w-4 h-4" />
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Setup Notice for new users */}
      {profile?.role === 'hospital_it' && !profile.hospital_id && (
        <Card className="mt-8 border-warning/50 bg-warning/5">
          <CardContent className="p-6">
            <div className="flex items-start gap-4">
              <div className="w-10 h-10 bg-warning/20 rounded-lg flex items-center justify-center flex-shrink-0">
                <AlertTriangle className="w-5 h-5 text-warning" />
              </div>
              <div>
                <h3 className="font-semibold mb-1">ยังไม่ได้เชื่อมโยงกับโรงพยาบาล</h3>
                <p className="text-sm text-muted-foreground">
                  กรุณาติดต่อผู้ดูแลระบบ (Admin) เพื่อเชื่อมโยงบัญชีของคุณกับโรงพยาบาลที่สังกัด
                  ก่อนที่จะเริ่มกรอกแบบประเมิน
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Return for Revision Dialog */}
      <AlertDialog open={returnDialogOpen} onOpenChange={setReturnDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>ยืนยันส่งกลับให้แก้ไข</AlertDialogTitle>
            <AlertDialogDescription>
              {selectedAssessmentForReturn && (
                <>
                  ส่งแบบประเมินกลับไปให้ <strong className="text-foreground">
                    {(selectedAssessmentForReturn as any).hospitals?.name || 
                     (selectedAssessmentForReturn as any).health_offices?.name}
                  </strong> แก้ไขแบบประเมิน
                  <br /><br />
                  เมื่อโรงพยาบาลแก้ไขเสร็จและส่งกลับมา จะต้องผ่านขั้นตอนอนุมัติใหม่ทั้งหมด
                  (สสจ. → เขตสุขภาพ)
                </>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="py-4">
            <Label htmlFor="return-comment">เหตุผลที่ส่งกลับ (ถ้ามี)</Label>
            <Textarea
              id="return-comment"
              placeholder="ระบุเหตุผลหรือสิ่งที่ต้องแก้ไข..."
              value={returnComment}
              onChange={(e) => setReturnComment(e.target.value)}
              className="mt-2"
            />
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => {
              setSelectedAssessmentForReturn(null);
              setReturnComment('');
            }}>
              ยกเลิก
            </AlertDialogCancel>
            <AlertDialogAction 
              onClick={handleReturnForRevision}
              disabled={returning}
              className="bg-warning text-warning-foreground hover:bg-warning/90"
            >
              {returning && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              ยืนยันส่งกลับ
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Regional Admin Edit Confirmation Dialog */}
      <AlertDialog open={regionalEditDialogOpen} onOpenChange={setRegionalEditDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <Pencil className="w-5 h-5 text-primary" />
              ยืนยันการแก้ไขแบบประเมิน
            </AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="space-y-2">
                {selectedAssessmentForEdit && (
                  <p>
                    คุณกำลังจะแก้ไขแบบประเมินของ{' '}
                    <span className="font-semibold text-foreground">
                      {selectedAssessmentForEdit.hospitals?.name || selectedAssessmentForEdit.health_offices?.name || ''}
                    </span>{' '}
                    ปี {selectedAssessmentForEdit.fiscal_year + 543} ครั้งที่ {selectedAssessmentForEdit.assessment_period}
                  </p>
                )}
                <p className="text-warning">
                  ⚠️ การแก้ไขจะส่งผลให้คะแนนรวมของหน่วยงานนี้ถูกคำนวณใหม่อัตโนมัติ
                </p>
                <p>คุณต้องการดำเนินการต่อหรือไม่?</p>
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setSelectedAssessmentForEdit(null)}>
              ยกเลิก
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (selectedAssessmentForEdit) {
                  navigate(`/assessment/${selectedAssessmentForEdit.id}`);
                }
                setRegionalEditDialogOpen(false);
                setSelectedAssessmentForEdit(null);
              }}
            >
              <Pencil className="w-4 h-4 mr-2" />
              ยืนยันแก้ไข
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={emailDialogOpen} onOpenChange={setEmailDialogOpen}>
        <AlertDialogContent className="max-w-lg">
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <Mail className="w-5 h-5 text-primary" />
              ยืนยันส่งอีเมลไปยัง ศทส.สป.
            </AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div>
                <p className="mb-4">
                  คุณกำลังจะส่งรายงานสรุปผลการประเมิน <strong className="text-foreground">{selectedAssessmentIds.size} รายการ</strong> ไปยัง:
                </p>
                <div className="bg-muted rounded-lg p-3 text-sm mb-4">
                  <p className="font-medium text-foreground mb-1">ผู้รับอีเมล:</p>
                  <ul className="list-disc list-inside text-muted-foreground">
                    <li>cyberaudit@moph.go.th</li>
                    <li>nopparat.ratcha@sansaihospital.go.th</li>
                  </ul>
                </div>
                <p className="text-muted-foreground text-sm">
                  อีเมลจะมีข้อมูลสรุปคะแนน, สถานะการโจมตี, การละเมิดข้อมูล และลิงก์ไปหน้าแบบประเมินแต่ละรายการ
                </p>
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setEmailDialogOpen(false)}>
              ยกเลิก
            </AlertDialogCancel>
            <AlertDialogAction 
              onClick={handleSendEmail}
              disabled={sendingEmail}
            >
              {sendingEmail ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  กำลังส่ง...
                </>
              ) : (
                <>
                  <Mail className="w-4 h-4 mr-2" />
                  ส่งอีเมล
                </>
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Delete Assessment Dialog */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2 text-destructive">
              <Trash2 className="w-5 h-5" />
              ยืนยันลบแบบประเมิน
            </AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div>
                {selectedAssessmentForDelete && (
                  <>
                    คุณกำลังจะลบแบบประเมินของ{' '}
                    <strong className="text-foreground">
                      {(selectedAssessmentForDelete as any).hospitals?.name ||
                        (selectedAssessmentForDelete as any).health_offices?.name}
                    </strong>{' '}
                    ครั้งที่ {selectedAssessmentForDelete.assessment_period}/
                    {selectedAssessmentForDelete.fiscal_year + 543}
                    <br />
                    <br />
                    การลบจะรวมถึงข้อมูลคะแนน หลักฐาน และประวัติการอนุมัติทั้งหมด
                    <strong className="text-destructive"> ไม่สามารถกู้คืนได้</strong>
                  </>
                )}
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel
              onClick={() => {
                setSelectedAssessmentForDelete(null);
              }}
            >
              ยกเลิก
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteAssessment}
              disabled={deleting}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deleting && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              ลบแบบประเมิน
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </DashboardLayout>
  );
}
