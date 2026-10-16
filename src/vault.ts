import { useCallback, useEffect, useRef, useState } from 'react';
import { daysBetween, todayIso } from './dates';
import { parseBlock, splitBlocks } from './markdown';
import type { Accent, Theme } from './theme';
import type { VaultSnapshot } from '../electron/api';
import { dailyDateOf, dailyPath, DEFAULT_DAILY, formatProblem, isDailyDir, LEGACY_DAILY, normalizeFolder, type DailyLocation } from './dailyFormat';

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

export type TextSize = 'small' | 'default' | 'large';
export type LineWidth = 'narrow' | 'default' | 'wide' | 'full';

export const TEXT_ZOOM: Record<TextSize, number> = { small: 1, default: 1.1, large: 1.2 };
/** Max width of a note's page, including its 56px side padding. */
export const LINE_WIDTH: Record<LineWidth, number | 'none'> = { narrow: 640, default: 720, wide: 900, full: 'none' };

export interface Prefs {
  theme: Theme;
  accent: Accent;
  textSize: TextSize;
  lineWidth: LineWidth;
  /** Where daily notes live and how their files are named. */
  daily: DailyLocation;
  carry: boolean;
  meta: boolean;
  live: boolean;
  spell: boolean;
}

export interface Vault {
  version: 1;
  /** Absolute path of the vault folder on disk. */
  root: string;
  notes: Record<string, Note>;
  /** Folders for regular notes, relative to the vault, including empty ones. */
  folders: string[];
  /** Non-Markdown files in the vault (attachments), relative paths. Not saved; read from disk. */
  assets: string[];
  /** Daily note bodies, keyed by ISO date. Every entry is a file on disk. */
  daily: Record<string, string[]>;
  tasks: DailyTask[];
  /** First day each `- [ ]` line in a regular note was seen, for its age. */
  seen: Record<string, string>;
  lastRollover: string;
  prefs: Prefs;
}

export type TabId = string; // 'daily:YYYY-MM-DD' | 'note:<id>' | 'tasks' | 'settings'

export interface UiState {
  tabs: TabId[];
  active: TabId | null;
  sideTab: 'files' | 'daily';
  open: Record<string, boolean>;
  sidebarHidden: boolean;
}

/** What `.journal/state.json` holds: everything that is not a Markdown file. */
interface StateFile {
  version: 1;
  tasks: DailyTask[];
  seen: Record<string, string>;
  lastRollover: string;
  prefs: Prefs;
  ui: UiState;
}

export const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 7);

const DEFAULT_PREFS: Prefs = { theme: 'dark', accent: 'violet', textSize: 'default', lineWidth: 'default', daily: DEFAULT_DAILY, carry: true, meta: true, live: true, spell: false };

