import { useEffect } from "react";
import { PublicLayout } from "@/components/layout/PublicLayout";
import { useSidebar } from "@/components/ui/sidebar";

function PricingContent() {
  const { setOpen } = useSidebar();
  useEffect(() => { setOpen(false); }, [setOpen]);

  return (
    <div className="w-full h-[calc(100vh-4rem)]">
      <iframe
        src="/r1dc-pricing.html"
        className="w-full h-full border-0"
        title="แผนงบประมาณ R1- Datacenter"
      />
    </div>
  );
}

export default function PublicR1dcPricing() {
  return (
    <PublicLayout>
      <PricingContent />
    </PublicLayout>
  );
}
