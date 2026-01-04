import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { SidebarProvider, SidebarTrigger, SidebarInset } from '@/components/ui/sidebar';
import { AppSidebar } from './AppSidebar';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { UserCircle, Settings, LogOut, ChevronDown } from 'lucide-react';

interface DashboardLayoutProps {
  children: React.ReactNode;
}

export function DashboardLayout({ children }: DashboardLayoutProps) {
  const navigate = useNavigate();
  const { profile, signOut } = useAuth();
  const [organizationName, setOrganizationName] = useState<string | null>(null);

  // Fetch organization name based on role
  useEffect(() => {
    const fetchOrganizationName = async () => {
      if (!profile) return;

      // For health_office role, fetch from health_offices table
      if (profile.health_office_id) {
        const { data } = await supabase
          .from('health_offices')
          .select('name')
          .eq('id', profile.health_office_id)
          .maybeSingle();
        if (data) setOrganizationName(data.name);
      } else if (profile.hospital_id) {
        const { data } = await supabase
          .from('hospitals')
          .select('name')
          .eq('id', profile.hospital_id)
          .maybeSingle();
        if (data) setOrganizationName(data.name);
      } else if (profile.province_id) {
        const { data } = await supabase
          .from('provinces')
          .select('name')
          .eq('id', profile.province_id)
          .maybeSingle();
        if (data) setOrganizationName(`สสจ.${data.name}`);
      } else if (profile.health_region_id) {
        const { data } = await supabase
          .from('health_regions')
          .select('region_number')
          .eq('id', profile.health_region_id)
          .maybeSingle();
        if (data) setOrganizationName(`เขตสุขภาพที่ ${data.region_number}`);
      } else if (profile.role === 'central_admin') {
        setOrganizationName('กระทรวงสาธารณสุข');
      }
    };
    fetchOrganizationName();
  }, [profile]);

  const getRoleLabel = (role: string) => {
    const labels: Record<string, string> = {
      hospital_it: 'IT รพ.',
      provincial: 'สสจ.',
      regional: 'เขตสุขภาพ',
      central_admin: 'Super Admin',
      health_office: 'สสจ./สนข.',
    };
    return labels[role] || role;
  };

  const handleSignOut = async () => {
    await signOut();
    navigate('/public/reports', { replace: true });
  };

  return (
    <SidebarProvider>
      <div className="min-h-screen flex w-full">
        <AppSidebar />
        <SidebarInset className="flex-1">
          <header className="sticky top-0 z-40 flex h-14 items-center justify-between border-b bg-background px-4">
            <div className="flex items-center gap-4">
              <SidebarTrigger />
              <span className="text-sm font-medium text-muted-foreground">
                ระบบประเมินความมั่นคงปลอดภัยไซเบอร์และรายงานการตรวจราชการ
              </span>
            </div>
            
            {/* User Menu - Top Right */}
            {profile ? (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="sm" className="gap-2 h-auto py-1.5">
                    <UserCircle className="h-5 w-5 flex-shrink-0" />
                    <div className="flex flex-col items-start text-left">
                      <span className="text-sm font-medium leading-tight">
                        {profile.full_name || profile.email}
                      </span>
                      {organizationName && (
                        <span className="text-xs text-muted-foreground leading-tight">
                          {organizationName}
                        </span>
                      )}
                    </div>
                    <ChevronDown className="h-4 w-4 text-muted-foreground" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-56">
                  <DropdownMenuLabel>
                    <div className="flex flex-col gap-1">
                      <span className="font-medium">{profile.full_name || 'ผู้ใช้งาน'}</span>
                      <span className="text-xs text-muted-foreground">{profile.email}</span>
                      <span className="text-xs text-primary font-medium">{getRoleLabel(profile.role || '')}</span>
                    </div>
                  </DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={() => navigate('/profile')}>
                    <Settings className="mr-2 h-4 w-4" />
                    ตั้งค่าโปรไฟล์
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={handleSignOut} className="text-destructive focus:text-destructive">
                    <LogOut className="mr-2 h-4 w-4" />
                    ออกจากระบบ
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            ) : (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <UserCircle className="h-5 w-5" />
                <span>กำลังโหลด...</span>
              </div>
            )}
          </header>
          <main className="flex-1 p-6 pl-12">
            {children}
          </main>
        </SidebarInset>
      </div>
    </SidebarProvider>
  );
}
