import { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { LoginForm } from '@/components/auth/LoginForm';
import { RegisterForm } from '@/components/auth/RegisterForm';
import { Shield, Lock, Server, Database, Loader2 } from 'lucide-react';
export default function Login() {
  const [isLogin, setIsLogin] = useState(true);
  const { user, profile, isLoading, signOut } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  // Get the redirect path from location state (set by ProtectedRoute)
  const from = (location.state as {
    from?: {
      pathname: string;
    };
  })?.from?.pathname || '/dashboard';
  const isActive = profile?.is_active === true;
  useEffect(() => {
    if (user && isActive) {
      // Redirect to the original requested page or dashboard
      navigate(from, {
        replace: true
      });
    }
  }, [user, isActive, navigate, from]);
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

  // Show loading during initial auth check
  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-center">
          <Loader2 className="h-8 w-8 animate-spin text-primary mx-auto mb-4" />
          <p className="text-muted-foreground">กำลังโหลด...</p>
        </div>
      </div>
    );
  }

  // If login succeeded but profile fetch is temporarily unavailable (503/PGRST002), show a recoverable screen.
  if (user && !profile) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-6">
        <div className="max-w-md w-full text-center space-y-4">
          <Loader2 className="h-8 w-8 animate-spin text-primary mx-auto" />
          <div className="space-y-1">
            <p className="font-medium text-foreground">กำลังเชื่อมต่อฐานข้อมูล…</p>
            <p className="text-sm text-muted-foreground">
              ถ้านานเกินไป ให้กด “ออกจากระบบ” แล้วลองเข้าสู่ระบบใหม่อีกครั้ง
            </p>
          </div>
          <div className="flex items-center justify-center gap-2">
            <button
              type="button"
              onClick={() => window.location.reload()}
              className="text-sm text-primary hover:underline"
            >
              รีเฟรชหน้า
            </button>
            <span className="text-muted-foreground">•</span>
            <button
              type="button"
              onClick={() => signOut()}
              className="text-sm text-primary hover:underline"
            >
              ออกจากระบบ
            </button>
          </div>
        </div>
      </div>
    );
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