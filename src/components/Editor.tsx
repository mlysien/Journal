import { useCallback, useRef, useState, type CSSProperties, type ClipboardEvent, type DragEvent, type KeyboardEvent, type MouseEvent } from 'react';
import { codeToks, parseBlock, type Block } from '../markdown';
import { FS, MONO, UI } from '../theme';
import { PRI, splitPriMark } from '../vault';
import { filesFromClipboard, isImage, mayHoldFiles, saveIncoming, useAssets, vaultUrl, type Incoming } from '../assets';
import { insideLinkSyntax, isUrl, pasteUrl } from '../links';
import { AttachmentChip, InlineText } from './InlineText';
import { Check, ExternalIcon } from './icons';

const P: CSSProperties = { fontSize: FS.body, lineHeight: 1.72, fontWeight: 400, margin: 0 };
const TYPE: Record<string, CSSProperties> = {
  h1: { fontSize: FS.h1, fontWeight: 600, lineHeight: 1.3, letterSpacing: '-0.02em', margin: '30px 0 8px' },
  h2: { fontSize: FS.h2, fontWeight: 600, lineHeight: 1.45, letterSpacing: '-0.012em', margin: '28px 0 6px' },
  h3: { fontSize: FS.h3, fontWeight: 600, lineHeight: 1.5, margin: '22px 0 4px' },
  quote: { ...P, margin: '8px 0', paddingLeft: 16, borderLeft: '2px solid var(--border-strong)', color: 'var(--text-2)', fontStyle: 'italic' },
};

type Caret = number | 'end' | null;

interface Props {
  blocks: string[];
  update: (fn: (L: string[]) => void) => void;
  isDaily: boolean;
  live: boolean;
  spell: boolean;
  onOpenLink: (name: string) => void;
  /** Start with the caret in the first block (a freshly created note). */
  autoFocus?: boolean;
  /** Vault folder of this note; pasted files go into its Attachments subfolder. */
  noteDir: string;
  /** Called with the vault paths of files saved by a paste or drop. */
  onAssetsAdded: (rels: string[]) => void;
}

