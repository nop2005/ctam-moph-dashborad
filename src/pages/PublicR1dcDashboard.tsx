import { PublicLayout } from "@/components/layout/PublicLayout";

const PublicR1dcDashboard = () => {
  return (
    <PublicLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-foreground">
            แดชบอร์ด R1-Datacenter
          </h1>
          <p className="text-muted-foreground mt-1">
            Dashboard เขตสุขภาพที่ 1 เชียงใหม่
          </p>
        </div>
        
        <div className="w-full bg-card rounded-lg border shadow-sm overflow-hidden" style={{ height: 'calc(100vh - 200px)' }}>
          <iframe
            src="/r1dc-dashboard.html"
            className="w-full h-full border-0"
            title="แดชบอร์ด R1-Datacenter"
          />
        </div>
      </div>
    </PublicLayout>
  );
};

export default PublicR1dcDashboard;
