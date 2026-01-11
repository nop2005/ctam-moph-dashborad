import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { 
  Search, 
  CheckCircle2, 
  XCircle, 
  Users, 
  Clock,
  Building2,
  MapPin,
  Loader2,
  UserCheck,
  UserX,
  Trash2,
  Edit,
  UserPlus
} from 'lucide-react';

interface Profile {
  id: string;
  user_id: string;
  email: string;
  full_name: string | null;
  role: 'hospital_it' | 'provincial' | 'regional' | 'central_admin' | 'health_office' | 'supervisor';
  hospital_id: string | null;
  health_office_id: string | null;
  province_id: string | null;
  health_region_id: string | null;
  phone: string | null;
  is_active: boolean;
  created_at: string;
}

interface Hospital {
  id: string;
  name: string;
  code: string;
  province_id: string;
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

export default function UserManagement() {
  const { profile: currentUserProfile } = useAuth();
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [hospitals, setHospitals] = useState<Hospital[]>([]);
  const [provinces, setProvinces] = useState<Province[]>([]);
  const [healthRegions, setHealthRegions] = useState<HealthRegion[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [approveDialogOpen, setApproveDialogOpen] = useState(false);
  const [rejectDialogOpen, setRejectDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [createUserDialogOpen, setCreateUserDialogOpen] = useState(false);
  const [createSupervisorDialogOpen, setCreateSupervisorDialogOpen] = useState(false);
  const [createProvincialDialogOpen, setCreateProvincialDialogOpen] = useState(false);
  const [selectedProfile, setSelectedProfile] = useState<Profile | null>(null);
  const [rejectReason, setRejectReason] = useState('');
  const [processing, setProcessing] = useState(false);
  const [creatingUsers, setCreatingUsers] = useState(false);
  const [activeTab, setActiveTab] = useState<'pending' | 'active' | 'all'>('all');
  
  // Supervisor form state
  const [supervisorEmail, setSupervisorEmail] = useState('');
  const [supervisorPassword, setSupervisorPassword] = useState('');
  const [supervisorFullName, setSupervisorFullName] = useState('');
  const [supervisorPosition, setSupervisorPosition] = useState('');
  const [supervisorOrganization, setSupervisorOrganization] = useState('');
  const isProvincialAdmin = currentUserProfile?.role === 'provincial';
  const isRegionalAdmin = currentUserProfile?.role === 'regional';

  useEffect(() => {
    fetchData();
  }, [currentUserProfile]);

  const fetchData = async () => {
    if (!currentUserProfile) return;
    
    setLoading(true);
    try {
      // Fetch reference data
      const [hospitalsRes, provincesRes, regionsRes] = await Promise.all([
        supabase.from('hospitals').select('*'),
        supabase.from('provinces').select('*'),
        supabase.from('health_regions').select('*'),
      ]);

      if (hospitalsRes.data) setHospitals(hospitalsRes.data);
      if (provincesRes.data) setProvinces(provincesRes.data);
      if (regionsRes.data) setHealthRegions(regionsRes.data);

      // Fetch profiles based on role
      const { data: profilesData, error } = await supabase
        .from('profiles')
        .select('*');

      if (error) {
        console.error('Error fetching profiles:', error);
        toast.error('ไม่สามารถโหลดข้อมูลผู้ใช้ได้');
        return;
      }

      if (profilesData) {
        setProfiles(profilesData as Profile[]);
      }
    } catch (error) {
      console.error('Error:', error);
      toast.error('เกิดข้อผิดพลาด');
    } finally {
      setLoading(false);
    }
  };

  const getHospitalName = (hospitalId: string | null) => {
    if (!hospitalId) return '-';
    const hospital = hospitals.find(h => h.id === hospitalId);
    return hospital?.name || '-';
  };

  const getProvinceName = (provinceId: string | null) => {
    if (!provinceId) return '-';
    const province = provinces.find(p => p.id === provinceId);
    return province?.name || '-';
  };

  const getRegionName = (regionId: string | null) => {
    if (!regionId) return '-';
    const region = healthRegions.find(r => r.id === regionId);
    return region ? `เขตสุขภาพที่ ${region.region_number}` : '-';
  };

  // Helper to get health office name
  const getHealthOfficeName = (healthOfficeId: string | null) => {
    if (!healthOfficeId) return '-';
    // Since we don't have health_offices loaded, we display from profile full_name
    return '-';
  };

  // Get organization name based on role and IDs
  const getOrganizationDisplay = (profile: Profile) => {
    if (profile.role === 'hospital_it' && profile.hospital_id) {
      return getHospitalName(profile.hospital_id);
    }
    if (profile.role === 'health_office') {
      // For health_office users, display their full_name which contains office name
      return profile.full_name?.replace('IT ', '') || '-';
    }
    if (profile.role === 'provincial' && profile.province_id) {
      return getProvinceName(profile.province_id);
    }
    return '-';
  };

  const getRoleLabel = (role: string) => {
    const labels: Record<string, string> = {
      hospital_it: 'IT รพ.',
      health_office: 'IT สสจ.',
      provincial: 'Admin จังหวัด',
      regional: 'Admin เขตสุขภาพ',
      central_admin: 'Super Admin',
      supervisor: 'ผู้นิเทศ',
    };
    return labels[role] || role;
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

  const handleApproveClick = (profile: Profile) => {
    setSelectedProfile(profile);
    setApproveDialogOpen(true);
  };

  const handleRejectClick = (profile: Profile) => {
    setSelectedProfile(profile);
    setRejectReason('');
    setRejectDialogOpen(true);
  };

  const handleApprove = async () => {
    if (!selectedProfile) return;

    setProcessing(true);
    try {
      const { error } = await supabase
        .from('profiles')
        .update({ is_active: true })
        .eq('id', selectedProfile.id);

      if (error) throw error;

      toast.success('อนุมัติผู้ใช้สำเร็จ');
      setApproveDialogOpen(false);
      setSelectedProfile(null);
      fetchData();
    } catch (error) {
      console.error('Error approving user:', error);
      toast.error('ไม่สามารถอนุมัติผู้ใช้ได้');
    } finally {
      setProcessing(false);
    }
  };

  const handleReject = async () => {
    if (!selectedProfile) return;

    setProcessing(true);
    try {
      // For now, we'll just keep is_active as false
      // In a real app, you might want to delete the user or send a notification
      toast.success('ปฏิเสธผู้ใช้สำเร็จ');
      setRejectDialogOpen(false);
      setSelectedProfile(null);
      setRejectReason('');
      fetchData();
    } catch (error) {
      console.error('Error rejecting user:', error);
      toast.error('ไม่สามารถปฏิเสธผู้ใช้ได้');
    } finally {
      setProcessing(false);
    }
  };

  const handleDeleteClick = (profile: Profile) => {
    setSelectedProfile(profile);
    setDeleteDialogOpen(true);
  };

  const handleDelete = async () => {
    if (!selectedProfile) return;

    setProcessing(true);
    try {
      // Delete profile first
      const { error: profileError } = await supabase
        .from('profiles')
        .delete()
        .eq('id', selectedProfile.id);

      if (profileError) throw profileError;

      toast.success('ลบผู้ใช้สำเร็จ');
      setDeleteDialogOpen(false);
      setSelectedProfile(null);
      fetchData();
    } catch (error) {
      console.error('Error deleting user:', error);
      toast.error('ไม่สามารถลบผู้ใช้ได้');
    } finally {
      setProcessing(false);
    }
  };

  const handleCreateUsers = async () => {
    setCreatingUsers(true);
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      if (!sessionData.session) {
        toast.error('กรุณาเข้าสู่ระบบ');
        return;
      }

      const headers = {
        Authorization: `Bearer ${sessionData.session.access_token}`,
      };

      // Call both Edge Functions simultaneously
      const [hospitalResult, healthOfficeResult] = await Promise.all([
        supabase.functions.invoke('create-hospital-users-provincial', { headers }),
        supabase.functions.invoke('create-health-office-users-provincial', { headers }),
      ]);

      // Process hospital IT results
      let hospitalSuccessCount = 0;
      let hospitalSkippedCount = 0;
      if (hospitalResult.data?.success && hospitalResult.data?.results) {
        hospitalSuccessCount = hospitalResult.data.results.filter((r: any) => r.status === 'success').length;
        hospitalSkippedCount = hospitalResult.data.results.filter((r: any) => r.status === 'skipped').length;
      }

      // Process health office result
      let healthOfficeStatus = '';
      if (healthOfficeResult.data?.success) {
        if (healthOfficeResult.data.status === 'skipped') {
          healthOfficeStatus = 'ข้าม (มีอยู่แล้ว)';
        } else {
          healthOfficeStatus = 'สำเร็จ';
        }
      } else {
        healthOfficeStatus = 'ล้มเหลว';
      }

      // Show combined result
      toast.success(
        `สร้างผู้ใช้สำเร็จ: IT สสจ. ${healthOfficeStatus}, IT รพ. ${hospitalSuccessCount} คน (ข้าม ${hospitalSkippedCount} คน)`
      );
      
      setCreateUserDialogOpen(false);
      fetchData();
    } catch (error) {
      console.error('Error creating users:', error);
      toast.error('ไม่สามารถสร้างผู้ใช้ได้');
    } finally {
      setCreatingUsers(false);
    }
  };

  const handleCreateSupervisor = async () => {
    setCreatingUsers(true);
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      if (!sessionData.session) {
        toast.error('กรุณาเข้าสู่ระบบ');
        return;
      }

      const headers = {
        Authorization: `Bearer ${sessionData.session.access_token}`,
      };

      const { data, error } = await supabase.functions.invoke('create-supervisor-users', {
        headers,
        body: {
          email: supervisorEmail,
          password: supervisorPassword,
          full_name: supervisorFullName,
          position: supervisorPosition,
          organization: supervisorOrganization,
        },
      });

      if (error || !data?.success) {
        toast.error(data?.error || 'ไม่สามารถสร้างผู้นิเทศได้');
        return;
      }

      toast.success('สร้างผู้นิเทศสำเร็จ');
      setCreateSupervisorDialogOpen(false);
      setSupervisorEmail('');
      setSupervisorPassword('');
      setSupervisorFullName('');
      setSupervisorPosition('');
      setSupervisorOrganization('');
      fetchData();
    } catch (error) {
      console.error('Error creating supervisor:', error);
      toast.error('ไม่สามารถสร้างผู้นิเทศได้');
    } finally {
      setCreatingUsers(false);
    }
  };

  const handleCreateProvincialUsers = async () => {
    setCreatingUsers(true);
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      if (!sessionData.session) {
        toast.error('กรุณาเข้าสู่ระบบ');
        return;
      }

      const headers = {
        Authorization: `Bearer ${sessionData.session.access_token}`,
      };

      const { data, error } = await supabase.functions.invoke('create-provincial-users', {
        headers,
        body: {
          health_region_id: currentUserProfile?.health_region_id,
        },
      });

      if (error || !data?.success) {
        toast.error(data?.error || 'ไม่สามารถสร้าง Admin จังหวัดได้');
        return;
      }

      const successCount = data.results?.filter((r: any) => r.status === 'success').length || 0;
      const skippedCount = data.results?.filter((r: any) => r.status === 'skipped').length || 0;

      toast.success(`สร้าง Admin จังหวัดสำเร็จ: ${successCount} คน (ข้าม ${skippedCount} คน)`);
      setCreateProvincialDialogOpen(false);
      fetchData();
    } catch (error) {
      console.error('Error creating provincial users:', error);
      toast.error('ไม่สามารถสร้าง Admin จังหวัดได้');
    } finally {
      setCreatingUsers(false);
    }
  };

  // Filter profiles based on search
  const filteredProfiles = profiles.filter(p => {
    const matchesSearch = 
      p.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (p.full_name?.toLowerCase().includes(searchTerm.toLowerCase()) ?? false);
    return matchesSearch;
  });

  const pendingProfiles = filteredProfiles.filter(p => !p.is_active);
  const activeProfiles = filteredProfiles.filter(p => p.is_active);

  const getManageableRoleLabel = () => {
    if (isProvincialAdmin) return 'IT รพ.';
    if (isRegionalAdmin) return 'Admin จังหวัด';
    return 'ผู้ใช้';
  };

  const getLocationLabel = () => {
    if (isProvincialAdmin) {
      const province = provinces.find(p => p.id === currentUserProfile?.province_id);
      return province?.name || 'จังหวัด';
    }
    if (isRegionalAdmin) {
      const region = healthRegions.find(r => r.id === currentUserProfile?.health_region_id);
      return region ? `เขตสุขภาพที่ ${region.region_number}` : 'เขตสุขภาพ';
    }
    return '';
  };

  // Calculate stats
  const stats = {
    total: profiles.length,
    pending: pendingProfiles.length,
    active: activeProfiles.length,
  };

  if (loading) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center h-64">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      {/* Page Header */}
      <div className="mb-6 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground">จัดการผู้ใช้งาน</h1>
          <p className="text-muted-foreground">
            อนุมัติ{getManageableRoleLabel()}ใน{getLocationLabel()}
          </p>
        </div>
        {isProvincialAdmin && (
          <Button onClick={() => setCreateUserDialogOpen(true)}>
            <UserPlus className="h-4 w-4 mr-2" />
            สร้างผู้ใช้งาน
          </Button>
        )}
        {isRegionalAdmin && (
          <div className="flex gap-2">
            <Button onClick={() => setCreateSupervisorDialogOpen(true)}>
              <UserPlus className="h-4 w-4 mr-2" />
              เพิ่มผู้นิเทศ
            </Button>
            <Button onClick={() => setCreateProvincialDialogOpen(true)} variant="outline">
              <UserPlus className="h-4 w-4 mr-2" />
              เพิ่ม Admin จังหวัด
            </Button>
          </div>
        )}
      </div>

      {/* Stats Cards - Clickable */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        <Card 
          className={`cursor-pointer transition-all hover:shadow-md ${activeTab === 'all' ? 'ring-2 ring-primary' : ''}`}
          onClick={() => setActiveTab('all')}
        >
          <CardContent className="p-6">
            <div className="flex items-center gap-4">
              <div className="p-3 rounded-xl bg-primary/10">
                <Users className="h-6 w-6 text-primary" />
              </div>
              <div>
                <p className="text-2xl font-bold">{stats.total}</p>
                <p className="text-sm text-muted-foreground">ผู้ใช้ทั้งหมด</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card 
          className={`cursor-pointer transition-all hover:shadow-md ${activeTab === 'pending' ? 'ring-2 ring-warning' : ''}`}
          onClick={() => setActiveTab('pending')}
        >
          <CardContent className="p-6">
            <div className="flex items-center gap-4">
              <div className="p-3 rounded-xl bg-warning/10">
                <Clock className="h-6 w-6 text-warning" />
              </div>
              <div>
                <p className="text-2xl font-bold">{stats.pending}</p>
                <p className="text-sm text-muted-foreground">รอการอนุมัติ</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card 
          className={`cursor-pointer transition-all hover:shadow-md ${activeTab === 'active' ? 'ring-2 ring-success' : ''}`}
          onClick={() => setActiveTab('active')}
        >
          <CardContent className="p-6">
            <div className="flex items-center gap-4">
              <div className="p-3 rounded-xl bg-success/10">
                <CheckCircle2 className="h-6 w-6 text-success" />
              </div>
              <div>
                <p className="text-2xl font-bold">{stats.active}</p>
                <p className="text-sm text-muted-foreground">อนุมัติแล้ว</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Search */}
      <Card className="mb-6">
        <CardContent className="p-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="ค้นหาด้วยชื่อหรืออีเมล..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10"
            />
          </div>
        </CardContent>
      </Card>

      {/* User List */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">
            {activeTab === 'all' ? 'ผู้ใช้ทั้งหมด' : activeTab === 'pending' ? 'รอการอนุมัติ' : 'อนุมัติแล้ว'}
            <span className="text-muted-foreground font-normal ml-2">
              ({activeTab === 'all' ? filteredProfiles.length : activeTab === 'pending' ? pendingProfiles.length : activeProfiles.length} คน)
            </span>
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {(() => {
            const displayProfiles = activeTab === 'all' ? filteredProfiles : activeTab === 'pending' ? pendingProfiles : activeProfiles;
            
            if (displayProfiles.length === 0) {
              return (
                <div className="p-12 text-center">
                  <Users className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                  <p className="text-muted-foreground">
                    {activeTab === 'pending' ? 'ไม่มีผู้ใช้รอการอนุมัติ' : 'ไม่พบผู้ใช้'}
                  </p>
                </div>
              );
            }
            
            return (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>อีเมล</TableHead>
                      <TableHead>ชื่อ-นามสกุล</TableHead>
                      <TableHead>เบอร์โทร</TableHead>
                      <TableHead>บทบาท</TableHead>
                      <TableHead>หน่วยงาน</TableHead>
                      <TableHead>สถานะ</TableHead>
                      <TableHead className="text-right">จัดการ</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {displayProfiles.map((profile) => (
                      <TableRow key={profile.id}>
                        <TableCell className="font-medium text-primary">
                          {profile.email}
                        </TableCell>
                        <TableCell>
                          {profile.full_name || '-'}
                        </TableCell>
                        <TableCell>
                          {profile.phone || '-'}
                        </TableCell>
                        <TableCell>
                          <Badge 
                            variant="outline" 
                            className={
                              profile.role === 'hospital_it' 
                                ? 'bg-cyan-100 text-cyan-700 border-cyan-200' 
                                : profile.role === 'health_office'
                                ? 'bg-teal-100 text-teal-700 border-teal-200'
                                : profile.role === 'provincial'
                                ? 'bg-blue-100 text-blue-700 border-blue-200'
                                : ''
                            }
                          >
                            {getRoleLabel(profile.role)}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <span className="flex items-center gap-1">
                            <Building2 className="h-4 w-4 text-muted-foreground" />
                            {getOrganizationDisplay(profile)}
                          </span>
                        </TableCell>
                        <TableCell>
                          {profile.is_active ? (
                            <Badge className="bg-success/20 text-success border-success/30 hover:bg-success/30">
                              อนุมัติแล้ว
                            </Badge>
                          ) : (
                            <Badge className="bg-warning/20 text-warning border-warning/30 hover:bg-warning/30">
                              รออนุมัติ
                            </Badge>
                          )}
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex justify-end gap-2">
                            {!profile.is_active ? (
                              <>
                                <Button
                                  size="sm"
                                  onClick={() => handleApproveClick(profile)}
                                >
                                  <CheckCircle2 className="h-4 w-4 mr-1" />
                                  อนุมัติ
                                </Button>
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={() => handleRejectClick(profile)}
                                  className="text-destructive border-destructive hover:bg-destructive/10"
                                >
                                  <XCircle className="h-4 w-4 mr-1" />
                                  ปฏิเสธ
                                </Button>
                              </>
                            ) : (
                              <Button
                                variant="outline"
                                size="icon"
                                onClick={() => handleDeleteClick(profile)}
                                className="text-muted-foreground hover:text-foreground"
                              >
                                <Edit className="h-4 w-4" />
                              </Button>
                            )}
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            );
          })()}
        </CardContent>
      </Card>

      {/* Approve Dialog */}
      <Dialog open={approveDialogOpen} onOpenChange={setApproveDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>ยืนยันการอนุมัติ</DialogTitle>
            <DialogDescription>
              คุณต้องการอนุมัติผู้ใช้ {selectedProfile?.full_name || selectedProfile?.email} หรือไม่?
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button 
              variant="outline" 
              onClick={() => setApproveDialogOpen(false)}
              disabled={processing}
            >
              ยกเลิก
            </Button>
            <Button 
              onClick={handleApprove}
              disabled={processing}
            >
              {processing && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              ยืนยัน
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Reject Dialog */}
      <Dialog open={rejectDialogOpen} onOpenChange={setRejectDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>ปฏิเสธผู้ใช้</DialogTitle>
            <DialogDescription>
              กรุณาระบุเหตุผลในการปฏิเสธ {selectedProfile?.full_name || selectedProfile?.email}
            </DialogDescription>
          </DialogHeader>
          <Textarea
            placeholder="เหตุผลในการปฏิเสธ..."
            value={rejectReason}
            onChange={(e) => setRejectReason(e.target.value)}
          />
          <DialogFooter>
            <Button 
              variant="outline" 
              onClick={() => setRejectDialogOpen(false)}
              disabled={processing}
            >
              ยกเลิก
            </Button>
            <Button 
              variant="destructive"
              onClick={handleReject}
              disabled={processing}
            >
              {processing && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              ปฏิเสธ
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Dialog */}
      <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>ยืนยันการลบผู้ใช้</DialogTitle>
            <DialogDescription>
              คุณต้องการลบผู้ใช้ {selectedProfile?.full_name || selectedProfile?.email} หรือไม่?
              <br />
              <span className="text-destructive font-medium">การดำเนินการนี้ไม่สามารถย้อนกลับได้</span>
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button 
              variant="outline" 
              onClick={() => setDeleteDialogOpen(false)}
              disabled={processing}
            >
              ยกเลิก
            </Button>
            <Button 
              variant="destructive"
              onClick={handleDelete}
              disabled={processing}
            >
              {processing && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              ลบผู้ใช้
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Create User Dialog for Provincial Admin */}
      <Dialog open={createUserDialogOpen} onOpenChange={setCreateUserDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>สร้างผู้ใช้งานใหม่</DialogTitle>
            <DialogDescription>
              สร้างผู้ใช้ทั้งหมดในจังหวัดของคุณ
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="text-sm">
              <p className="font-medium mb-2">ระบบจะสร้างผู้ใช้ดังนี้:</p>
              <ul className="list-disc list-inside space-y-1 text-muted-foreground">
                <li>IT สสจ. - 1 คน</li>
                <li>IT รพ. - ทุกโรงพยาบาลในจังหวัด</li>
              </ul>
            </div>
            <div className="text-sm bg-muted p-3 rounded-md space-y-3">
              <div>
                <p className="font-medium text-foreground">IT รพ.:</p>
                <p className="text-muted-foreground">Email: รหัสโรงพยาบาล@ctam.moph</p>
                <p className="text-muted-foreground">Password: รหัสโรงพยาบาล</p>
                <p className="text-xs text-muted-foreground mt-1">เช่น 12345@ctam.moph / 12345</p>
              </div>
              <div>
                <p className="font-medium text-foreground">IT สสจ.:</p>
                <p className="text-muted-foreground">Email: รหัสสสจ@ctam.moph</p>
                <p className="text-muted-foreground">Password: รหัสสสจ</p>
                <p className="text-xs text-muted-foreground mt-1">เช่น 00037@ctam.moph / 00037</p>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button 
              variant="outline" 
              onClick={() => setCreateUserDialogOpen(false)}
              disabled={creatingUsers}
            >
              ยกเลิก
            </Button>
            <Button 
              onClick={handleCreateUsers}
              disabled={creatingUsers}
            >
              {creatingUsers && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              สร้างผู้ใช้งาน
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Create Supervisor Dialog for Regional Admin */}
      <Dialog open={createSupervisorDialogOpen} onOpenChange={setCreateSupervisorDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>เพิ่มผู้นิเทศ</DialogTitle>
            <DialogDescription>
              กรอกข้อมูลเพื่อสร้างบัญชีผู้นิเทศใหม่
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">อีเมล *</label>
              <Input
                type="email"
                placeholder="email@example.com"
                value={supervisorEmail}
                onChange={(e) => setSupervisorEmail(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">รหัสผ่าน *</label>
              <Input
                type="password"
                placeholder="รหัสผ่าน"
                value={supervisorPassword}
                onChange={(e) => setSupervisorPassword(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">ชื่อ-นามสกุล</label>
              <Input
                placeholder="ชื่อ-นามสกุล"
                value={supervisorFullName}
                onChange={(e) => setSupervisorFullName(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">ตำแหน่ง</label>
              <Input
                placeholder="ตำแหน่ง"
                value={supervisorPosition}
                onChange={(e) => setSupervisorPosition(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">หน่วยงาน</label>
              <Input
                placeholder="หน่วยงาน"
                value={supervisorOrganization}
                onChange={(e) => setSupervisorOrganization(e.target.value)}
              />
            </div>
          </div>
          <DialogFooter>
            <Button 
              variant="outline" 
              onClick={() => setCreateSupervisorDialogOpen(false)}
              disabled={creatingUsers}
            >
              ยกเลิก
            </Button>
            <Button 
              onClick={handleCreateSupervisor}
              disabled={creatingUsers || !supervisorEmail || !supervisorPassword}
            >
              {creatingUsers && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              สร้างผู้นิเทศ
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Create Provincial Admin Dialog for Regional Admin */}
      <Dialog open={createProvincialDialogOpen} onOpenChange={setCreateProvincialDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>เพิ่ม Admin จังหวัด</DialogTitle>
            <DialogDescription>
              สร้าง Admin จังหวัดสำหรับทุกจังหวัดในเขตสุขภาพของคุณ
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="text-sm">
              <p className="font-medium mb-2">ระบบจะสร้าง Admin จังหวัดดังนี้:</p>
              <ul className="list-disc list-inside space-y-1 text-muted-foreground">
                <li>Admin จังหวัด - ทุกจังหวัดในเขตสุขภาพ</li>
              </ul>
            </div>
            <div className="text-sm bg-muted p-3 rounded-md">
              <p className="font-medium text-foreground">รูปแบบบัญชี:</p>
              <p className="text-muted-foreground">Email: admin.รหัสสสจ@ctam.moph</p>
              <p className="text-muted-foreground">Password: รหัสสสจ</p>
              <p className="text-xs text-muted-foreground mt-1">เช่น admin.00037@ctam.moph / 00037</p>
            </div>
          </div>
          <DialogFooter>
            <Button 
              variant="outline" 
              onClick={() => setCreateProvincialDialogOpen(false)}
              disabled={creatingUsers}
            >
              ยกเลิก
            </Button>
            <Button 
              onClick={handleCreateProvincialUsers}
              disabled={creatingUsers}
            >
              {creatingUsers && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              สร้าง Admin จังหวัด
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </DashboardLayout>
  );
}

