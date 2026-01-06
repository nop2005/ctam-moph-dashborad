import { useEffect, useState } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { Loader2 } from 'lucide-react';

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

  if (isLoading || isSigningOut || (user && !profile)) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-center">
          <Loader2 className="h-8 w-8 animate-spin text-primary mx-auto mb-4" />
          <p className="text-muted-foreground">กำลังโหลด...</p>
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
