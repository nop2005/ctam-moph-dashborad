import { useCallback, useEffect, useRef, useState } from "react";

/**
 * Uplifting digital soundscape — bright major key pad + pulsing arpeggio +
 * shimmer. All synthesized in-browser via Web Audio API. No autoplay.
 *
 * Feel: hopeful, futuristic, "digital sunrise". Key of D major.
 */
export function useAmbientSound() {
  const [isPlaying, setIsPlaying] = useState(false);
  const ctxRef = useRef<AudioContext | null>(null);
  const cleanupRef = useRef<(() => void) | null>(null);

  const stop = useCallback(() => {
    const ctx = ctxRef.current;
    const cleanup = cleanupRef.current;
    if (!ctx || !cleanup) {
      setIsPlaying(false);
      return;
    }
    cleanup();
    cleanupRef.current = null;
    setIsPlaying(false);
  }, []);

  const start = useCallback(async () => {
    if (cleanupRef.current) return;
    const AC = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    const ctx = ctxRef.current ?? new AC();
    ctxRef.current = ctx;
    if (ctx.state === "suspended") await ctx.resume();

    const now = ctx.currentTime;

    // ---------- Master chain ----------
    const master = ctx.createGain();
    master.gain.value = 0.0001;
    master.connect(ctx.destination);

    // Simple feedback delay for "digital space"
    const delay = ctx.createDelay(1.5);
    delay.delayTime.value = 0.375; // dotted-eighth vibe
    const delayFb = ctx.createGain();
    delayFb.gain.value = 0.35;
    const delayWet = ctx.createGain();
    delayWet.gain.value = 0.5;
    delay.connect(delayFb).connect(delay);
    delay.connect(delayWet).connect(master);

    // ---------- Pad (bright major chord: D, F#, A, C#, E) ----------
    const padFilter = ctx.createBiquadFilter();
    padFilter.type = "lowpass";
    padFilter.frequency.value = 1400;
    padFilter.Q.value = 0.9;
    padFilter.connect(master);
    padFilter.connect(delay);

    // Slow filter LFO for movement
    const filterLfo = ctx.createOscillator();
    filterLfo.frequency.value = 0.15;
    const filterLfoGain = ctx.createGain();
    filterLfoGain.gain.value = 700;
    filterLfo.connect(filterLfoGain).connect(padFilter.frequency);
    filterLfo.start();

    const chord = [146.83, 220.0, 277.18, 329.63, 415.3]; // D3, A3, C#4, E4, G#4-ish (Dmaj7add9)
    const padOscs: OscillatorNode[] = [];
    chord.forEach((freq, i) => {
      const o1 = ctx.createOscillator();
      const o2 = ctx.createOscillator();
      o1.type = "sawtooth";
      o2.type = "triangle";
      o1.frequency.value = freq;
      o2.frequency.value = freq * 1.005;
      const g = ctx.createGain();
      g.gain.value = 0.045 - i * 0.005;
      o1.connect(g);
      o2.connect(g);
      g.connect(padFilter);
      o1.start();
      o2.start();
      padOscs.push(o1, o2);
    });

    // ---------- Arpeggio (pluck synth) ----------
    // D major arpeggio: D, F#, A, D, F#, A, C#, A (rising, hopeful)
    const arpNotes = [293.66, 369.99, 440.0, 587.33, 739.99, 880.0, 1108.73, 880.0];
    const arpGain = ctx.createGain();
    arpGain.gain.value = 0.5;
    arpGain.connect(master);
    arpGain.connect(delay);

    let arpIdx = 0;
    const arpInterval = 0.28; // ~215 bpm sixteenths — energetic but not frantic
    const arpOscs: OscillatorNode[] = [];
    const arpTimer = window.setInterval(() => {
      if (!ctxRef.current) return;
      const t = ctxRef.current.currentTime;
      const freq = arpNotes[arpIdx % arpNotes.length];
      arpIdx++;
      const osc = ctx.createOscillator();
      osc.type = "triangle";
      osc.frequency.value = freq;
      const env = ctx.createGain();
      env.gain.value = 0;
      env.gain.setValueAtTime(0, t);
      env.gain.linearRampToValueAtTime(0.18, t + 0.005);
      env.gain.exponentialRampToValueAtTime(0.001, t + 0.4);
      osc.connect(env).connect(arpGain);
      osc.start(t);
      osc.stop(t + 0.45);
      arpOscs.push(osc);
      // trim
      if (arpOscs.length > 40) arpOscs.splice(0, 20);
    }, arpInterval * 1000);

    // ---------- Bright shimmer (5th + octave sparkle) ----------
    const shimmer1 = ctx.createOscillator();
    shimmer1.type = "sine";
    shimmer1.frequency.value = 2349; // D7
    const shimmer2 = ctx.createOscillator();
    shimmer2.type = "sine";
    shimmer2.frequency.value = 3520; // A7
    const shimmerGain = ctx.createGain();
    shimmerGain.gain.value = 0.0;
    const shimmerLfo = ctx.createOscillator();
    shimmerLfo.frequency.value = 0.12;
    const shimmerLfoGain = ctx.createGain();
    shimmerLfoGain.gain.value = 0.018;
    shimmerLfo.connect(shimmerLfoGain).connect(shimmerGain.gain);
    shimmer1.connect(shimmerGain);
    shimmer2.connect(shimmerGain);
    shimmerGain.connect(master);
    shimmer1.start();
    shimmer2.start();
    shimmerLfo.start();

    // ---------- Sub-bass pulse (heartbeat of hope) ----------
    const bass = ctx.createOscillator();
    bass.type = "sine";
    bass.frequency.value = 73.42; // D2
    const bassGain = ctx.createGain();
    bassGain.gain.value = 0;
    bass.connect(bassGain).connect(master);
    bass.start();
    // Slow pulse every ~2.24s (8 arp steps)
    const bassTimer = window.setInterval(() => {
      if (!ctxRef.current) return;
      const t = ctxRef.current.currentTime;
      bassGain.gain.cancelScheduledValues(t);
      bassGain.gain.setValueAtTime(0.0, t);
      bassGain.gain.linearRampToValueAtTime(0.14, t + 0.05);
      bassGain.gain.exponentialRampToValueAtTime(0.001, t + 1.8);
    }, arpInterval * 8 * 1000);

    // ---------- Master fade-in ----------
    master.gain.cancelScheduledValues(now);
    master.gain.setValueAtTime(0.0001, now);
    master.gain.exponentialRampToValueAtTime(0.4, now + 2.5);

    cleanupRef.current = () => {
      const ctxNow = ctxRef.current;
      if (!ctxNow) return;
      const t = ctxNow.currentTime;
      master.gain.cancelScheduledValues(t);
      master.gain.setValueAtTime(master.gain.value, t);
      master.gain.linearRampToValueAtTime(0.0001, t + 1.0);
      window.clearInterval(arpTimer);
      window.clearInterval(bassTimer);
      window.setTimeout(() => {
        try {
          padOscs.forEach((o) => o.stop());
          arpOscs.forEach((o) => { try { o.stop(); } catch { /* already stopped */ } });
          filterLfo.stop();
          shimmer1.stop();
          shimmer2.stop();
          shimmerLfo.stop();
          bass.stop();
          master.disconnect();
          delay.disconnect();
          delayFb.disconnect();
          delayWet.disconnect();
          padFilter.disconnect();
        } catch {
          /* ignore */
        }
      }, 1200);
    };
    setIsPlaying(true);
  }, []);

  const toggle = useCallback(() => {
    if (isPlaying) stop();
    else void start();
  }, [isPlaying, start, stop]);

  useEffect(() => {
    return () => {
      cleanupRef.current?.();
      cleanupRef.current = null;
      ctxRef.current?.close().catch(() => {});
    };
  }, []);

  return { isPlaying, toggle };
}
