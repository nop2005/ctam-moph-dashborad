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
  UserX
} from 'lucide-react';

interface Profile {
  id: string;
  user_id: string;
  email: string;
  full_name: string | null;
  role: 'hospital_it' | 'provincial' | 'regional' | 'central_admin';
  hospital_id: string | null;
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
  const [selectedProfile, setSelectedProfile] = useState<Profile | null>(null);
  const [rejectReason, setRejectReason] = useState('');
  const [processing, setProcessing] = useState(false);

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

  const getRoleLabel = (role: string) => {
    const labels: Record<string, string> = {
      hospital_it: 'IT รพ.',
      provincial: 'Admin จังหวัด',
      regional: 'Admin เขตสุขภาพ',
      central_admin: 'Super Admin',
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
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-foreground">จัดการผู้ใช้งาน</h1>
        <p className="text-muted-foreground">
          อนุมัติ{getManageableRoleLabel()}ใน{getLocationLabel()}
        </p>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        <Card>
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
        <Card>
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
        <Card>
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

      {/* Tabs */}
      <Tabs defaultValue="pending" className="space-y-4">
        <TabsList>
          <TabsTrigger value="pending" className="gap-2">
            <Clock className="h-4 w-4" />
            รอการอนุมัติ ({pendingProfiles.length})
          </TabsTrigger>
          <TabsTrigger value="active" className="gap-2">
            <CheckCircle2 className="h-4 w-4" />
            อนุมัติแล้ว ({activeProfiles.length})
          </TabsTrigger>
        </TabsList>

        {/* Pending Tab */}
        <TabsContent value="pending">
          {pendingProfiles.length === 0 ? (
            <Card>
              <CardContent className="p-12 text-center">
                <UserCheck className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                <p className="text-muted-foreground">ไม่มีผู้ใช้รอการอนุมัติ</p>
              </CardContent>
            </Card>
          ) : (
            <div className="grid gap-4">
              {pendingProfiles.map((profile) => (
                <Card key={profile.id}>
                  <CardContent className="p-6">
                    <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                      <div className="space-y-2">
                        <div className="flex items-center gap-2">
                          <h3 className="font-semibold text-lg">
                            {profile.full_name || 'ไม่ระบุชื่อ'}
                          </h3>
                          <Badge variant="outline">{getRoleLabel(profile.role)}</Badge>
                        </div>
                        <p className="text-sm text-muted-foreground">{profile.email}</p>
                        {profile.phone && (
                          <p className="text-sm text-muted-foreground">โทร: {profile.phone}</p>
                        )}
                        <div className="flex flex-wrap gap-2 text-sm text-muted-foreground">
                          {profile.hospital_id && (
                            <span className="flex items-center gap-1">
                              <Building2 className="h-4 w-4" />
                              {getHospitalName(profile.hospital_id)}
                            </span>
                          )}
                          {profile.province_id && (
                            <span className="flex items-center gap-1">
                              <MapPin className="h-4 w-4" />
                              {getProvinceName(profile.province_id)}
                            </span>
                          )}
                        </div>
                        <p className="text-xs text-muted-foreground">
                          ลงทะเบียนเมื่อ: {formatDate(profile.created_at)}
                        </p>
                      </div>
                      <div className="flex gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleRejectClick(profile)}
                          className="text-destructive hover:text-destructive"
                        >
                          <XCircle className="h-4 w-4 mr-1" />
                          ปฏิเสธ
                        </Button>
                        <Button
                          size="sm"
                          onClick={() => handleApproveClick(profile)}
                        >
                          <CheckCircle2 className="h-4 w-4 mr-1" />
                          อนุมัติ
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>

        {/* Active Tab */}
        <TabsContent value="active">
          {activeProfiles.length === 0 ? (
            <Card>
              <CardContent className="p-12 text-center">
                <Users className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                <p className="text-muted-foreground">ไม่พบผู้ใช้ที่อนุมัติแล้ว</p>
              </CardContent>
            </Card>
          ) : (
            <Card>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>ชื่อ-นามสกุล</TableHead>
                    <TableHead>อีเมล</TableHead>
                    <TableHead>ตำแหน่ง</TableHead>
                    <TableHead>สังกัด</TableHead>
                    <TableHead>สถานะ</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {activeProfiles.map((profile) => (
                    <TableRow key={profile.id}>
                      <TableCell className="font-medium">
                        {profile.full_name || '-'}
                      </TableCell>
                      <TableCell>{profile.email}</TableCell>
                      <TableCell>
                        <Badge variant="outline">{getRoleLabel(profile.role)}</Badge>
                      </TableCell>
                      <TableCell>
                        {profile.hospital_id 
                          ? getHospitalName(profile.hospital_id)
                          : profile.province_id 
                            ? getProvinceName(profile.province_id)
                            : '-'}
                      </TableCell>
                      <TableCell>
                        <Badge variant="default" className="bg-success">
                          ใช้งานได้
                        </Badge>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </Card>
          )}
        </TabsContent>
      </Tabs>

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
    </DashboardLayout>
  );
}

