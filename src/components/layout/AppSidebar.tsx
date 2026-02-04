import { useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { useLocalStorageState } from "@/hooks/useLocalStorageState";
import { useAuth } from "@/contexts/AuthContext";
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
  SidebarFooter,
  useSidebar,
} from "@/components/ui/sidebar";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
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
  ListOrdered,
  HardDrive,
  MapPinned,
  Wrench,
  UserCheck,
  MonitorDot,
  Wallet,
  DollarSign,
  Table2,
} from "lucide-react";
const menuItems = [
  {
    title: "หน้าหลักแบบประเมิน",
    url: "/dashboard",
    icon: LayoutDashboard,
    roles: ["hospital_it", "provincial", "regional", "central_admin", "health_office", "supervisor"],
  },
  {
    title: "บุคลากรในหน่วยงาน",
    url: "/personnel",
    icon: UserCheck,
    roles: ["hospital_it", "health_office"],
  },
  {
    title: "บันทึกงบประมาณประจำปี",
    url: "/budget-recording",
    icon: Wallet,
    roles: ["hospital_it", "health_office"],
  },
  {
    title: "บุคลากร",
    url: "/personnel-admin",
    icon: UserCheck,
    roles: ["provincial", "regional"],
  },
];
const reportSubItems = [
  {
    title: "คะเเนนรวม 70:30",
    url: "/reports",
    icon: PieChart,
  },
  {
    title: "เชิงปริมาณ (17 ข้อ)",
    url: "/reports/quantitative",
    icon: TrendingUp,
  },
  {
    title: "เชิงผลกระทบ (Incident & Recovery)",
    url: "/reports/impact",
    icon: AlertTriangle,
  },
  {
    title: "แดชบอร์ดศูนย์เทคโนโลยีสารสนเทศ",
    url: "/reports/tableau-dashboard",
    icon: MonitorDot,
  },
];
const analyticalReportSubItems = [
  {
    title: "รายงาน CTAM+ เพิ่มเติม",
    url: "/reports/quantitative-detail",
    icon: ListOrdered,
  },
  {
    title: "คะแนน 17 ข้อ แยกตามพื้นที่",
    url: "/reports/quantitative-by-area",
    icon: MapPinned,
  },
  {
    title: "การใช้อุปกรณ์/ซอฟต์แวร์",
    url: "/reports/equipment-usage",
    icon: Wrench,
  },
];
const budgetReportSubItems = [
  {
    title: "ตารางสรุปงบประมาณ",
    url: "/reports/budget",
    icon: Table2,
  },
  {
    title: "กราฟแท่ง (Drill-down)",
    url: "/reports/budget/chart",
    icon: BarChart3,
  },
  {
    title: "กราฟวงกลม (17 หมวดหมู่)",
    url: "/reports/budget/pie",
    icon: PieChart,
  },
];
const inspectionSubItems = [
  {
    title: "รายงานผู้นิเทศ",
    url: "/inspection/supervisor",
    icon: FileSearch,
  },
  {
    title: "รายงานผู้รับนิเทศ",
    url: "/inspection/supervisee",
    icon: FileCheck,
  },
];
const adminItems = [
  {
    title: "จัดการผู้ใช้งาน",
    url: "/user-management",
    icon: Users,
    roles: ["provincial", "regional"],
  },
  {
    title: "จัดการผู้ใช้งาน",
    url: "/super-admin",
    icon: Users,
    roles: ["central_admin"],
  },
  {
    title: "จัดการโรงพยาบาล",
    url: "/admin/hospitals",
    icon: Building2,
    roles: ["central_admin"],
  },
  {
    title: "ตั้งค่าระบบ",
    url: "/admin/settings",
    icon: Settings,
    roles: ["central_admin"],
  },
  {
    title: "แดชบอร์ดระบบ",
    url: "/admin/system-dashboard",
    icon: HardDrive,
    roles: ["central_admin"],
  },
];
export function AppSidebar() {
  const { state } = useSidebar();
  const collapsed = state === "collapsed";
  const location = useLocation();
  const navigate = useNavigate();
  const { profile } = useAuth();
  const currentPath = location.pathname;
  const isActive = (path: string) => currentPath === path || currentPath.startsWith(path + "/");
  const isReportsActive =
    currentPath === "/reports" || currentPath === "/reports/quantitative" || currentPath === "/reports/impact" || currentPath === "/reports/tableau-dashboard";
  const isAnalyticalReportsActive =
    currentPath === "/reports/quantitative-by-area" ||
    currentPath === "/reports/quantitative-detail" ||
    currentPath === "/reports/equipment-usage";
  const isInspectionActive = currentPath.startsWith("/inspection") && currentPath !== "/inspection/manual";
  const isBudgetReportActive = currentPath.startsWith("/reports/budget");

  // State for collapsible menus (persist across route changes)
  const [reportsOpen, setReportsOpen] = useLocalStorageState<boolean>("sidebar.reportsOpen", isReportsActive);
  const [analyticalReportsOpen, setAnalyticalReportsOpen] = useLocalStorageState<boolean>(
    "sidebar.analyticalReportsOpen",
    isAnalyticalReportsActive,
  );
  const [inspectionOpen, setInspectionOpen] = useLocalStorageState<boolean>(
    "sidebar.inspectionOpen",
    isInspectionActive,
  );
  const [budgetReportOpen, setBudgetReportOpen] = useLocalStorageState<boolean>(
    "sidebar.budgetReportOpen",
    isBudgetReportActive,
  );
  const filterByRole = (items: typeof menuItems) => {
    if (!profile?.role) return items;
    return items.filter((item) => item.roles.includes(profile.role));
  };
  const isCentralAdmin = profile?.role === "central_admin";
  const isProvincialAdmin = profile?.role === "provincial";
  const isRegionalAdmin = profile?.role === "regional";
  const isSupervisor = profile?.role === "supervisor";
  const hasAdminMenu = isCentralAdmin || isProvincialAdmin || isRegionalAdmin;
  return (
    <Sidebar collapsible="icon" className="border-r bg-sidebar text-sidebar-foreground">
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
          <SidebarGroupLabel className={`text-sidebar-foreground/60 ${collapsed ? "sr-only" : ""}`}>
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
              <Collapsible open={reportsOpen} onOpenChange={setReportsOpen} className="group/collapsible">
                <SidebarMenuItem>
                  <SidebarMenuButton
                    tooltip="รายงานและสถิติ"
                    isActive={false}
                    onClick={() => {
                      if (collapsed) {
                        navigate("/reports");
                      } else {
                        setReportsOpen(!reportsOpen);
                      }
                    }}
                    className={`
                      text-sidebar-foreground/80 hover:bg-sidebar-accent hover:text-sidebar-foreground
                    `}
                  >
                    <BarChart3 className="h-4 w-4" />
                    <span>เเดชบอร์ดทั่วไป</span>
                    <ChevronRight className="ml-auto h-4 w-4 transition-transform duration-200 group-data-[state=open]/collapsible:rotate-90" />
                  </SidebarMenuButton>
                  <CollapsibleContent>
                    <SidebarMenuSub className="border-sidebar-border">
                      {reportSubItems.map((subItem) => (
                        <SidebarMenuSubItem key={subItem.title}>
                          <SidebarMenuSubButton
                            onClick={() => navigate(subItem.url)}
                            isActive={currentPath === subItem.url}
                            title={subItem.title}
                            className={`
                              text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-sidebar-foreground cursor-pointer
                              data-[active=true]:bg-sidebar-primary data-[active=true]:text-sidebar-primary-foreground data-[active=true]:font-medium
                            `}
                          >
                            <subItem.icon className="h-3 w-3" />
                            <span className="truncate">{subItem.title}</span>
                          </SidebarMenuSubButton>
                        </SidebarMenuSubItem>
                      ))}
                    </SidebarMenuSub>
                  </CollapsibleContent>
                </SidebarMenuItem>
              </Collapsible>

              {/* Analytical Reports with Submenu - Hide from hospital_it and health_office */}
              {profile?.role && !["hospital_it", "health_office"].includes(profile.role) && (
                <Collapsible
                  open={analyticalReportsOpen}
                  onOpenChange={setAnalyticalReportsOpen}
                  className="group/collapsible"
                >
                  <SidebarMenuItem>
                    <SidebarMenuButton
                      tooltip="รายงานเชิงวิเคราะห์"
                      isActive={false}
                      onClick={() => {
                        if (collapsed) {
                          navigate("/reports/impact");
                        } else {
                          setAnalyticalReportsOpen(!analyticalReportsOpen);
                        }
                      }}
                      className={`
                      text-sidebar-foreground/80 hover:bg-sidebar-accent hover:text-sidebar-foreground
                    `}
                    >
                      <TrendingUp className="h-4 w-4" />
                      <span>รายงานเชิงวิเคราะห์</span>
                      <ChevronRight className="ml-auto h-4 w-4 transition-transform duration-200 group-data-[state=open]/collapsible:rotate-90" />
                    </SidebarMenuButton>
                    <CollapsibleContent>
                      <SidebarMenuSub className="border-sidebar-border">
                        {analyticalReportSubItems.map((subItem) => (
                          <SidebarMenuSubItem key={subItem.title}>
                            <SidebarMenuSubButton
                              onClick={() => navigate(subItem.url)}
                              isActive={currentPath === subItem.url}
                              title={subItem.title}
                              className={`
                              text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-sidebar-foreground cursor-pointer
                              data-[active=true]:bg-sidebar-primary data-[active=true]:text-sidebar-primary-foreground data-[active=true]:font-medium
                            `}
                            >
                              <subItem.icon className="h-3 w-3" />
                              <span className="truncate">{subItem.title}</span>
                            </SidebarMenuSubButton>
                          </SidebarMenuSubItem>
                        ))}
                      </SidebarMenuSub>
                    </CollapsibleContent>
                  </SidebarMenuItem>
                </Collapsible>
              )}

              {/* Inspection Reports with Submenu */}
              <Collapsible open={inspectionOpen} onOpenChange={setInspectionOpen} className="group/collapsible">
                <SidebarMenuItem>
                  <SidebarMenuButton
                    tooltip="รายงานตรวจราชการ"
                    isActive={false}
                    onClick={() => {
                      if (collapsed) {
                        navigate("/inspection/supervisor");
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
                            isActive={currentPath === subItem.url || currentPath.startsWith(subItem.url + "/")}
                            title={subItem.title}
                            className={`
                              text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-sidebar-foreground cursor-pointer
                              data-[active=true]:bg-sidebar-primary data-[active=true]:text-sidebar-primary-foreground data-[active=true]:font-medium
                            `}
                          >
                            <subItem.icon className="h-3 w-3" />
                            <span className="truncate">{subItem.title}</span>
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
                  onClick={() => navigate("/inspection/manual")}
                  isActive={currentPath === "/inspection/manual"}
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

              {/* Budget Report with Submenu - For all authenticated users */}
              <Collapsible open={budgetReportOpen} onOpenChange={setBudgetReportOpen} className="group/collapsible">
                <SidebarMenuItem>
                  <SidebarMenuButton
                    tooltip="รายงานงบประมาณประจำปี"
                    isActive={false}
                    onClick={() => {
                      if (collapsed) {
                        navigate("/reports/budget");
                      } else {
                        setBudgetReportOpen(!budgetReportOpen);
                      }
                    }}
                    className={`
                      text-sidebar-foreground/80 hover:bg-sidebar-accent hover:text-sidebar-foreground
                    `}
                  >
                    <DollarSign className="h-4 w-4" />
                    <span>รายงานงบประมาณประจำปี</span>
                    <ChevronRight className="ml-auto h-4 w-4 transition-transform duration-200 group-data-[state=open]/collapsible:rotate-90" />
                  </SidebarMenuButton>
                  <CollapsibleContent>
                    <SidebarMenuSub className="border-sidebar-border">
                      {budgetReportSubItems.map((subItem) => (
                        <SidebarMenuSubItem key={subItem.title}>
                          <SidebarMenuSubButton
                            onClick={() => navigate(subItem.url)}
                            isActive={currentPath === subItem.url}
                            title={subItem.title}
                            className={`
                              text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-sidebar-foreground cursor-pointer
                              data-[active=true]:bg-sidebar-primary data-[active=true]:text-sidebar-primary-foreground data-[active=true]:font-medium
                            `}
                          >
                            <subItem.icon className="h-3 w-3" />
                            <span className="truncate">{subItem.title}</span>
                          </SidebarMenuSubButton>
                        </SidebarMenuSubItem>
                      ))}
                    </SidebarMenuSub>
                  </CollapsibleContent>
                </SidebarMenuItem>
              </Collapsible>

              {/* Personnel Report - For provincial, regional, central_admin */}
              {profile?.role && ["provincial", "regional", "central_admin"].includes(profile.role) && (
                <SidebarMenuItem>
                  <SidebarMenuButton
                    onClick={() => navigate("/reports/personnel")}
                    isActive={currentPath === "/reports/personnel"}
                    tooltip="รายงานบุคลากร"
                    className={`
                      text-sidebar-foreground/80 hover:bg-sidebar-accent hover:text-sidebar-foreground
                      data-[active=true]:bg-sidebar-primary data-[active=true]:text-sidebar-primary-foreground data-[active=true]:font-medium
                    `}
                  >
                    <Users className="h-4 w-4" />
                    <span>รายงานบุคลากร</span>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              )}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        {/* Admin Menu - Show for provincial, regional, and central_admin */}
        {hasAdminMenu && (
          <SidebarGroup>
            <SidebarGroupLabel className={`text-sidebar-foreground/60 ${collapsed ? "sr-only" : ""}`}>
              จัดการระบบ
            </SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                {adminItems
                  .filter((item) => profile?.role && item.roles.includes(profile.role))
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

      {/* Footer with About System and Agency Info */}
      <SidebarFooter className="border-t border-sidebar-border p-3">
        {!collapsed}
        {!collapsed ? (
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-sidebar-primary/10 rounded-lg flex items-center justify-center flex-shrink-0">
              <Building2 className="w-5 h-5 text-sidebar-primary" />
            </div>
            <div className="overflow-hidden">
              <p className="text-xs font-medium text-sidebar-foreground leading-tight">
                ศูนย์เฝ้าระวังความมั่นคงปลอดภัยไซเบอร์เขตสุขภาพที่ 1 (CISO)
              </p>
              <p className="text-xs text-sidebar-foreground/60 truncate">ศทส.สป. กระทรวงสาธารณสุข</p>
            </div>
          </div>
        ) : (
          <div className="flex justify-center">
            <Building2 className="w-5 h-5 text-sidebar-primary" />
          </div>
        )}
      </SidebarFooter>
    </Sidebar>
  );
}
