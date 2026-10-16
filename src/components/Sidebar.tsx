import { useState, type CSSProperties, type ReactNode } from 'react';
import { fmt, isoWeek, daysBetween } from '../dates';
import { MONO } from '../theme';
import { wordsOf } from '../markdown';
import type { Note, TabId, UiState, Vault } from '../vault';
import { SearchIcon, CalendarIcon, ChevronRight, CollapseAllIcon, DayIcon, ExpandAllIcon, FileIcon, FolderIcon, FolderOpenIcon, FolderPlusIcon, GearIcon, JournalIcon, NotePlusIcon } from './icons';
import { addDays, dayLabel } from './Tasks';
import { formatDate } from '../dailyFormat';

interface Props {
  vault: Vault;
  ui: UiState;
  setUi: (fn: (u: UiState) => UiState) => void;
  today: string;
  dates: string[];
  todayOpen: number;
  open: (id: TabId) => void;
  onSearch: () => void;
  onNewNote: (folder: string | null) => void;
  /** Returns an error message, or null once the folder exists. */
  onNewFolder: (parent: string | null, name: string) => string | null;
}

type Row =
  | { kind: 'header'; key: string; label: string }
  | { kind: 'folder'; key: string; label: string; depth: number; count: number; path: string | null; journal?: boolean }
  | { kind: 'note'; key: string; label: string; depth: number; meta: string; tab: TabId; day?: boolean }
  | { kind: 'draft'; key: string; depth: number };

interface FolderNode { path: string; name: string; folders: FolderNode[]; notes: Note[] }

const linkStyle = (act: boolean): CSSProperties => ({ display: 'flex', alignItems: 'center', gap: 10, height: 32, padding: '0 10px', borderRadius: 6, fontSize: 14.5, color: act ? 'var(--text)' : 'var(--text-2)', background: act ? 'var(--active)' : 'transparent', cursor: 'default' });
const segStyle = (on: boolean): CSSProperties => ({ flex: 1, border: 'none', fontFamily: 'inherit', fontSize: 13, padding: '4px 0', borderRadius: 5, cursor: 'pointer', background: on ? 'var(--bg)' : 'transparent', color: on ? 'var(--text)' : 'var(--muted)', boxShadow: on ? '0 0 0 1px var(--border)' : 'none' });
const rowStyle = (depth: number, folder: boolean, act: boolean): CSSProperties => ({ display: 'flex', alignItems: 'center', gap: 4, height: 30, paddingLeft: 10 + depth * 16 + (folder ? 0 : 16), paddingRight: 10, borderRadius: 6, fontSize: 14.5, color: act ? 'var(--text)' : folder ? 'var(--text-2)' : 'var(--muted)', background: act ? 'var(--active)' : 'transparent', cursor: 'default', fontWeight: folder ? 500 : 400 });
const smallBtn: CSSProperties = { width: 26, height: 26, display: 'flex', alignItems: 'center', justifyContent: 'center', border: 'none', background: 'transparent', color: 'var(--faint)', borderRadius: 5, padding: 0, cursor: 'pointer', flex: 'none' };
/** Icon slot in a sidebar row; keeps labels aligned whatever the icon. */
const RowIcon = ({ children, act }: { children: ReactNode; act?: boolean }) => (
  <span style={{ display: 'flex', width: 16, flex: 'none', marginRight: 6, color: act ? 'var(--text)' : 'var(--muted)' }}>{children}</span>
);
const byTitle = (a: Note, b: Note) => (a.title || 'Untitled').localeCompare(b.title || 'Untitled');

function NavLink({ act, onClick, icon, label, meta, metaStyle }: { act: boolean; onClick: () => void; icon: ReactNode; label: string; meta: string; metaStyle?: CSSProperties }) {
  return (
    <div onClick={onClick} className="hov-bg" style={linkStyle(act)}>
      <span style={{ display: 'flex', color: act ? 'var(--text)' : 'var(--muted)' }}>{icon}</span><span style={{ flex: 1 }}>{label}</span><span style={{ fontSize: 12.5, color: 'var(--faint)', ...metaStyle }}>{meta}</span>
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
    n.folders.sort((a, b) => (a.path === daily ? -1 : b.path === daily ? 1 : a.name.localeCompare(b.name)));
    n.notes.sort(byTitle);
    n.folders.forEach(sort);
  };
  sort(root);
  return root;
}

const countNotes = (n: FolderNode): number => n.notes.length + n.folders.reduce((a, f) => a + countNotes(f), 0);

