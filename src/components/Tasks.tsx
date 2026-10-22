import { useEffect, useRef, useState, type CSSProperties, type KeyboardEvent } from 'react';
import { fmt, parseIso, iso } from '../dates';
import { FS, MONO } from '../theme';
import { PRI, toneOf, type Pri, type TaskItem } from '../vault';
import { Check, Close, Plus } from './icons';
import { InlineText } from './InlineText';
import { insideLinkSyntax, isUrl, pasteUrl } from '../links';

export interface TaskActions {
  toggle: (t: TaskItem) => void;
  setPri: (t: TaskItem, pri: Pri) => void;
  remove?: (t: TaskItem) => void;
  /** Opens a `[[wiki link]]` from a task title. */
  openLink?: (name: string) => void;
  /** Replaces a pasted link's placeholder label in task titles once the page title arrives. */
  relink?: (draft: string, final: string) => void;
  /** Changes a task's text. Without it, titles can't be edited. */
  rename?: (t: TaskItem, title: string) => void;
}

/** Which details task rows show next to their titles. */
export interface TaskShow { pri: boolean; age: boolean; carried: boolean }

/** Which task's priority menu is open; closes on any mousedown outside a menu. */
export function usePriMenu() {
  const [open, setOpen] = useState<string | null>(null);
  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => { if (!(e.target as HTMLElement).closest?.('[data-primenu]')) setOpen(null); };
    document.addEventListener('mousedown', onDown);
    return () => document.removeEventListener('mousedown', onDown);
  }, [open]);
  return [open, setOpen] as const;
}

function rowKey(e: KeyboardEvent<HTMLDivElement>, t: TaskItem, a: TaskActions, setMenu: (f: (m: string | null) => string | null) => void) {
  if (e.target !== e.currentTarget) return;
  if (e.key === ' ' || e.key === 'x') { e.preventDefault(); a.toggle(t); }
  else if (e.key === 'Enter' && a.rename) { e.preventDefault(); e.currentTarget.querySelector<HTMLElement>('[data-title]')?.click(); }
  else if (e.key === 'p') setMenu(m => (m === t.id ? null : t.id));
  else if (e.key === '1' || e.key === '2' || e.key === '3') { a.setPri(t, (['h', 'm', 'l'] as const)[+e.key - 1]); setMenu(() => null); }
  else if (e.key === 'Escape') setMenu(() => null);
  else if ((e.key === 'Backspace' || e.key === 'Delete') && a.remove) a.remove(t);
  else if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
    e.preventDefault();
    const scope = e.currentTarget.closest('[data-scroll]') || document;
    const rows = Array.from(scope.querySelectorAll<HTMLElement>('[data-row]'));
    rows[rows.indexOf(e.currentTarget) + (e.key === 'ArrowDown' ? 1 : -1)]?.focus();
  }
}

const dot = (pri: Pri, done = false): CSSProperties => ({ width: 7, height: 7, borderRadius: '50%', background: PRI[pri].color, opacity: done ? 0.45 : 1, flex: 'none' });

const boxStyle = (done: boolean, clickable = true): CSSProperties => ({
  width: 16, height: 16, boxSizing: 'border-box', borderRadius: 4.5,
  border: done ? '1.5px solid var(--accent-fill)' : '1.5px solid var(--border-strong)',
  background: done ? 'var(--accent-fill)' : 'transparent',
  display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 0, cursor: clickable ? 'pointer' : 'default', flex: 'none',
});

const titleStyle = (t: TaskItem): CSSProperties => ({
  flex: 1, minWidth: 0, fontSize: FS.lg, lineHeight: 1.5,
  color: t.done ? 'var(--faint)' : toneOf(t) === 2 ? 'var(--warm-text)' : 'var(--text)',
  textDecoration: t.done ? 'line-through' : 'none', textDecorationColor: 'var(--faint)',
  overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
});

