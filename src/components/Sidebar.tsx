import { useEffect, useRef, useState, type CSSProperties, type DragEvent, type MouseEvent as ReactMouseEvent, type ReactNode } from 'react';
import { fmt, isoWeek, daysBetween } from '../dates';
import { FS, MONO } from '../theme';
import { wordsOf } from '../markdown';
import { SIDEBAR_MAX, SIDEBAR_MIN, SIDEBAR_WIDTH, type IconChoice, type Note, type TabId, type UiState, type Vault } from '../vault';
import {
  SearchIcon, CalendarIcon, ChevronRight, CollapseAllIcon, DayIcon, ExpandAllIcon, FileIcon, FolderIcon, FolderOpenIcon, FolderPlusIcon, GearIcon, JournalIcon, NotePlusIcon,
  ICON_COLORS, PaletteIcon, PICKABLE, PickedIcon, TrashIcon,
} from './icons';
import { addDays, dayLabel } from './Tasks';
import { formatDate } from '../dailyFormat';
import { keyLabel } from '../keys';

interface Props {
  vault: Vault;
  ui: UiState;
  setUi: (fn: (u: UiState) => UiState) => void;
  today: string;
  /** The text size zoom the sidebar is drawn at, to turn mouse movement into its width. */
  zoom: number;
  dates: string[];
  todayOpen: number;
  open: (id: TabId) => void;
  onSearch: () => void;
  onNewNote: (folder: string | null) => void;
  /** Returns an error message, or null once the folder exists. */
  onNewFolder: (parent: string | null, name: string) => string | null;
  /** Sets (or with null, resets) the icon of `f:<folder>` or `n:<note path>`. */
  onIcon: (key: string, choice: IconChoice | null) => void;
  onDelete: (target: DeleteTarget) => void;
  /** Moves folder `name` to just before `before` (null: the end) among `siblings` in `parent`. */
  onMoveFolder: (parent: string, siblings: string[], name: string, before: string | null) => void;
}

export type DeleteTarget = { kind: 'note'; id: string; label: string } | { kind: 'folder'; path: string; label: string } | { kind: 'daily'; date: string; label: string };

type Row =
  | { kind: 'header'; key: string; label: string }
  /** `parent` and `siblings` are set on folders that can be dragged into a new order. */
  | { kind: 'folder'; key: string; label: string; depth: number; count: number; path: string | null; journal?: boolean; parent?: string; siblings?: string[] }
  | { kind: 'note'; key: string; label: string; depth: number; meta: string; tab: TabId; day?: boolean; path?: string }
  | { kind: 'draft'; key: string; depth: number };

interface FolderNode { path: string; name: string; folders: FolderNode[]; notes: Note[] }
/** A folder made by the daily notes format (like `2026` or `2026/10`), with the days directly in it. */
interface DayDir { rel: string; dirs: Map<string, DayDir>; days: string[] }

const linkStyle = (act: boolean): CSSProperties => ({ display: 'flex', alignItems: 'center', gap: 10, height: 32, padding: '0 10px', borderRadius: 6, fontSize: FS.ui, color: act ? 'var(--text)' : 'var(--text-2)', background: act ? 'var(--active)' : 'transparent', cursor: 'default' });
const segStyle = (on: boolean): CSSProperties => ({ flex: 1, border: 'none', fontFamily: 'inherit', fontSize: FS.ui, padding: '4px 0', borderRadius: 5, cursor: 'pointer', background: on ? 'var(--bg)' : 'transparent', color: on ? 'var(--text)' : 'var(--muted)', boxShadow: on ? '0 0 0 1px var(--border)' : 'none' });
const rowStyle = (depth: number, folder: boolean, act: boolean): CSSProperties => ({ display: 'flex', alignItems: 'center', gap: 4, height: 30, paddingLeft: 10 + depth * 16 + (folder ? 0 : 16), paddingRight: 10, borderRadius: 6, fontSize: FS.ui, color: act ? 'var(--text)' : folder ? 'var(--text-2)' : 'var(--muted)', background: act ? 'var(--active)' : 'transparent', cursor: 'default', fontWeight: folder ? 500 : 400 });
const smallBtn: CSSProperties = { width: 26, height: 26, display: 'flex', alignItems: 'center', justifyContent: 'center', border: 'none', background: 'transparent', color: 'var(--faint)', borderRadius: 5, padding: 0, cursor: 'pointer', flex: 'none' };
/** Icon slot in a sidebar row; keeps labels aligned whatever the icon. */
const RowIcon = ({ children, act }: { children: ReactNode; act?: boolean }) => (
  <span style={{ display: 'flex', width: 16, flex: 'none', marginRight: 6, color: act ? 'var(--text)' : 'var(--muted)' }}>{children}</span>
);
const byTitle = (a: Note, b: Note) => (a.title || 'Untitled').localeCompare(b.title || 'Untitled');

