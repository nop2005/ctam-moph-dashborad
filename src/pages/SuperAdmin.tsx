import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { toast } from 'sonner';
import { 
  Shield, 
  LogOut, 
  Users, 
  UserPlus,
  Building2,
  MapPin,
  Edit,
  Trash2,
  ArrowLeft,
  Search,
  RefreshCw
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';

interface Profile {
  id: string;
  user_id: string;
  email: string;
  full_name: string | null;
  role: 'hospital_it' | 'provincial' | 'regional' | 'central_admin';
  hospital_id: string | null;
  province_id: string | null;
  health_region_id: string | null;
  is_active: boolean;
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
  const { user, profile, signOut } = useAuth();
  const navigate = useNavigate();
  
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [provinces, setProvinces] = useState<Province[]>([]);
  const [healthRegions, setHealthRegions] = useState<HealthRegion[]>([]);
  const [hospitals, setHospitals] = useState<Hospital[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  
  // Dialog states
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [selectedProfile, setSelectedProfile] = useState<Profile | null>(null);
  const [editRole, setEditRole] = useState<string>('');
  const [editProvinceId, setEditProvinceId] = useState<string>('');
  const [editRegionId, setEditRegionId] = useState<string>('');
  const [editHospitalId, setEditHospitalId] = useState<string>('');
  const [editFullName, setEditFullName] = useState('');
  const [isSaving, setIsSaving] = useState(false);

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
    };
    return labels[role] || role;
  };

  const getRoleBadgeVariant = (role: string): 'default' | 'secondary' | 'destructive' | 'outline' => {
    const variants: Record<string, 'default' | 'secondary' | 'destructive' | 'outline'> = {
      hospital_it: 'secondary',
      provincial: 'outline',
      regional: 'default',
      central_admin: 'destructive',
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

  const filteredProfiles = profiles.filter(p => 
    p.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
    (p.full_name?.toLowerCase() || '').includes(searchTerm.toLowerCase())
  );

  const filteredHospitals = editProvinceId 
    ? hospitals.filter(h => h.province_id === editProvinceId)
    : hospitals;

  const filteredProvinces = editRegionId
    ? provinces.filter(p => p.health_region_id === editRegionId)
    : provinces;

  // Stats
  const stats = {
    total: profiles.length,
    centralAdmin: profiles.filter(p => p.role === 'central_admin').length,
    regional: profiles.filter(p => p.role === 'regional').length,
    provincial: profiles.filter(p => p.role === 'provincial').length,
    hospitalIt: profiles.filter(p => p.role === 'hospital_it').length,
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b bg-card sticky top-0 z-50">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="icon" onClick={() => navigate('/dashboard')}>
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <div className="w-10 h-10 bg-destructive/10 rounded-xl flex items-center justify-center">
              <Shield className="w-6 h-6 text-destructive" />
            </div>
            <div>
              <h1 className="font-bold text-lg">Super Admin</h1>
              <p className="text-xs text-muted-foreground">จัดการผู้ใช้งานระบบ</p>
            </div>
          </div>

          <div className="flex items-center gap-4">
            <div className="text-right hidden sm:block">
              <p className="font-medium text-sm">{profile?.full_name || user?.email}</p>
              <Badge variant="destructive">Super Admin</Badge>
            </div>
            <Button variant="outline" size="icon" onClick={signOut}>
              <LogOut className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="container mx-auto px-4 py-8">
        {/* Stats */}
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-8">
          <Card>
            <CardContent className="p-4">
              <div className="text-2xl font-bold">{stats.total}</div>
              <div className="text-sm text-muted-foreground">ผู้ใช้ทั้งหมด</div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="text-2xl font-bold text-destructive">{stats.centralAdmin}</div>
              <div className="text-sm text-muted-foreground">Super Admin</div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="text-2xl font-bold text-primary">{stats.regional}</div>
              <div className="text-sm text-muted-foreground">เขตสุขภาพ</div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="text-2xl font-bold text-accent">{stats.provincial}</div>
              <div className="text-sm text-muted-foreground">สสจ.</div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="text-2xl font-bold text-muted-foreground">{stats.hospitalIt}</div>
              <div className="text-sm text-muted-foreground">IT รพ.</div>
            </CardContent>
          </Card>
        </div>

        {/* Users Table */}
        <Card>
          <CardHeader>
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <CardTitle className="flex items-center gap-2">
                  <Users className="h-5 w-5" />
                  รายชื่อผู้ใช้งาน
                </CardTitle>
                <CardDescription>จัดการสิทธิ์และข้อมูลผู้ใช้งานทั้งหมด</CardDescription>
              </div>
              <div className="flex gap-2">
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
            </div>
          </CardHeader>
          <CardContent>
            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>อีเมล</TableHead>
                    <TableHead>ชื่อ-นามสกุล</TableHead>
                    <TableHead>บทบาท</TableHead>
                    <TableHead>หน่วยงาน</TableHead>
                    <TableHead>สถานะ</TableHead>
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
                  ) : filteredProfiles.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                        ไม่พบข้อมูลผู้ใช้
                      </TableCell>
                    </TableRow>
                  ) : (
                    filteredProfiles.map((p) => (
                      <TableRow key={p.id}>
                        <TableCell className="font-medium">{p.email}</TableCell>
                        <TableCell>{p.full_name || '-'}</TableCell>
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
                          {p.role === 'central_admin' && (
                            <span className="text-sm text-muted-foreground">ส่วนกลาง</span>
                          )}
                        </TableCell>
                        <TableCell>
                          <Badge variant={p.is_active ? 'default' : 'secondary'}>
                            {p.is_active ? 'ใช้งาน' : 'ปิดใช้งาน'}
                          </Badge>
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
      </main>

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
                <Select value={editProvinceId} onValueChange={setEditProvinceId}>
                  <SelectTrigger>
                    <SelectValue placeholder="เลือกจังหวัด" />
                  </SelectTrigger>
                  <SelectContent>
                    {provinces.map((province) => (
                      <SelectItem key={province.id} value={province.id}>
                        {province.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            {editRole === 'hospital_it' && (
              <>
                <div className="space-y-2">
                  <Label>จังหวัด</Label>
                  <Select value={editProvinceId} onValueChange={(v) => {
                    setEditProvinceId(v);
                    setEditHospitalId('');
                  }}>
                    <SelectTrigger>
                      <SelectValue placeholder="เลือกจังหวัด" />
                    </SelectTrigger>
                    <SelectContent>
                      {provinces.map((province) => (
                        <SelectItem key={province.id} value={province.id}>
                          {province.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label>โรงพยาบาล</Label>
                  <Select value={editHospitalId} onValueChange={setEditHospitalId}>
                    <SelectTrigger>
                      <SelectValue placeholder="เลือกโรงพยาบาล" />
                    </SelectTrigger>
                    <SelectContent>
                      {filteredHospitals.map((hospital) => (
                        <SelectItem key={hospital.id} value={hospital.id}>
                          {hospital.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
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
    </div>
  );
}
