import { useState } from "react";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { ChevronLeft, ChevronRight, X } from "lucide-react";
import slide1 from "@/assets/strategy-slide-1.jpg";
import slide2 from "@/assets/strategy-slide-2.jpg";
import slide3 from "@/assets/strategy-slide-3.jpg";

const slides = [
  { src: slide1, title: "Smart Operations: R1-Datacenter (R1DC)" },
  { src: slide2, title: "Proactive Digital Care" },
  { src: slide3, title: "Secure & Sustainable" },
];

interface StrategySlidesDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function StrategySlidesDialog({ open, onOpenChange }: StrategySlidesDialogProps) {
  const [current, setCurrent] = useState(0);

  const prev = () => setCurrent((c) => (c === 0 ? slides.length - 1 : c - 1));
  const next = () => setCurrent((c) => (c === slides.length - 1 ? 0 : c + 1));

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[95vw] w-[95vw] max-h-[95vh] p-0 overflow-hidden border-0 bg-black/95">
        {/* Close button */}
        <button
          onClick={() => onOpenChange(false)}
          className="absolute right-4 top-4 z-50 rounded-full bg-black/50 p-2 text-white hover:bg-black/70 transition-colors"
        >
          <X className="h-5 w-5" />
        </button>

        {/* Slide counter */}
        <div className="absolute top-4 left-1/2 -translate-x-1/2 z-50 text-white/80 text-sm font-medium bg-black/40 px-4 py-1.5 rounded-full">
          {current + 1} / {slides.length}
        </div>

        {/* Image */}
        <div className="flex items-center justify-center w-full h-[90vh] relative">
          <img
            src={slides[current].src}
            alt={slides[current].title}
            className="max-w-full max-h-full object-contain select-none"
            draggable={false}
          />

          {/* Nav buttons */}
          <Button
            variant="ghost"
            size="icon"
            onClick={prev}
            className="absolute left-4 top-1/2 -translate-y-1/2 h-12 w-12 rounded-full bg-black/40 text-white hover:bg-black/60 hover:text-white"
          >
            <ChevronLeft className="h-7 w-7" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            onClick={next}
            className="absolute right-4 top-1/2 -translate-y-1/2 h-12 w-12 rounded-full bg-black/40 text-white hover:bg-black/60 hover:text-white"
          >
            <ChevronRight className="h-7 w-7" />
          </Button>
        </div>

        {/* Title & dots */}
        <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex flex-col items-center gap-2">
          <p className="text-white/90 text-sm font-medium bg-black/40 px-4 py-1 rounded-full">
            {slides[current].title}
          </p>
          <div className="flex gap-2">
            {slides.map((_, i) => (
              <button
                key={i}
                onClick={() => setCurrent(i)}
                className={`w-2.5 h-2.5 rounded-full transition-all ${
                  i === current ? "bg-white scale-125" : "bg-white/40 hover:bg-white/60"
                }`}
              />
            ))}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