/** A task's title; click it (or press Enter on the row) to edit the raw text. */
function TaskTitle({ t, actions, style }: { t: TaskItem; actions: TaskActions; style: CSSProperties }) {
  const [draft, setDraft] = useState<string | null>(null);
  // Set synchronously, so the blur that follows Enter or Esc doesn't save a second time.
  const finished = useRef(false);
  const editable = !!actions.rename;
  /** Leave edit mode once; Enter, Esc and blur all end up here. */
  const finish = (save: boolean, el: HTMLInputElement, refocusRow: boolean) => {
    if (draft === null || finished.current) return;
    finished.current = true;
    const title = draft.trim();
    setDraft(null);
    if (save && title && title !== t.title) actions.rename!(t, title);
    // Back to the row, so arrow keys and shortcuts keep working.
    if (refocusRow) (el.closest('[data-row]') as HTMLElement | null)?.focus();
  };
  if (draft !== null) return (
    <input autoFocus value={draft} spellCheck={false} aria-label="Task text"
      onChange={e => setDraft(e.target.value)}
      onKeyDown={e => {
        if (e.key === 'Enter') { e.preventDefault(); finish(true, e.currentTarget, true); }
        else if (e.key === 'Escape') { e.preventDefault(); finish(false, e.currentTarget, true); }
      }}
      onBlur={e => finish(true, e.currentTarget, false)}
      onPaste={e => {
        const el = e.currentTarget, text = e.clipboardData.getData('text/plain').trim();
        if (!isUrl(text) || insideLinkSyntax(el.value.slice(0, el.selectionStart ?? 0))) return;
        const relink = (from: string, to: string) => { setDraft(d => d?.replace(from, to) ?? d); actions.relink?.(from, to); };
        if (pasteUrl(el, text, relink)) e.preventDefault();
      }}
      style={{ flex: 1, minWidth: 0, font: 'inherit', fontSize: FS.lg, lineHeight: 1.5, color: 'var(--text)', background: 'var(--elev)', border: '1px solid var(--accent-ring)', borderRadius: 5, padding: '0 6px', margin: '-1px -7px', outline: 'none' }} />
  );
  return (
    <span data-title="1" style={{ ...style, cursor: editable ? 'text' : undefined }} title={editable ? 'Click to edit' : undefined}
      onClick={e => { if (!editable || (e.target as HTMLElement).closest('[data-link]')) return; e.stopPropagation(); finished.current = false; setDraft(t.title); }}>
      <InlineText text={t.title} onOpenLink={actions.openLink} />
    </span>
  );
}

const carryTitle = (n: number) => `Carried over ${n} time${n === 1 ? '' : 's'}`;
const createdTitle = (t: TaskItem) => `Created ${fmt(t.createdOn, { month: 'short', day: 'numeric' })}`;

function PriMenu({ t, onPick, style }: { t: TaskItem; onPick: (p: Pri) => void; style: CSSProperties }) {
  return (
    <div role="menu" style={{ position: 'absolute', zIndex: 30, minWidth: 150, background: 'var(--elev)', border: '1px solid var(--border-strong)', borderRadius: 8, padding: 4, boxShadow: '0 8px 24px rgba(0,0,0,0.18)', display: 'flex', flexDirection: 'column', gap: 1, ...style }}>
      <div style={{ padding: '6px 8px 4px', fontSize: FS.xs, color: 'var(--faint)' }}>Priority</div>
      {(['h', 'm', 'l'] as const).map((k, n) => (
        <button key={k} role="menuitem" className="hov-active" onClick={e => { e.stopPropagation(); onPick(k); }} style={{ display: 'flex', alignItems: 'center', gap: 10, width: '100%', border: 'none', background: 'transparent', fontFamily: 'inherit', fontSize: FS.ui, color: 'var(--text)', padding: '6px 8px', borderRadius: 5, cursor: 'pointer', textAlign: 'left' }}>
          <span style={dot(k)} />
          <span style={{ flex: 1 }}>{PRI[k].label}</span>
          <span style={{ fontFamily: MONO, fontSize: FS.xs, color: 'var(--faint)' }}>{n + 1}</span>
          <span style={{ width: 12, fontSize: FS.sm, color: 'var(--accent)', opacity: t.pri === k ? 1 : 0 }}>✓</span>
        </button>
      ))}
    </div>
  );
}

/* ---------- today ---------- */

interface ListProps {
  rows: TaskItem[];
  actions: TaskActions;
  show: TaskShow;
}

