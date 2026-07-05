import { useCallback, useEffect, useRef, useState } from "react";

/**
 * Ambient synth pad generated fully in the browser via Web Audio API.
 * No external audio files, no network calls. Zero autoplay — user must opt in.
 *
 * Design: three detuned sine oscillators + slow LFO on filter cutoff +
 * long attack/release gain envelope for that "floating sci-fi hospital" pad,
 * plus a subtle high-freq shimmer that fades in/out on a slow LFO.
 */
export function useAmbientSound() {
  const [isPlaying, setIsPlaying] = useState(false);
  const ctxRef = useRef<AudioContext | null>(null);
  const nodesRef = useRef<{
    master: GainNode;
    stop: () => void;
  } | null>(null);

  const stop = useCallback(() => {
    const nodes = nodesRef.current;
    const ctx = ctxRef.current;
    if (!nodes || !ctx) {
      setIsPlaying(false);
      return;
    }
    const now = ctx.currentTime;
    // fade out
    nodes.master.gain.cancelScheduledValues(now);
    nodes.master.gain.setValueAtTime(nodes.master.gain.value, now);
    nodes.master.gain.linearRampToValueAtTime(0.0001, now + 1.2);
    window.setTimeout(() => {
      nodes.stop();
      nodesRef.current = null;
    }, 1300);
    setIsPlaying(false);
  }, []);

  const start = useCallback(async () => {
    if (nodesRef.current) return;
    const AC = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    const ctx = ctxRef.current ?? new AC();
    ctxRef.current = ctx;
    if (ctx.state === "suspended") await ctx.resume();

    const master = ctx.createGain();
    master.gain.value = 0.0001;
    master.connect(ctx.destination);

    // Low-pass filter for warmth
    const filter = ctx.createBiquadFilter();
    filter.type = "lowpass";
    filter.frequency.value = 900;
    filter.Q.value = 1.2;
    filter.connect(master);

    // Slow LFO modulating filter cutoff
    const lfo = ctx.createOscillator();
    lfo.frequency.value = 0.08; // very slow
    const lfoGain = ctx.createGain();
    lfoGain.gain.value = 400;
    lfo.connect(lfoGain).connect(filter.frequency);
    lfo.start();

    // Pad chord: A minor 9 (A2, C3, E3, G3, B3) — feels calm + sci-fi
    const chord = [110, 130.81, 164.81, 196.0, 246.94];
    const oscs: OscillatorNode[] = [];
    chord.forEach((freq, i) => {
      const osc1 = ctx.createOscillator();
      const osc2 = ctx.createOscillator();
      osc1.type = "sine";
      osc2.type = "triangle";
      osc1.frequency.value = freq;
      osc2.frequency.value = freq * 1.003; // slight detune for chorus feel
      const g = ctx.createGain();
      g.gain.value = 0.09 - i * 0.008;
      osc1.connect(g);
      osc2.connect(g);
      g.connect(filter);
      osc1.start();
      osc2.start();
      oscs.push(osc1, osc2);
    });

    // High shimmer — very quiet sine at 2637 Hz (E7) modulated by slow LFO
    const shimmer = ctx.createOscillator();
    shimmer.type = "sine";
    shimmer.frequency.value = 2637;
    const shimmerGain = ctx.createGain();
    shimmerGain.gain.value = 0.0;
    const shimmerLfo = ctx.createOscillator();
    shimmerLfo.frequency.value = 0.05;
    const shimmerLfoGain = ctx.createGain();
    shimmerLfoGain.gain.value = 0.012;
    shimmerLfo.connect(shimmerLfoGain).connect(shimmerGain.gain);
    shimmer.connect(shimmerGain).connect(master);
    shimmer.start();
    shimmerLfo.start();

    // Master fade-in
    const now = ctx.currentTime;
    master.gain.cancelScheduledValues(now);
    master.gain.setValueAtTime(0.0001, now);
    master.gain.exponentialRampToValueAtTime(0.35, now + 3.0);

    nodesRef.current = {
      master,
      stop: () => {
        try {
          oscs.forEach((o) => o.stop());
          lfo.stop();
          shimmer.stop();
          shimmerLfo.stop();
          filter.disconnect();
          master.disconnect();
        } catch {
          /* ignore */
        }
      },
    };
    setIsPlaying(true);
  }, []);

  const toggle = useCallback(() => {
    if (isPlaying) stop();
    else void start();
  }, [isPlaying, start, stop]);

  useEffect(() => {
    return () => {
      nodesRef.current?.stop();
      nodesRef.current = null;
      ctxRef.current?.close().catch(() => {});
    };
  }, []);

  return { isPlaying, toggle };
}
