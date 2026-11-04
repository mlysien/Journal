import { useEffect, useRef, type CSSProperties, type MouseEvent } from 'react';
import { MONO, UI } from '../theme';
import { EditorSelection, EditorState, type ChangeSpec, type SelectionRange } from '@codemirror/state';
import { EditorView, dropCursor, keymap, placeholder } from '@codemirror/view';
import { defaultKeymap, history, historyKeymap, indentLess, indentMore } from '@codemirror/commands';
import { markdown, markdownLanguage } from '@codemirror/lang-markdown';
import { syntaxTree } from '@codemirror/language';
import { splitBlocks } from '../markdown';
import { filesFromClipboard, mayHoldFiles, saveIncoming, useAssets, type Incoming } from '../assets';
import { insideLinkSyntax, isUrl, mdLink, urlLabel } from '../links';
import { formatOf, inlineEdit, isInline, isKind, lineEdit, type FormatId, type LineFormat } from '../format';
import { flash, flashLine, livePreview, refresh, type PreviewCtx } from '../livePreview';
import { playDone } from '../sound';

interface Props {
  blocks: string[];
  update: (fn: (L: string[]) => void) => void;
  isDaily: boolean;
  live: boolean;
  spell: boolean;
  /** Show the priority dot of `!high` / `!low` checklist items. */
  showPri: boolean;
  /** Chime when a checklist item is checked. */
  sound: boolean;
  /** Changes when the caret should go to the start of the note (Enter in the title). */
  focusStart?: number;
  onOpenLink: (name: string) => void;
  /** Start with the caret at the start of the note (a freshly created note). */
  autoFocus?: boolean;
  /** Vault folder of this note; pasted files go into its Attachments subfolder. */
  noteDir: string;
  /** Called with the vault paths of files saved by a paste or drop. */
  onAssetsAdded: (rels: string[]) => void;
  /** A block to scroll to and flash, as from a search result. */
  jump?: number | null;
  onJumped?: () => void;
}

/** Inside a code block, inline code or a table, where Markdown shortcuts don't apply. */
const inCode = (state: EditorState, pos: number) => {
  for (let n: ReturnType<typeof syntaxTree>['topNode'] | null = syntaxTree(state).resolveInner(pos, -1); n; n = n.parent)
    if (n.name === 'FencedCode' || n.name === 'InlineCode') return true;
  return state.doc.lineAt(pos).text.startsWith('|');
};

/** Apply a formatting shortcut to the selection. */
function applyFormat(view: EditorView, id: FormatId, sound: boolean) {
  const { state } = view, doc = state.doc;
  if (isInline(id)) {
    const r = state.selection.main, l = doc.lineAt(r.from);
    if (doc.lineAt(r.to).number !== l.number || inCode(state, r.from)) return;
    const ed = inlineEdit(l.text, r.from - l.from, r.to - l.from, id);
    view.dispatch({ changes: { from: l.from + ed.from, to: l.from + ed.to, insert: ed.text }, selection: EditorSelection.single(l.from + ed.selStart, l.from + ed.selEnd), userEvent: 'input.format', scrollIntoView: true });
    return;
  }
  // Line formats: every line the selection touches becomes that kind of line, or all plain text when they already are.
  const lines = new Map<number, { from: number; text: string }>();
  for (const r of state.selection.ranges)
    for (let n = doc.lineAt(r.from).number; n <= doc.lineAt(r.to).number; n++) {
      const l = doc.line(n);
      if (!inCode(state, l.from)) lines.set(n, { from: l.from, text: l.text });
    }
  if (!lines.size) return;
  const all = [...lines.values()], lid = id as LineFormat;
  const on = lid === 'check' ? all.some(l => /^\s*- \[ \]/.test(l.text)) : all.some(l => !isKind(l.text, lid));
  const changes: ChangeSpec[] = [];
  /** Where each changed line's text after its prefix moved, to carry the caret along. */
  const moves: { from: number; oldEnd: number; at: number; shift: number }[] = [];
  for (const l of all) {
    const r = lineEdit(l.text, lid, on);
    if (!r) continue;
    const oldEnd = r.at - r.shift;
    changes.push({ from: l.from, to: l.from + oldEnd, insert: r.line.slice(0, r.at) });
    moves.push({ from: l.from, oldEnd, at: r.at, shift: r.shift });
  }
  if (!changes.length) return;
  if (lid === 'check' && on && sound) playDone();
  const map = (p: number) => {
    let delta = 0;
    for (const m of moves) {
      if (p < m.from) break;
      if (p < m.from + m.oldEnd) return m.from + delta + m.at;
      delta += m.shift;
    }
    return p + delta;
  };
  view.dispatch({
    changes,
    selection: EditorSelection.create(state.selection.ranges.map((r: SelectionRange) => EditorSelection.range(map(r.anchor), map(r.head))), state.selection.mainIndex),
    userEvent: 'input.format',
  });
}