export function DailyTaskRow({ t, actions, show, menu, setMenu }: { t: TaskItem; actions: TaskActions; show: TaskShow; menu: string | null; setMenu: ReturnType<typeof usePriMenu>[1] }) {
  const tone = toneOf(t), carried = t.carried ?? 0, menuOpen = menu === t.id;
  return (
    <div data-row="1" tabIndex={0} className="task-row" onKeyDown={e => rowKey(e, t, actions, setMenu)}
      style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '7px 10px', margin: '0 -10px', borderRadius: 7, outline: 'none', cursor: 'default' }}>
      <button className="checkbox" onClick={e => { e.stopPropagation(); actions.toggle(t); }} title={t.done ? 'Mark as open' : 'Complete'} style={boxStyle(t.done)}>
        {t.done && <Check />}
      </button>
      <TaskTitle t={t} actions={actions} style={titleStyle(t)} />
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, fontSize: FS.sm, color: tone ? 'var(--warm)' : 'var(--faint)', fontVariantNumeric: 'tabular-nums', flex: 'none' }}>
        {show.carried && carried > 0 && <span title={carryTitle(carried)}>↻ {carried}</span>}
        {show.age && <span title={createdTitle(t)} style={{ minWidth: 50, textAlign: 'right' }}>{t.done ? 'done' : t.age === 0 ? 'today' : `${t.age}d old`}</span>}
        {show.pri && <span data-primenu="1" style={{ position: 'relative', display: 'flex' }}>
          <button className="hov-active" onClick={e => { e.stopPropagation(); setMenu(m => (m === t.id ? null : t.id)); }} title={`${PRI[t.pri].label} priority. Click to change`}
            style={{ width: 20, height: 20, display: 'flex', alignItems: 'center', justifyContent: 'center', border: 'none', background: menuOpen ? 'var(--active)' : 'transparent', padding: 0, borderRadius: 5, cursor: 'pointer' }}>
            <span style={dot(t.pri, t.done)} />
          </button>
          {menuOpen && <PriMenu t={t} style={{ right: -4, top: 26 }} onPick={p => { actions.setPri(t, p); setMenu(() => null); }} />}
        </span>}
        {actions.remove && (
          <button className="del-btn" onClick={e => { e.stopPropagation(); actions.remove!(t); }} title="Delete task"
            style={{ width: 20, height: 20, display: 'flex', alignItems: 'center', justifyContent: 'center', border: 'none', background: 'transparent', color: 'var(--faint)', padding: 0, borderRadius: 5, cursor: 'pointer' }}>
            <Close />
          </button>
        )}
      </div>
    </div>
  );
}

export function TodayTasks({ rows, actions, show, onAdd }: ListProps & { onAdd: (title: string, pri: Pri) => void }) {
  const [menu, setMenu] = usePriMenu();
  const [qa, setQa] = useState('');
  const [qaPri, setQaPri] = useState<Pri>('m');
  const [qaFocus, setQaFocus] = useState(false);
  const open = rows.filter(t => !t.done), done = rows.filter(t => t.done);
  const carriedN = open.filter(t => (t.carried ?? 0) > 0).length;
  const summary = `${open.length} open` + (carriedN ? ` · ${carriedN} carried over` : '') + (done.length ? ` · ${done.length} done` : '');
  const add = () => { const title = qa.trim(); if (!title) return; onAdd(title, qaPri); setQa(''); };
  const qaActive = qaFocus || !!qa;

  return (
    <section data-bi="tasks" style={{ margin: '36px 0 40px' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap', paddingBottom: 10, borderBottom: '1px solid var(--border)' }}>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 10 }}>
          <span style={{ fontSize: FS.ui, fontWeight: 600, color: 'var(--text)' }}>Tasks</span>
          <span style={{ fontSize: FS.sm, color: 'var(--faint)' }}>{summary}</span>
        </div>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', marginTop: 6 }}>
        {rows.map(t => <DailyTaskRow key={t.id} t={t} actions={actions} show={show} menu={menu} setMenu={setMenu} />)}
      </div>

      {rows.length === 0 && (
        <div style={{ padding: '20px 0 12px', display: 'flex', flexDirection: 'column', gap: 4 }}>
          <span style={{ fontSize: FS.lg, color: 'var(--text-2)', fontWeight: 500 }}>All clear for today</span>
          <span style={{ fontSize: FS.ui, color: 'var(--muted)', lineHeight: 1.55 }}>Anything you add and leave unchecked carries over to tomorrow on its own.</span>
        </div>
      )}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '8px 10px', margin: '4px -10px 0', borderRadius: 8, border: qaFocus ? '1px solid var(--border-strong)' : '1px solid transparent', background: qaFocus ? 'var(--elev)' : 'transparent' }}>
        <span style={{ width: 16, display: 'flex', justifyContent: 'center', color: qaFocus ? 'var(--accent)' : 'var(--faint)', flex: 'none' }}><Plus /></span>
        <input value={qa} onChange={e => setQa(e.target.value)} placeholder="Add a task for today" spellCheck={false}
          onPaste={e => {
            const el = e.currentTarget, text = e.clipboardData.getData('text/plain').trim();
            if (!isUrl(text) || insideLinkSyntax(el.value.slice(0, el.selectionStart ?? 0))) return;
            // The task may already be added by the time the title arrives, so fix it in both places.
            const relink = (draft: string, final: string) => { setQa(q => q.replace(draft, final)); actions.relink?.(draft, final); };
            if (pasteUrl(el, text, relink)) e.preventDefault();
          }}
          onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); add(); } else if (e.key === 'Escape') { setQa(''); e.currentTarget.blur(); } }}
          onFocus={() => setQaFocus(true)} onBlur={() => setQaFocus(false)}
          style={{ flex: 1, minWidth: 0, border: 'none', outline: 'none', background: 'transparent', color: 'var(--text)', fontFamily: 'inherit', fontSize: FS.lg, lineHeight: 1.5, padding: 0 }} />
        {qaActive && show.pri && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 2 }}>
            {(['h', 'm', 'l'] as const).map(k => (
              <button key={k} title={`${PRI[k].label} priority`} onMouseDown={e => { e.preventDefault(); setQaPri(k); }}
                style={{ display: 'flex', alignItems: 'center', gap: 6, fontFamily: 'inherit', fontSize: FS.sm, padding: '3px 7px', borderRadius: 5, border: 'none', cursor: 'pointer', background: qaPri === k ? 'var(--active)' : 'transparent', color: qaPri === k ? 'var(--text)' : 'var(--faint)' }}>
                <span style={{ width: 6, height: 6, borderRadius: '50%', background: PRI[k].color }} />{PRI[k].short}
              </button>
            ))}
            <span style={{ fontFamily: MONO, fontSize: FS.xs, color: 'var(--faint)', border: '1px solid var(--border-strong)', borderRadius: 4, padding: '0 5px', marginLeft: 6, opacity: qa.trim() ? 1 : 0.4 }}>↵</span>
          </div>
        )}
      </div>
    </section>
  );
}

