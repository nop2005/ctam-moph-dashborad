import { useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
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
  ChevronLeft,
  ChevronRight,
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
    url: '/assessment', 
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
  
  const currentPath = location.pathname;
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
    if (!profile) return [];
    return items.filter(item => item.roles.includes(profile.role));
  };

  return (
    <Sidebar collapsible="icon" className="border-r">
      <SidebarHeader className="border-b p-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-primary/10 rounded-xl flex items-center justify-center flex-shrink-0">
            <Shield className="w-6 h-6 text-primary" />
          </div>
          {!collapsed && (
            <div className="overflow-hidden">
              <h1 className="font-bold text-lg leading-tight">CTAM+</h1>
              <p className="text-xs text-muted-foreground truncate">Cybersecurity Assessment</p>
            </div>
          )}
        </div>
      </SidebarHeader>

      <SidebarContent className="px-2">
        {/* Main Menu */}
        <SidebarGroup>
          <SidebarGroupLabel className={collapsed ? 'sr-only' : ''}>
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
                  >
                    <item.icon className="h-4 w-4" />
                    <span>{item.title}</span>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        {/* Admin Menu */}
        {profile?.role === 'central_admin' && (
          <SidebarGroup>
            <SidebarGroupLabel className={collapsed ? 'sr-only' : ''}>
              จัดการระบบ
            </SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                {filterByRole(adminItems).map((item) => (
                  <SidebarMenuItem key={item.title}>
                    <SidebarMenuButton 
                      onClick={() => navigate(item.url)}
                      isActive={isActive(item.url)}
                      tooltip={item.title}
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

      <SidebarFooter className="border-t p-4">
        {!collapsed && profile && (
          <div className="mb-3">
            <p className="font-medium text-sm truncate">{profile.full_name || profile.email}</p>
            <Badge variant="secondary" className="mt-1">
              {getRoleLabel(profile.role)}
            </Badge>
          </div>
        )}
        <Button 
          variant="outline" 
          size={collapsed ? 'icon' : 'default'}
          onClick={signOut}
          className="w-full"
        >
          <LogOut className="h-4 w-4" />
          {!collapsed && <span className="ml-2">ออกจากระบบ</span>}
        </Button>
      </SidebarFooter>
    </Sidebar>
  );
}
