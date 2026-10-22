/** Short chimes, synthesized so the app ships no audio files. */
let ctx: AudioContext | null = null;

/** A two-note chime for a completed task: a rising fifth, E6 then B6. */
export const playDone = () => chime([[1318.5, 0], [1975.5, 0.07]]);

/** A softer three-note bell for the end of a pomodoro or a break, lower and slower than playDone. */
export const playTimer = () => chime([[659.25, 0], [987.77, 0.18], [1318.5, 0.36]], 1.1);

/** Plays [frequency, delay] notes, each a soft sine pluck that rings for `ring` seconds. */
function chime(notes: number[][], ring = 0.35) {
  try {
    ctx ??= new AudioContext();
    const t0 = ctx.currentTime + 0.01;
    const out = ctx.createGain();
    out.gain.value = 0.18;
    out.connect(ctx.destination);
    notes.forEach(([freq, delay]) => {
      const osc = ctx!.createOscillator(), env = ctx!.createGain();
      osc.type = 'sine';
      osc.frequency.value = freq;
      env.gain.setValueAtTime(0, t0 + delay);
      env.gain.linearRampToValueAtTime(1, t0 + delay + 0.008);
      env.gain.exponentialRampToValueAtTime(0.001, t0 + delay + ring);
      osc.connect(env).connect(out);
      osc.start(t0 + delay);
      osc.stop(t0 + delay + ring + 0.05);
    });
  } catch { /* no audio device */ }
}
