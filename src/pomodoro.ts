import { useEffect, useRef, useState } from 'react';
import { playTimer } from './sound';
import type { Prefs } from './vault';

/**
 * A pomodoro timer for one task: focus, then a break (a long one after every fourth focus), then
 * the next focus, which starts on its own or, with pomoAuto off, waits paused at full length for a
 * click. Kept in memory only; the focus time it adds up is handed to `onWork` to save on the task.
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
  /** Focus time in the current pomodoro not yet handed to `onWork`, for saving when the app closes. */
  unsaved: () => { taskId: string; ms: number } | null;
}

const MIN = 60_000;

/** 1500000 → `25:00`. */
export const clock = (ms: number) => { const s = Math.ceil(ms / 1000); return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`; };

/** Focus time so far in a pomodoro, in ms; none during a break. */
const worked = (p: Pomodoro, t: number) => p.phase !== 'focus' ? 0 : p.total - (p.endsAt === null ? p.left : Math.max(0, p.endsAt - t));

/** `onWork` gets the focus time spent on a task each time a pomodoro ends, is stopped or is replaced. */
export function usePomodoro(prefs: Prefs, onWork: (taskId: string, ms: number) => void): Timer {
  const [pomo, setPomo] = useState<Pomodoro | null>(null);
  const [now, setNow] = useState(Date.now);
  const latest = useRef(prefs);
  latest.current = prefs;
  const current = useRef(pomo);
  current.current = pomo;
  const report = useRef(onWork);
  report.current = onWork;
  // The ref is updated right away, so focus time is never handed over twice before a render.
  const go = (next: Pomodoro | null) => { current.current = next; setPomo(next); };
  /** Hands over the focus time of the running pomodoro, then clears or replaces it. */
  const end = (next: Pomodoro | null) => {
    const p = current.current, ms = p ? worked(p, Date.now()) : 0;
    if (p && ms > 0) report.current(p.taskId, ms);
    go(next);
  };
  const left = !pomo ? 0 : pomo.endsAt === null ? pomo.left : Math.max(0, pomo.endsAt - now);

  // Ticks twice a second, so the countdown never skips a digit.
  useEffect(() => {
    if (!pomo?.endsAt) return;
    const id = setInterval(() => setNow(Date.now()), 500);
    return () => clearInterval(id);
  }, [pomo?.endsAt]);

  // Turning the timer off in Settings stops it.
  useEffect(() => { if (!prefs.pomo) end(null); }, [prefs.pomo]);

  // A phase ran out: focus moves on to a break, a break to the next focus.
  useEffect(() => {
    if (!pomo?.endsAt || now < pomo.endsAt) return;
    const p = latest.current, t = Date.now();
    if (p.pomoSound) playTimer();
    if (pomo.phase === 'focus') {
      report.current(pomo.taskId, pomo.total);
      const done = pomo.done + 1, long = done % 4 === 0, total = (long ? p.pomoLong : p.pomoBreak) * MIN;
      window.journal.notify('Pomodoro done', `${pomo.title}\nTime for a ${total / MIN}-minute ${long ? 'long ' : ''}break.`);
      go({ ...pomo, phase: 'break', done, total, endsAt: t + total, left: total });
    } else {
      const total = p.pomoFocus * MIN;
      if (p.pomoAuto) window.journal.notify('Break over', `Next pomodoro started: ${pomo.title}`);
      else window.journal.notify('Break over', `Ready for the next pomodoro? ${pomo.title}`);
      go({ ...pomo, phase: 'focus', total, endsAt: p.pomoAuto ? t + total : null, left: total });
    }
  }, [now, pomo]);

  // Progress in the Windows taskbar button.
  const fraction = pomo ? Math.min(1, 1 - left / pomo.total) : -1;
  const shown = Math.round(fraction * 200);
  useEffect(() => { window.journal.setProgress(shown < 0 ? -1 : shown / 200); }, [shown]);

  return {
    pomo, left,
    start: (taskId, title) => {
      const total = latest.current.pomoFocus * MIN, t = Date.now(), p = current.current;
      setNow(t);
      end({ taskId, title, phase: 'focus', total, endsAt: t + total, left: total, done: p?.taskId === taskId ? p.done : 0 });
    },
    toggle: () => {
      const t = Date.now();
      setNow(t);
      const p = current.current;
      if (p) go(p.endsAt === null ? { ...p, endsAt: t + p.left } : { ...p, endsAt: null, left: Math.max(0, p.endsAt - t) });
    },
    stop: () => end(null),
    unsaved: () => { const p = current.current, ms = p ? worked(p, Date.now()) : 0; return p && ms > 0 ? { taskId: p.taskId, ms } : null; },
  };
}
