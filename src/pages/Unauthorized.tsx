import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { ShieldX, ArrowLeft } from 'lucide-react';

export default function Unauthorized() {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <div className="text-center max-w-md">
        <div className="mx-auto w-20 h-20 bg-destructive/10 rounded-full flex items-center justify-center mb-6">
          <ShieldX className="w-10 h-10 text-destructive" />
        </div>
        <h1 className="text-2xl font-bold mb-2">ไม่มีสิทธิ์เข้าถึง</h1>
        <p className="text-muted-foreground mb-6">
          คุณไม่มีสิทธิ์ในการเข้าถึงหน้านี้ กรุณาติดต่อผู้ดูแลระบบหากคิดว่านี่เป็นข้อผิดพลาด
        </p>
        <Button onClick={() => navigate('/dashboard')}>
          <ArrowLeft className="w-4 h-4 mr-2" />
          กลับหน้าหลัก
        </Button>
      </div>
    </div>
  );
}