const defaultUi = (today: string): UiState => ({
  tabs: [`daily:${today}`, 'tasks'],
  active: `daily:${today}`,
  sideTab: 'files',
  open: { [`m:${today.slice(0, 7)}`]: true, 'f:Projects': true },
  sidebarHidden: false,
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
  const clash = Object.keys(v.daily).find(d => notePaths.has(dailyPath(loc, d).toLowerCase()));
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
  const n = v.notes[id];
  return { ...v, notes: { ...v.notes, [id]: { ...n, title, path: notePath(v, n.folder, title, id) } } };
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
      '- Tasks you write as `- [ ]` in any other note show up in **All open tasks**',
      '- Add `!high` or `!low` at the end of a note task to set its priority',
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
    mk('Projects', 'Example project', ['A project note. Its open tasks are collected in All open tasks.', '', '## Next', '- [ ] Sketch the first milestone !high', '- [ ] Write a short README', '- [ ] Clean up old branches !low']),
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
  const prefs: Prefs = { ...DEFAULT_PREFS, ...state?.prefs, ...(obsidian && !formatProblem(obsidian.format) ? { daily: obsidian } : {}) };
  const notes: Record<string, Note> = {}, daily: Record<string, string[]> = {};
  for (const [path, content] of Object.entries(snap.files)) {
    // Files in the old Journal/YYYY-MM/YYYY-MM-DD.md layout are daily notes too; saving moves them.
    const date = dailyDateOf(prefs.daily, path) ?? path.match(LEGACY_DAILY)?.[1];
    if (date && !daily[date]) { daily[date] = splitBlocks(content); continue; }
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
    tasks: state?.tasks ?? [], seen: state?.seen ?? {},
    lastRollover: state?.lastRollover ?? today,
    prefs,
  };
  return { vault: trackSeen(startDay(vault, today), today), ui: { ...defaultUi(today), ...state?.ui }, files: snap.files, dirs: snap.dirs };
}

function filesOf(v: Vault): Record<string, string> {
  const out: Record<string, string> = {};
  for (const n of Object.values(v.notes)) out[n.path] = n.blocks.join('\n');
  for (const [date, L] of Object.entries(v.daily)) out[dailyPath(v.prefs.daily, date)] = L.join('\n');
  return out;
}

/** Note ids are only stable within a session, so the state file refers to notes by path. */
function stateOf(v: Vault, ui: UiState): string {
  const pathOf = (id: string) => v.notes[id]?.path ?? id;
  const tab = (t: TabId) => (t.startsWith('note:') ? 'note:' + pathOf(t.slice(5)) : t);
  const seen: Record<string, string> = {};
  for (const [k, d] of Object.entries(v.seen)) { const i = k.indexOf('\u0000'); seen[pathOf(k.slice(0, i)) + k.slice(i)] = d; }
  const file: StateFile = {
    version: 1, tasks: v.tasks, seen, lastRollover: v.lastRollover, prefs: v.prefs,
    ui: { ...ui, tabs: ui.tabs.map(tab), active: ui.active && tab(ui.active) },
  };
  return JSON.stringify(file, null, 2);
}

/** A new day: create its daily note, and carry unfinished tasks into it. */
function startDay(v: Vault, today: string): Vault {
  const withNote = v.daily[today] ? v : { ...v, daily: { ...v.daily, [today]: [''] } };
  return rollover(withNote, today);
}

/** Move unfinished daily tasks into today, once per new day. */
export function rollover(v: Vault, today: string): Vault {
  if (v.lastRollover >= today) return v;
  const tasks = v.prefs.carry
    ? v.tasks.map(t => (!t.done && t.day < today ? { ...t, day: today, carried: t.carried + 1 } : t))
    : v.tasks;
  return { ...v, tasks, lastRollover: today };
}

/** Records the first-seen day of every note task, so note tasks have an age. */
function trackSeen(v: Vault, today: string): Vault {
  let seen: Record<string, string> | null = null;
  for (const t of noteTasks(v)) {
    if (!v.seen[t.key]) (seen ??= { ...v.seen })[t.key] = today;
  }
  return seen ? { ...v, seen } : v;
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
  useEffect(() => { setVault(v => startDay(v, today)); }, [today]);

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
  useEffect(() => { window.journal.onFlush(save); }, [save]);

  const update = useCallback((fn: (v: Vault) => Vault) => setVault(v => trackSeen(fn(v), todayIso())), []);
  return { today, vault, update, ui, setUi, saveError, save };
}

/* ---------- note tasks ---------- */

const PRI_MARK = /\s+!(high|med|medium|low)\s*$/i;

export function splitPriMark(text: string): { text: string; pri: Pri | null } {
  const m = text.match(PRI_MARK);
  if (!m) return { text, pri: null };
  const k = m[1].toLowerCase();
  return { text: text.slice(0, m.index), pri: k === 'high' ? 'h' : k === 'low' ? 'l' : 'm' };
}

export interface NoteTask {
  key: string;
  noteId: string;
  block: number;
  title: string;
  pri: Pri;
  done: boolean;
}

export function noteTasks(v: Vault): NoteTask[] {
  const out: NoteTask[] = [];
  for (const n of Object.values(v.notes)) {
    n.blocks.forEach((src, block) => {
      const b = parseBlock(src);
      if (b.type !== 'task' || !b.text.trim()) return;
      const { text, pri } = splitPriMark(b.text);
      out.push({ key: `${n.id}\u0000${text}`, noteId: n.id, block, title: text, pri: pri ?? 'm', done: b.checked });
    });
  }
  return out;
}

export function setNoteTaskPri(src: string, pri: Pri): string {
  const mark = pri === 'h' ? ' !high' : pri === 'l' ? ' !low' : '';
  return src.replace(PRI_MARK, '').replace(/\s+$/, '') + mark;
}

/** Replace a `- [ ]` line's text, keeping its indent, checkbox and priority marker. */
export function setNoteTaskTitle(src: string, title: string): string {
  const m = src.match(/^(\s*- \[[ xX]\]\s?)(.*)$/);
  if (!m) return src;
  const mark = m[2].match(PRI_MARK)?.[0] ?? '';
  return m[1] + title.trim() + mark;
}

export function toggleTaskLine(src: string): string {
  return /- \[[xX]\]/.test(src) ? src.replace(/- \[[xX]\]/, '- [ ]') : src.replace('- [ ]', '- [x]');
}

/* ---------- unified task view ---------- */

export interface TaskItem {
  id: string;
  title: string;
  pri: Pri;
  age: number;
  carried: number | null;
  done: boolean;
  createdOn: string;
  source: { kind: 'daily' } | { kind: 'note'; noteId: string; block: number };
}

export function allTaskItems(v: Vault, today: string): TaskItem[] {
  const daily: TaskItem[] = v.tasks.map(t => ({
    id: t.id, title: t.title, pri: t.pri, age: Math.max(0, daysBetween(t.createdOn, today)), carried: t.carried,
    done: !!t.done, createdOn: t.createdOn, source: { kind: 'daily' },
  }));
  const fromNotes: TaskItem[] = noteTasks(v).map(t => {
    const createdOn = v.seen[t.key] ?? today;
    return {
      id: 'n:' + t.key, title: t.title, pri: t.pri, age: Math.max(0, daysBetween(createdOn, today)), carried: null,
      done: t.done, createdOn, source: { kind: 'note', noteId: t.noteId, block: t.block },
    };
  });
  return daily.concat(fromNotes);
}

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