function NavLink({ act, onClick, icon, label, meta, metaStyle }: { act: boolean; onClick: () => void; icon: ReactNode; label: string; meta: string; metaStyle?: CSSProperties }) {
  return (
    <div onClick={onClick} className="hov-bg" style={linkStyle(act)}>
      <span style={{ display: 'flex', color: act ? 'var(--text)' : 'var(--muted)' }}>{icon}</span><span style={{ flex: 1 }}>{label}</span><span style={{ fontSize: FS.sm, color: 'var(--faint)', ...metaStyle }}>{meta}</span>
    </div>
  );
}

function CreateButtons({ onNote, onFolder, className }: { onNote: () => void; onFolder: () => void; className?: string }) {
  return (
    <span className={className} style={{ display: 'flex', gap: 1 }}>
      <button title="New note" className="hov-text-active" style={smallBtn} onClick={e => { e.stopPropagation(); onNote(); }}><NotePlusIcon /></button>
      <button title="New folder" className="hov-text-active" style={smallBtn} onClick={e => { e.stopPropagation(); onFolder(); }}><FolderPlusIcon /></button>
    </span>
  );
}

/** Nested folders from every folder path plus the folders notes live in. */
function buildTree(vault: Vault): FolderNode {
  const daily = vault.prefs.daily.folder;
  const root: FolderNode = { path: '', name: '', folders: [], notes: [] };
  const nodes = new Map<string, FolderNode>([['', root]]);
  const get = (p: string): FolderNode => {
    let n = nodes.get(p);
    if (n) return n;
    const i = p.lastIndexOf('/');
    n = { path: p, name: p.slice(i + 1), folders: [], notes: [] };
    nodes.set(p, n);
    get(i < 0 ? '' : p.slice(0, i)).folders.push(n);
    return n;
  };
  vault.folders.forEach(get);
  Object.values(vault.notes).forEach(n => get(n.folder ?? '').notes.push(n));
  const sort = (n: FolderNode) => {
    // Folders the user dragged into place keep that order; new ones go after them, A to Z.
    const order = vault.order[n.path], rank = (f: FolderNode) => { const i = order?.indexOf(f.name) ?? -1; return i < 0 ? Infinity : i; };
    n.folders.sort((a, b) => rank(a) - rank(b) || (order ? 0 : a.path === daily ? -1 : b.path === daily ? 1 : 0) || a.name.localeCompare(b.name));
    n.notes.sort(byTitle);
    n.folders.forEach(sort);
  };
  sort(root);
  return root;
}

const countNotes = (n: FolderNode): number => n.notes.length + n.folders.reduce((a, f) => a + countNotes(f), 0);
const countDays = (d: DayDir): number => d.days.length + [...d.dirs.values()].reduce((a, c) => a + countDays(c), 0);

const menuStyle: CSSProperties = { position: 'absolute', zIndex: 40, minWidth: 180, background: 'var(--elev)', border: '1px solid var(--border-strong)', borderRadius: 8, padding: 4, boxShadow: '0 8px 24px rgba(0,0,0,0.22)', display: 'flex', flexDirection: 'column', gap: 1 };
const menuItem: CSSProperties = { display: 'flex', alignItems: 'center', gap: 10, width: '100%', border: 'none', background: 'transparent', fontFamily: 'inherit', fontSize: FS.ui, color: 'var(--text)', padding: '6px 8px', borderRadius: 5, cursor: 'pointer', textAlign: 'left' };

/** The row's icon: the one picked for it, or the default for its kind. */
function TreeIcon({ choice, fallback, open }: { choice?: IconChoice; fallback: ReactNode; open?: boolean }) {
  if (!choice) return <>{fallback}</>;
  const icon = choice.icon === 'folder' && open ? <FolderOpenIcon /> : <PickedIcon name={choice.icon} />;
  return <span style={{ display: 'flex', color: ICON_COLORS[choice.color] }}>{icon}</span>;
}

