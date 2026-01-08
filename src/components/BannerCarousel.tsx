import { useState, useEffect, useCallback } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface BannerSlide {
  id: number;
  title: string;
  subtitle?: string;
  description?: string;
  link?: string;
  gradient: string;
}

const defaultBanners: BannerSlide[] = [
  {
    id: 1,
    title: "ระบบ CTAM+ ประเมินความมั่นคงปลอดภัยไซเบอร์",
    subtitle: "สำหรับหน่วยบริการสุขภาพ",
    description: "ศูนย์เฝ้าระวังความมั่นคงปลอดภัยไซเบอร์ ศทส.ป. กรมวิทยาศาสตร์การแพทย์ มุ่งมั่นยกระดับมาตรฐาน Cybersecurity เพื่อความปลอดภัยของข้อมูลสุขภาพประชาชน",
    gradient: "from-primary via-primary/90 to-accent",
  },
  {
    id: 2,
    title: "การประเมินตามมาตรฐาน CTAM",
    subtitle: "17 ข้อกำหนดด้านความปลอดภัย",
    description: "ประเมินครอบคลุมทุกมิติของการรักษาความมั่นคงปลอดภัยไซเบอร์ตามแนวทางกระทรวงสาธารณสุข",
    gradient: "from-accent via-primary to-primary/80",
  },
  {
    id: 3,
    title: "รายงานและสถิติ",
    subtitle: "แดชบอร์ดวิเคราะห์ข้อมูล",
    description: "ติดตามผลการประเมินรายเขตสุขภาพและรายจังหวัด พร้อมกราฟแสดงแนวโน้มการพัฒนา",
    gradient: "from-primary/80 via-accent to-primary",
  },
  {
    id: 4,
    title: "การตรวจราชการ",
    subtitle: "รายงานผู้นิเทศและผู้รับนิเทศ",
    description: "ระบบจัดการเอกสารตรวจราชการ รวบรวมรายงานจากทุกเขตสุขภาพ",
    gradient: "from-accent/90 via-primary/90 to-accent",
  },
];

interface BannerCarouselProps {
  banners?: BannerSlide[];
  autoPlay?: boolean;
  autoPlayInterval?: number;
  className?: string;
}

export function BannerCarousel({
  banners = defaultBanners,
  autoPlay = true,
  autoPlayInterval = 5000,
  className,
}: BannerCarouselProps) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isHovered, setIsHovered] = useState(false);

  const nextSlide = useCallback(() => {
    setCurrentIndex((prev) => (prev + 1) % banners.length);
  }, [banners.length]);

  const prevSlide = useCallback(() => {
    setCurrentIndex((prev) => (prev - 1 + banners.length) % banners.length);
  }, [banners.length]);

  const goToSlide = (index: number) => {
    setCurrentIndex(index);
  };

  useEffect(() => {
    if (!autoPlay || isHovered) return;

    const interval = setInterval(nextSlide, autoPlayInterval);
    return () => clearInterval(interval);
  }, [autoPlay, autoPlayInterval, isHovered, nextSlide]);

  const currentBanner = banners[currentIndex];

  const handleBannerClick = () => {
    if (currentBanner.link) {
      window.open(currentBanner.link, "_blank");
    }
  };

  return (
    <div
      className={cn(
        "relative w-full overflow-hidden rounded-2xl",
        className
      )}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      {/* Banner Content */}
      <div
        className={cn(
          "relative h-48 md:h-56 lg:h-64 bg-gradient-to-r p-6 md:p-8 lg:p-10 flex flex-col justify-center transition-all duration-500",
          currentBanner.gradient,
          currentBanner.link && "cursor-pointer"
        )}
        onClick={handleBannerClick}
      >
        {/* Decorative elements */}
        <div className="absolute inset-0 overflow-hidden">
          <div className="absolute -top-20 -right-20 w-64 h-64 bg-white/10 rounded-full blur-3xl" />
          <div className="absolute -bottom-20 -left-20 w-48 h-48 bg-white/5 rounded-full blur-2xl" />
          <div className="absolute top-1/2 right-1/4 w-32 h-32 bg-white/10 rounded-full blur-xl" />
        </div>

        {/* Content */}
        <div className="relative z-10 max-w-3xl mx-auto text-center text-white">
          <h2 className="text-xl md:text-2xl lg:text-3xl font-bold mb-2 drop-shadow-lg">
            {currentBanner.title}
          </h2>
          {currentBanner.subtitle && (
            <p className="text-lg md:text-xl font-semibold mb-3 text-white/90">
              {currentBanner.subtitle}
            </p>
          )}
          {currentBanner.description && (
            <p className="text-sm md:text-base text-white/80 line-clamp-2">
              {currentBanner.description}
            </p>
          )}
        </div>
      </div>

      {/* Navigation Arrows */}
      <Button
        variant="ghost"
        size="icon"
        className="absolute left-2 top-1/2 -translate-y-1/2 w-10 h-10 rounded-full bg-white/20 hover:bg-white/40 text-white border-0 backdrop-blur-sm transition-all"
        onClick={(e) => {
          e.stopPropagation();
          prevSlide();
        }}
      >
        <ChevronLeft className="h-6 w-6" />
      </Button>
      <Button
        variant="ghost"
        size="icon"
        className="absolute right-2 top-1/2 -translate-y-1/2 w-10 h-10 rounded-full bg-white/20 hover:bg-white/40 text-white border-0 backdrop-blur-sm transition-all"
        onClick={(e) => {
          e.stopPropagation();
          nextSlide();
        }}
      >
        <ChevronRight className="h-6 w-6" />
      </Button>

      {/* Dots Indicator */}
      <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex gap-2">
        {banners.map((_, index) => (
          <button
            key={index}
            onClick={(e) => {
              e.stopPropagation();
              goToSlide(index);
            }}
            className={cn(
              "w-2.5 h-2.5 rounded-full transition-all duration-300",
              index === currentIndex
                ? "bg-white w-6"
                : "bg-white/50 hover:bg-white/70"
            )}
          />
        ))}
      </div>
    </div>
  );
}
