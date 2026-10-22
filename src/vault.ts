import { useCallback, useEffect, useRef, useState } from 'react';
import { daysBetween, todayIso } from './dates';
import { splitBlocks } from './markdown';
import { isAccent, type Accent, type ThemePref } from './theme';
import type { VaultSnapshot } from '../electron/api';
import { dailyDateOf, dailyPath, DEFAULT_DAILY, formatProblem, isDailyDir, LEGACY_DAILY, normalizeFolder, type DailyLocation } from './dailyFormat';
import { dailyFileText, parseDailyFile, taskDay } from './dailyTasks';

export type Pri = 'h' | 'm' | 'l';

export const PRI: Record<Pri, { label: string; short: string; color: string; rank: number }> = {
  h: { label: 'High', short: 'High', color: 'var(--pri-h)', rank: 0 },
  m: { label: 'Medium', short: 'Med', color: 'var(--pri-m)', rank: 1 },
  l: { label: 'Low', short: 'Low', color: 'var(--pri-l)', rank: 2 },
};

/** A task from the daily task list. It lives on `day` and moves forward on rollover. */
export interface DailyTask {
  id: string;
  title: string;
  pri: Pri;
  createdOn: string;
  carried: number;
  day: string;
  done?: boolean;
  doneOn?: string;
  /** Minutes of pomodoro focus time spent on the task. */
  spent?: number;
}

/**
 * A regular note. `id` is the file path it had when loaded or created, and stays fixed for the
 * session even if the note is renamed; `path` is where it is written now.
 */
export interface Note {
  id: string;
  path: string;
  title: string;
  folder: string | null;
  blocks: string[];
}

export type TextSize = 'small' | 'medium' | 'large';
export type LineWidth = 'narrow' | 'default' | 'wide' | 'full';

/** Steps that keep the 13px interface text on whole pixels: 12, 13 and 15px. */
export const TEXT_ZOOM: Record<TextSize, number> = { small: 12 / 13, medium: 1, large: 15 / 13 };
/** Max width of a note's page, including its 56px side padding. */
export const LINE_WIDTH: Record<LineWidth, number | 'none'> = { narrow: 640, default: 720, wide: 900, full: 'none' };

export interface Prefs {
  theme: ThemePref;
  accent: Accent;
  /** Named `textScale` since the type scale changed; an older `textSize` value is dropped. */
  textScale: TextSize;
  lineWidth: LineWidth;
  /** Where daily notes live and how their files are named. */
  daily: DailyLocation;
  carry: boolean;
  /** What daily task rows show next to the title. */
  showPri: boolean;
  showAge: boolean;
  showCarried: boolean;
  /** Play a short chime when a task is checked off. */
  sound: boolean;
  live: boolean;
  spell: boolean;
  /** Show the pomodoro timer on today's tasks. */
  pomo: boolean;
  /** Pomodoro lengths, in minutes: focus, a short break, and the long break after every fourth focus. */
  pomoFocus: number;
  pomoBreak: number;
  pomoLong: number;
  /** Start the next pomodoro as soon as a break ends, instead of waiting for a click. */
  pomoAuto: boolean;
  /** Play a bell when a pomodoro or a break ends. */
  pomoSound: boolean;
  /** Key bindings, like `Ctrl+Shift+T`; an empty string turns one off. */
  keys: Record<ShortcutId, string>;
}

export type ShortcutId = 'today' | 'search' | 'newNote' | 'closeTab' | 'reopenTab' | 'sidebar';

export const SHORTCUTS: { id: ShortcutId; label: string; default: string }[] = [
  { id: 'today', label: 'Open today’s daily note', default: 'Ctrl+D' },
  { id: 'search', label: 'Search', default: 'Ctrl+K' },
  { id: 'newNote', label: 'New note', default: 'Ctrl+N' },
  { id: 'closeTab', label: 'Close tab', default: 'Ctrl+W' },
  { id: 'reopenTab', label: 'Reopen closed tab', default: 'Ctrl+Shift+T' },
  { id: 'sidebar', label: 'Show or hide the sidebar', default: 'Ctrl+\\' },
];

/** A custom sidebar icon: a name from the icon set and a colour name ('' for the default). */
export interface IconChoice { icon: string; color: string }