/** Grid of icons and a row of colours for a folder or note. */
function IconPicker({ current, fallback, onPick }: { current?: IconChoice; fallback: string; onPick: (c: IconChoice | null) => void }) {
  const icon = current?.icon ?? fallback, color = current?.color ?? '';
  const swatch = (c: string) => (
    <button key={c || 'default'} title={c ? c[0].toUpperCase() + c.slice(1) : 'Default'} onClick={() => onPick({ icon, color: c })}
      style={{ width: 20, height: 20, padding: 0, borderRadius: '50%', cursor: 'pointer', border: 'none', background: c ? ICON_COLORS[c] : 'var(--muted)', boxShadow: color === c ? '0 0 0 2px var(--elev), 0 0 0 3.5px var(--text-2)' : 'none' }} />
  );
  return (
    <div data-sidemenu="1" style={{ ...menuStyle, width: 236, padding: 10, gap: 10 }} onContextMenu={e => e.preventDefault()}>
      <div style={{ fontSize: FS.xs, color: 'var(--faint)' }}>Icon</div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 2 }}>
        {Object.keys(PICKABLE).map(name => (
          <button key={name} title={name} className="hov-active" onClick={() => onPick({ icon: name, color })}
            style={{ height: 28, display: 'flex', alignItems: 'center', justifyContent: 'center', border: 'none', borderRadius: 5, padding: 0, cursor: 'pointer', background: name === icon ? 'var(--active)' : 'transparent', color: color ? ICON_COLORS[color] : 'var(--text-2)' }}>
            <PickedIcon name={name} />
          </button>
        ))}
      </div>
      <div style={{ fontSize: FS.xs, color: 'var(--faint)' }}>Colour</div>
      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', padding: '0 2px' }}>{['', ...Object.keys(ICON_COLORS)].map(swatch)}</div>
      <button className="hov-active" onClick={() => onPick(null)} disabled={!current}
        style={{ ...menuItem, justifyContent: 'center', color: current ? 'var(--text-2)' : 'var(--faint)', cursor: current ? 'pointer' : 'default', border: '1px solid var(--border)' }}>Reset to default</button>
    </div>
  );
}

