import { useState, useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarHeader,
  SidebarFooter,
  useSidebar,
} from '@/components/ui/sidebar';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Shield,
  LayoutDashboard,
  FileText,
  BarChart3,
  Users,
  Building2,
  Settings,
  LogOut,
  UserCircle,
} from 'lucide-react';

const menuItems = [
  { 
    title: 'หน้าหลัก', 
    url: '/dashboard', 
    icon: LayoutDashboard,
    roles: ['hospital_it', 'provincial', 'regional', 'central_admin']
  },
  { 
    title: 'แบบประเมิน CTAM+', 
    url: '/assessments', 
    icon: FileText,
    roles: ['hospital_it', 'provincial', 'regional', 'central_admin']
  },
  { 
    title: 'รายงานและสถิติ', 
    url: '/reports', 
    icon: BarChart3,
    roles: ['hospital_it', 'provincial', 'regional', 'central_admin']
  },
];

const adminItems = [
  { 
    title: 'อนุมัติผู้ใช้งาน', 
    url: '/user-management', 
    icon: Users,
    roles: ['provincial', 'regional']
  },
  { 
    title: 'จัดการผู้ใช้งาน', 
    url: '/super-admin', 
    icon: Users,
    roles: ['central_admin']
  },
  { 
    title: 'จัดการโรงพยาบาล', 
    url: '/admin/hospitals', 
    icon: Building2,
    roles: ['central_admin']
  },
  { 
    title: 'ตั้งค่าระบบ', 
    url: '/admin/settings', 
    icon: Settings,
    roles: ['central_admin']
  },
];

export function AppSidebar() {
  const { state } = useSidebar();
  const collapsed = state === 'collapsed';
  const location = useLocation();
  const navigate = useNavigate();
  const { profile, signOut } = useAuth();
  const [hospitalName, setHospitalName] = useState<string | null>(null);
  
  const currentPath = location.pathname;

  // Fetch hospital name for hospital_it users
  useEffect(() => {
    const fetchHospitalName = async () => {
      if (profile?.hospital_id) {
        const { data } = await supabase
          .from('hospitals')
          .select('name')
          .eq('id', profile.hospital_id)
          .maybeSingle();
        if (data) {
          setHospitalName(data.name);
        }
      }
    };
    fetchHospitalName();
  }, [profile?.hospital_id]);
  const isActive = (path: string) => currentPath === path || currentPath.startsWith(path + '/');

  const getRoleLabel = (role: string) => {
    const labels: Record<string, string> = {
      hospital_it: 'IT รพ.',
      provincial: 'สสจ.',
      regional: 'เขตสุขภาพ',
      central_admin: 'Super Admin',
    };
    return labels[role] || role;
  };

  const filterByRole = (items: typeof menuItems) => {
    if (!profile?.role) return items; // Show all if role not loaded yet
    return items.filter(item => item.roles.includes(profile.role));
  };

  const isCentralAdmin = profile?.role === 'central_admin';
  const isProvincialAdmin = profile?.role === 'provincial';
  const isRegionalAdmin = profile?.role === 'regional';
  const hasAdminMenu = isCentralAdmin || isProvincialAdmin || isRegionalAdmin;

  return (
    <Sidebar 
      collapsible="icon" 
      className="border-r bg-primary text-primary-foreground"
    >
      <SidebarHeader className="border-b border-primary-foreground/20 p-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-white/20 rounded-xl flex items-center justify-center flex-shrink-0">
            <Shield className="w-6 h-6 text-white" />
          </div>
          {!collapsed && (
            <div className="overflow-hidden">
              <h1 className="font-bold text-lg leading-tight text-white">CTAM+</h1>
              <p className="text-xs text-white/70 truncate">Cybersecurity Assessment</p>
            </div>
          )}
        </div>
      </SidebarHeader>

      <SidebarContent className="px-2 py-2">
        {/* Main Menu */}
        <SidebarGroup>
          <SidebarGroupLabel className={`text-white/60 ${collapsed ? 'sr-only' : ''}`}>
            เมนูหลัก
          </SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {filterByRole(menuItems).map((item) => (
                <SidebarMenuItem key={item.title}>
                  <SidebarMenuButton 
                    onClick={() => navigate(item.url)}
                    isActive={isActive(item.url)}
                    tooltip={item.title}
                    className={`
                      text-white/80 hover:bg-white/10 hover:text-white
                      data-[active=true]:bg-white data-[active=true]:text-primary data-[active=true]:font-medium
                    `}
                  >
                    <item.icon className="h-4 w-4" />
                    <span>{item.title}</span>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        {/* Admin Menu - Show for provincial, regional, and central_admin */}
        {hasAdminMenu && (
          <SidebarGroup>
            <SidebarGroupLabel className={`text-white/60 ${collapsed ? 'sr-only' : ''}`}>
              จัดการระบบ
            </SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                {adminItems
                  .filter(item => profile?.role && item.roles.includes(profile.role))
                  .map((item) => (
                    <SidebarMenuItem key={item.title}>
                      <SidebarMenuButton 
                        onClick={() => navigate(item.url)}
                        isActive={isActive(item.url)}
                        tooltip={item.title}
                        className={`
                          text-white/80 hover:bg-white/10 hover:text-white
                          data-[active=true]:bg-white data-[active=true]:text-primary data-[active=true]:font-medium
                        `}
                      >
                        <item.icon className="h-4 w-4" />
                        <span>{item.title}</span>
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                  ))}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        )}
      </SidebarContent>

      <SidebarFooter className="border-t border-white/20 p-4 bg-primary">
        {!collapsed && profile && (
          <div className="mb-3">
            <p className="font-medium text-sm truncate text-white">{profile.full_name || profile.email}</p>
            {hospitalName && (
              <p className="text-xs text-white/70 truncate">{hospitalName}</p>
            )}
            <Badge className="mt-1 bg-white/20 text-white hover:bg-white/30 border-0">
              {getRoleLabel(profile.role)}
            </Badge>
          </div>
        )}
        <div className="flex flex-col gap-2">
          <Button 
            variant="ghost" 
            size={collapsed ? 'icon' : 'default'}
            onClick={() => navigate('/profile')}
            className="w-full bg-white/10 border-0 text-white hover:bg-white/20 hover:text-white"
          >
            <UserCircle className="h-4 w-4" />
            {!collapsed && <span className="ml-2">ตั้งค่าโปรไฟล์</span>}
          </Button>
          <Button 
            variant="ghost" 
            size={collapsed ? 'icon' : 'default'}
            onClick={signOut}
            className="w-full bg-white/10 border-0 text-white hover:bg-white/20 hover:text-white"
          >
            <LogOut className="h-4 w-4" />
            {!collapsed && <span className="ml-2">ออกจากระบบ</span>}
          </Button>
        </div>
      </SidebarFooter>
    </Sidebar>
  );
}