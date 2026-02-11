import { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { LoginForm } from '@/components/auth/LoginForm';
import { RegisterForm } from '@/components/auth/RegisterForm';
import { Shield, Lock, Server, Database, Loader2 } from 'lucide-react';
export default function Login() {
  const [isLogin, setIsLogin] = useState(true);
  const {
    user,
    profile,
    isLoading
  } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  // Get the redirect path from location state (set by ProtectedRoute)
  const requestedPath = (location.state as {
    from?: {
      pathname: string;
    };
  })?.from?.pathname;
  const isActive = profile?.is_active === true;

  // Paths that are restricted by role
  const restrictedPaths: Record<string, string[]> = {
    '/user-management': ['provincial', 'regional'],
    '/super-admin': ['central_admin', 'regional'],
    '/admin/system-dashboard': ['central_admin'],
    '/admin/hospitals': ['central_admin'],
    '/admin/settings': ['central_admin'],
    '/personnel-admin': ['provincial', 'regional'],
  };

  // Default landing page per role
  const getDefaultPage = (): string => {
    if (profile?.role === 'ceo') return '/reports';
    return '/dashboard';
  };

  // Determine safe redirect path based on user role
  const getSafeRedirectPath = (): string => {
    const defaultPage = getDefaultPage();
    if (!requestedPath || !profile?.role) return defaultPage;
    
    // CEO cannot access dashboard
    if (profile.role === 'ceo' && requestedPath === '/dashboard') {
      return '/reports';
    }
    
    // Check if the requested path is restricted
    for (const [path, allowedRoles] of Object.entries(restrictedPaths)) {
      if (requestedPath.startsWith(path) && !allowedRoles.includes(profile.role)) {
        return defaultPage;
      }
    }
    
    return requestedPath;
  };

  useEffect(() => {
    if (user && isActive && profile?.role) {
      // Redirect to the safe path based on user role
      const safePath = getSafeRedirectPath();
      navigate(safePath, {
        replace: true
      });
    }
  }, [user, isActive, profile?.role, navigate, requestedPath]);
  const features = [{
    icon: Shield,
    label: 'ประเมินตาม CTAM+ 17 หมวด'
  }, {
    icon: Lock,
    label: 'ระบบ Workflow 3 ระดับ'
  }, {
    icon: Server,
    label: 'Dashboard ภาพรวม'
  }, {
    icon: Database,
    label: 'รองรับการตรวจราชการ'
  }];

  // Show loading during initial auth check AND while profile is being fetched
  if (isLoading || user && !profile) {
    return <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-center">
          <Loader2 className="h-8 w-8 animate-spin text-primary mx-auto mb-4" />
          <p className="text-muted-foreground">กำลังโหลด...</p>
        </div>
      </div>;
  }
  return <div className="min-h-screen flex">
      {/* Left: Branding */}
      <div className="hidden lg:flex lg:w-1/2 bg-gradient-to-br from-primary via-primary/90 to-primary/80 text-primary-foreground p-12 flex-col justify-between relative overflow-hidden">
        {/* Background pattern */}
        <div className="absolute inset-0 cyber-grid opacity-10" />
        
        {/* Decorative shapes */}
        <div className="absolute -top-40 -right-40 w-80 h-80 bg-primary-foreground/10 rounded-full blur-3xl" />
        <div className="absolute -bottom-40 -left-40 w-80 h-80 bg-primary-foreground/10 rounded-full blur-3xl" />

        {/* Content */}
        <div className="relative z-10">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-12 h-12 bg-primary-foreground/20 rounded-xl flex items-center justify-center">
              <Shield className="w-7 h-7" />
            </div>
            <span className="text-2xl font-bold">CTAM+</span>
          </div>
          <p className="text-primary-foreground/80 text-sm">
            Cybersecurity Threat Assessment Maturity Plus
          </p>
        </div>

        <div className="relative z-10">
          <h1 className="text-4xl font-bold mb-4 leading-tight">
            ระบบประเมิน<br />
            ความปลอดภัยไซเบอร์<br />
            โรงพยาบาล
          </h1>
          <p className="text-primary-foreground/80 text-lg mb-8">สอดคล้องกับแนวทางตรวจราชการ สธ. ปีงบ 2569
และสูตรคะแนน 70 : 30 <br />
            และสูตรคะแนน 70 : 15 : 15
          </p>

          <div className="grid grid-cols-2 gap-4">
            {features.map((feature, index) => <div key={index} className="flex items-center gap-3 p-3 rounded-lg bg-primary-foreground/10 backdrop-blur-sm">
                <feature.icon className="w-5 h-5" />
                <span className="text-sm font-medium">{feature.label}</span>
              </div>)}
          </div>
        </div>

        <div className="relative z-10 text-sm text-primary-foreground/60">
          <p>พัฒนาโดย ศูนย์เทคโนโลยีสารสนเทศและการสื่อสาร</p>
          <p>สำนักงานปลัดกระทรวงสาธารณสุข (ศทส.สป.สธ.)</p>
        </div>
      </div>

      {/* Right: Auth Forms */}
      <div className="w-full lg:w-1/2 flex items-center justify-center p-8 bg-background">
        <div className="w-full max-w-md">
          {/* Mobile logo */}
          <div className="lg:hidden text-center mb-8">
            <div className="inline-flex items-center gap-3 mb-2">
              <div className="w-12 h-12 bg-primary/10 rounded-xl flex items-center justify-center">
                <Shield className="w-7 h-7 text-primary" />
              </div>
              <span className="text-2xl font-bold text-foreground">CTAM+</span>
            </div>
            <p className="text-muted-foreground text-sm">
              ระบบประเมินความปลอดภัยไซเบอร์โรงพยาบาล
            </p>
          </div>

          {isLogin ? <LoginForm onToggleMode={() => setIsLogin(false)} /> : <RegisterForm onToggleMode={() => setIsLogin(true)} />}
        </div>
      </div>
    </div>;
}