import { useEffect, useState } from "react";
import { Volume2, VolumeX, Sparkles } from "lucide-react";
import { useAmbientSound } from "@/hooks/useAmbientSound";

export function AmbientSoundToggle() {
  const { isPlaying, toggle } = useAmbientSound();
  const [showHint, setShowHint] = useState(false);

  // Show a subtle hint on first visit
  useEffect(() => {
    const seen = sessionStorage.getItem("event_ambient_hinted");
    if (!seen) {
      const t = window.setTimeout(() => setShowHint(true), 1500);
      const h = window.setTimeout(() => {
        setShowHint(false);
        sessionStorage.setItem("event_ambient_hinted", "1");
      }, 7500);
      return () => {
        window.clearTimeout(t);
        window.clearTimeout(h);
      };
    }
  }, []);

  return (
    <div className="fixed bottom-6 right-6 z-50 flex items-center gap-3">
      {showHint && !isPlaying && (
        <div className="event-glass rounded-full px-4 py-2 text-xs text-cyan-100 border border-cyan-300/30 shadow-lg animate-fade-in flex items-center gap-1.5">
          <Sparkles className="h-3 w-3 text-cyan-300" />
          เปิดเสียงบรรยากาศ
        </div>
      )}
      <button
        type="button"
        onClick={() => {
          setShowHint(false);
          sessionStorage.setItem("event_ambient_hinted", "1");
          toggle();
        }}
        aria-label={isPlaying ? "ปิดเสียงบรรยากาศ" : "เปิดเสียงบรรยากาศ"}
        title={isPlaying ? "ปิดเสียงบรรยากาศ" : "เปิดเสียงบรรยากาศ"}
        className={`relative h-12 w-12 rounded-full flex items-center justify-center transition-all backdrop-blur-md border shadow-lg ${
          isPlaying
            ? "bg-gradient-to-br from-cyan-400 to-violet-500 border-cyan-300/60 text-slate-900 shadow-[0_0_25px_hsl(190_95%_55%/0.6)]"
            : "bg-slate-900/70 border-white/20 text-cyan-100 hover:border-cyan-300/60 hover:text-white"
        }`}
      >
        {isPlaying ? <Volume2 className="h-5 w-5" /> : <VolumeX className="h-5 w-5" />}
        {isPlaying && (
          <>
            <span className="absolute inset-0 rounded-full border-2 border-cyan-300/50 animate-ping" />
            <span className="absolute inset-0 rounded-full border border-cyan-200/40" />
          </>
        )}
      </button>
    </div>
  );
}
