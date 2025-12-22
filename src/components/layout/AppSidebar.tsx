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
  SidebarMenuSub,
  SidebarMenuSubButton,
  SidebarMenuSubItem,
  SidebarHeader,
  useSidebar,
} from '@/components/ui/sidebar';
import {
  Shield,
  LayoutDashboard,
  FileText,
  BarChart3,
  Users,
  Building2,
  Settings,
  PieChart,
  TrendingUp,
  Target,
  AlertTriangle,
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
];

const reportSubItems = [
  { title: 'รายงานภาพรวม', url: '/reports', icon: PieChart },
  { title: 'เชิงปริมาณ', url: '/reports/quantitative', icon: TrendingUp },
  { title: 'เชิงคุณภาพ', url: '/reports/qualitative', icon: Target },
  { title: 'เชิงผลกระทบ', url: '/reports/impact', icon: AlertTriangle },
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
  const { profile } = useAuth();
  
  const currentPath = location.pathname;

  const isActive = (path: string) => currentPath === path || currentPath.startsWith(path + '/');
  const isReportsActive = currentPath.startsWith('/reports');

  const filterByRole = (items: typeof menuItems) => {
    if (!profile?.role) return items;
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

      <SidebarContent className="px-3 py-2">
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

              {/* Reports with Submenu - Always visible */}
              <SidebarMenuItem>
                <SidebarMenuButton 
                  tooltip="รายงานและสถิติ"
                  isActive={isReportsActive}
                  className={`
                    text-white/80 hover:bg-white/10 hover:text-white
                    data-[active=true]:bg-white data-[active=true]:text-primary data-[active=true]:font-medium
                  `}
                >
                  <BarChart3 className="h-4 w-4" />
                  <span>รายงานและสถิติ</span>
                </SidebarMenuButton>
                <SidebarMenuSub className="border-white/20">
                  {reportSubItems.map((subItem) => (
                    <SidebarMenuSubItem key={subItem.title}>
                      <SidebarMenuSubButton
                        onClick={() => navigate(subItem.url)}
                        isActive={currentPath === subItem.url}
                        className={`
                          text-white/70 hover:bg-white/10 hover:text-white cursor-pointer
                          data-[active=true]:bg-white/20 data-[active=true]:text-white data-[active=true]:font-medium
                        `}
                      >
                        <subItem.icon className="h-3 w-3" />
                        <span>{subItem.title}</span>
                      </SidebarMenuSubButton>
                    </SidebarMenuSubItem>
                  ))}
                </SidebarMenuSub>
              </SidebarMenuItem>
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
    </Sidebar>
  );
}