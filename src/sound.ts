/** A short two-note chime for a completed task, synthesized so the app ships no audio files. */
let ctx: AudioContext | null = null;

export function playDone() {
  try {
    ctx ??= new AudioContext();
    const t0 = ctx.currentTime + 0.01;
    const out = ctx.createGain();
    out.gain.value = 0.18;
    out.connect(ctx.destination);
    // A rising fifth (E6, then B6), each note a soft sine pluck.
    [[1318.5, 0], [1975.5, 0.07]].forEach(([freq, delay]) => {
      const osc = ctx!.createOscillator(), env = ctx!.createGain();
      osc.type = 'sine';
      osc.frequency.value = freq;
      env.gain.setValueAtTime(0, t0 + delay);
      env.gain.linearRampToValueAtTime(1, t0 + delay + 0.008);
      env.gain.exponentialRampToValueAtTime(0.001, t0 + delay + 0.35);
      osc.connect(env).connect(out);
      osc.start(t0 + delay);
      osc.stop(t0 + delay + 0.4);
    });
  } catch { /* no audio device */ }
}