export function Editor({ blocks, update, isDaily, live, spell, onOpenLink, autoFocus, noteDir, onAssetsAdded }: Props) {
  const assets = useAssets();
  const [dropAt, setDropAt] = useState<number | null>(null);

  /** Save files and link them: images on their own lines after block `i`, other files inline at the caret. */
  const attach = async (items: Incoming[], i: number, ta: HTMLTextAreaElement | null, caretPos: number) => {
    let saved;
    try { saved = await saveIncoming(noteDir, items); } catch (err) { alert(`Could not save the attachment.\n${err instanceof Error ? err.message : err}`); return; }
    onAssetsAdded(saved.map(s => s.rel));
    const images = saved.filter(s => s.image).map(s => s.markdown), files = saved.filter(s => !s.image).map(s => s.markdown).join(' ');
    if (files && ta && document.activeElement === ta) document.execCommand('insertText', false, files);
    else if (files) update(A => { A[i] = A[i].slice(0, caretPos) + files + A[i].slice(caretPos); });
    // An empty line is replaced by the images; otherwise they go below it. Either way the caret lands on a fresh line after them.
    const replace = !blocks[i]?.trim();
    if (images.length) mutate(A => {
      if (replace) A.splice(i, 1, ...images, ''); else A.splice(i + 1, 0, ...images, '');
    }, i + images.length + (replace ? 0 : 1), 0);
  };

  const onDrop = (e: DragEvent) => {
    setDropAt(null);
    if (!e.dataTransfer.files.length) return;
    e.preventDefault();
    const at = Number((e.target as HTMLElement).closest('[data-bi]')?.getAttribute('data-bi') ?? blocks.length - 1);
    const items = Array.from(e.dataTransfer.files).map(f => ({ name: f.name, path: window.journal.pathForFile(f) || undefined, file: f }));
    // Dropped files always go on lines of their own.
    saveIncoming(noteDir, items).then(saved => {
      onAssetsAdded(saved.map(s => s.rel));
      mutate(A => { A.splice(at + 1, 0, ...saved.map(s => s.markdown)); });
    }).catch(err => alert(`Could not save the attachment.\n${err instanceof Error ? err.message : err}`));
  };
  const onDragOver = (e: DragEvent) => {
    if (!e.dataTransfer.types.includes('Files')) return;
    e.preventDefault();
    e.dataTransfer.dropEffect = 'copy';
    const at = Number((e.target as HTMLElement).closest('[data-bi]')?.getAttribute('data-bi') ?? blocks.length - 1);
    if (at !== dropAt) setDropAt(at);
  };

  const [focus, setFocus] = useState<number | null>(autoFocus ? 0 : null);
  const [copied, setCopied] = useState<number | null>(null);
  const caret = useRef<Caret>(null);
  const onlyEmpty = blocks.length === 1 && blocks[0] === '';

  const taRef = useCallback((el: HTMLTextAreaElement | null) => {
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = el.scrollHeight + 'px';
    el.focus();
    const c = caret.current;
    const pos = c == null || c === 'end' ? el.value.length : Math.min(c, el.value.length);
    el.setSelectionRange(pos, pos);
    caret.current = null;
  }, []);

  const mutate = (fn: (A: string[]) => void, nextFocus?: number | null, c: Caret = null) => {
    caret.current = c;
    update(A => { fn(A); if (!A.length) A.push(''); });
    if (nextFocus !== undefined) setFocus(nextFocus);
  };

  const onKey = (e: KeyboardEvent<HTMLTextAreaElement>, i: number) => {
    const ta = e.currentTarget, pos = ta.selectionStart, end = ta.selectionEnd, val = ta.value;
    const multi = val.startsWith('```') || val.startsWith('|');
    if (e.key === 'Escape') { e.preventDefault(); ta.blur(); setFocus(null); return; }
    if (e.key === 'Enter' && !e.shiftKey && !multi) {
      e.preventDefault();
      const before = val.slice(0, pos), after = val.slice(end);
      if (/^```\w*$/.test(before.trim()) && !after) { mutate(A => { A[i] = before + '\n\n```'; }, i, before.length + 1); return; }
      let prefix = '';
      const m = before.match(/^(\s*)(- \[[ xX]\] |[-*] |> )/);
      if (m) {
        if (before.trim() === m[2].trim() && !after.trim()) { mutate(A => { A[i] = ''; }, i, 0); return; }
        prefix = m[1] + (m[2].startsWith('- [') ? '- [ ] ' : m[2]);
      }
      mutate(A => { A[i] = before; A.splice(i + 1, 0, prefix + after); }, i + 1, prefix.length);
      return;
    }
    if (e.key === 'Backspace' && pos === 0 && end === 0 && i > 0) {
      const prev = blocks[i - 1], pt = parseBlock(prev).type;
      e.preventDefault();
      if (pt === 'code' || pt === 'table' || pt === 'image') {
        mutate(A => { if (!val) A.splice(i, 1); }, i - 1, 'end');
        return;
      }
      mutate(A => { A[i - 1] = prev + val; A.splice(i, 1); }, i - 1, prev.length);
      return;
    }
    if (e.key === 'ArrowUp' && i > 0 && val.lastIndexOf('\n', pos - 1) === -1 && (!multi || pos === 0)) {
      e.preventDefault(); caret.current = 'end'; setFocus(i - 1); return;
    }
    if (e.key === 'ArrowDown' && i < blocks.length - 1 && val.indexOf('\n', pos) === -1 && (!multi || pos === val.length)) {
      e.preventDefault(); caret.current = 0; setFocus(i + 1);
    }
  };

  const onPaste = (e: ClipboardEvent<HTMLTextAreaElement>, i: number) => {
    const ta = e.currentTarget;
    const text = e.clipboardData.getData('text/plain').trim();
    const inCode = ta.value.startsWith('```') || ta.value.startsWith('|');
    if (text && isUrl(text) && !inCode && !insideLinkSyntax(ta.value.slice(0, ta.selectionStart))) {
      const relink = (draft: string, final: string) => update(A => {
        const k = A.findIndex(b => b.includes(draft));
        if (k >= 0) A[k] = A[k].replace(draft, final);
      });
      if (pasteUrl(ta, text, relink)) e.preventDefault();
      return;
    }
    if (inCode || !mayHoldFiles(e.clipboardData)) return;
    // Files (or what may be paths of copied files): check, then save them or paste the text after all.
    e.preventDefault();
    const pos = ta.selectionStart, raw = e.clipboardData.getData('text/plain');
    filesFromClipboard(e.clipboardData).then(items => {
      if (items?.length) return attach(items, i, ta, pos);
      if (!raw) return;
      if (document.activeElement === ta) document.execCommand('insertText', false, raw);
      else update(A => { A[i] = A[i].slice(0, pos) + raw + A[i].slice(pos); });
    });
  };

  const focusEnd = (e: MouseEvent) => {
    e.preventDefault();
    if (blocks[blocks.length - 1] !== '') mutate(A => { A.push(''); }, blocks.length, 0);
    else { caret.current = 'end'; setFocus(blocks.length - 1); }
  };

  const tokens = (text: string) => <InlineText text={text} onOpenLink={onOpenLink} />;

  const renderBlock = (src: string, pb: Block, i: number) => {
    if (onlyEmpty) return <div style={{ fontSize: FS.body, lineHeight: 1.72, color: 'var(--faint)', cursor: 'text' }}>Start writing. Markdown renders as you type.</div>;
    if (!live) return <div style={{ ...P, fontFamily: pb.type === 'code' || pb.type === 'table' ? MONO : UI, fontSize: pb.type === 'code' || pb.type === 'table' ? 13.5 : 16, whiteSpace: 'pre-wrap', minHeight: '1.72em', cursor: 'text' }}>{src}</div>;
    switch (pb.type) {
      case 'code': return (
        <div style={{ margin: '14px 0', background: 'var(--code)', border: '1px solid var(--border)', borderRadius: 8, overflow: 'hidden', cursor: 'text' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '9px 14px 0 16px', fontFamily: MONO, fontSize: FS.xs, color: 'var(--faint)' }}>
            <span>{pb.lang}</span>
            <button data-link="1" className="hov-text" onClick={e => {
              e.stopPropagation();
              window.journal.copyText(pb.body.join('\n')).catch(() => {});
              setCopied(i);
              setTimeout(() => setCopied(c => (c === i ? null : c)), 1400);
            }} style={{ border: 'none', background: 'transparent', color: 'var(--faint)', font: 'inherit', fontSize: FS.xs, padding: '2px 6px', borderRadius: 4, cursor: 'pointer' }}>{copied === i ? 'Copied' : 'Copy'}</button>
          </div>
          <div style={{ padding: '6px 16px 14px', fontFamily: MONO, fontSize: FS.ui, lineHeight: 1.65, overflowX: 'auto', color: 'var(--text-2)' }}>
            {pb.body.map((ln, j) => (
              <div key={j} style={{ whiteSpace: 'pre', minHeight: '1.65em' }}>{codeToks(ln, pb.lang).map(ct => <span key={ct.key} style={ct.style}>{ct.text}</span>)}</div>
            ))}
          </div>
        </div>
      );
      case 'table': {
        const n = Math.max(...pb.rows.map(r => r.length));
        const numeric = Array.from({ length: n }, (_, c) => pb.rows.slice(1).every(r => /^[\d.,\s]+(s|ms|%)?$/.test(r[c] || '')));
        return (
          <div style={{ margin: '14px 0', fontSize: FS.md, lineHeight: 1.5, fontVariantNumeric: 'tabular-nums', cursor: 'text' }}>
            {pb.rows.map((r, ri) => (
              <div key={ri} style={{ display: 'grid', gridTemplateColumns: `repeat(${n}, minmax(0,1fr))`, borderBottom: '1px solid var(--border)' }}>
                {Array.from({ length: n }, (_, c) => (
                  <div key={c} style={{ padding: '8px 12px 8px 0', textAlign: numeric[c] && c > 0 ? 'right' : 'left', fontWeight: ri === 0 ? 600 : 400, fontSize: ri === 0 ? 13 : 14.5, color: ri === 0 ? 'var(--text-2)' : 'var(--text)' }}>{tokens(r[c] || '')}</div>
                ))}
              </div>
            ))}
          </div>
        );
      }
      case 'image': {
        const rel = assets.resolve(pb.src ?? pb.name, !pb.src);
        if (rel && isImage(rel)) return (
          <div className="note-image" style={{ cursor: 'text' }}>
            <img src={vaultUrl(rel)} alt={pb.name} draggable={false} />
            <button data-link="1" className="image-open" onMouseDown={e => { e.preventDefault(); e.stopPropagation(); }} onClick={e => { e.stopPropagation(); assets.open(rel); }}>
              <ExternalIcon />Open
            </button>
          </div>
        );
        // An embedded non-image file (![[report.pdf]]) shows as an attachment.
        if (rel) return <div style={{ ...P, cursor: 'text' }}><AttachmentChip label={pb.name.split('/').pop()!} target={pb.src ?? pb.name} wiki={!pb.src} /></div>;
        return (
          <div style={{ margin: '12px 0', padding: '18px 20px', border: '1px dashed var(--border-strong)', borderRadius: 10, display: 'flex', flexDirection: 'column', gap: 6, cursor: 'text' }}>
            <span style={{ fontFamily: MONO, fontSize: FS.sm, color: 'var(--muted)' }}>{pb.src ?? pb.name}</span>
            <span style={{ fontSize: FS.ui, color: 'var(--faint)' }}>This file isn’t in the vault.</span>
          </div>
        );
      }
      case 'hr': return <div style={{ padding: '14px 0', cursor: 'text' }}><div style={{ height: 1, background: 'var(--border)' }} /></div>;
      case 'empty': return <div style={{ height: 12, cursor: 'text' }} />;
      default: {
        const indent = 'indent' in pb ? pb.indent : 0;
        const checked = pb.type === 'task' && pb.checked;
        const { text, pri } = pb.type === 'task' ? splitPriMark(pb.text) : { text: pb.text, pri: null };
        return (
          <div style={{ display: 'flex', alignItems: 'flex-start', cursor: 'text', ...(TYPE[pb.type] || P), marginLeft: indent * 11 }}>
            {pb.type === 'li' && (
              <span style={{ width: 22, flex: 'none', height: '1.72em', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><span style={{ width: 5, height: 5, borderRadius: '50%', background: 'var(--muted)' }} /></span>
            )}
            {pb.type === 'task' && (
              <span data-link="1" onClick={e => { e.stopPropagation(); update(A => { A[i] = checked ? A[i].replace(/- \[[xX]\]/, '- [ ]') : A[i].replace('- [ ]', '- [x]'); }); }} style={{ width: 26, flex: 'none', height: '1.72em', display: 'flex', alignItems: 'center', cursor: 'pointer' }}>
                <span style={{ width: 15, height: 15, boxSizing: 'border-box', borderRadius: 4, border: checked ? '1.5px solid var(--accent-fill)' : '1.5px solid var(--border-strong)', background: checked ? 'var(--accent-fill)' : 'transparent', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  {checked && <Check />}
                </span>
              </span>
            )}
            <span style={{ flex: 1, minWidth: 0, textWrap: 'pretty', color: checked ? 'var(--faint)' : undefined, textDecoration: checked ? 'line-through' : 'none' } as CSSProperties}>
              {tokens(text)}
              {pri && pri !== 'm' && <span title={`${PRI[pri].label} priority`} style={{ display: 'inline-block', width: 7, height: 7, borderRadius: '50%', background: PRI[pri].color, marginLeft: 10, verticalAlign: 'middle', opacity: checked ? 0.45 : 1 }} />}
            </span>
          </div>
        );
      }
    }
  };

  return (
    <div style={{ color: 'var(--text)' }} onDrop={onDrop} onDragOver={onDragOver} onDragLeave={e => { if (e.currentTarget === e.target) setDropAt(null); }}>
      {blocks.map((src, i) => {
        const pb = parseBlock(src), editing = focus === i;
        let body;
        if (editing) {
          const multi = pb.type === 'code' || pb.type === 'table';
          const T = TYPE[pb.type] || P;
          const style: CSSProperties = { display: 'block', width: '100%', boxSizing: 'border-box', resize: 'none', border: 'none', outline: 'none', background: 'transparent', color: 'var(--text)', fontFamily: UI, padding: 0, overflow: 'hidden', caretColor: 'var(--accent)', fontSize: T.fontSize, lineHeight: T.lineHeight, fontWeight: T.fontWeight || 400, letterSpacing: T.letterSpacing || 'normal', margin: T.margin };
          if (multi) Object.assign(style, { fontFamily: MONO, fontSize: FS.ui, lineHeight: 1.65, fontWeight: 400, margin: '14px 0', padding: '12px 16px', background: 'var(--code)', border: '1px solid var(--accent-ring)', borderRadius: 8, color: 'var(--text-2)' });
          if (pb.type === 'image') Object.assign(style, { fontFamily: MONO, fontSize: FS.ui, margin: '16px 0' });
          body = (
            <textarea
              ref={taRef} value={src} rows={1} spellCheck={spell} style={style}
              placeholder={onlyEmpty ? (isDaily ? 'How did today go? Markdown renders as you type.' : 'Start writing…') : ''}
              onChange={e => { const el = e.target; el.style.height = 'auto'; el.style.height = el.scrollHeight + 'px'; const v = el.value; update(A => { A[i] = v; }); }}
              onKeyDown={e => onKey(e, i)}
              onBlur={() => setFocus(f => (f === i ? null : f))}
              onPaste={e => onPaste(e, i)}
            />
          );
        } else body = renderBlock(src, pb, i);
        return (
          <div key={i} data-bi={i} className={dropAt === i ? 'drop-target' : undefined} style={{ position: 'relative' }} onMouseDown={e => {
            if ((e.target as HTMLElement).closest('[data-link]') || editing) return;
            e.preventDefault(); caret.current = 'end'; setFocus(i);
          }}>{body}</div>
        );
      })}
      <div onMouseDown={focusEnd} style={{ height: 200, cursor: 'text' }} />
    </div>
  );
}
