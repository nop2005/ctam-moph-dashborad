import { useEffect, useRef, useState } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { Loader2 } from 'lucide-react';

interface ProtectedRouteProps {
  children: React.ReactNode;
  allowedRoles?: Array<'hospital_it' | 'provincial' | 'regional' | 'central_admin' | 'health_office' | 'supervisor' | 'ceo'>;
}

export function ProtectedRoute({ children, allowedRoles }: ProtectedRouteProps) {
  const { user, profile, isLoading, signOut } = useAuth();
  const location = useLocation();
  const [isSigningOut, setIsSigningOut] = useState(false);
  
  // สำคัญ: เก็บ profile ล่าสุดที่โหลดสำเร็จ เพื่อไม่ให้แสดง spinner ซ้ำเมื่อสลับแท็บ
  // เมื่อ TOKEN_REFRESHED เกิดขึ้น profile จะยังคงอยู่ แต่ isLoading อาจสั่นบ้าง
  const lastValidProfileRef = useRef(profile);
  
  // อัพเดท ref เมื่อได้ profile ใหม่
  useEffect(() => {
    if (profile) {
      lastValidProfileRef.current = profile;
    }
  }, [profile]);

  useEffect(() => {
    // If user exists but account is not active, force logout
    if (user && profile && !profile.is_active) {
      setIsSigningOut(true);
      signOut().finally(() => setIsSigningOut(false));
    }
  }, [user, profile, signOut]);

  // ใช้ profile ที่มีอยู่หรือ profile ล่าสุดที่โหลดได้
  const effectiveProfile = profile || lastValidProfileRef.current;
  
  // แสดง spinner เฉพาะเมื่อ:
  // 1. กำลัง sign out
  // 2. กำลังโหลดครั้งแรกจริง ๆ (ไม่เคยมี profile เลย)
  const showLoading = isSigningOut || (isLoading && !effectiveProfile && !lastValidProfileRef.current);

  if (showLoading) {
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
  if (!effectiveProfile) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  if (!effectiveProfile.is_active) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  if (allowedRoles && !allowedRoles.includes(effectiveProfile.role)) {
    return <Navigate to="/unauthorized" replace />;
  }

  return <>{children}</>;
}