export function Sidebar({ vault, ui, setUi, today, zoom, dates, todayOpen, open, onSearch, onNewNote, onNewFolder, onIcon, onDelete, onMoveFolder }: Props) {
  const active = ui.active;
  const [draft, setDraft] = useState<{ parent: string | null; name: string; error: string | null } | null>(null);
  /** The right-click menu, or the icon picker opened from it, at a spot in the sidebar. */
  const [menu, setMenu] = useState<{ x: number; y: number; row: Row; picker?: boolean } | null>(null);
  /** A folder being dragged, and where it would land. */
  const [drag, setDrag] = useState<{ parent: string; name: string } | null>(null);
  const [dropHint, setDropHint] = useState<{ key: string; after: boolean } | null>(null);
  const aside = useRef<HTMLElement>(null);
  useEffect(() => {
    if (!menu) return;
    const onDown = (e: MouseEvent) => { if (!(e.target as HTMLElement).closest?.('[data-sidemenu]')) setMenu(null); };
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setMenu(null); };
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    return () => { document.removeEventListener('mousedown', onDown); document.removeEventListener('keydown', onKey); };
  }, [menu]);
  const loc = vault.prefs.daily;
  // Daily notes nest by the folders in their format (2026 › 10 › 16.10.2026); today's are open by default.
  const dailyRel = (d: string) => formatDate(d, loc.format).split('/');
  const todayDirs = new Set(dailyRel(today).slice(0, -1).map((_, i, a) => 'd:' + a.slice(0, i + 1).join('/')));
  const isOpen = (k: string) => ui.open[k] ?? (k === 'f:' + loc.folder || k === 'd:' || todayDirs.has(k));
  const setOpen = (k: string, v: boolean) => setUi(u => ({ ...u, open: { ...u.open, [k]: v } }));
  const rows: Row[] = [];
  /** Every folder row in the Files tab, open or not, for collapse/expand all. */
  const folderKeys: string[] = [];

  if (ui.sideTab === 'files') {
    const tree = buildTree(vault);
    const collect = (n: FolderNode) => n.folders.forEach(f => { folderKeys.push('f:' + f.path); collect(f); });
    collect(tree);
    if (!loc.folder) folderKeys.push('d:');
    for (const d of dates) dailyRel(d).slice(0, -1).forEach((_, i, a) => folderKeys.push('d:' + a.slice(0, i + 1).join('/')));

    // The folders the daily notes format makes, with each day in its folder. `dates` is newest first.
    const days: DayDir = { rel: '', dirs: new Map(), days: [] };
    for (const d of dates) {
      const segs = dailyRel(d);
      let n = days;
      for (const name of segs.slice(0, -1)) {
        let c = n.dirs.get(name);
        if (!c) { c = { rel: n.rel ? n.rel + '/' + name : name, dirs: new Map(), days: [] }; n.dirs.set(name, c); }
        n = c;
      }
      n.days.push(d);
    }

    /**
     * A daily notes folder. Folders on disk with the same path (holding other notes, or
     * subfolders the format doesn't make) are shown inside it, not as a second folder.
     */
    const dayDir = (dd: DayDir, disk: FolderNode | undefined, depth: number) => {
      for (const [name, c] of dd.dirs) {
        const key = 'd:' + c.rel, same = disk?.folders.find(f => f.name === name);
        rows.push({ kind: 'folder', key, label: name, depth, count: countDays(c) + (same ? countNotes(same) : 0), path: null });
        if (isOpen(key)) dayDir(c, same, depth + 1);
      }
      if (disk) {
        const other = disk.folders.filter(f => !dd.dirs.has(f.name)), names = other.map(f => f.name);
        for (const f of other) folderRow(f, depth, disk.path, names);
      }
      for (const d of dd.days) {
        const segs = dailyRel(d);
        rows.push({ kind: 'note', key: 'daily:' + d, label: segs[segs.length - 1], depth, meta: d === today ? 'today' : '', tab: 'daily:' + d, day: true });
      }
      disk?.notes.forEach(n => rows.push(noteRow(n, depth)));
    };
    const noteRow = (n: Note, depth: number): Row => ({ kind: 'note', key: n.id, label: n.title || 'Untitled', depth, meta: '', tab: 'note:' + n.id, path: n.path });
    const folderRow = (f: FolderNode, depth: number, parent: string, siblings: string[]) => {
      const key = 'f:' + f.path, journal = !!loc.folder && f.path === loc.folder;
      rows.push({ kind: 'folder', key, label: f.name, depth, count: countNotes(f) + (journal ? dates.length : 0), path: f.path, journal, parent, siblings });
      if (!isOpen(key)) return;
      if (journal) dayDir(days, f, depth + 1);
      else walk(f, depth + 1);
    };
    const walk = (node: FolderNode, depth: number) => {
      if (draft && (draft.parent ?? '') === node.path) rows.push({ kind: 'draft', key: 'draft', depth });
      // With the vault root as the daily folder, daily notes get their own section at the top,
      // and the year folders (and whatever else is in them) show only there.
      const rootDaily = node.path === '' && !loc.folder;
      if (rootDaily) {
        const inside: FolderNode = { ...node, folders: node.folders.filter(f => days.dirs.has(f.name)), notes: [] };
        rows.push({ kind: 'folder', key: 'd:', label: 'Daily notes', depth, count: dates.length + countNotes(inside), path: null, journal: true });
        if (isOpen('d:')) dayDir(days, inside, depth + 1);
      }
      const shown = rootDaily ? node.folders.filter(f => !days.dirs.has(f.name)) : node.folders, names = shown.map(f => f.name);
      for (const f of shown) folderRow(f, depth, node.path, names);
      node.notes.forEach(n => rows.push(noteRow(n, depth)));
    };
    walk(tree, 0);
  } else {
    const thisWeek = isoWeek(today), lastWeek = isoWeek(addDays(today, -7));
    const groupOf = (d: string) => {
      const age = daysBetween(d, today);
      if (age < 7 && isoWeek(d) === thisWeek) return 'This week';
      if (age < 14 && isoWeek(d) === lastWeek) return 'Last week';
      return fmt(d, d.slice(0, 4) === today.slice(0, 4) ? { month: 'long' } : { month: 'long', year: 'numeric' });
    };
    let last = '';
    dates.forEach(d => {
      const g = groupOf(d);
      if (g !== last) { rows.push({ kind: 'header', key: 'h-' + g, label: g }); last = g; }
      rows.push({ kind: 'note', key: 'daily:' + d, label: dayLabel(d), depth: -1, meta: d === today ? `${todayOpen} open` : `${wordsOf(vault.daily[d] || [])}w`, tab: 'daily:' + d, day: true });
    });
  }

  const startFolder = (parent: string | null) => {
    if (parent) setOpen('f:' + parent, true);
    setUi(u => ({ ...u, sideTab: 'files' }));
    setDraft({ parent, name: '', error: null });
  };
  const newNoteIn = (folder: string | null) => {
    if (folder) setOpen('f:' + folder, true);
    onNewNote(folder);
  };
  const anyOpen = folderKeys.some(isOpen);
  const iconKey = (r: Row) => r.kind === 'folder' && r.path !== null ? 'f:' + r.path : r.kind === 'note' && !r.day && r.path ? 'n:' + r.path : null;

  const openMenu = (e: ReactMouseEvent, row: Row) => {
    e.preventDefault();
    const box = aside.current!.getBoundingClientRect();
    // The sidebar is drawn at the text size zoom; mouse positions are in screen pixels.
    const x = (e.clientX - box.left) / zoom, y = (e.clientY - box.top) / zoom;
    setMenu({ x: Math.min(x, box.width / zoom - 190), y, row });
  };
  const menuItems = (r: Row): [ReactNode, string, () => void][] => {
    const items: [ReactNode, string, () => void][] = [];
    const key = iconKey(r);
    if (r.kind === 'folder' && r.path !== null && !r.journal) {
      const p = r.path;
      items.push([<NotePlusIcon />, 'New note', () => newNoteIn(p)], [<FolderPlusIcon />, 'New folder', () => startFolder(p)]);
    }
    if (key) items.push([<PaletteIcon />, 'Change icon…', () => setMenu(m => m && { ...m, picker: true })]);
    if (r.kind === 'folder' && r.path !== null && !r.journal) { const p = r.path; items.push([<TrashIcon />, 'Delete folder', () => onDelete({ kind: 'folder', path: p, label: r.label })]); }
    if (r.kind === 'note' && r.day) items.push([<TrashIcon />, 'Delete daily note', () => onDelete({ kind: 'daily', date: r.tab.slice(6), label: r.label })]);
    else if (r.kind === 'note') items.push([<TrashIcon />, 'Delete note', () => onDelete({ kind: 'note', id: r.tab.slice(5), label: r.label })]);
    return items;
  };

  /* Dragging folders into a new order, among the folders next to them. */
  const canDrop = (r: Row) => !!drag && r.kind === 'folder' && r.parent === drag.parent && !!r.siblings;
  const dragOver = (e: DragEvent, r: Row) => {
    if (!canDrop(r)) return;
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    const box = e.currentTarget.getBoundingClientRect(), after = e.clientY > box.top + box.height / 2;
    if (dropHint?.key !== r.key || dropHint.after !== after) setDropHint({ key: r.key, after });
  };
  const drop = (e: DragEvent, r: Row) => {
    if (!canDrop(r) || r.kind !== 'folder' || !drag) return;
    e.preventDefault();
    const sib = r.siblings!, after = dropHint?.key === r.key && dropHint.after;
    const before = after ? sib[sib.indexOf(r.label) + 1] ?? null : r.label;
    if (before !== drag.name) onMoveFolder(drag.parent, sib, drag.name, before);
    setDrag(null); setDropHint(null);
  };
  const setAllOpen = (v: boolean) => setUi(u => ({ ...u, open: { ...u.open, ...Object.fromEntries(folderKeys.map(k => [k, v])) } }));
  const commitDraft = () => {
    if (!draft) return;
    if (!draft.name.trim()) { setDraft(null); return; }
    const error = onNewFolder(draft.parent, draft.name);
    if (error) setDraft({ ...draft, error });
    else setDraft(null);
  };

  return (
    <aside ref={aside} style={{ width: ui.sidebarWidth, flex: 'none', position: 'relative', display: 'flex', flexDirection: 'column', background: 'var(--side)', borderRight: '1px solid var(--border)', minHeight: 0 }}>
      <div style={{ padding: '8px 8px 4px', display: 'flex', flexDirection: 'column', gap: 1 }}>
        <NavLink act={active === 'daily:' + today} onClick={() => open('daily:' + today)} icon={<CalendarIcon />} label="Today" meta={fmt(today, { month: 'short', day: 'numeric' })} />
        <NavLink act={false} onClick={onSearch} icon={<SearchIcon />} label="Search" meta={keyLabel(vault.prefs.keys.search, window.journal.platform)} />
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, margin: '10px 10px 6px 12px' }}>
        <div style={{ flex: 1, display: 'flex', gap: 2, padding: 2, background: 'var(--hover)', borderRadius: 7 }}>
          <button onClick={() => setUi(u => ({ ...u, sideTab: 'files' }))} style={segStyle(ui.sideTab === 'files')}>Files</button>
          <button onClick={() => setUi(u => ({ ...u, sideTab: 'daily' }))} style={segStyle(ui.sideTab === 'daily')}>Daily notes</button>
        </div>
        <span style={{ display: 'flex', gap: 1 }}>
          {ui.sideTab === 'files' && folderKeys.length > 0 && (
            <button title={anyOpen ? 'Collapse all' : 'Expand all'} className="hov-text-active" style={smallBtn} onClick={() => setAllOpen(!anyOpen)}>
              {anyOpen ? <CollapseAllIcon /> : <ExpandAllIcon />}
            </button>
          )}
          <CreateButtons onNote={() => newNoteIn(null)} onFolder={() => startFolder(null)} />
        </span>
      </div>
      <div style={{ flex: 1, overflowY: 'auto', padding: '4px 8px 12px' }}>
        {rows.map(r => {
          if (r.kind === 'header') return <div key={r.key} style={{ padding: '14px 10px 6px', fontSize: FS.sm, fontWeight: 500, color: 'var(--faint)', letterSpacing: '0.02em' }}>{r.label}</div>;
          if (r.kind === 'draft') return (
            <div key={r.key}>
              <div style={{ ...rowStyle(r.depth, true, false), paddingRight: 6 }}>
                <span style={{ display: 'flex', width: 16, justifyContent: 'center', color: 'var(--faint)' }}><ChevronRight /></span>
                <RowIcon><FolderIcon /></RowIcon>
                <input autoFocus value={draft!.name} placeholder="Folder name" spellCheck={false}
                  onChange={e => setDraft({ ...draft!, name: e.target.value, error: null })}
                  onKeyDown={e => { if (e.key === 'Enter') commitDraft(); else if (e.key === 'Escape') setDraft(null); }}
                  onBlur={commitDraft}
                  style={{ flex: 1, minWidth: 0, font: 'inherit', fontWeight: 500, color: 'var(--text)', background: 'var(--elev)', border: `1px solid ${draft!.error ? 'var(--pri-h)' : 'var(--accent-ring)'}`, borderRadius: 5, padding: '2px 6px', outline: 'none' }} />
              </div>
              {draft!.error && <div style={{ padding: `2px 10px 4px ${10 + r.depth * 16 + 42}px`, fontSize: FS.sm, color: 'var(--pri-h)' }}>{draft!.error}</div>}
            </div>
          );
          const key = iconKey(r), choice = key ? vault.icons[key] : undefined;
          const menuOpen = menu?.row.key === r.key;
          if (r.kind === 'folder') {
            const o = isOpen(r.key), path = r.path;
            const hint = dropHint?.key === r.key && drag ? (dropHint.after ? 'inset 0 -2px 0 var(--accent)' : 'inset 0 2px 0 var(--accent)') : undefined;
            return (
              <div key={r.key} onClick={() => setOpen(r.key, !o)} onContextMenu={e => { if (menuItems(r).length) openMenu(e, r); }} className="hov-bg side-row"
                draggable={!!r.siblings && r.siblings.length > 1}
                onDragStart={e => { if (!r.siblings || r.parent === undefined) return; e.dataTransfer.effectAllowed = 'move'; e.dataTransfer.setData('text/x-journal-folder', r.path ?? ''); setDrag({ parent: r.parent, name: r.label }); }}
                onDragEnd={() => { setDrag(null); setDropHint(null); }}
                onDragOver={e => dragOver(e, r)} onDrop={e => drop(e, r)}
                style={{ ...rowStyle(r.depth, true, false), paddingRight: path ? 4 : 10, boxShadow: hint, background: menuOpen ? 'var(--active)' : undefined, opacity: drag && drag.parent === r.parent && drag.name === r.label ? 0.5 : 1 }}>
                <span style={{ display: 'flex', width: 16, justifyContent: 'center', color: 'var(--faint)', transform: o ? 'rotate(90deg)' : 'none', transition: 'transform .12s' }}><ChevronRight /></span>
                <RowIcon><TreeIcon choice={choice} open={o} fallback={r.journal ? <JournalIcon /> : o ? <FolderOpenIcon /> : <FolderIcon />} /></RowIcon>
                <span title={r.label} style={{ flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{r.label}</span>
                {path && !r.journal && <CreateButtons className="side-actions" onNote={() => newNoteIn(path)} onFolder={() => startFolder(path)} />}
                <span className="side-meta" style={{ fontSize: FS.sm, color: 'var(--faint)', fontVariantNumeric: 'tabular-nums' }}>{o ? '' : r.count}</span>
              </div>
            );
          }
          const style = r.depth < 0 ? { ...rowStyle(0, false, r.tab === active), paddingLeft: 10 } : rowStyle(r.depth, false, r.tab === active);
          return (
            <div key={r.key} onClick={() => open(r.tab)} onContextMenu={e => openMenu(e, r)} className="hov-bg" style={{ ...style, background: menuOpen && r.tab !== active ? 'var(--active)' : style.background }}>
              <RowIcon act={r.tab === active}><TreeIcon choice={choice} fallback={r.day ? <DayIcon /> : <FileIcon />} /></RowIcon>
              <span title={r.label} style={{ flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{r.label}</span>
              <span style={{ fontSize: FS.sm, color: 'var(--faint)', fontVariantNumeric: 'tabular-nums' }}>{r.meta}</span>
            </div>
          );
        })}
      </div>
      {menu && !menu.picker && (
        <div data-sidemenu="1" role="menu" style={{ ...menuStyle, left: menu.x, top: Math.min(menu.y, (aside.current?.clientHeight ?? 600) - 34 * menuItems(menu.row).length - 12) }} onContextMenu={e => e.preventDefault()}>
          {menuItems(menu.row).map(([icon, label, fn]) => (
            <button key={label} role="menuitem" className="hov-active" onClick={() => { if (!label.startsWith('Change icon')) setMenu(null); fn(); }}
              style={{ ...menuItem, color: label.startsWith('Delete') ? 'var(--pri-h)' : 'var(--text)' }}>
              <span style={{ display: 'flex', width: 16, justifyContent: 'center', color: label.startsWith('Delete') ? 'var(--pri-h)' : 'var(--muted)' }}>{icon}</span>{label}
            </button>
          ))}
        </div>
      )}
      {menu?.picker && (() => {
        const key = iconKey(menu.row)!;
        const fallback = menu.row.kind === 'folder' ? (menu.row.journal ? 'journal' : 'folder') : 'file';
        return (
          <div style={{ position: 'absolute', left: Math.max(4, Math.min(menu.x, ui.sidebarWidth - 244)), top: Math.max(4, Math.min(menu.y, (aside.current?.clientHeight ?? 600) - 270)), zIndex: 40 }}>
            <IconPicker current={vault.icons[key]} fallback={fallback} onPick={c => onIcon(key, c)} />
          </div>
        );
      })()}
      <div className="side-resize" title="Drag to resize, double-click to reset"
        onDoubleClick={() => setUi(u => ({ ...u, sidebarWidth: SIDEBAR_WIDTH }))}
        onPointerDown={e => {
          e.preventDefault();
          // Listening on the window keeps the drag going when the pointer runs ahead of the edge.
          const el = e.currentTarget, x0 = e.clientX, w0 = ui.sidebarWidth;
          el.classList.add('dragging');
          document.body.style.cursor = 'col-resize';
          const move = (m: PointerEvent) => {
            const w = Math.round(Math.min(SIDEBAR_MAX, Math.max(SIDEBAR_MIN, w0 + (m.clientX - x0) / zoom)));
            setUi(u => (u.sidebarWidth === w ? u : { ...u, sidebarWidth: w }));
          };
          const up = () => {
            el.classList.remove('dragging');
            document.body.style.cursor = '';
            window.removeEventListener('pointermove', move);
            window.removeEventListener('pointerup', up);
            window.removeEventListener('pointercancel', up);
          };
          window.addEventListener('pointermove', move);
          window.addEventListener('pointerup', up);
          window.addEventListener('pointercancel', up);
        }} />
      <div style={{ borderTop: '1px solid var(--border)', padding: 8 }}>
        <NavLink act={active === 'settings'} onClick={() => open('settings')} icon={<GearIcon />} label="Settings" meta={vault.root.split(/[\\/]/).pop() ?? ''} metaStyle={{ fontFamily: MONO, fontSize: FS.xs }} />
      </div>
    </aside>
  );
}
