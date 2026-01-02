import { useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useLocalStorageState } from '@/hooks/useLocalStorageState';
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
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';
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
  AlertTriangle,
  ClipboardCheck,
  FileSearch,
  FileCheck,
  BookOpen,
  ChevronRight,
} from 'lucide-react';

const menuItems = [
  { 
    title: 'หน้าหลัก', 
    url: '/dashboard', 
    icon: LayoutDashboard,
    roles: ['hospital_it', 'provincial', 'regional', 'central_admin', 'health_office', 'supervisor']
  },
  { 
    title: 'แบบประเมิน CTAM+', 
    url: '/assessments', 
    icon: FileText,
    roles: ['hospital_it', 'provincial', 'regional', 'central_admin', 'health_office', 'supervisor']
  },
];

const reportSubItems = [
  { title: 'รายงานภาพรวม', url: '/reports', icon: PieChart },
  { title: 'เชิงปริมาณ', url: '/reports/quantitative', icon: TrendingUp },
  { title: 'เชิงผลกระทบ', url: '/reports/impact', icon: AlertTriangle },
];

const inspectionSubItems = [
  { title: 'รายงานผู้นิเทศ', url: '/inspection/supervisor', icon: FileSearch },
  { title: 'รายงานผู้รับนิเทศ', url: '/inspection/supervisee', icon: FileCheck },
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
    roles: ['central_admin', 'regional']
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
  const isInspectionActive = currentPath.startsWith('/inspection') && currentPath !== '/inspection/manual';

  // State for collapsible menus (persist across route changes)
  const [reportsOpen, setReportsOpen] = useLocalStorageState<boolean>(
    'sidebar.reportsOpen',
    isReportsActive
  );
  const [inspectionOpen, setInspectionOpen] = useLocalStorageState<boolean>(
    'sidebar.inspectionOpen',
    isInspectionActive
  );

  const filterByRole = (items: typeof menuItems) => {
    if (!profile?.role) return items;
    return items.filter(item => item.roles.includes(profile.role));
  };

  const isCentralAdmin = profile?.role === 'central_admin';
  const isProvincialAdmin = profile?.role === 'provincial';
  const isRegionalAdmin = profile?.role === 'regional';
  const isSupervisor = profile?.role === 'supervisor';
  const hasAdminMenu = isCentralAdmin || isProvincialAdmin || isRegionalAdmin;

  return (
    <Sidebar 
      collapsible="icon" 
      className="border-r bg-sidebar text-sidebar-foreground"
    >
      <SidebarHeader className="border-b border-sidebar-border p-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-sidebar-primary rounded-xl flex items-center justify-center flex-shrink-0">
            <Shield className="w-6 h-6 text-sidebar-primary-foreground" />
          </div>
          {!collapsed && (
            <div className="overflow-hidden">
              <h1 className="font-bold text-lg leading-tight text-sidebar-primary">CTAM+</h1>
              <p className="text-xs text-sidebar-foreground/70 truncate">Cybersecurity Assessment</p>
            </div>
          )}
        </div>
      </SidebarHeader>

      <SidebarContent className="px-3 py-2">
        {/* Main Menu */}
        <SidebarGroup>
          <SidebarGroupLabel className={`text-sidebar-foreground/60 ${collapsed ? 'sr-only' : ''}`}>
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
                      text-sidebar-foreground/80 hover:bg-sidebar-accent hover:text-sidebar-foreground
                      data-[active=true]:bg-sidebar-primary data-[active=true]:text-sidebar-primary-foreground data-[active=true]:font-medium
                    `}
                  >
                    <item.icon className="h-4 w-4" />
                    <span>{item.title}</span>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}

              {/* Reports with Submenu - Always visible */}
              <Collapsible
                open={reportsOpen}
                onOpenChange={setReportsOpen}
                className="group/collapsible"
              >
                <SidebarMenuItem>
                  <SidebarMenuButton 
                    tooltip="รายงานและสถิติ"
                    isActive={false}
                    onClick={() => {
                      if (collapsed) {
                        navigate('/reports');
                      } else {
                        setReportsOpen(!reportsOpen);
                      }
                    }}
                    className={`
                      text-sidebar-foreground/80 hover:bg-sidebar-accent hover:text-sidebar-foreground
                    `}
                  >
                    <BarChart3 className="h-4 w-4" />
                    <span>รายงานและสถิติ</span>
                    <ChevronRight className="ml-auto h-4 w-4 transition-transform duration-200 group-data-[state=open]/collapsible:rotate-90" />
                  </SidebarMenuButton>
                  <CollapsibleContent>
                    <SidebarMenuSub className="border-sidebar-border">
                      {reportSubItems.map((subItem) => (
                        <SidebarMenuSubItem key={subItem.title}>
                          <SidebarMenuSubButton
                            onClick={() => navigate(subItem.url)}
                            isActive={currentPath === subItem.url}
                            className={`
                              text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-sidebar-foreground cursor-pointer
                              data-[active=true]:bg-sidebar-primary data-[active=true]:text-sidebar-primary-foreground data-[active=true]:font-medium
                            `}
                          >
                            <subItem.icon className="h-3 w-3" />
                            <span>{subItem.title}</span>
                          </SidebarMenuSubButton>
                        </SidebarMenuSubItem>
                      ))}
                    </SidebarMenuSub>
                  </CollapsibleContent>
                </SidebarMenuItem>
              </Collapsible>

              {/* Inspection Reports with Submenu */}
              <Collapsible
                open={inspectionOpen}
                onOpenChange={setInspectionOpen}
                className="group/collapsible"
              >
                <SidebarMenuItem>
                  <SidebarMenuButton 
                    tooltip="รายงานตรวจราชการ"
                    isActive={false}
                    onClick={() => {
                      if (collapsed) {
                        navigate('/inspection/supervisor');
                      } else {
                        setInspectionOpen(!inspectionOpen);
                      }
                    }}
                    className={`
                      text-sidebar-foreground/80 hover:bg-sidebar-accent hover:text-sidebar-foreground
                    `}
                  >
                    <ClipboardCheck className="h-4 w-4" />
                    <span>รายงานตรวจราชการ</span>
                    <ChevronRight className="ml-auto h-4 w-4 transition-transform duration-200 group-data-[state=open]/collapsible:rotate-90" />
                  </SidebarMenuButton>
                  <CollapsibleContent>
                    <SidebarMenuSub className="border-sidebar-border">
                      {inspectionSubItems.map((subItem) => (
                        <SidebarMenuSubItem key={subItem.title}>
                          <SidebarMenuSubButton
                            onClick={() => navigate(subItem.url)}
                            isActive={currentPath === subItem.url || currentPath.startsWith(subItem.url + '/')}
                            className={`
                              text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-sidebar-foreground cursor-pointer
                              data-[active=true]:bg-sidebar-primary data-[active=true]:text-sidebar-primary-foreground data-[active=true]:font-medium
                            `}
                          >
                            <subItem.icon className="h-3 w-3" />
                            <span>{subItem.title}</span>
                          </SidebarMenuSubButton>
                        </SidebarMenuSubItem>
                      ))}
                    </SidebarMenuSub>
                  </CollapsibleContent>
                </SidebarMenuItem>
              </Collapsible>

              {/* Inspection Manual - Standalone menu item */}
              <SidebarMenuItem>
                <SidebarMenuButton 
                  onClick={() => navigate('/inspection/manual')}
                  isActive={currentPath === '/inspection/manual'}
                  tooltip="คู่มือเอกสารสำหรับการนิเทศ"
                  className={`
                    text-sidebar-foreground/80 hover:bg-sidebar-accent hover:text-sidebar-foreground
                    data-[active=true]:bg-sidebar-primary data-[active=true]:text-sidebar-primary-foreground data-[active=true]:font-medium
                  `}
                >
                  <BookOpen className="h-4 w-4" />
                  <span>คู่มือเอกสารสำหรับการนิเทศ</span>
                </SidebarMenuButton>
              </SidebarMenuItem>
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        {/* Admin Menu - Show for provincial, regional, and central_admin */}
        {hasAdminMenu && (
          <SidebarGroup>
            <SidebarGroupLabel className={`text-sidebar-foreground/60 ${collapsed ? 'sr-only' : ''}`}>
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
                          text-sidebar-foreground/80 hover:bg-sidebar-accent hover:text-sidebar-foreground
                          data-[active=true]:bg-sidebar-primary data-[active=true]:text-sidebar-primary-foreground data-[active=true]:font-medium
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