import { useState, type CSSProperties } from 'react';
import { PRI, sorter, type Pri, type TaskItem, type Vault } from '../vault';
import { ALL_GRID, AllTaskRow, usePriMenu, type TaskActions } from './Tasks';

const chip = (on: boolean): CSSProperties => ({ display: 'flex', alignItems: 'center', gap: 5, fontFamily: 'inherit', fontSize: 12.5, padding: '3px 8px', borderRadius: 6, border: 'none', background: on ? 'var(--active)' : 'transparent', color: on ? 'var(--text)' : 'var(--muted)', cursor: 'pointer' });

interface Props {
  vault: Vault;
  open: TaskItem[];
  actions: TaskActions;
  openToday: () => void;
  openNote: (id: string) => void;
}

export function TasksPage({ vault, open, actions, openToday, openNote }: Props) {
  const [menu, setMenu] = usePriMenu();
  const [group, setGroup] = useState<'source' | 'priority'>('source');
  const [filter, setFilter] = useState<'all' | Pri>('all');
  const [sort, setSort] = useState<'priority' | 'age' | 'carried'>('priority');

  const noteTitle = (id: string) => vault.notes[id]?.title || 'Untitled';
  const srcKey = (t: TaskItem) => (t.source.kind === 'daily' ? 'daily' : t.source.noteId);
  const rows = open.filter(t => filter === 'all' || t.pri === filter).sort(sorter(sort));

  let groups: { key: string; label: string; rows: TaskItem[]; onOpen?: () => void }[];
  if (group === 'source') {
    const keys = [...new Set(rows.map(srcKey))].sort((a, b) => (a === 'daily' ? -1 : b === 'daily' ? 1 : noteTitle(a).localeCompare(noteTitle(b))));
    groups = keys.map(k => ({
      key: k, label: k === 'daily' ? 'Daily · carried into today' : noteTitle(k),
      rows: rows.filter(t => srcKey(t) === k), onOpen: k === 'daily' ? openToday : () => openNote(k),
    }));
  } else {
    groups = (['h', 'm', 'l'] as const).map(k => ({ key: k, label: PRI[k].label + ' priority', rows: rows.filter(t => t.pri === k) })).filter(g => g.rows.length);
  }

  const srcCount = new Set(open.map(srcKey)).size;
  const summary = open.length
    ? `${open.length} open across ${srcCount} note${srcCount === 1 ? '' : 's'} · ${open.filter(t => t.pri === 'h').length} high priority`
    : 'Nothing open anywhere in the vault.';

  return (
    <div style={{ maxWidth: 880, margin: '0 auto', padding: '40px 56px 120px' }}>
      <div style={{ fontSize: 12.5, color: 'var(--faint)', height: 28, display: 'flex', alignItems: 'center', gap: 6 }}><span>Views</span><span style={{ opacity: 0.6 }}>/</span><span style={{ color: 'var(--text-2)' }}>All open tasks</span></div>
      <h1 style={{ margin: '22px 0 6px', fontSize: 34, fontWeight: 600, letterSpacing: '-0.025em', lineHeight: 1.2 }}>All open tasks</h1>
      <div style={{ fontSize: 14, color: 'var(--muted)' }}>{summary}</div>

      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap', margin: '34px 0 0', paddingBottom: 10, borderBottom: '1px solid var(--border)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 2 }}>
          <span style={{ fontSize: 12.5, color: 'var(--faint)', marginRight: 6 }}>Group by</span>
          {([['source', 'Note'], ['priority', 'Priority']] as const).map(([k, l]) => <button key={k} className="hov-text" onClick={() => setGroup(k)} style={chip(group === k)}>{l}</button>)}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 2 }}>
          {([['all', 'All'], ['h', 'High'], ['m', 'Med'], ['l', 'Low']] as const).map(([k, l]) => (
            <button key={k} className="hov-text" onClick={() => setFilter(k)} style={chip(filter === k)}>
              {l}<span style={{ color: 'var(--faint)', fontVariantNumeric: 'tabular-nums' }}>{k === 'all' ? open.length : open.filter(t => t.pri === k).length}</span>
            </button>
          ))}
          <span style={{ width: 1, height: 14, background: 'var(--border-strong)', margin: '0 8px' }} />
          {([['priority', 'Priority'], ['age', 'Age'], ['carried', 'Carried']] as const).map(([k, l]) => <button key={k} className="hov-text" onClick={() => setSort(k)} style={chip(sort === k)}>{l}</button>)}
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: ALL_GRID, gap: 16, padding: '12px 10px 0', fontSize: 11.5, color: 'var(--faint)', letterSpacing: '0.02em' }}>
        <span /><span>Task</span><span>Priority</span><span style={{ textAlign: 'right' }}>Age</span><span style={{ textAlign: 'right' }}>Carried</span>
      </div>

      {groups.map(g => (
        <div key={g.key}>
          <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', margin: '24px 0 4px', padding: '0 10px' }}>
            <div style={{ display: 'flex', gap: 10, alignItems: 'baseline' }}>
              <span style={{ fontSize: 13.5, fontWeight: 600, color: 'var(--text-2)' }}>{g.label}</span>
              <span style={{ fontSize: 12.5, color: 'var(--faint)' }}>{g.rows.length}</span>
            </div>
            {g.onOpen && <button onClick={g.onOpen} className="hov-accent" style={{ border: 'none', background: 'transparent', padding: 0, color: 'var(--faint)', font: 'inherit', fontSize: 12.5, cursor: 'pointer' }}>Open note</button>}
          </div>
          <div>
            {g.rows.map(t => (
              <AllTaskRow key={t.id} t={t} actions={actions} menu={menu} setMenu={setMenu}
                source={group === 'priority' ? (t.source.kind === 'daily' ? 'Daily note' : noteTitle(t.source.noteId)) : null} />
            ))}
          </div>
        </div>
      ))}

      {!rows.length && (
        <div style={{ padding: '48px 10px', display: 'flex', flexDirection: 'column', gap: 4 }}>
          <span style={{ fontSize: 15, color: 'var(--text-2)', fontWeight: 500 }}>Nothing open</span>
          <span style={{ fontSize: 13.5, color: 'var(--muted)' }}>{open.length ? 'No tasks match this filter.' : 'Every task in the vault is done.'}</span>
        </div>
      )}
    </div>
  );
}
