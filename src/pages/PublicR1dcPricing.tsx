import { PublicLayout } from "@/components/layout/PublicLayout";

export default function PublicR1dcPricing() {
  return (
    <PublicLayout>
      <div className="w-full h-[calc(100vh-4rem)]">
        <iframe
          src="/r1dc-pricing.html"
          className="w-full h-full border-0"
          title="แผนงบประมาณ R1- Datacenter"
        />
      </div>
    </PublicLayout>
  );
}
