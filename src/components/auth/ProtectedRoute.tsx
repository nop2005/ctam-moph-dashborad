import { useEffect, useState } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface ProtectedRouteProps {
  children: React.ReactNode;
  allowedRoles?: Array<'hospital_it' | 'provincial' | 'regional' | 'central_admin' | 'health_office' | 'supervisor'>;
}

export function ProtectedRoute({ children, allowedRoles }: ProtectedRouteProps) {
  const { user, profile, isLoading, signOut } = useAuth();
  const location = useLocation();
  const [isSigningOut, setIsSigningOut] = useState(false);

  useEffect(() => {
    // If user exists but account is not active, force logout
    if (user && profile && !profile.is_active) {
      setIsSigningOut(true);
      signOut().finally(() => setIsSigningOut(false));
    }
  }, [user, profile, signOut]);

  if (isLoading || isSigningOut) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-center">
          <Loader2 className="h-8 w-8 animate-spin text-primary mx-auto mb-4" />
          <p className="text-muted-foreground">กำลังโหลด...</p>
        </div>
      </div>
    );
  }

  // If user is authenticated but profile is temporarily unavailable (backend hiccup), show a recoverable screen.
  if (user && !profile) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-6">
        <div className="max-w-md w-full text-center space-y-4">
          <Loader2 className="h-8 w-8 animate-spin text-primary mx-auto" />
          <div className="space-y-1">
            <p className="font-medium text-foreground">กำลังเชื่อมต่อฐานข้อมูล…</p>
            <p className="text-sm text-muted-foreground">กรุณารอสักครู่ แล้วกดรีเฟรช (หรือออกจากระบบแล้วลองใหม่)</p>
          </div>
          <div className="flex items-center justify-center gap-2">
            <Button variant="link" size="sm" onClick={() => window.location.reload()}>
              รีเฟรชหน้า
            </Button>
            <span className="text-muted-foreground">•</span>
            <Button
              variant="link"
              size="sm"
              onClick={() => {
                setIsSigningOut(true);
                signOut().finally(() => setIsSigningOut(false));
              }}
            >
              ออกจากระบบ
            </Button>
          </div>
        </div>
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  // If profile still missing, block access (shouldn't happen often, but safer)
  if (!profile) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  if (!profile.is_active) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  if (allowedRoles && !allowedRoles.includes(profile.role)) {
    return <Navigate to="/unauthorized" replace />;
  }

  return <>{children}</>;
}