export function Sidebar({ vault, ui, setUi, today, dates, todayOpen, open, onSearch, onNewNote, onNewFolder }: Props) {
  const active = ui.active;
  const [draft, setDraft] = useState<{ parent: string | null; name: string; error: string | null } | null>(null);
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

    /** The daily notes, nested by the folders their format creates. `dates` is newest first. */
    const dailyRows = (depth: number) => {
      const seen = new Set<string>();
      for (const d of dates) {
        const segs = dailyRel(d);
        let hidden = false;
        for (let i = 0; i < segs.length - 1 && !hidden; i++) {
          const key = 'd:' + segs.slice(0, i + 1).join('/');
          if (!seen.has(key)) {
            seen.add(key);
            const prefix = segs.slice(0, i + 1).join('/') + '/';
            rows.push({ kind: 'folder', key, label: segs[i], depth: depth + i, count: dates.filter(x => (dailyRel(x).join('/') + '/').startsWith(prefix)).length, path: null });
          }
          hidden = !isOpen(key);
        }
        if (!hidden) rows.push({ kind: 'note', key: 'daily:' + d, label: segs[segs.length - 1], depth: depth + segs.length - 1, meta: d === today ? 'today' : '', tab: 'daily:' + d, day: true });
      }
    };
    const walk = (node: FolderNode, depth: number) => {
      if (draft && (draft.parent ?? '') === node.path) rows.push({ kind: 'draft', key: 'draft', depth });
      // With the vault root as the daily folder, daily notes get their own section at the top.
      if (node.path === '' && !loc.folder) {
        rows.push({ kind: 'folder', key: 'd:', label: 'Daily notes', depth, count: dates.length, path: null, journal: true });
        if (isOpen('d:')) dailyRows(depth + 1);
      }
      for (const f of node.folders) {
        const key = 'f:' + f.path, journal = !!loc.folder && f.path === loc.folder;
        rows.push({ kind: 'folder', key, label: f.name, depth, count: countNotes(f) + (journal ? dates.length : 0), path: f.path, journal });
        if (!isOpen(key)) continue;
        if (journal) dailyRows(depth + 1);
        walk(f, depth + 1);
      }
      node.notes.forEach(n => rows.push({ kind: 'note', key: n.id, label: n.title || 'Untitled', depth, meta: '', tab: 'note:' + n.id }));
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
  const setAllOpen = (v: boolean) => setUi(u => ({ ...u, open: { ...u.open, ...Object.fromEntries(folderKeys.map(k => [k, v])) } }));
  const commitDraft = () => {
    if (!draft) return;
    if (!draft.name.trim()) { setDraft(null); return; }
    const error = onNewFolder(draft.parent, draft.name);
    if (error) setDraft({ ...draft, error });
    else setDraft(null);
  };

  return (
    <aside style={{ width: 256, flex: 'none', display: 'flex', flexDirection: 'column', background: 'var(--side)', borderRight: '1px solid var(--border)', minHeight: 0 }}>
      <div style={{ padding: '8px 8px 4px', display: 'flex', flexDirection: 'column', gap: 1 }}>
        <NavLink act={active === 'daily:' + today} onClick={() => open('daily:' + today)} icon={<CalendarIcon />} label="Today" meta={fmt(today, { month: 'short', day: 'numeric' })} />
        <NavLink act={false} onClick={onSearch} icon={<SearchIcon />} label="Search" meta={window.journal.platform === 'darwin' ? '⌘K' : 'Ctrl K'} />
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
          if (r.kind === 'header') return <div key={r.key} style={{ padding: '14px 10px 6px', fontSize: 12.5, fontWeight: 500, color: 'var(--faint)', letterSpacing: '0.02em' }}>{r.label}</div>;
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
              {draft!.error && <div style={{ padding: `2px 10px 4px ${10 + r.depth * 16 + 42}px`, fontSize: 12.5, color: 'var(--pri-h)' }}>{draft!.error}</div>}
            </div>
          );
          if (r.kind === 'folder') {
            const o = isOpen(r.key), path = r.path;
            return (
              <div key={r.key} onClick={() => setOpen(r.key, !o)} className="hov-bg side-row" style={{ ...rowStyle(r.depth, true, false), paddingRight: path ? 4 : 10 }}>
                <span style={{ display: 'flex', width: 16, justifyContent: 'center', color: 'var(--faint)', transform: o ? 'rotate(90deg)' : 'none', transition: 'transform .12s' }}><ChevronRight /></span>
                <RowIcon>{r.journal ? <JournalIcon /> : o ? <FolderOpenIcon /> : <FolderIcon />}</RowIcon>
                <span style={{ flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{r.label}</span>
                {path && !r.journal && <CreateButtons className="side-actions" onNote={() => newNoteIn(path)} onFolder={() => startFolder(path)} />}
                <span className="side-meta" style={{ fontSize: 12.5, color: 'var(--faint)', fontVariantNumeric: 'tabular-nums' }}>{o ? '' : r.count}</span>
              </div>
            );
          }
          const style = r.depth < 0 ? { ...rowStyle(0, false, r.tab === active), paddingLeft: 10 } : rowStyle(r.depth, false, r.tab === active);
          return (
            <div key={r.key} onClick={() => open(r.tab)} className="hov-bg" style={style}>
              <RowIcon act={r.tab === active}>{r.day ? <DayIcon /> : <FileIcon />}</RowIcon>
              <span style={{ flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{r.label}</span>
              <span style={{ fontSize: 12.5, color: 'var(--faint)', fontVariantNumeric: 'tabular-nums' }}>{r.meta}</span>
            </div>
          );
        })}
      </div>
      <div style={{ borderTop: '1px solid var(--border)', padding: 8 }}>
        <NavLink act={active === 'settings'} onClick={() => open('settings')} icon={<GearIcon />} label="Settings" meta={vault.root.split(/[\\/]/).pop() ?? ''} metaStyle={{ fontFamily: MONO, fontSize: 11 }} />
      </div>
    </aside>
  );
}