export interface Vault {
  version: 1;
  /** Absolute path of the vault folder on disk. */
  root: string;
  notes: Record<string, Note>;
  /** Folders for regular notes, relative to the vault, including empty ones. */
  folders: string[];
  /** Non-Markdown files in the vault (attachments), relative paths. Not saved; read from disk. */
  assets: string[];
  /** Daily note bodies (without their tasks section), keyed by ISO date. Every entry is a file on disk. */
  daily: Record<string, string[]>;
  /** Daily tasks of every day. Each is saved in the note of its `taskDay`. */
  tasks: DailyTask[];
  lastRollover: string;
  prefs: Prefs;
  /** Custom sidebar icons, keyed `f:<folder path>` or `n:<note path>`. */
  icons: Record<string, IconChoice>;
  /** Hand-arranged order of folders, as child names keyed by parent path ('' for the vault root). */
  order: Record<string, string[]>;
}

export const SIDEBAR_WIDTH = 256, SIDEBAR_MIN = 180, SIDEBAR_MAX = 560;

export type TabId = string; // 'daily:YYYY-MM-DD' | 'note:<id>' | 'settings'

export interface UiState {
  tabs: TabId[];
  active: TabId | null;
  sideTab: 'files' | 'daily';
  open: Record<string, boolean>;
  sidebarHidden: boolean;
  /** Sidebar width in px at the default text size; dragged by its right edge. */
  sidebarWidth: number;
}

/** What `.journal/state.json` holds: settings and UI state. Daily tasks live in the daily notes. */
interface StateFile {
  version: 1;
  /** Only in state files from before tasks moved into daily notes; read once, then dropped. */
  tasks?: DailyTask[];
  lastRollover: string;
  prefs: Prefs;
  icons?: Record<string, IconChoice>;
  order?: Record<string, string[]>;
  ui: UiState;
}

export const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 7);

const DEFAULT_PREFS: Prefs = { theme: 'system', accent: 'violet', textScale: 'medium', lineWidth: 'default', daily: DEFAULT_DAILY, carry: true,
  showPri: true, showAge: true, showCarried: true, sound: true, live: true, spell: false,
  pomo: true, pomoFocus: 25, pomoBreak: 5, pomoLong: 15, pomoAuto: true, pomoSound: true,
  keys: Object.fromEntries(SHORTCUTS.map(s => [s.id, s.default])) as Record<ShortcutId, string>,
};

const defaultUi = (today: string): UiState => ({
  tabs: [`daily:${today}`],
  active: `daily:${today}`,
  sideTab: 'files',
  open: { [`m:${today.slice(0, 7)}`]: true, 'f:Projects': true },
  sidebarHidden: false,
  sidebarWidth: SIDEBAR_WIDTH,
});

/* ---------- file paths ---------- */

export const dailyFile = (v: Vault, date: string) => dailyPath(v.prefs.daily, date);

