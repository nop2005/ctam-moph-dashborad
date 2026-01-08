import { useState } from "react";
import { useLocation, useNavigate, Link } from "react-router-dom";
import { useLocalStorageState } from "@/hooks/useLocalStorageState";
import { Sidebar, SidebarContent, SidebarGroup, SidebarGroupContent, SidebarGroupLabel, SidebarMenu, SidebarMenuButton, SidebarMenuItem, SidebarMenuSub, SidebarMenuSubButton, SidebarMenuSubItem, SidebarHeader, SidebarProvider, SidebarTrigger, SidebarInset, useSidebar } from "@/components/ui/sidebar";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Shield, BarChart3, PieChart, TrendingUp, AlertTriangle, ClipboardCheck, FileSearch, ChevronRight, LogIn, BookOpen, Building2, Info } from "lucide-react";
import { SidebarFooter, SidebarSeparator } from "@/components/ui/sidebar";
import { Button } from "@/components/ui/button";
const reportSubItems = [{
  title: "รายงานภาพรวม",
  url: "/public/reports",
  icon: PieChart
}, {
  title: "เชิงปริมาณ ( 17 ข้อ )",
  url: "/public/reports/quantitative",
  icon: TrendingUp
}];
const inspectionSubItems = [{
  title: "รายงานผู้นิเทศ",
  url: "/public/inspection/supervisor",
  icon: FileSearch
}];
interface PublicSidebarProps {
  navigate: (path: string) => void;
}
function PublicSidebar({
  navigate
}: PublicSidebarProps) {
  const {
    state,
    toggleSidebar
  } = useSidebar();
  const collapsed = state === "collapsed";
  const location = useLocation();
  const currentPath = location.pathname;
  const isReportsActive = currentPath.startsWith("/public/reports");
  const isInspectionActive = currentPath.startsWith("/public/inspection");
  const [reportsOpen, setReportsOpen] = useLocalStorageState<boolean>("sidebar.publicReportsOpen", isReportsActive);
  const [inspectionOpen, setInspectionOpen] = useLocalStorageState<boolean>("sidebar.publicInspectionOpen", isInspectionActive);
  return <Sidebar collapsible="icon" className="border-r bg-sidebar text-sidebar-foreground">
      <SidebarHeader className="border-b border-sidebar-border p-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-sidebar-primary rounded-xl flex items-center justify-center flex-shrink-0">
            <Shield className="w-6 h-6 text-sidebar-primary-foreground" />
          </div>
          {!collapsed && <div className="overflow-hidden">
              <h1 className="font-bold text-lg leading-tight text-sidebar-primary">CTAM+</h1>
              <p className="text-xs text-sidebar-foreground/70 truncate">Cybersecurity Assessment</p>
            </div>}
        </div>
      </SidebarHeader>

      <SidebarContent className="px-3 py-2">
        <SidebarGroup>
          <SidebarGroupContent>
            <SidebarMenu>
              {/* Reports with Submenu */}
              <Collapsible open={reportsOpen} onOpenChange={setReportsOpen} className="group/collapsible">
                <SidebarMenuItem>
                  <SidebarMenuButton tooltip="รายงานและสถิติ" isActive={false} onClick={() => {
                  if (collapsed) {
                    toggleSidebar();
                    setReportsOpen(true);
                    if (!isReportsActive) navigate("/public/reports");
                    return;
                  }
                  setReportsOpen(!reportsOpen);
                }} className={`
                      text-sidebar-foreground/80 hover:bg-sidebar-accent hover:text-sidebar-foreground
                    `}>
                    <BarChart3 className="h-4 w-4" />
                    <span>รายงานและสถิติ</span>
                    <ChevronRight className="ml-auto h-4 w-4 transition-transform duration-200 group-data-[state=open]/collapsible:rotate-90" />
                  </SidebarMenuButton>
                  <CollapsibleContent>
                    <SidebarMenuSub className="border-sidebar-border">
                      {reportSubItems.map(subItem => <SidebarMenuSubItem key={subItem.title}>
                          <SidebarMenuSubButton onClick={() => navigate(subItem.url)} isActive={currentPath === subItem.url} className={`
                              text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-sidebar-foreground cursor-pointer
                              data-[active=true]:bg-sidebar-primary data-[active=true]:text-sidebar-primary-foreground data-[active=true]:font-medium
                            `}>
                            <subItem.icon className="h-3 w-3" />
                            <span>{subItem.title}</span>
                          </SidebarMenuSubButton>
                        </SidebarMenuSubItem>)}
                    </SidebarMenuSub>
                  </CollapsibleContent>
                </SidebarMenuItem>
              </Collapsible>

              {/* Inspection Reports with Submenu */}
              <Collapsible open={inspectionOpen} onOpenChange={setInspectionOpen} className="group/collapsible">
                <SidebarMenuItem>
                  <SidebarMenuButton tooltip="รายงานตรวจราชการ" isActive={false} onClick={() => {
                  if (collapsed) {
                    toggleSidebar();
                    setInspectionOpen(true);
                    if (!isInspectionActive) navigate("/public/inspection/supervisor");
                    return;
                  }
                  setInspectionOpen(!inspectionOpen);
                }} className={`
                      text-sidebar-foreground/80 hover:bg-sidebar-accent hover:text-sidebar-foreground
                    `}>
                    <ClipboardCheck className="h-4 w-4" />
                    <span>รายงานตรวจราชการ</span>
                    <ChevronRight className="ml-auto h-4 w-4 transition-transform duration-200 group-data-[state=open]/collapsible:rotate-90" />
                  </SidebarMenuButton>
                  <CollapsibleContent>
                    <SidebarMenuSub className="border-sidebar-border">
                      {inspectionSubItems.map(subItem => <SidebarMenuSubItem key={subItem.title}>
                          <SidebarMenuSubButton onClick={() => navigate(subItem.url)} isActive={currentPath === subItem.url || currentPath.startsWith(subItem.url + "/")} className={`
                              text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-sidebar-foreground cursor-pointer
                              data-[active=true]:bg-sidebar-primary data-[active=true]:text-sidebar-primary-foreground data-[active=true]:font-medium
                            `}>
                            <subItem.icon className="h-3 w-3" />
                            <span>{subItem.title}</span>
                          </SidebarMenuSubButton>
                        </SidebarMenuSubItem>)}
                    </SidebarMenuSub>
                  </CollapsibleContent>
                </SidebarMenuItem>
              </Collapsible>

              {/* คู่มือเอกสาร - Main Menu Item */}
              <SidebarMenuItem>
                <SidebarMenuButton tooltip="คู่มือเอกสาร" isActive={currentPath === "/public/inspection/manual"} onClick={() => navigate("/public/inspection/manual")} className={`
                    text-sidebar-foreground/80 hover:bg-sidebar-accent hover:text-sidebar-foreground
                    data-[active=true]:bg-sidebar-primary data-[active=true]:text-sidebar-primary-foreground data-[active=true]:font-medium
                  `}>
                  <BookOpen className="h-4 w-4" />
                  <span>คู่มือเอกสาร</span>
                </SidebarMenuButton>
              </SidebarMenuItem>
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      {/* Footer with Agency Info */}
      <SidebarFooter className="border-t border-sidebar-border p-3">
        {!collapsed ? <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-sidebar-primary/10 rounded-lg flex items-center justify-center flex-shrink-0">
              <Building2 className="w-5 h-5 text-sidebar-primary" />
            </div>
            <div className="overflow-hidden">
              <p className="text-xs font-medium text-sidebar-foreground leading-tight">
                ศูนย์เฝ้าระวังความมั่นคงปลอดภัยไซเบอร์เขตสุขภาพที่ 1 (CISO)
              </p>
              <p className="text-xs text-sidebar-foreground/60 truncate">ศทส.สป. กระทรวงสาธารณสุข</p>
            </div>
          </div> : <div className="flex justify-center">
            <Building2 className="w-5 h-5 text-sidebar-primary" />
          </div>}
      </SidebarFooter>
    </Sidebar>;
}
function PublicSidebarInner() {
  const navigate = useNavigate();
  return <PublicSidebar navigate={navigate} />;
}
interface PublicLayoutProps {
  children: React.ReactNode;
}
export function PublicLayout({
  children
}: PublicLayoutProps) {
  const navigate = useNavigate();
  return <SidebarProvider>
      <div className="min-h-screen flex w-full">
        <PublicSidebar navigate={navigate} />
        <SidebarInset className="flex-1">
          <header className="sticky top-0 z-[60] flex h-14 items-center justify-between border-b bg-background px-4">
            <div className="flex items-center gap-4">
              <SidebarTrigger />
              <span className="text-sm font-medium text-muted-foreground">
                ระบบประเมินความมั่นคงปลอดภัยไซเบอร์และรายงานการตรวจราชการ
              </span>
            </div>
            <Button variant="ghost" size="sm" onClick={() => navigate("/login")} className="text-primary hover:bg-primary/10">
              <LogIn className="h-4 w-4 mr-2" />
              เข้าสู่ระบบ
            </Button>
          </header>
          <main className="flex-1 p-6 pl-12">{children}</main>
        </SidebarInset>
      </div>
    </SidebarProvider>;
}