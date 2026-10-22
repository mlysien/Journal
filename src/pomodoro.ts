import { useEffect, useRef, useState } from 'react';
import { playTimer } from './sound';
import type { Prefs } from './vault';

/**
 * A pomodoro timer for one task: focus, then a break (a long one after every fourth focus), then
 * the next focus, which starts on its own or, with pomoAuto off, waits paused at full length for a
 * click. Kept in memory only.
 */
export interface Pomodoro {
  taskId: string;
  /** The task's title when the timer started, for notifications. */
  title: string;
  phase: 'focus' | 'break';
  /** Length of this phase, in ms. */
  total: number;
  /** When this phase ends; null while paused. */
  endsAt: number | null;
  /** Time left while paused, in ms. */
  left: number;
  /** Focus sessions finished on this task in a row. */
  done: number;
}

export interface Timer {
  pomo: Pomodoro | null;
  /** Time left in the current phase, in ms. */
  left: number;
  start: (taskId: string, title: string) => void;
  /** Pauses or resumes. */
  toggle: () => void;
  stop: () => void;
}

const MIN = 60_000;

/** 1500000 → `25:00`. */
export const clock = (ms: number) => { const s = Math.ceil(ms / 1000); return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`; };

export function usePomodoro(prefs: Prefs): Timer {
  const [pomo, setPomo] = useState<Pomodoro | null>(null);
  const [now, setNow] = useState(Date.now);
  const latest = useRef(prefs);
  latest.current = prefs;
  const left = !pomo ? 0 : pomo.endsAt === null ? pomo.left : Math.max(0, pomo.endsAt - now);

  // Ticks twice a second, so the countdown never skips a digit.
  useEffect(() => {
    if (!pomo?.endsAt) return;
    const id = setInterval(() => setNow(Date.now()), 500);
    return () => clearInterval(id);
  }, [pomo?.endsAt]);

  // Turning the timer off in Settings stops it.
  useEffect(() => { if (!prefs.pomo) setPomo(null); }, [prefs.pomo]);

  // A phase ran out: focus moves on to a break, a break to the next focus.
  useEffect(() => {
    if (!pomo?.endsAt || now < pomo.endsAt) return;
    const p = latest.current, t = Date.now();
    if (p.pomoSound) playTimer();
    if (pomo.phase === 'focus') {
      const done = pomo.done + 1, long = done % 4 === 0, total = (long ? p.pomoLong : p.pomoBreak) * MIN;
      window.journal.notify('Pomodoro done', `${pomo.title}\nTime for a ${total / MIN}-minute ${long ? 'long ' : ''}break.`);
      setPomo({ ...pomo, phase: 'break', done, total, endsAt: t + total, left: total });
    } else {
      const total = p.pomoFocus * MIN;
      if (p.pomoAuto) window.journal.notify('Break over', `Next pomodoro started: ${pomo.title}`);
      else window.journal.notify('Break over', `Ready for the next pomodoro? ${pomo.title}`);
      setPomo({ ...pomo, phase: 'focus', total, endsAt: p.pomoAuto ? t + total : null, left: total });
    }
  }, [now, pomo]);

  // Progress in the Windows taskbar button.
  const fraction = pomo ? Math.min(1, 1 - left / pomo.total) : -1;
  const shown = Math.round(fraction * 200);
  useEffect(() => { window.journal.setProgress(shown < 0 ? -1 : shown / 200); }, [shown]);

  return {
    pomo, left,
    start: (taskId, title) => {
      const total = latest.current.pomoFocus * MIN, t = Date.now();
      setNow(t);
      setPomo(p => ({ taskId, title, phase: 'focus', total, endsAt: t + total, left: total, done: p?.taskId === taskId ? p.done : 0 }));
    },
    toggle: () => {
      const t = Date.now();
      setNow(t);
      setPomo(p => !p ? p : p.endsAt === null ? { ...p, endsAt: t + p.left } : { ...p, endsAt: null, left: Math.max(0, p.endsAt - t) });
    },
    stop: () => setPomo(null),
  };
}
