import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { PublicLayout } from "@/components/layout/PublicLayout";
import { useSidebar } from "@/components/ui/sidebar";
import { Button } from "@/components/ui/button";
import { ArrowLeft } from "lucide-react";

function ArchitectureContent() {
  const { setOpen } = useSidebar();
  const navigate = useNavigate();
  useEffect(() => { setOpen(false); }, [setOpen]);

  return (
    <div className="w-full h-[calc(100vh-4rem)] flex flex-col">
      <div className="p-2 shrink-0">
        <Button variant="ghost" size="sm" onClick={() => navigate("/public/strategic-plan")} className="gap-1.5 text-muted-foreground hover:text-foreground">
          <ArrowLeft className="h-4 w-4" />
          กลับหน้าแผนยุทธศาสตร์
        </Button>
      </div>
      <iframe
        src="/r1dc-architecture.html"
        className="w-full flex-1 border-0"
        title="สถาปัตยกรรม R1- Datacenter"
      />
    </div>
  );
}

export default function PublicR1dcArchitecture() {
  return (
    <PublicLayout>
      <ArchitectureContent />
    </PublicLayout>
  );
}