/* ---------- a past day ---------- */

export function PastTasks({ done, open, actions, show, onOpenToday }: { done: TaskItem[]; open: TaskItem[]; actions: TaskActions; show: TaskShow; onOpenToday: () => void }) {
  return (
    <section data-bi="tasks" style={{ margin: '36px 0 40px' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, paddingBottom: 10, borderBottom: '1px solid var(--border)', marginBottom: 6 }}>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 10 }}>
          <span style={{ fontSize: FS.ui, fontWeight: 600, color: 'var(--text)' }}>Tasks</span>
          <span style={{ fontSize: FS.sm, color: 'var(--faint)' }}>{done.length} done{open.length ? ` · ${open.length} open` : ''}</span>
        </div>
        <button onClick={onOpenToday} style={{ border: 'none', background: 'transparent', padding: 0, color: 'var(--accent)', font: 'inherit', fontSize: FS.sm, cursor: 'pointer' }}>Open today</button>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column' }}>
        {open.concat(done).map(t => {
          const carried = t.carried ?? 0;
          return (
            <div key={t.id} data-row="1" tabIndex={0} className="task-row"
              onKeyDown={e => {
                if (e.target !== e.currentTarget || t.done) return;
                if (e.key === ' ' || e.key === 'x') { e.preventDefault(); actions.toggle(t); }
                else if (e.key === 'Enter') { e.preventDefault(); e.currentTarget.querySelector<HTMLElement>('[data-title]')?.click(); }
              }}
              style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '7px 10px', margin: '0 -10px', borderRadius: 7, outline: 'none', cursor: 'default' }}>
              <button className={t.done ? undefined : 'checkbox'} onClick={e => { e.stopPropagation(); if (!t.done) actions.toggle(t); }}
                title={t.done ? 'Completed this day' : 'Complete (marks done today)'} style={boxStyle(t.done, !t.done)}>
                {t.done && <Check />}
              </button>
              <TaskTitle t={t} actions={t.done ? { ...actions, rename: undefined } : actions} style={titleStyle(t)} />
              <div style={{ display: 'flex', alignItems: 'center', gap: 12, fontSize: FS.sm, color: 'var(--faint)', flex: 'none' }}>
                {show.carried && carried > 0 && <span title={carryTitle(carried)}>↻ {carried}</span>}
                <span style={{ color: t.done ? 'var(--faint)' : 'var(--muted)' }}>{t.done ? 'done' : 'open'}</span>
                {show.pri && <span style={{ width: 20, display: 'flex', justifyContent: 'center' }}><span style={dot(t.pri, t.done)} /></span>}
              </div>
            </div>
          );
        })}
      </div>
      {!done.length && !open.length && <div style={{ padding: '18px 0 6px', fontSize: FS.ui, color: 'var(--muted)' }}>Nothing was completed on this day.</div>}
    </section>
  );
}

export const dayLabel = (d: string) => `${fmt(d, { weekday: 'short' })}, ${fmt(d, { month: 'short', day: 'numeric' })}`;
export const addDays = (d: string, n: number) => { const x = parseIso(d); x.setDate(x.getDate() + n); return iso(x); };