/** Paste a URL as a Markdown link; the label becomes the page title once it's fetched. */
function pasteUrl(view: EditorView, url: string) {
  const r = view.state.selection.main, selected = view.state.sliceDoc(r.from, r.to).trim();
  const draft = mdLink(selected || urlLabel(url), url);
  view.dispatch(view.state.replaceSelection(draft), { userEvent: 'input.paste' });
  if (selected) return;
  window.journal.fetchTitle(url).then(title => {
    if (!title) return;
    const at = view.state.doc.toString().indexOf(draft);
    if (at >= 0) view.dispatch({ changes: { from: at, to: at + draft.length, insert: mdLink(title, url) } });
  });
}

export function Editor({ blocks, update, isDaily, live, spell, showPri, sound, focusStart, onOpenLink, autoFocus, noteDir, onAssetsAdded, jump, onJumped }: Props) {
  const assets = useAssets();
  const host = useRef<HTMLDivElement>(null);
  const view = useRef<EditorView | null>(null);
  /** The text last sent to or taken from the vault, to tell our own changes from outside ones. */
  const synced = useRef(blocks.join('\n'));
  const ctx = useRef<PreviewCtx>(null!);
  ctx.current = { resolve: assets.resolve, openFile: assets.open, openNote: onOpenLink, showPri, sound };
  const props = useRef({ update, noteDir, onAssetsAdded, sound });
  props.current = { update, noteDir, onAssetsAdded, sound };

  /** Save files and link them: images on lines of their own after the line at `pos`, other files at `pos`. */
  const attach = async (v: EditorView, items: Incoming[], pos: number, inline: boolean) => {
    let saved;
    try { saved = await saveIncoming(props.current.noteDir, items); } catch (err) { alert(`Could not save the attachment.\n${err instanceof Error ? err.message : err}`); return; }
    props.current.onAssetsAdded(saved.map(s => s.rel));
    const doc = v.state.doc, at = Math.min(pos, doc.length), l = doc.lineAt(at);
    const images = saved.filter(s => s.image || !inline).map(s => s.markdown), files = saved.filter(s => !s.image && inline).map(s => s.markdown).join(' ');
    const changes: ChangeSpec[] = [];
    let caret = at;
    if (files) { changes.push({ from: at, insert: files }); caret = at + files.length; }
    if (images.length) {
      // An empty line is replaced by the images; otherwise they go below it. Either way the caret lands on a fresh line after them.
      const block = images.join('\n') + '\n';
      if (!l.text.trim() && !files) { changes.push({ from: l.from, to: l.to, insert: block }); caret = l.from + block.length; }
      else { changes.push({ from: l.to, insert: '\n' + block }); caret = l.to + (files ? files.length : 0) + 1 + block.length; }
    }
    v.dispatch({ changes, selection: { anchor: caret }, userEvent: 'input.paste', scrollIntoView: true });
    v.focus();
  };

  useEffect(() => {
    const extensions = [
      history(),
      dropCursor(),
      EditorView.lineWrapping,
      // Tables, `Text` + `---` headings and indented code are left out: notes keep a line per block
      // (see splitBlocks), so a table is only its `|` lines and `---` is always a divider.
      markdown({ base: markdownLanguage, extensions: [{ remove: ['Table', 'SetextHeading', 'IndentedCode'] }] }),
      keymap.of([
        { key: 'Tab', run: indentMore, shift: indentLess },
        { key: 'Escape', run: v => { v.contentDOM.blur(); return true; } },
        ...historyKeymap,
        ...defaultKeymap,
      ]),
      placeholder(isDaily ? 'How did today go? Markdown renders as you type.' : 'Start writing…'),
      EditorView.contentAttributes.of({ spellcheck: spell ? 'true' : 'false' }),
      flash,
      live ? livePreview(ctx) : [],
      EditorView.updateListener.of(u => {
        if (!u.docChanged) return;
        const text = u.state.doc.toString();
        if (text === synced.current) return;
        synced.current = text;
        const next = splitBlocks(text);
        props.current.update(A => { A.splice(0, A.length, ...next); });
      }),
      EditorView.domEventHandlers({
        keydown(e, v) {
          const id = formatOf(e);
          if (!id) return false;
          e.preventDefault();
          applyFormat(v, id, props.current.sound);
          return true;
        },
        mousedown(e, v) {
          // Rendered links open on click; on a line being edited, with Ctrl+click.
          const t = (e.target as HTMLElement).closest<HTMLElement>('[data-href],[data-note]');
          if (!t || e.button !== 0) return false;
          const editing = v.hasFocus && t.closest('.cm-line') && v.state.selection.ranges.some(r => {
            const l = v.state.doc.lineAt(v.posAtDOM(t));
            return r.from <= l.to && r.to >= l.from;
          });
          if (editing && !(e.ctrlKey || e.metaKey)) return false;
          e.preventDefault();
          if (t.dataset.href) window.journal.openExternal(t.dataset.href);
          else if (t.dataset.note) ctx.current.openNote(t.dataset.note);
          return true;
        },
        paste(e, v) {
          const cd = e.clipboardData;
          if (!cd) return false;
          const text = cd.getData('text/plain').trim(), pos = v.state.selection.main.head;
          const code = inCode(v.state, pos), before = v.state.sliceDoc(v.state.doc.lineAt(pos).from, pos);
          if (text && isUrl(text) && !code && !insideLinkSyntax(before)) { e.preventDefault(); pasteUrl(v, text); return true; }
          if (code || !mayHoldFiles(cd)) return false;
          // Files (or what may be paths of copied files): check, then save them or paste the text after all.
          e.preventDefault();
          const raw = cd.getData('text/plain');
          filesFromClipboard(cd).then(items => {
            if (items?.length) return attach(v, items, pos, true);
            if (raw) v.dispatch(v.state.replaceSelection(raw), { userEvent: 'input.paste' });
          });
          return true;
        },
        drop(e, v) {
          if (!e.dataTransfer?.files.length) return false;
          e.preventDefault();
          const pos = v.posAtCoords({ x: e.clientX, y: e.clientY }) ?? v.state.doc.length;
          const items = Array.from(e.dataTransfer.files).map(f => ({ name: f.name, path: window.journal.pathForFile(f) || undefined, file: f }));
          // Dropped files always go on lines of their own.
          attach(v, items, pos, false);
          return true;
        },
      }),
    ];
    const v = new EditorView({
      parent: host.current!,
      state: EditorState.create({ doc: synced.current, extensions }),
    });
    view.current = v;
    if (autoFocus) { v.focus(); v.dispatch({ selection: { anchor: 0 } }); }
    return () => { v.destroy(); view.current = null; };
    // The editor is made once per note (and when these settings change); props it needs later are read from refs.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [live, spell, isDaily]);

  // Changes from elsewhere (the file changed, a task was checked in the sidebar) replace the text.
  useEffect(() => {
    const v = view.current, text = blocks.join('\n');
    if (!v || text === synced.current) return;
    synced.current = text;
    if (text === v.state.doc.toString()) return;
    v.dispatch({ changes: { from: 0, to: v.state.doc.length, insert: text }, annotations: [] });
  }, [blocks]);

  // Files added or settings changed: redraw links, images and priority dots.
  useEffect(() => { view.current?.dispatch({ effects: refresh.of(null) }); }, [assets, showPri, sound]);

  useEffect(() => {
    if (!focusStart || !view.current) return;
    view.current.focus();
    view.current.dispatch({ selection: { anchor: 0 }, scrollIntoView: true });
  }, [focusStart]);

  useEffect(() => {
    const v = view.current;
    if (jump == null || !v) return;
    // Blocks are lines, except code blocks and tables, which span several.
    const line = Math.min(v.state.doc.lines, blocks.slice(0, jump).reduce((n, b) => n + b.split('\n').length, 1));
    const pos = v.state.doc.line(line).from;
    v.dispatch({ effects: [EditorView.scrollIntoView(pos, { y: 'center' }), flashLine.of(line)] });
    setTimeout(() => view.current?.dispatch({ effects: flashLine.of(null) }), 1600);
    onJumped?.();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [jump]);

  /** A click below the text puts the caret at the end, on an empty line. */
  const focusEnd = (e: MouseEvent) => {
    const v = view.current;
    if (!v) return;
    e.preventDefault();
    const doc = v.state.doc, last = doc.line(doc.lines);
    if (last.text.trim()) v.dispatch({ changes: { from: doc.length, insert: '\n' }, selection: { anchor: doc.length + 1 }, scrollIntoView: true });
    else v.dispatch({ selection: { anchor: doc.length } });
    v.focus();
  };

  return (
    <div data-editor="" className="note-editor" style={{ color: 'var(--text)', fontFamily: UI, '--mono': MONO } as CSSProperties}>
      <div ref={host} />
      <div onMouseDown={focusEnd} style={{ height: 200, cursor: 'text' }} />
    </div>
  );
}