/** Make a title safe as a file or folder name on both Linux and Windows. */
function fileName(title: string, fallback = 'Untitled'): string {
  let s = title.replace(/[\\/:*?"<>|\u0000-\u001f]/g, '-').trim().replace(/[. ]+$/, '').slice(0, 120);
  if (!s) s = fallback;
  if (/^(con|prn|aux|nul|com\d|lpt\d)$/i.test(s)) s += '_';
  return s;
}

/** Folders that hold daily notes or attachments are managed by the app, not listed as note folders. */
const isNoteFolder = (loc: DailyLocation, f: string) =>
  !isDailyDir(loc, f) && !LEGACY_DAILY_DIR.test(f) && !/(^|\/)attachments(\/|$)/i.test(f);
const LEGACY_DAILY_DIR = /^Journal\/\d{4}-\d{2}$/;

/** The path a new folder named `name` would get inside `parent`, or an error message. */
export function folderPath(v: Vault, parent: string | null, name: string): { path: string } | { error: string } {
  const base = fileName(name, '');
  if (!base) return { error: 'Enter a folder name' };
  const p = (parent ? parent + '/' : '') + base;
  if (!isNoteFolder(v.prefs.daily, p)) return { error: 'That name is reserved for daily notes' };
  if (v.folders.some(f => f.toLowerCase() === p.toLowerCase())) return { error: 'A folder with that name already exists' };
  return { path: p };
}

export function addFolder(v: Vault, path: string): Vault {
  return { ...v, folders: [...v.folders, path] };
}

/** Move daily notes to a new folder and file name format, unless that would clash with a note. */
export function setDailyLocation(v: Vault, folder: string, format: string): { vault: Vault } | { error: string } {
  const loc: DailyLocation = { folder: normalizeFolder(folder), format: format.trim() };
  const problem = formatProblem(loc.format);
  if (problem) return { error: problem };
  if (/[\\:*?"<>|]/.test(loc.folder)) return { error: 'The folder name contains characters not allowed in file names' };
  const notePaths = new Set(Object.values(v.notes).map(n => n.path.toLowerCase()));
  const clash = dailyFileDates(v).find(d => notePaths.has(dailyPath(loc, d).toLowerCase()));
  if (clash) return { error: `The daily note for ${clash} would replace the note ${dailyPath(loc, clash)}` };
  const folders = loc.folder && !v.folders.includes(loc.folder) ? [...v.folders, loc.folder] : v.folders;
  return { vault: { ...v, folders, prefs: { ...v.prefs, daily: loc } } };
}

/** A free path for a note with this title, ignoring the note `selfId` itself. */
export function notePath(v: Vault, folder: string | null, title: string, selfId: string | null = null): string {
  const taken = new Set(Object.values(v.notes).filter(n => n.id !== selfId).map(n => n.path.toLowerCase()));
  const base = (folder ? folder + '/' : '') + fileName(title);
  for (let n = 1; ; n++) {
    const p = `${base}${n === 1 ? '' : ' ' + n}.md`;
    if (!taken.has(p.toLowerCase())) return p;
  }
}

export function renameNote(v: Vault, id: string, title: string): Vault {
  const n = v.notes[id], path = notePath(v, n.folder, title, id);
  // The note's custom icon follows it to its new path.
  const icons = { ...v.icons };
  if (icons['n:' + n.path]) { icons['n:' + path] = icons['n:' + n.path]; if (path !== n.path) delete icons['n:' + n.path]; }
  return { ...v, icons, notes: { ...v.notes, [id]: { ...n, title, path } } };
}

const under = (p: string, dir: string) => p === dir || p.startsWith(dir + '/');

/** The vault without a folder and everything in it. */
export function removeFolder(v: Vault, dir: string): Vault {
  const notes = Object.fromEntries(Object.entries(v.notes).filter(([, n]) => !under(n.path, dir)));
  const icons = Object.fromEntries(Object.entries(v.icons).filter(([k]) => !under(k.slice(2), dir)));
  return { ...v, notes, icons, folders: v.folders.filter(f => !under(f, dir)), assets: v.assets.filter(a => !under(a, dir)) };
}

/** The vault without a daily note: its text and the tasks saved in it. */
export function removeDaily(v: Vault, date: string): Vault {
  const daily = { ...v.daily };
  delete daily[date];
  return { ...v, daily, tasks: v.tasks.filter(t => taskDay(t) !== date) };
}

/** Move folder `name` among its siblings in `parent`, to just before `before` (or to the end). */
export function moveFolder(v: Vault, parent: string, siblings: string[], name: string, before: string | null): Vault {
  const rest = siblings.filter(s => s !== name);
  const at = before === null ? rest.length : rest.indexOf(before);
  rest.splice(at < 0 ? rest.length : at, 0, name);
  return { ...v, order: { ...v.order, [parent]: rest } };
}

function seedNotes(today: string): Note[] {
  const mk = (folder: string | null, title: string, blocks: string[]): Note => {
    const path = (folder ? folder + '/' : '') + title + '.md';
    return { id: path, path, title, folder, blocks };
  };
  return [
    mk(null, 'Welcome to Journal', splitBlocks([
      'Journal is a Markdown journal with a **daily note** and a task list that carries itself forward.',
      '',
      '## How it works',
      '- Open **Today** and add tasks. Anything left unchecked moves to tomorrow on its own',
      '- Add `!high` or `!low` at the end of a `- [ ]` line to mark its priority',
      '- Link notes with double brackets, like [[Example project]] or [[' + today + ']]',
      '',
      '## Keyboard',
      '| Key | On a focused task |',
      '|---|---|',
      '| Space or x | complete |',
      '| 1 / 2 / 3 | set priority |',
      '| p | priority menu |',
      '| Delete | remove |',
      '',
      '```ts',
      '// click any line to edit its raw Markdown',
      'const note = await vault.open("Welcome to Journal");',
      '```',
      '',
      '> Every note is a plain Markdown file in your vault folder, so any editor can open it.',
    ].join('\n'))),
    mk('Projects', 'Example project', ['A project note, with its own checklist.', '', '## Next', '- [ ] Sketch the first milestone !high', '- [ ] Write a short README', '- [ ] Clean up old branches !low']),
  ];
}

/* ---------- loading and saving ---------- */

export interface Loaded {
  vault: Vault;
  ui: UiState;
  /** File contents as they are on disk right now, used to write only what changed. */
  files: Record<string, string>;
  /** Folders that exist on disk right now. */
  dirs: string[];
}

export function fromSnapshot(snap: VaultSnapshot, today: string): Loaded {
  const state = (snap.state ?? null) as Partial<StateFile> | null;
  // A vault opened for the first time follows its Obsidian daily notes settings, if it has them.
  const obsidian = !state && snap.obsidianDaily
    ? { folder: normalizeFolder(snap.obsidianDaily.folder ?? ''), format: snap.obsidianDaily.format?.trim() || 'YYYY-MM-DD' }
    : null;
  const saved: Partial<Prefs> & { textSize?: unknown; meta?: unknown } = { ...state?.prefs };
  delete saved.textSize;
  // One switch for age and carry-over count became separate ones.
  if (saved.meta === false) { saved.showAge ??= false; saved.showCarried ??= false; }
  delete saved.meta;
  saved.keys = { ...DEFAULT_PREFS.keys, ...saved.keys };
  // Values from earlier versions: the Blue accent and the Default text size.
  if (!isAccent(saved.accent)) delete saved.accent;
  if ((saved.textScale as string) === 'default') saved.textScale = 'medium';
  const prefs: Prefs = { ...DEFAULT_PREFS, ...saved, ...(obsidian && !formatProblem(obsidian.format) ? { daily: obsidian } : {}) };
  const notes: Record<string, Note> = {}, daily: Record<string, string[]> = {}, tasks: DailyTask[] = [];
  for (const [path, content] of Object.entries(snap.files)) {
    // Files in the old Journal/YYYY-MM/YYYY-MM-DD.md layout are daily notes too; saving moves them.
    const date = dailyDateOf(prefs.daily, path) ?? path.match(LEGACY_DAILY)?.[1];
    if (date && !daily[date]) {
      const parsed = parseDailyFile(content, date);
      daily[date] = parsed.body;
      tasks.push(...parsed.tasks);
      continue;
    }
    const slash = path.lastIndexOf('/');
    notes[path] = { id: path, path, title: path.slice(slash + 1, -3), folder: slash < 0 ? null : path.slice(0, slash), blocks: splitBlocks(content) };
  }
  const fresh = !state && !Object.keys(snap.files).length;
  if (fresh) for (const n of seedNotes(today)) notes[n.id] = n;
  const folders = new Set(snap.dirs.filter(f => isNoteFolder(prefs.daily, f)));
  for (const n of Object.values(notes)) if (n.folder) folders.add(n.folder);
  if (prefs.daily.folder) folders.add(prefs.daily.folder);

  const vault: Vault = {
    version: 1, root: snap.root, notes, folders: [...folders], assets: snap.assets, daily,
    // Tasks from an older state file get written into their daily notes on the first save.
    tasks: tasks.concat(state?.tasks ?? []),
    lastRollover: state?.lastRollover ?? today,
    prefs,
    icons: state?.icons ?? {},
    order: state?.order ?? {},
  };
  const ui = { ...defaultUi(today), ...state?.ui };
  return { vault: startDay(vault, today), ui: onNewDay(ui, vault.lastRollover, today), files: snap.files, dirs: snap.dirs };
}

/** Days that have a daily note file: a body, or tasks to keep in it. */
function dailyFileDates(v: Vault): string[] {
  return [...new Set([...Object.keys(v.daily), ...v.tasks.map(taskDay)])];
}

function filesOf(v: Vault): Record<string, string> {
  const out: Record<string, string> = {};
  for (const n of Object.values(v.notes)) out[n.path] = n.blocks.join('\n');
  const byDay = new Map<string, DailyTask[]>();
  for (const t of v.tasks) { const d = taskDay(t); byDay.set(d, [...(byDay.get(d) ?? []), t]); }
  for (const date of dailyFileDates(v)) out[dailyPath(v.prefs.daily, date)] = dailyFileText(byDay.get(date) ?? [], v.daily[date] ?? ['']);
  return out;
}

/** Note ids are only stable within a session, so the state file refers to notes by path. */
function stateOf(v: Vault, ui: UiState): string {
  const pathOf = (id: string) => v.notes[id]?.path ?? id;
  const tab = (t: TabId) => (t.startsWith('note:') ? 'note:' + pathOf(t.slice(5)) : t);
  const file: StateFile = {
    version: 1, lastRollover: v.lastRollover, prefs: v.prefs, icons: v.icons, order: v.order,
    ui: { ...ui, tabs: ui.tabs.map(tab), active: ui.active && tab(ui.active) },
  };
  return JSON.stringify(file, null, 2);
}

/** A new day: create its daily note, and carry unfinished tasks into it. */
function startDay(v: Vault, today: string): Vault {
  const withNote = v.daily[today] ? v : { ...v, daily: { ...v.daily, [today]: [''] } };
  return rollover(withNote, today);
}

/**
 * On a new day, today's daily note becomes the active tab. A tab still showing the previous
 * day's note turns into today's, so day tabs don't pile up.
 */
export function onNewDay(ui: UiState, lastDay: string, today: string): UiState {
  if (lastDay >= today) return ui;
  const tab = 'daily:' + today, prev = 'daily:' + lastDay;
  let tabs = ui.tabs.includes(tab) ? ui.tabs : ui.tabs.includes(prev) ? ui.tabs.map(t => (t === prev ? tab : t)) : [...ui.tabs, tab];
  tabs = tabs.filter((t, i) => tabs.indexOf(t) === i);
  return { ...ui, tabs, active: tab };
}

/** Move unfinished daily tasks into today, once per new day. */
export function rollover(v: Vault, today: string): Vault {
  if (v.lastRollover >= today) return v;
  const tasks = v.prefs.carry
    ? v.tasks.map(t => (!t.done && t.day < today ? { ...t, day: today, carried: t.carried + 1 } : t))
    : v.tasks;
  return { ...v, tasks, lastRollover: today };
}

export function useVault(initial: Loaded) {
  const [today, setToday] = useState(todayIso);
  const [vault, setVault] = useState(initial.vault);
  const [ui, setUi] = useState(initial.ui);
  const [saveError, setSaveError] = useState<string | null>(null);

  // Detect midnight while the app is open.
  useEffect(() => {
    const id = setInterval(() => setToday(t => (todayIso() !== t ? todayIso() : t)), 30_000);
    return () => clearInterval(id);
  }, []);
  const dayShown = useRef(today);
  useEffect(() => {
    setVault(v => startDay(v, today));
    setUi(u => onNewDay(u, dayShown.current, today));
    dayShown.current = today;
  }, [today]);

  // Saving: the latest state is read from refs, and saves run one after another.
  const latest = useRef({ vault, ui });
  latest.current = { vault, ui };
  const onDisk = useRef(initial.files);
  const dirsOnDisk = useRef(new Set(initial.dirs));
  const lastState = useRef('');
  const queue = useRef(Promise.resolve());

  const save = useCallback(() => {
    queue.current = queue.current.then(async () => {
      const { vault: v, ui: u } = latest.current;
      const files = filesOf(v);
      const writes: Record<string, string> = {};
      for (const [p, text] of Object.entries(files)) if (onDisk.current[p] !== text) writes[p] = text;
      const deletes = Object.keys(onDisk.current).filter(p => !(p in files));
      const state = stateOf(v, u);
      try {
        for (const f of v.folders) if (!dirsOnDisk.current.has(f)) { await window.journal.mkdir(f); dirsOnDisk.current.add(f); }
        // Folders left empty by moved daily notes go too; folders the user made stay.
        const keep = new Set([...v.folders, v.prefs.daily.folder, '']);
        const prune = new Set<string>();
        for (const p of deletes) for (let d = p.slice(0, Math.max(0, p.lastIndexOf('/'))); d && !keep.has(d); d = d.slice(0, Math.max(0, d.lastIndexOf('/')))) prune.add(d);
        if (deletes.length || Object.keys(writes).length) {
          await window.journal.sync({ deletes, writes, prune: [...prune].sort((a, b) => b.split('/').length - a.split('/').length) });
          onDisk.current = files;
        }
        if (state !== lastState.current) { await window.journal.writeState(state); lastState.current = state; }
        setSaveError(null);
      } catch (e) {
        setSaveError(e instanceof Error ? e.message : String(e));
      }
    });
    return queue.current;
  }, []);

  useEffect(() => {
    const t = setTimeout(save, 300);
    return () => clearTimeout(t);
  }, [vault, ui, save]);
  // Before the window closes: last changes that aren't in state yet, like a running timer's time.
  const beforeClose = useRef<((v: Vault) => Vault) | null>(null);
  useEffect(() => {
    window.journal.onFlush(() => {
      if (beforeClose.current) latest.current = { ...latest.current, vault: beforeClose.current(latest.current.vault) };
      return save();
    });
  }, [save]);

  const update = useCallback((fn: (v: Vault) => Vault) => setVault(fn), []);

  /** Move a file or folder to the OS trash, then drop it from the vault with `fn`. */
  const trash = useCallback(async (rel: string, fn: (v: Vault) => Vault) => {
    await queue.current;
    await window.journal.trash(rel);
    const gone = (p: string) => p === rel || p.startsWith(rel + '/');
    onDisk.current = Object.fromEntries(Object.entries(onDisk.current).filter(([p]) => !gone(p)));
    for (const d of [...dirsOnDisk.current]) if (gone(d)) dirsOnDisk.current.delete(d);
    setVault(fn);
  }, []);
  return { today, vault, update, ui, setUi, saveError, save, trash, beforeClose };
}

/* ---------- priority marks ---------- */

const PRI_MARK = /\s+!(high|med|medium|low)\s*$/i;

export function splitPriMark(text: string): { text: string; pri: Pri | null } {
  const m = text.match(PRI_MARK);
  if (!m) return { text, pri: null };
  const k = m[1].toLowerCase();
  return { text: text.slice(0, m.index), pri: k === 'high' ? 'h' : k === 'low' ? 'l' : 'm' };
}

export function setNoteTaskPri(src: string, pri: Pri): string {
  const mark = pri === 'h' ? ' !high' : pri === 'l' ? ' !low' : '';
  return src.replace(PRI_MARK, '').replace(/\s+$/, '') + mark;
}

/* ---------- daily tasks ---------- */

export interface TaskItem {
  id: string;
  title: string;
  pri: Pri;
  age: number;
  carried: number;
  done: boolean;
  createdOn: string;
  /** Minutes of pomodoro focus time; 0 when none. */
  spent: number;
}

export function dailyTaskItems(v: Vault, today: string): TaskItem[] {
  return v.tasks.map(t => ({
    id: t.id, title: t.title, pri: t.pri, age: Math.max(0, daysBetween(t.createdOn, today)), carried: t.carried,
    done: !!t.done, createdOn: t.createdOn, spent: t.spent ?? 0,
  }));
}

/** Adds focus time, in ms, to a task's time spent; it is kept in whole minutes. */
export const addSpent = (v: Vault, id: string, ms: number): Vault => {
  const min = Math.round(ms / 60_000);
  return min ? { ...v, tasks: v.tasks.map(t => (t.id === id ? { ...t, spent: (t.spent ?? 0) + min } : t)) } : v;
};

/** 85 → `1h 25m`. */
export const formatSpent = (min: number) => min < 60 ? `${min}m` : `${Math.floor(min / 60)}h` + (min % 60 ? ` ${min % 60}m` : '');

/** 0 = fresh, 1 = aging (5+ days or 3+ carries), 2 = long-running (10+ days or 6+ carries). */
export const toneOf = (t: { done: boolean; age: number; carried: number | null }) =>
  t.done ? 0 : (t.age >= 10 || (t.carried ?? 0) >= 6) ? 2 : (t.age >= 5 || (t.carried ?? 0) >= 3) ? 1 : 0;

export const sorter = (mode: 'priority' | 'age' | 'carried') => (a: TaskItem, b: TaskItem) => {
  const pr = PRI[a.pri].rank - PRI[b.pri].rank, ag = b.age - a.age, cr = (b.carried ?? 0) - (a.carried ?? 0);
  if (mode === 'age') return ag || pr;
  if (mode === 'carried') return cr || ag || pr;
  return pr || ag;
};

/** Dates that have a daily note: a file, completed or still-open tasks, or today. */
export function dailyDates(v: Vault, today: string): string[] {
  const s = new Set<string>([today, ...Object.keys(v.daily)]);
  for (const t of v.tasks) s.add(t.done && t.doneOn ? t.doneOn : t.day);
  return [...s].filter(d => d <= today).sort().reverse();
}
