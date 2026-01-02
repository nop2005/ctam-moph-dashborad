import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { SearchableSelect } from '@/components/ui/searchable-select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { toast } from 'sonner';
import { 
  Users, 
  Building2,
  MapPin,
  Edit,
  Search,
  RefreshCw,
  UserCheck,
  UserX,
  Clock,
  CheckCircle,
  XCircle,
  Phone,
  UserPlus
} from 'lucide-react';

interface Profile {
  id: string;
  user_id: string;
  email: string;
  full_name: string | null;
  phone: string | null;
  role: 'hospital_it' | 'provincial' | 'regional' | 'central_admin' | 'health_office' | 'supervisor';
  hospital_id: string | null;
  province_id: string | null;
  health_region_id: string | null;
  is_active: boolean;
  created_at: string;
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

interface Hospital {
  id: string;
  name: string;
  code: string;
  province_id: string;
}

export default function SuperAdmin() {
  const { profile: currentUserProfile } = useAuth();
  
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [provinces, setProvinces] = useState<Province[]>([]);
  const [healthRegions, setHealthRegions] = useState<HealthRegion[]>([]);
  const [hospitals, setHospitals] = useState<Hospital[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [activeTab, setActiveTab] = useState('pending');
  
  // Dialog states
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [isApproveDialogOpen, setIsApproveDialogOpen] = useState(false);
  const [selectedProfile, setSelectedProfile] = useState<Profile | null>(null);
  const [editRole, setEditRole] = useState<string>('');
  const [editProvinceId, setEditProvinceId] = useState<string>('');
  const [editRegionId, setEditRegionId] = useState<string>('');
  const [editHospitalId, setEditHospitalId] = useState<string>('');
  const [editFullName, setEditFullName] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  
  // Bulk create dialog for hospitals
  const [isBulkCreateDialogOpen, setIsBulkCreateDialogOpen] = useState(false);
  const [bulkCreateProvinceId, setBulkCreateProvinceId] = useState('');
  const [isBulkCreating, setIsBulkCreating] = useState(false);
  const [bulkCreateResults, setBulkCreateResults] = useState<any[]>([]);
  
  // Bulk create dialog for health offices
  const [isHealthOfficeBulkDialogOpen, setIsHealthOfficeBulkDialogOpen] = useState(false);
  const [bulkHealthOfficeRegionId, setBulkHealthOfficeRegionId] = useState('');
  const [isBulkCreatingHealthOffice, setIsBulkCreatingHealthOffice] = useState(false);
  const [healthOfficeBulkResults, setHealthOfficeBulkResults] = useState<any[]>([]);
  
  // Bulk create dialog for provincial users (regional admin feature)
  const [isProvincialBulkDialogOpen, setIsProvincialBulkDialogOpen] = useState(false);
  const [bulkProvincialRegionId, setBulkProvincialRegionId] = useState('');
  const [isBulkCreatingProvincial, setIsBulkCreatingProvincial] = useState(false);
  const [provincialBulkResults, setProvincialBulkResults] = useState<any[]>([]);
  
  // Create supervisor dialog (regional admin feature)
  const [isSupervisorDialogOpen, setIsSupervisorDialogOpen] = useState(false);
  const [supervisorEmail, setSupervisorEmail] = useState('');
  const [supervisorPassword, setSupervisorPassword] = useState('');
  const [supervisorFullName, setSupervisorFullName] = useState('');
  const [supervisorPosition, setSupervisorPosition] = useState('');
  const [supervisorOrganization, setSupervisorOrganization] = useState('');
  const [isCreatingSupervisor, setIsCreatingSupervisor] = useState(false);
  
  // Card filter state
  type CardFilter = 'all' | 'pending' | 'active' | 'central_admin' | 'regional' | 'provincial';
  const [cardFilter, setCardFilter] = useState<CardFilter>('all');
  
  // Role filter state for pending/active tabs
  const [roleFilter, setRoleFilter] = useState<string>('all');
  const [regionFilter, setRegionFilter] = useState<string>('all');
  const [provinceFilter, setProvinceFilter] = useState<string>('all');

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setIsLoading(true);
    try {
      const [profilesRes, provincesRes, regionsRes, hospitalsRes] = await Promise.all([
        supabase.from('profiles').select('*').order('created_at', { ascending: false }),
        supabase.from('provinces').select('*').order('name'),
        supabase.from('health_regions').select('*').order('region_number'),
        supabase.from('hospitals').select('*').order('name'),
      ]);

      if (profilesRes.data) setProfiles(profilesRes.data as Profile[]);
      if (provincesRes.data) setProvinces(provincesRes.data);
      if (regionsRes.data) setHealthRegions(regionsRes.data);
      if (hospitalsRes.data) setHospitals(hospitalsRes.data);
    } catch (error) {
      console.error('Error fetching data:', error);
      toast.error('ไม่สามารถโหลดข้อมูลได้');
    } finally {
      setIsLoading(false);
    }
  };

  const getRoleLabel = (role: string) => {
    const labels: Record<string, string> = {
      hospital_it: 'IT โรงพยาบาล',
      provincial: 'ผู้ประเมินระดับจังหวัด (สสจ.)',
      regional: 'ผู้ประเมินระดับเขตสุขภาพ',
      central_admin: 'ส่วนกลาง (Super Admin)',
      health_office: 'สำนักงาน สสจ./เขตสุขภาพ',
      supervisor: 'ผู้นิเทศ',
    };
    return labels[role] || role;
  };

  const getRoleBadgeVariant = (role: string): 'default' | 'secondary' | 'destructive' | 'outline' => {
    const variants: Record<string, 'default' | 'secondary' | 'destructive' | 'outline'> = {
      hospital_it: 'secondary',
      provincial: 'outline',
      regional: 'default',
      central_admin: 'destructive',
      health_office: 'outline',
      supervisor: 'default',
    };
    return variants[role] || 'secondary';
  };

  const getProvinceName = (provinceId: string | null) => {
    if (!provinceId) return '-';
    const province = provinces.find(p => p.id === provinceId);
    return province?.name || '-';
  };

  const getRegionName = (regionId: string | null) => {
    if (!regionId) return '-';
    const region = healthRegions.find(r => r.id === regionId);
    return region ? `เขต ${region.region_number}` : '-';
  };

  const getHospitalName = (hospitalId: string | null) => {
    if (!hospitalId) return '-';
    const hospital = hospitals.find(h => h.id === hospitalId);
    return hospital?.name || '-';
  };

  const handleEditProfile = (profileToEdit: Profile) => {
    setSelectedProfile(profileToEdit);
    setEditRole(profileToEdit.role);
    setEditProvinceId(profileToEdit.province_id || '');
    setEditRegionId(profileToEdit.health_region_id || '');
    setEditHospitalId(profileToEdit.hospital_id || '');
    setEditFullName(profileToEdit.full_name || '');
    setIsEditDialogOpen(true);
  };

  const handleApproveClick = (profileToApprove: Profile) => {
    setSelectedProfile(profileToApprove);
    
    // Pre-fill based on existing data (for bulk created users)
    if (profileToApprove.hospital_id) {
      // User was created via bulk - pre-fill hospital_it role
      setEditRole('hospital_it');
      const hospital = hospitals.find(h => h.id === profileToApprove.hospital_id);
      setEditHospitalId(profileToApprove.hospital_id);
      setEditProvinceId(hospital?.province_id || profileToApprove.province_id || '');
    } else if (profileToApprove.province_id) {
      // User already has province - pre-fill provincial role
      setEditRole('provincial');
      setEditProvinceId(profileToApprove.province_id);
      setEditHospitalId('');
    } else {
      // Try to auto-match province from email pattern admin.{code}@ctam.moph
      const emailMatch = profileToApprove.email.match(/^admin\.(\d+)@ctam\.moph$/);
      if (emailMatch) {
        const provinceCode = emailMatch[1];
        const matchedProvince = provinces.find(p => p.code === provinceCode);
        if (matchedProvince) {
          setEditRole('provincial');
          setEditProvinceId(matchedProvince.id);
          setEditHospitalId('');
        } else {
          // Code not found - default
          setEditRole('provincial');
          setEditProvinceId('');
          setEditHospitalId('');
        }
      } else {
        // Regular user - default to provincial
        setEditRole('provincial');
        setEditProvinceId('');
        setEditHospitalId('');
      }
    }
    setEditRegionId('');
    setEditFullName(profileToApprove.full_name || '');
    setIsApproveDialogOpen(true);
  };

  const handleApproveUser = async () => {
    if (!selectedProfile) return;
    
    setIsSaving(true);
    try {
      const updateData: Partial<Profile> = {
        role: editRole as Profile['role'],
        full_name: editFullName || null,
        province_id: editProvinceId || null,
        health_region_id: editRegionId || null,
        hospital_id: editHospitalId || null,
        is_active: true,
      };

      // Clear irrelevant fields based on role
      if (editRole === 'central_admin') {
        updateData.province_id = null;
        updateData.health_region_id = null;
        updateData.hospital_id = null;
      } else if (editRole === 'regional') {
        updateData.province_id = null;
        updateData.hospital_id = null;
      } else if (editRole === 'provincial') {
        updateData.hospital_id = null;
        updateData.health_region_id = null;
      } else if (editRole === 'hospital_it') {
        updateData.health_region_id = null;
      }

      const { error } = await supabase
        .from('profiles')
        .update(updateData)
        .eq('id', selectedProfile.id);

      if (error) throw error;

      toast.success('อนุมัติผู้ใช้สำเร็จ');
      setIsApproveDialogOpen(false);
      fetchData();
    } catch (error) {
      console.error('Error approving user:', error);
      toast.error('ไม่สามารถอนุมัติผู้ใช้ได้');
    } finally {
      setIsSaving(false);
    }
  };

  const handleRejectUser = async (profileToReject: Profile) => {
    if (!confirm('คุณต้องการปฏิเสธผู้ใช้นี้หรือไม่?')) return;
    
    try {
      // We can't delete auth users, so we just keep is_active = false
      // Optionally mark them as rejected somehow
      toast.info('ผู้ใช้ถูกปฏิเสธ (ยังคงอยู่ในระบบแต่ไม่สามารถใช้งานได้)');
    } catch (error) {
      console.error('Error rejecting user:', error);
      toast.error('ไม่สามารถปฏิเสธผู้ใช้ได้');
    }
  };

  const handleBulkCreateUsers = async () => {
    if (!bulkCreateProvinceId) {
      toast.error('กรุณาเลือกจังหวัด');
      return;
    }

    setIsBulkCreating(true);
    setBulkCreateResults([]);

    try {
      // Get current session token
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) {
        toast.error('กรุณาเข้าสู่ระบบใหม่');
        return;
      }

      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/create-hospital-users`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${session.access_token}`,
          },
          body: JSON.stringify({ province_id: bulkCreateProvinceId }),
        }
      );

      const data = await response.json();

      if (data.success) {
        setBulkCreateResults(data.results);
        const successCount = data.results.filter((r: any) => r.status === 'success').length;
        const skippedCount = data.results.filter((r: any) => r.status === 'skipped').length;
        toast.success(`สร้างผู้ใช้สำเร็จ ${successCount} ราย, ข้าม ${skippedCount} ราย`);
        fetchData();
      } else {
        toast.error(data.error || 'เกิดข้อผิดพลาด');
      }
    } catch (error) {
      console.error('Error creating bulk users:', error);
      toast.error('ไม่สามารถสร้างผู้ใช้ได้');
    } finally {
      setIsBulkCreating(false);
    }
  };

  const handleBulkCreateHealthOfficeUsers = async () => {
    if (!bulkHealthOfficeRegionId) {
      toast.error('กรุณาเลือกเขตสุขภาพ');
      return;
    }

    setIsBulkCreatingHealthOffice(true);
    setHealthOfficeBulkResults([]);

    try {
      // Get current session token
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) {
        toast.error('กรุณาเข้าสู่ระบบใหม่');
        return;
      }

      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/create-health-office-users`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${session.access_token}`,
          },
          body: JSON.stringify({ health_region_id: bulkHealthOfficeRegionId }),
        }
      );

      const data = await response.json();

      if (data.success) {
        setHealthOfficeBulkResults(data.results);
        const successCount = data.results.filter((r: any) => r.status === 'success').length;
        const skippedCount = data.results.filter((r: any) => r.status === 'skipped').length;
        toast.success(`สร้างผู้ใช้ สสจ./เขตสุขภาพ สำเร็จ ${successCount} ราย, ข้าม ${skippedCount} ราย`);
        fetchData();
      } else {
        toast.error(data.error || 'เกิดข้อผิดพลาด');
      }
    } catch (error) {
      console.error('Error creating health office bulk users:', error);
      toast.error('ไม่สามารถสร้างผู้ใช้ได้');
    } finally {
      setIsBulkCreatingHealthOffice(false);
    }
  };

  // Create provincial users for a health region (regional admin can use this)
  const handleBulkCreateProvincialUsers = async () => {
    // For regional users, use their own region; for central_admin, use selected region
    const regionId = currentUserProfile?.role === 'regional' 
      ? currentUserProfile.health_region_id 
      : bulkProvincialRegionId;

    if (!regionId) {
      toast.error('กรุณาเลือกเขตสุขภาพ');
      return;
    }

    setIsBulkCreatingProvincial(true);
    setProvincialBulkResults([]);

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) {
        toast.error('กรุณาเข้าสู่ระบบใหม่');
        return;
      }

      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/create-provincial-users`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${session.access_token}`,
          },
          body: JSON.stringify({ health_region_id: regionId }),
        }
      );

      const data = await response.json();

      if (data.success) {
        setProvincialBulkResults(data.results);
        const successCount = data.results.filter((r: any) => r.status === 'success').length;
        const skippedCount = data.results.filter((r: any) => r.status === 'skipped').length;
        toast.success(`สร้างผู้ใช้ระดับจังหวัดสำเร็จ ${successCount} ราย, ข้าม ${skippedCount} ราย`);
        fetchData();
      } else {
        toast.error(data.error || 'เกิดข้อผิดพลาด');
      }
    } catch (error) {
      console.error('Error creating provincial bulk users:', error);
      toast.error('ไม่สามารถสร้างผู้ใช้ได้');
    } finally {
      setIsBulkCreatingProvincial(false);
    }
  };

  // Create supervisor user
  const handleCreateSupervisor = async () => {
    if (!supervisorEmail || !supervisorPassword) {
      toast.error('กรุณากรอกอีเมลและรหัสผ่าน');
      return;
    }

    // Validate email format - must contain only ASCII characters and valid email format
    const emailRegex = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
    if (!emailRegex.test(supervisorEmail)) {
      toast.error('รูปแบบอีเมลไม่ถูกต้อง กรุณาตรวจสอบว่าไม่มีตัวอักษรภาษาไทยในอีเมล');
      return;
    }

    if (supervisorPassword.length < 6) {
      toast.error('รหัสผ่านต้องมีอย่างน้อย 6 ตัวอักษร');
      return;
    }

    setIsCreatingSupervisor(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) {
        toast.error('กรุณาเข้าสู่ระบบใหม่');
        return;
      }

      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/create-supervisor-users`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${session.access_token}`,
          },
          body: JSON.stringify({ 
            email: supervisorEmail, 
            password: supervisorPassword,
            full_name: supervisorFullName,
            position: supervisorPosition,
            organization: supervisorOrganization 
          }),
        }
      );

      const data = await response.json();

      if (data.success) {
        toast.success('สร้างผู้นิเทศสำเร็จ');
        setIsSupervisorDialogOpen(false);
        setSupervisorEmail('');
        setSupervisorPassword('');
        setSupervisorFullName('');
        setSupervisorPosition('');
        setSupervisorOrganization('');
        fetchData();
      } else {
        toast.error(data.error || 'เกิดข้อผิดพลาด');
      }
    } catch (error) {
      console.error('Error creating supervisor:', error);
      toast.error('ไม่สามารถสร้างผู้นิเทศได้');
    } finally {
      setIsCreatingSupervisor(false);
    }
  };

  const handleSaveProfile = async () => {
    if (!selectedProfile) return;
    
    setIsSaving(true);
    try {
      const updateData: Partial<Profile> = {
        role: editRole as Profile['role'],
        full_name: editFullName || null,
        province_id: editProvinceId || null,
        health_region_id: editRegionId || null,
        hospital_id: editHospitalId || null,
      };

      // Clear irrelevant fields based on role
      if (editRole === 'central_admin') {
        updateData.province_id = null;
        updateData.health_region_id = null;
        updateData.hospital_id = null;
      } else if (editRole === 'regional') {
        updateData.province_id = null;
        updateData.hospital_id = null;
      } else if (editRole === 'provincial') {
        updateData.hospital_id = null;
        updateData.health_region_id = null;
      } else if (editRole === 'hospital_it') {
        updateData.health_region_id = null;
      }

      const { error } = await supabase
        .from('profiles')
        .update(updateData)
        .eq('id', selectedProfile.id);

      if (error) throw error;

      toast.success('บันทึกข้อมูลสำเร็จ');
      setIsEditDialogOpen(false);
      fetchData();
    } catch (error) {
      console.error('Error updating profile:', error);
      toast.error('ไม่สามารถบันทึกข้อมูลได้');
    } finally {
      setIsSaving(false);
    }
  };

  const pendingProfiles = profiles.filter(p => !p.is_active);
  const activeProfiles = profiles.filter(p => p.is_active);

  // Apply card filter
  const getFilteredByCard = (profileList: Profile[]) => {
    switch (cardFilter) {
      case 'pending':
        return profileList.filter(p => !p.is_active);
      case 'active':
        return profileList.filter(p => p.is_active);
      case 'central_admin':
        return profileList.filter(p => p.role === 'central_admin' && p.is_active);
      case 'regional':
        return profileList.filter(p => p.role === 'regional' && p.is_active);
      case 'provincial':
        return profileList.filter(p => p.role === 'provincial' && p.is_active);
      default:
        return profileList;
    }
  };

  const cardFilteredProfiles = getFilteredByCard(profiles);
  
  // Get provinces filtered by region
  const filteredProvincesByRegion = regionFilter !== 'all'
    ? provinces.filter(p => p.health_region_id === regionFilter)
    : provinces;

  const filteredPendingProfiles = cardFilteredProfiles.filter(p => {
    if (p.is_active) return false;
    
    // Search filter
    const matchesSearch = p.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (p.full_name?.toLowerCase() || '').includes(searchTerm.toLowerCase());
    
    // Role filter
    const matchesRole = roleFilter === 'all' || p.role === roleFilter;
    
    // Region filter
    let matchesRegion = true;
    if (regionFilter !== 'all') {
      if (p.health_region_id) {
        matchesRegion = p.health_region_id === regionFilter;
      } else if (p.province_id) {
        const province = provinces.find(prov => prov.id === p.province_id);
        matchesRegion = province?.health_region_id === regionFilter;
      } else if (p.hospital_id) {
        const hospital = hospitals.find(h => h.id === p.hospital_id);
        const province = provinces.find(prov => prov.id === hospital?.province_id);
        matchesRegion = province?.health_region_id === regionFilter;
      } else {
        matchesRegion = false;
      }
    }
    
    // Province filter
    let matchesProvince = true;
    if (provinceFilter !== 'all') {
      if (p.province_id) {
        matchesProvince = p.province_id === provinceFilter;
      } else if (p.hospital_id) {
        const hospital = hospitals.find(h => h.id === p.hospital_id);
        matchesProvince = hospital?.province_id === provinceFilter;
      } else {
        matchesProvince = false;
      }
    }
    
    return matchesSearch && matchesRole && matchesRegion && matchesProvince;
  });

  const filteredActiveProfiles = cardFilteredProfiles.filter(p => {
    if (!p.is_active) return false;
    
    // Search filter
    const matchesSearch = p.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (p.full_name?.toLowerCase() || '').includes(searchTerm.toLowerCase());
    
    // Role filter
    const matchesRole = roleFilter === 'all' || p.role === roleFilter;
    
    // Region filter
    let matchesRegion = true;
    if (regionFilter !== 'all') {
      if (p.health_region_id) {
        matchesRegion = p.health_region_id === regionFilter;
      } else if (p.province_id) {
        const province = provinces.find(prov => prov.id === p.province_id);
        matchesRegion = province?.health_region_id === regionFilter;
      } else if (p.hospital_id) {
        const hospital = hospitals.find(h => h.id === p.hospital_id);
        const province = provinces.find(prov => prov.id === hospital?.province_id);
        matchesRegion = province?.health_region_id === regionFilter;
      } else {
        matchesRegion = false;
      }
    }
    
    // Province filter
    let matchesProvince = true;
    if (provinceFilter !== 'all') {
      if (p.province_id) {
        matchesProvince = p.province_id === provinceFilter;
      } else if (p.hospital_id) {
        const hospital = hospitals.find(h => h.id === p.hospital_id);
        matchesProvince = hospital?.province_id === provinceFilter;
      } else {
        matchesProvince = false;
      }
    }
    
    return matchesSearch && matchesRole && matchesRegion && matchesProvince;
  });

  const filteredHospitals = editProvinceId 
    ? hospitals.filter(h => h.province_id === editProvinceId)
    : hospitals;

  // Stats
  const stats = {
    total: profiles.length,
    pending: pendingProfiles.length,
    active: activeProfiles.length,
    centralAdmin: profiles.filter(p => p.role === 'central_admin' && p.is_active).length,
    regional: profiles.filter(p => p.role === 'regional' && p.is_active).length,
    provincial: profiles.filter(p => p.role === 'provincial' && p.is_active).length,
  };

  const handleCardClick = (filter: CardFilter) => {
    setCardFilter(filter);
    // Auto switch to appropriate tab
    if (filter === 'pending') {
      setActiveTab('pending');
    } else if (['active', 'central_admin', 'regional', 'provincial'].includes(filter)) {
      setActiveTab('active');
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('th-TH', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  return (
    <DashboardLayout>
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
        <div>
          <h2 className="text-2xl font-bold mb-2">จัดการผู้ใช้งาน</h2>
          <p className="text-muted-foreground">
            อนุมัติผู้ใช้ใหม่และจัดการสิทธิ์ผู้ใช้งานทั้งหมดในระบบ
          </p>
        </div>
        <div className="flex gap-2 flex-wrap">
          {/* Regional admin can create supervisor */}
          {currentUserProfile?.role === 'regional' && (
            <Button 
              onClick={() => setIsSupervisorDialogOpen(true)} 
              variant="default" 
              className="gap-2"
            >
              <UserPlus className="h-4 w-4" />
              สร้างผู้นิเทศ
            </Button>
          )}
          {/* Regional admin can create provincial users for their region */}
          {(currentUserProfile?.role === 'regional' || currentUserProfile?.role === 'central_admin') && (
            <Button 
              onClick={() => {
                // For regional, auto-fill their region
                if (currentUserProfile?.role === 'regional') {
                  setBulkProvincialRegionId(currentUserProfile.health_region_id || '');
                }
                setIsProvincialBulkDialogOpen(true);
              }} 
              variant="outline" 
              className="gap-2"
            >
              <MapPin className="h-4 w-4" />
              สร้างแอดมินระดับจังหวัด
            </Button>
          )}
          {currentUserProfile?.role === 'central_admin' && (
            <>
              <Button onClick={() => setIsHealthOfficeBulkDialogOpen(true)} variant="outline" className="gap-2">
                <Building2 className="h-4 w-4" />
                สร้างผู้ใช้งาน สสจ./เขตสุขภาพ แบบ Bulk
              </Button>
              <Button onClick={() => setIsBulkCreateDialogOpen(true)} className="gap-2">
                <UserPlus className="h-4 w-4" />
                สร้างผู้ใช้ รพ. แบบ Bulk
              </Button>
            </>
          )}
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-6 gap-4 mb-8">
        <Card 
          className={`cursor-pointer transition-all hover:shadow-md ${cardFilter === 'all' ? 'ring-2 ring-primary' : ''}`}
          onClick={() => handleCardClick('all')}
        >
          <CardContent className="p-4">
            <div className="text-2xl font-bold">{stats.total}</div>
            <div className="text-sm text-muted-foreground">ทั้งหมด</div>
          </CardContent>
        </Card>
        <Card 
          className={`cursor-pointer transition-all hover:shadow-md ${cardFilter === 'pending' ? 'ring-2 ring-warning' : ''} ${stats.pending > 0 ? 'border-warning' : ''}`}
          onClick={() => handleCardClick('pending')}
        >
          <CardContent className="p-4">
            <div className="text-2xl font-bold text-warning">{stats.pending}</div>
            <div className="text-sm text-muted-foreground">รอการอนุมัติ</div>
          </CardContent>
        </Card>
        <Card 
          className={`cursor-pointer transition-all hover:shadow-md ${cardFilter === 'active' ? 'ring-2 ring-success' : ''}`}
          onClick={() => handleCardClick('active')}
        >
          <CardContent className="p-4">
            <div className="text-2xl font-bold text-success">{stats.active}</div>
            <div className="text-sm text-muted-foreground">ใช้งาน</div>
          </CardContent>
        </Card>
        <Card 
          className={`cursor-pointer transition-all hover:shadow-md ${cardFilter === 'central_admin' ? 'ring-2 ring-destructive' : ''}`}
          onClick={() => handleCardClick('central_admin')}
        >
          <CardContent className="p-4">
            <div className="text-2xl font-bold text-destructive">{stats.centralAdmin}</div>
            <div className="text-sm text-muted-foreground">Super Admin</div>
          </CardContent>
        </Card>
        <Card 
          className={`cursor-pointer transition-all hover:shadow-md ${cardFilter === 'regional' ? 'ring-2 ring-primary' : ''}`}
          onClick={() => handleCardClick('regional')}
        >
          <CardContent className="p-4">
            <div className="text-2xl font-bold text-primary">{stats.regional}</div>
            <div className="text-sm text-muted-foreground">เขตสุขภาพ</div>
          </CardContent>
        </Card>
        <Card 
          className={`cursor-pointer transition-all hover:shadow-md ${cardFilter === 'provincial' ? 'ring-2 ring-accent' : ''}`}
          onClick={() => handleCardClick('provincial')}
        >
          <CardContent className="p-4">
            <div className="text-2xl font-bold text-accent">{stats.provincial}</div>
            <div className="text-sm text-muted-foreground">สสจ.</div>
          </CardContent>
        </Card>
      </div>

      {/* Search and Refresh */}
      <div className="flex justify-end gap-2 mb-4">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="ค้นหาผู้ใช้..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-9 w-[200px]"
          />
        </div>
        <Button variant="outline" size="icon" onClick={fetchData}>
          <RefreshCw className={`h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} />
        </Button>
      </div>

      {/* Pending Users Section */}
      {(cardFilter === 'all' || cardFilter === 'pending') && (
          <Card>
            <CardHeader>
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                  <CardTitle className="flex items-center gap-2">
                    <Clock className="h-5 w-5 text-warning" />
                    ผู้ใช้รอการอนุมัติ
                  </CardTitle>
                  <CardDescription>
                    ตรวจสอบและอนุมัติผู้ใช้ใหม่ พร้อมกำหนดบทบาทและหน่วยงาน
                  </CardDescription>
                </div>
                <div className="flex flex-wrap gap-2">
                  <Select value={roleFilter} onValueChange={setRoleFilter}>
                    <SelectTrigger className="w-[140px]">
                      <SelectValue placeholder="บทบาท" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">ทุกบทบาท</SelectItem>
                      <SelectItem value="hospital_it">IT โรงพยาบาล</SelectItem>
                      <SelectItem value="health_office">IT สสจ.</SelectItem>
                      <SelectItem value="provincial">แอดมินจังหวัด</SelectItem>
                      <SelectItem value="regional">แอดมินเขตสุขภาพ</SelectItem>
                      <SelectItem value="supervisor">ผู้นิเทศ</SelectItem>
                      <SelectItem value="central_admin">Super Admin</SelectItem>
                    </SelectContent>
                  </Select>
                  <Select value={regionFilter} onValueChange={(val) => {
                    setRegionFilter(val);
                    setProvinceFilter('all'); // Reset province when region changes
                  }}>
                    <SelectTrigger className="w-[140px]">
                      <SelectValue placeholder="เขตสุขภาพ" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">ทุกเขต</SelectItem>
                      {healthRegions.map(region => (
                        <SelectItem key={region.id} value={region.id}>
                          เขต {region.region_number}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Select value={provinceFilter} onValueChange={setProvinceFilter}>
                    <SelectTrigger className="w-[160px]">
                      <SelectValue placeholder="จังหวัด" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">ทุกจังหวัด</SelectItem>
                      {filteredProvincesByRegion.map(province => (
                        <SelectItem key={province.id} value={province.id}>
                          {province.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <div className="text-center py-8">
                  <RefreshCw className="h-6 w-6 animate-spin mx-auto text-muted-foreground" />
                </div>
              ) : filteredPendingProfiles.length === 0 ? (
                <div className="text-center py-12 text-muted-foreground">
                  <UserCheck className="h-12 w-12 mx-auto mb-4 opacity-50" />
                  <p>ไม่มีผู้ใช้รอการอนุมัติ</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {filteredPendingProfiles.map((p) => (
                    <Card key={p.id} className="border-warning/30">
                      <CardContent className="p-4">
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                          <div className="space-y-1">
                            <div className="font-medium">{p.full_name || 'ไม่ระบุชื่อ'}</div>
                            <div className="text-sm text-muted-foreground">{p.email}</div>
                            {p.phone && (
                              <div className="flex items-center gap-1 text-sm text-muted-foreground">
                                <Phone className="h-3 w-3" />
                                {p.phone}
                              </div>
                            )}
                            <div className="text-xs text-muted-foreground">
                              สมัครเมื่อ: {formatDate(p.created_at)}
                            </div>
                          </div>
                          <div className="flex gap-2">
                            <Button
                              variant="default"
                              size="sm"
                              onClick={() => handleApproveClick(p)}
                              className="gap-1"
                            >
                              <CheckCircle className="h-4 w-4" />
                              อนุมัติ
                            </Button>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => handleRejectUser(p)}
                              className="gap-1 text-destructive hover:text-destructive"
                            >
                              <XCircle className="h-4 w-4" />
                              ปฏิเสธ
                            </Button>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
      )}

      {/* Active Users Section */}
      {(cardFilter !== 'pending') && (
          <Card>
            <CardHeader>
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                  <CardTitle className="flex items-center gap-2">
                    <Users className="h-5 w-5" />
                    รายชื่อผู้ใช้งาน
                  </CardTitle>
                  <CardDescription>ผู้ใช้ที่ได้รับการอนุมัติแล้ว</CardDescription>
                </div>
                <div className="flex flex-wrap gap-2">
                  <Select value={roleFilter} onValueChange={setRoleFilter}>
                    <SelectTrigger className="w-[140px]">
                      <SelectValue placeholder="บทบาท" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">ทุกบทบาท</SelectItem>
                      <SelectItem value="hospital_it">IT โรงพยาบาล</SelectItem>
                      <SelectItem value="health_office">IT สสจ.</SelectItem>
                      <SelectItem value="provincial">แอดมินจังหวัด</SelectItem>
                      <SelectItem value="regional">แอดมินเขตสุขภาพ</SelectItem>
                      <SelectItem value="supervisor">ผู้นิเทศ</SelectItem>
                      <SelectItem value="central_admin">Super Admin</SelectItem>
                    </SelectContent>
                  </Select>
                  <Select value={regionFilter} onValueChange={(val) => {
                    setRegionFilter(val);
                    setProvinceFilter('all');
                  }}>
                    <SelectTrigger className="w-[140px]">
                      <SelectValue placeholder="เขตสุขภาพ" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">ทุกเขต</SelectItem>
                      {healthRegions.map(region => (
                        <SelectItem key={region.id} value={region.id}>
                          เขต {region.region_number}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Select value={provinceFilter} onValueChange={setProvinceFilter}>
                    <SelectTrigger className="w-[160px]">
                      <SelectValue placeholder="จังหวัด" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">ทุกจังหวัด</SelectItem>
                      {filteredProvincesByRegion.map(province => (
                        <SelectItem key={province.id} value={province.id}>
                          {province.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <div className="rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>อีเมล</TableHead>
                      <TableHead>ชื่อ-นามสกุล</TableHead>
                      <TableHead>เบอร์โทร</TableHead>
                      <TableHead>บทบาท</TableHead>
                      <TableHead>หน่วยงาน</TableHead>
                      <TableHead className="text-right">จัดการ</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {isLoading ? (
                      <TableRow>
                        <TableCell colSpan={6} className="text-center py-8">
                          <RefreshCw className="h-6 w-6 animate-spin mx-auto text-muted-foreground" />
                        </TableCell>
                      </TableRow>
                    ) : filteredActiveProfiles.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                          ไม่พบข้อมูลผู้ใช้
                        </TableCell>
                      </TableRow>
                    ) : (
                      filteredActiveProfiles.map((p) => (
                        <TableRow key={p.id}>
                          <TableCell className="font-medium">{p.email}</TableCell>
                          <TableCell>{p.full_name || '-'}</TableCell>
                          <TableCell>{p.phone || '-'}</TableCell>
                          <TableCell>
                            <Badge variant={getRoleBadgeVariant(p.role)}>
                              {getRoleLabel(p.role)}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            {p.role === 'hospital_it' && (
                              <div className="flex items-center gap-1 text-sm">
                                <Building2 className="h-3 w-3" />
                                {getHospitalName(p.hospital_id)}
                              </div>
                            )}
                            {p.role === 'provincial' && (
                              <div className="flex items-center gap-1 text-sm">
                                <MapPin className="h-3 w-3" />
                                {getProvinceName(p.province_id)}
                              </div>
                            )}
                            {p.role === 'regional' && (
                              <div className="flex items-center gap-1 text-sm">
                                <MapPin className="h-3 w-3" />
                                {getRegionName(p.health_region_id)}
                              </div>
                            )}
                            {p.role === 'supervisor' && (
                              <div className="flex items-center gap-1 text-sm">
                                <MapPin className="h-3 w-3" />
                                {getRegionName(p.health_region_id)}
                              </div>
                            )}
                            {p.role === 'central_admin' && (
                              <span className="text-sm text-muted-foreground">ส่วนกลาง</span>
                            )}
                          </TableCell>
                          <TableCell className="text-right">
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => handleEditProfile(p)}
                            >
                              <Edit className="h-4 w-4" />
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
      )}

      {/* Approve Dialog */}
      <Dialog open={isApproveDialogOpen} onOpenChange={setIsApproveDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>อนุมัติผู้ใช้</DialogTitle>
            <DialogDescription>
              กำหนดบทบาทและหน่วยงานสำหรับ {selectedProfile?.email}
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>ชื่อ-นามสกุล</Label>
              <Input
                value={editFullName}
                onChange={(e) => setEditFullName(e.target.value)}
                placeholder="ระบุชื่อ-นามสกุล"
              />
            </div>

            <div className="space-y-2">
              <Label>บทบาท</Label>
              <Select value={editRole} onValueChange={setEditRole}>
                <SelectTrigger>
                  <SelectValue placeholder="เลือกบทบาท" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="hospital_it">IT โรงพยาบาล</SelectItem>
                  <SelectItem value="provincial">ผู้ประเมินระดับจังหวัด (สสจ.)</SelectItem>
                  <SelectItem value="regional">ผู้ประเมินระดับเขตสุขภาพ</SelectItem>
                  <SelectItem value="central_admin">ส่วนกลาง (Super Admin)</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {editRole === 'regional' && (
              <div className="space-y-2">
                <Label>เขตสุขภาพ</Label>
                <Select value={editRegionId} onValueChange={setEditRegionId}>
                  <SelectTrigger>
                    <SelectValue placeholder="เลือกเขตสุขภาพ" />
                  </SelectTrigger>
                  <SelectContent>
                    {healthRegions.map((region) => (
                      <SelectItem key={region.id} value={region.id}>
                        เขตสุขภาพที่ {region.region_number}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            {editRole === 'provincial' && (
              <div className="space-y-2">
                <Label>จังหวัด</Label>
                <SearchableSelect
                  options={provinces.map(p => ({ value: p.id, label: p.name }))}
                  value={editProvinceId}
                  onValueChange={setEditProvinceId}
                  placeholder="เลือกจังหวัด"
                  searchPlaceholder="พิมพ์ชื่อจังหวัด..."
                  emptyMessage="ไม่พบจังหวัด"
                />
              </div>
            )}

            {editRole === 'hospital_it' && (
              <>
                <div className="space-y-2">
                  <Label>จังหวัด</Label>
                  <SearchableSelect
                    options={provinces.map(p => ({ value: p.id, label: p.name }))}
                    value={editProvinceId}
                    onValueChange={(v) => {
                      setEditProvinceId(v);
                      setEditHospitalId('');
                    }}
                    placeholder="เลือกจังหวัด"
                    searchPlaceholder="พิมพ์ชื่อจังหวัด..."
                    emptyMessage="ไม่พบจังหวัด"
                  />
                </div>

                <div className="space-y-2">
                  <Label>โรงพยาบาล</Label>
                  <SearchableSelect
                    options={filteredHospitals.map(h => ({ value: h.id, label: h.name }))}
                    value={editHospitalId}
                    onValueChange={setEditHospitalId}
                    placeholder="เลือกโรงพยาบาล"
                    searchPlaceholder="พิมพ์ชื่อโรงพยาบาล..."
                    emptyMessage="ไม่พบโรงพยาบาล"
                    disabled={!editProvinceId}
                  />
                </div>
              </>
            )}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setIsApproveDialogOpen(false)}>
              ยกเลิก
            </Button>
            <Button onClick={handleApproveUser} disabled={isSaving}>
              {isSaving ? 'กำลังอนุมัติ...' : 'อนุมัติ'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Dialog */}
      <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>แก้ไขข้อมูลผู้ใช้</DialogTitle>
            <DialogDescription>
              {selectedProfile?.email}
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>ชื่อ-นามสกุล</Label>
              <Input
                value={editFullName}
                onChange={(e) => setEditFullName(e.target.value)}
                placeholder="ระบุชื่อ-นามสกุล"
              />
            </div>

            <div className="space-y-2">
              <Label>บทบาท</Label>
              <Select value={editRole} onValueChange={setEditRole}>
                <SelectTrigger>
                  <SelectValue placeholder="เลือกบทบาท" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="hospital_it">IT โรงพยาบาล</SelectItem>
                  <SelectItem value="provincial">ผู้ประเมินระดับจังหวัด (สสจ.)</SelectItem>
                  <SelectItem value="regional">ผู้ประเมินระดับเขตสุขภาพ</SelectItem>
                  <SelectItem value="central_admin">ส่วนกลาง (Super Admin)</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {editRole === 'regional' && (
              <div className="space-y-2">
                <Label>เขตสุขภาพ</Label>
                <Select value={editRegionId} onValueChange={setEditRegionId}>
                  <SelectTrigger>
                    <SelectValue placeholder="เลือกเขตสุขภาพ" />
                  </SelectTrigger>
                  <SelectContent>
                    {healthRegions.map((region) => (
                      <SelectItem key={region.id} value={region.id}>
                        เขตสุขภาพที่ {region.region_number}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            {editRole === 'provincial' && (
              <div className="space-y-2">
                <Label>จังหวัด</Label>
                <SearchableSelect
                  options={provinces.map(p => ({ value: p.id, label: p.name }))}
                  value={editProvinceId}
                  onValueChange={setEditProvinceId}
                  placeholder="เลือกจังหวัด"
                  searchPlaceholder="พิมพ์ชื่อจังหวัด..."
                  emptyMessage="ไม่พบจังหวัด"
                />
              </div>
            )}

            {editRole === 'hospital_it' && (
              <>
                <div className="space-y-2">
                  <Label>จังหวัด</Label>
                  <SearchableSelect
                    options={provinces.map(p => ({ value: p.id, label: p.name }))}
                    value={editProvinceId}
                    onValueChange={(v) => {
                      setEditProvinceId(v);
                      setEditHospitalId('');
                    }}
                    placeholder="เลือกจังหวัด"
                    searchPlaceholder="พิมพ์ชื่อจังหวัด..."
                    emptyMessage="ไม่พบจังหวัด"
                  />
                </div>

                <div className="space-y-2">
                  <Label>โรงพยาบาล</Label>
                  <SearchableSelect
                    options={filteredHospitals.map(h => ({ value: h.id, label: h.name }))}
                    value={editHospitalId}
                    onValueChange={setEditHospitalId}
                    placeholder="เลือกโรงพยาบาล"
                    searchPlaceholder="พิมพ์ชื่อโรงพยาบาล..."
                    emptyMessage="ไม่พบโรงพยาบาล"
                    disabled={!editProvinceId}
                  />
                </div>
              </>
            )}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setIsEditDialogOpen(false)}>
              ยกเลิก
            </Button>
            <Button onClick={handleSaveProfile} disabled={isSaving}>
              {isSaving ? 'กำลังบันทึก...' : 'บันทึก'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Bulk Create Dialog */}
      <Dialog open={isBulkCreateDialogOpen} onOpenChange={setIsBulkCreateDialogOpen}>
        <DialogContent className="sm:max-w-lg max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>สร้างผู้ใช้ IT รพ. แบบ Bulk</DialogTitle>
            <DialogDescription>
              สร้างผู้ใช้สำหรับโรงพยาบาลทั้งหมดในจังหวัดที่เลือก
              <br />
              <span className="text-primary font-medium">Email: รหัสรพ@ctam.moph | Password: รหัสรพ</span>
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>เลือกจังหวัด</Label>
              <SearchableSelect
                options={provinces.map(p => ({ value: p.id, label: p.name }))}
                value={bulkCreateProvinceId}
                onValueChange={setBulkCreateProvinceId}
                placeholder="เลือกจังหวัด"
                searchPlaceholder="พิมพ์ชื่อจังหวัด..."
                emptyMessage="ไม่พบจังหวัด"
              />
            </div>

            {bulkCreateResults.length > 0 && (
              <div className="space-y-2">
                <Label>ผลลัพธ์การสร้างผู้ใช้</Label>
                <div className="max-h-60 overflow-y-auto border rounded-md p-2 space-y-1">
                  {bulkCreateResults.map((result, index) => (
                    <div 
                      key={index} 
                      className={`text-sm p-2 rounded ${
                        result.status === 'success' 
                          ? 'bg-success/10 text-success' 
                          : result.status === 'skipped' 
                          ? 'bg-warning/10 text-warning' 
                          : 'bg-destructive/10 text-destructive'
                      }`}
                    >
                      <span className="font-medium">{result.hospital_code}</span> - {result.hospital_name}
                      <br />
                      <span className="text-xs">{result.message}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => {
              setIsBulkCreateDialogOpen(false);
              setBulkCreateResults([]);
              setBulkCreateProvinceId('');
            }}>
              ปิด
            </Button>
            {bulkCreateResults.length === 0 && (
              <Button 
                onClick={handleBulkCreateUsers} 
                disabled={isBulkCreating || !bulkCreateProvinceId}
              >
                {isBulkCreating ? 'กำลังสร้าง...' : 'สร้างผู้ใช้'}
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Health Office Bulk Create Dialog */}
      <Dialog open={isHealthOfficeBulkDialogOpen} onOpenChange={setIsHealthOfficeBulkDialogOpen}>
        <DialogContent className="sm:max-w-lg max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>สร้างผู้ใช้ สสจ./เขตสุขภาพ แบบ Bulk</DialogTitle>
            <DialogDescription>
              สร้างผู้ใช้สำหรับ สสจ. และสำนักงานเขตสุขภาพทั้งหมดในเขตที่เลือก
              <br />
              <span className="text-primary font-medium">Email: รหัส 5 หลัก@ctam.moph | Password: รหัส 5 หลัก</span>
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>เลือกเขตสุขภาพ</Label>
              <Select value={bulkHealthOfficeRegionId} onValueChange={setBulkHealthOfficeRegionId}>
                <SelectTrigger>
                  <SelectValue placeholder="เลือกเขตสุขภาพ" />
                </SelectTrigger>
                <SelectContent>
                  {healthRegions.map((region) => (
                    <SelectItem key={region.id} value={region.id}>
                      เขตสุขภาพที่ {region.region_number}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {healthOfficeBulkResults.length > 0 && (
              <div className="space-y-2">
                <Label>ผลลัพธ์การสร้างผู้ใช้</Label>
                <div className="max-h-60 overflow-y-auto border rounded-md p-2 space-y-1">
                  {healthOfficeBulkResults.map((result, index) => (
                    <div 
                      key={index} 
                      className={`text-sm p-2 rounded ${
                        result.status === 'success' 
                          ? 'bg-success/10 text-success' 
                          : result.status === 'skipped' 
                          ? 'bg-warning/10 text-warning' 
                          : 'bg-destructive/10 text-destructive'
                      }`}
                    >
                      <span className="font-medium">{result.office_code}</span> - {result.office_name}
                      {result.email && <span className="text-xs block">Email: {result.email} | Password: {result.password}</span>}
                      <span className="text-xs block">{result.message}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => {
              setIsHealthOfficeBulkDialogOpen(false);
              setHealthOfficeBulkResults([]);
              setBulkHealthOfficeRegionId('');
            }}>
              ปิด
            </Button>
            {healthOfficeBulkResults.length === 0 && (
              <Button 
                onClick={handleBulkCreateHealthOfficeUsers} 
                disabled={isBulkCreatingHealthOffice || !bulkHealthOfficeRegionId}
              >
                {isBulkCreatingHealthOffice ? 'กำลังสร้าง...' : 'สร้างผู้ใช้'}
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Provincial Users Bulk Create Dialog (for regional admin) */}
      <Dialog open={isProvincialBulkDialogOpen} onOpenChange={setIsProvincialBulkDialogOpen}>
        <DialogContent className="sm:max-w-lg max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>สร้างผู้ใช้ระดับจังหวัด แบบ Bulk</DialogTitle>
            <DialogDescription>
              สร้างผู้ใช้ผู้ประเมินระดับจังหวัด (สสจ.) สำหรับทุกจังหวัดในเขตสุขภาพ
              <br />
              <span className="text-primary font-medium">Email: admin.รหัสสถานพยาบาลสสจ.@ctam.moph | Password: รหัสสถานพยาบาลสสจ.</span>
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4 py-4">
            {/* Only show region selector for central_admin */}
            {currentUserProfile?.role === 'central_admin' && (
              <div className="space-y-2">
                <Label>เลือกเขตสุขภาพ</Label>
                <Select value={bulkProvincialRegionId} onValueChange={setBulkProvincialRegionId}>
                  <SelectTrigger>
                    <SelectValue placeholder="เลือกเขตสุขภาพ" />
                  </SelectTrigger>
                  <SelectContent>
                    {healthRegions.map((region) => (
                      <SelectItem key={region.id} value={region.id}>
                        เขตสุขภาพที่ {region.region_number}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            {/* For regional admin, show their assigned region */}
            {currentUserProfile?.role === 'regional' && (
              <div className="space-y-2">
                <Label>เขตสุขภาพของคุณ</Label>
                <div className="p-3 bg-muted rounded-md">
                  <span className="font-medium">
                    {getRegionName(currentUserProfile.health_region_id)}
                  </span>
                </div>
              </div>
            )}

            {provincialBulkResults.length > 0 && (
              <div className="space-y-2">
                <Label>ผลลัพธ์การสร้างผู้ใช้</Label>
                <div className="max-h-60 overflow-y-auto border rounded-md p-2 space-y-1">
                  {provincialBulkResults.map((result, index) => (
                    <div 
                      key={index} 
                      className={`text-sm p-2 rounded ${
                        result.status === 'success' 
                          ? 'bg-success/10 text-success' 
                          : result.status === 'skipped' 
                          ? 'bg-warning/10 text-warning' 
                          : 'bg-destructive/10 text-destructive'
                      }`}
                    >
                      <span className="font-medium">{result.health_office_code || result.province_code}</span> - {result.province_name}
                      {result.email && <span className="text-xs block">Email: {result.email}</span>}
                      <span className="text-xs block">{result.message}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => {
              setIsProvincialBulkDialogOpen(false);
              setProvincialBulkResults([]);
              setBulkProvincialRegionId('');
            }}>
              ปิด
            </Button>
            {provincialBulkResults.length === 0 && (
              <Button 
                onClick={handleBulkCreateProvincialUsers} 
                disabled={isBulkCreatingProvincial || (currentUserProfile?.role === 'central_admin' && !bulkProvincialRegionId)}
              >
                {isBulkCreatingProvincial ? 'กำลังสร้าง...' : 'สร้างผู้ใช้'}
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Supervisor Create Dialog */}
      <Dialog open={isSupervisorDialogOpen} onOpenChange={setIsSupervisorDialogOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>สร้างผู้นิเทศ</DialogTitle>
            <DialogDescription>
              กรอกข้อมูลเพื่อสร้างบัญชีผู้นิเทศใหม่สำหรับเขตสุขภาพของคุณ
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="supervisor-email">อีเมล *</Label>
              <Input
                id="supervisor-email"
                type="email"
                value={supervisorEmail}
                onChange={(e) => setSupervisorEmail(e.target.value)}
                placeholder="example@email.com"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="supervisor-password">รหัสผ่าน *</Label>
              <Input
                id="supervisor-password"
                type="password"
                value={supervisorPassword}
                onChange={(e) => setSupervisorPassword(e.target.value)}
                placeholder="อย่างน้อย 6 ตัวอักษร"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="supervisor-fullname">ชื่อ-นามสกุล</Label>
              <Input
                id="supervisor-fullname"
                type="text"
                value={supervisorFullName}
                onChange={(e) => setSupervisorFullName(e.target.value)}
                placeholder="ชื่อ นามสกุล"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="supervisor-position">ตำแหน่ง</Label>
              <Input
                id="supervisor-position"
                type="text"
                value={supervisorPosition}
                onChange={(e) => setSupervisorPosition(e.target.value)}
                placeholder="เช่น นักวิชาการสาธารณสุขชำนาญการพิเศษ"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="supervisor-organization">หน่วยงาน</Label>
              <Input
                id="supervisor-organization"
                type="text"
                value={supervisorOrganization}
                onChange={(e) => setSupervisorOrganization(e.target.value)}
                placeholder="เช่น สำนักงานเขตสุขภาพที่ 1"
              />
            </div>

            {currentUserProfile?.role === 'regional' && (
              <div className="p-3 bg-muted rounded-md">
                <span className="text-sm text-muted-foreground">
                  ผู้นิเทศจะถูกกำหนดให้อยู่ใน: <strong>{getRegionName(currentUserProfile.health_region_id)}</strong>
                </span>
              </div>
            )}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => {
              setIsSupervisorDialogOpen(false);
              setSupervisorEmail('');
              setSupervisorPassword('');
              setSupervisorFullName('');
              setSupervisorPosition('');
              setSupervisorOrganization('');
            }}>
              ยกเลิก
            </Button>
            <Button 
              onClick={handleCreateSupervisor} 
              disabled={isCreatingSupervisor || !supervisorEmail || !supervisorPassword}
            >
              {isCreatingSupervisor ? 'กำลังสร้าง...' : 'สร้างผู้นิเทศ'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </DashboardLayout>
  );
}
