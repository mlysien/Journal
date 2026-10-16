import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { fmt } from '../dates';
import { dailyFile, type TabId, type Vault } from '../vault';
import { taskDay } from '../dailyTasks';
import { DayIcon, FileIcon } from './icons';

/** A searchable line: a note block, or a daily task (`block` null). */
interface Line { text: string; block: number | null }
interface Doc { tab: TabId; title: string; sub: string; lines: Line[]; day: boolean; date?: string }
interface Hit { doc: Doc; titleHit: boolean; lines: Line[] }

const MAX_RESULTS = 50, MAX_LINES = 3;

/** Every note and daily note, as plain lines to search. */
function docsOf(v: Vault): Doc[] {
  const docs: Doc[] = [];
  for (const n of Object.values(v.notes)) {
    docs.push({ tab: 'note:' + n.id, title: n.title || 'Untitled', sub: n.folder ?? '', day: false, lines: n.blocks.map((text, block) => ({ text, block })) });
  }
  const tasksByDay = new Map<string, Line[]>();
  for (const t of v.tasks) {
    const d = taskDay(t);
    tasksByDay.set(d, [...(tasksByDay.get(d) ?? []), { text: `- [${t.done ? 'x' : ' '}] ${t.title}`, block: null }]);
  }
  for (const date of new Set([...Object.keys(v.daily), ...tasksByDay.keys()])) {
    docs.push({
      tab: 'daily:' + date, date, day: true,
      title: fmt(date, { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' }),
      sub: dailyFile(v, date).replace(/\.md$/, ''),
      lines: [...(tasksByDay.get(date) ?? []), ...(v.daily[date] ?? []).map((text, block) => ({ text, block }))],
    });
  }
  return docs;
}

/** Markdown syntax off a line, so snippets read as text. */
const plain = (s: string) => s
  .replace(/^\s*(#{1,6}\s+|- \[[ xX]\]\s?|[-*]\s|>\s?|\|)/, '')
  .replace(/!?\[\[([^\]|]+)\|([^\]]+)\]\]/g, '$2').replace(/!?\[\[([^\]]+)\]\]/g, '$1')
  .replace(/!?\[([^\]]*)\]\(([^)\s]+)\)/g, (_m, t: string, u: string) => t || u)
  .replace(/\*\*|`|\s+!(high|med|medium|low)\s*$/gi, '').replace(/\s*\|\s*/g, ' · ').trim();

function search(docs: Doc[], query: string): Hit[] {
  const terms = query.toLowerCase().split(/\s+/).filter(Boolean);
  if (!terms.length) return [];
  const hits: (Hit & { score: number })[] = [];
  for (const doc of docs) {
    const title = doc.title.toLowerCase() + ' ' + doc.sub.toLowerCase();
    const lines: Line[] = [];
    for (const l of doc.lines) {
      // A code block or table is one block of several lines; each line is its own result.
      for (const part of l.text.split('\n')) {
        const low = part.toLowerCase();
        if (terms.some(t => low.includes(t))) lines.push({ text: part, block: l.block });
      }
    }
    const all = (title + ' ' + lines.map(l => l.text.toLowerCase()).join(' '));
    if (!terms.every(t => all.includes(t))) continue;
    const titleHit = terms.every(t => title.includes(t));
    const full = (l: Line) => terms.every(t => l.text.toLowerCase().includes(t));
    lines.sort((a, b) => +full(b) - +full(a));
    // Title matches first, then notes with more matching lines, then newer daily notes.
    hits.push({ doc, titleHit, lines: lines.slice(0, MAX_LINES), score: (titleHit ? 1000 : 0) + Math.min(lines.length, 50) });
  }
  hits.sort((a, b) => b.score - a.score || (b.doc.date ?? '').localeCompare(a.doc.date ?? '') || a.doc.title.localeCompare(b.doc.title));
  return hits.slice(0, MAX_RESULTS);
}

const escapeRe = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/** `text` with every search term marked, cut down to the part around the first one. */
function Marked({ text, terms, cut }: { text: string; terms: string[]; cut?: boolean }) {
  let s = text;
  if (cut && s.length > 110) {
    const low = s.toLowerCase(), first = Math.min(...terms.map(t => low.indexOf(t)).filter(i => i >= 0));
    const from = Math.max(0, first - 40);
    s = (from ? '…' : '') + s.slice(from, from + 110) + (from + 110 < s.length ? '…' : '');
  }
  if (!terms.length) return <>{s}</>;
  const parts = s.split(new RegExp(`(${terms.map(escapeRe).join('|')})`, 'gi'));
  const out: ReactNode[] = parts.map((p, i) => i % 2
    ? <mark key={i} style={{ background: 'var(--accent-soft)', color: 'var(--text)', borderRadius: 3, padding: '0 1px' }}>{p}</mark>
    : p);
  return <>{out}</>;
}

interface Props {
  vault: Vault;
  onOpen: (tab: TabId, block: number | null) => void;
  onClose: () => void;
}

export function Search({ vault, onOpen, onClose }: Props) {
  const [query, setQuery] = useState('');
  const [sel, setSel] = useState(0);
  const docs = useMemo(() => docsOf(vault), [vault]);
  const hits = useMemo(() => search(docs, query), [docs, query]);
  const terms = query.toLowerCase().split(/\s+/).filter(Boolean);
  const list = useRef<HTMLDivElement>(null);

  // Each result's first line is the one Enter opens; the rows are [doc, its lines…].
  const rows = hits.flatMap(h => (h.lines.length ? h.lines : [null]).map(l => ({ hit: h, line: l })));
  useEffect(() => { setSel(0); }, [query]);
  useEffect(() => { list.current?.querySelector(`[data-row="${sel}"]`)?.scrollIntoView({ block: 'nearest' }); }, [sel]);

  const open = (i: number) => {
    const r = rows[i];
    if (r) onOpen(r.hit.doc.tab, r.line?.block ?? null);
  };

  let n = 0;
  return (
    <div onMouseDown={onClose} style={{ position: 'fixed', inset: 0, zIndex: 50, background: 'rgba(0,0,0,0.35)', display: 'flex', justifyContent: 'center', alignItems: 'flex-start', paddingTop: '12vh' }}>
      <div onMouseDown={e => e.stopPropagation()} role="dialog" aria-label="Search"
        style={{ width: 'min(640px, calc(100vw - 32px))', maxHeight: '70vh', display: 'flex', flexDirection: 'column', background: 'var(--elev)', border: '1px solid var(--border)', borderRadius: 12, boxShadow: '0 24px 60px rgba(0,0,0,0.35)', overflow: 'hidden' }}>
        <input autoFocus value={query} placeholder="Search notes, daily notes and tasks" spellCheck={false}
          onChange={e => setQuery(e.target.value)}
          onKeyDown={e => {
            if (e.key === 'Escape') { e.preventDefault(); onClose(); }
            else if (e.key === 'ArrowDown') { e.preventDefault(); setSel(s => Math.min(s + 1, rows.length - 1)); }
            else if (e.key === 'ArrowUp') { e.preventDefault(); setSel(s => Math.max(s - 1, 0)); }
            else if (e.key === 'Enter') { e.preventDefault(); open(sel); }
          }}
          style={{ font: 'inherit', fontSize: 16, padding: '16px 18px', border: 'none', borderBottom: '1px solid var(--border)', outline: 'none', background: 'transparent', color: 'var(--text)' }} />
        <div ref={list} style={{ overflowY: 'auto', padding: 6 }}>
          {!terms.length && <div style={{ padding: '14px 12px', fontSize: 13.5, color: 'var(--muted)' }}>Type to search every note in the vault. ↑ ↓ to move, Enter to open, Esc to close.</div>}
          {terms.length > 0 && !hits.length && <div style={{ padding: '14px 12px', fontSize: 13.5, color: 'var(--muted)' }}>Nothing matches “{query.trim()}”.</div>}
          {hits.map(h => {
            const first = n;
            const lineRows = h.lines.map(l => ({ l, i: n++ }));
            if (!h.lines.length) n++;
            const docSel = !h.lines.length && sel === first;
            return (
              <div key={h.doc.tab} style={{ padding: '4px 0' }}>
                <div data-row={h.lines.length ? undefined : first} onClick={() => open(first)} onMouseMove={() => { if (!h.lines.length) setSel(first); }} className="hov-bg"
                  style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 10px', borderRadius: 7, cursor: 'pointer', background: docSel ? 'var(--active)' : undefined }}>
                  <span style={{ display: 'flex', color: 'var(--muted)' }}>{h.doc.day ? <DayIcon /> : <FileIcon />}</span>
                  <span style={{ fontSize: 14.5, fontWeight: 500, color: 'var(--text)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}><Marked text={h.doc.title} terms={h.titleHit ? terms : []} /></span>
                  {h.doc.sub && <span style={{ fontSize: 12.5, color: 'var(--faint)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', minWidth: 0 }}>{h.doc.sub}</span>}
                </div>
                {lineRows.map(({ l, i }) => (
                  <div key={i} data-row={i} onClick={() => open(i)} onMouseMove={() => setSel(i)} className="hov-bg"
                    style={{ padding: '4px 10px 4px 34px', borderRadius: 7, fontSize: 13.5, lineHeight: 1.5, color: 'var(--text-2)', cursor: 'pointer', background: sel === i ? 'var(--active)' : undefined, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    {l.block === null && <span style={{ color: 'var(--faint)', marginRight: 6 }}>Task</span>}
                    <Marked text={plain(l.text) || l.text} terms={terms} cut />
                  </div>
                ))}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
