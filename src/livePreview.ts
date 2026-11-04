/**
 * Live preview for the note editor, like Obsidian's: Markdown shows formatted, and the lines with
 * the caret or selection show their raw Markdown so they can be edited. Code blocks, tables and
 * whole-line images are drawn as blocks until the caret goes into them.
 */
import { StateEffect, StateField, type EditorState, type Extension, type Range } from '@codemirror/state';
import { Decoration, EditorView, WidgetType, type DecorationSet } from '@codemirror/view';
import { ensureSyntaxTree, syntaxTree } from '@codemirror/language';
import type { SyntaxNodeRef } from '@lezer/common';
import { codeToks, fileOf, hasScheme, inlineToks, isFileName } from './markdown';
import { isImage, vaultUrl } from './assets';
import { PRI, PRI_MARK, splitPriMark } from './vault';
import { playDone } from './sound';

/** What the preview needs from the app. Read at draw time, so it can change without a new editor. */
export interface PreviewCtx {
  /** Vault path of a referenced file, or null when there's no such file. */
  resolve(ref: string, wiki: boolean): string | null;
  openFile(rel: string): void;
  openNote(name: string): void;
  showPri: boolean;
  sound: boolean;
}

/** Redraw, for when something in the context changed (files added, settings). */
export const refresh = StateEffect.define<null>();
const setFocused = StateEffect.define<boolean>();
/** Flash a line, as when a search result is opened; null clears it. */
export const flashLine = StateEffect.define<number | null>();

const focused = StateField.define<boolean>({
  create: () => false,
  update(v, tr) { for (const e of tr.effects) if (e.is(setFocused)) v = e.value; return v; },
});

/** Highlights the line given by `flashLine`. */
export const flash = StateField.define<DecorationSet>({
  create: () => Decoration.none,
  update(v, tr) {
    for (const e of tr.effects) if (e.is(flashLine)) {
      const n = e.value;
      v = n != null && n <= tr.state.doc.lines ? Decoration.set([Decoration.line({ class: 'search-hit' }).range(tr.state.doc.line(n).from)]) : Decoration.none;
    }
    return v.map(tr.changes);
  },
  provide: f => EditorView.decorations.from(f),
});

/* ---------- widgets ---------- */

const el = <K extends keyof HTMLElementTagNameMap>(tag: K, cls?: string, text?: string) => {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (text != null) e.textContent = text;
  return e;
};
const svg = (html: string) => { const s = el('span'); s.innerHTML = html; return s.firstElementChild as SVGElement; };
const PAPERCLIP = '<svg width="13" height="13" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M13.2 7.6 8 12.8a3.4 3.4 0 0 1-4.8-4.8l5.6-5.6a2.27 2.27 0 0 1 3.2 3.2L6.4 11.2a1.13 1.13 0 0 1-1.6-1.6l4.9-4.9"/></svg>';
const EXTERNAL = '<svg width="13" height="13" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M9.5 2.5h4v4M13.5 2.5 7.5 8.5M12 9.5V12a1.5 1.5 0 0 1-1.5 1.5H4A1.5 1.5 0 0 1 2.5 12V5.5A1.5 1.5 0 0 1 4 4h2.5"/></svg>';
const TICK = '<svg width="10" height="10" viewBox="0 0 10 10" fill="none" stroke="var(--on-accent)" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M2.3 5.2l1.8 1.8 3.6-3.9"/></svg>';

/** CSS properties as a style attribute. */
const css = (style: Record<string, unknown>) =>
  Object.entries(style).map(([k, v]) => `${k.replace(/[A-Z]/g, c => '-' + c.toLowerCase())}:${typeof v === 'number' && k !== 'fontWeight' ? v + 'px' : v}`).join(';');

/** Put the caret at the start of a widget's text, which shows its Markdown. */
const editAt = (view: EditorView, dom: HTMLElement) => {
  const pos = view.posAtDOM(dom);
  view.dispatch({ selection: { anchor: pos } });
  view.focus();
};

const COPY = '<svg width="13" height="13" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round"><rect x="5.5" y="5.5" width="8" height="8" rx="1.5"/><path d="M10.5 5.5V4A1.5 1.5 0 0 0 9 2.5H4A1.5 1.5 0 0 0 2.5 4v5A1.5 1.5 0 0 0 4 10.5h1.5"/></svg>';
const COPIED = '<svg width="13" height="13" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M3.5 8.5l3 3 6-7"/></svg>';

/** Inline `code` with a copy button that shows on hover (and briefly after copying). */
function codeChip(text: string): HTMLElement {
  const chip = el('span', 'cm-icode code-chip', text);
  const btn = el('button', 'code-copy');
  btn.title = 'Copy'; btn.setAttribute('aria-label', 'Copy to clipboard');
  btn.append(svg(COPY));
  btn.addEventListener('mousedown', e => {
    e.preventDefault(); e.stopPropagation();
    window.journal.copyText(text).then(() => {
      chip.classList.add('copied'); btn.title = 'Copied'; btn.replaceChildren(svg(COPIED));
      setTimeout(() => { chip.classList.remove('copied'); btn.title = 'Copy'; btn.replaceChildren(svg(COPY)); }, 1200);
    }).catch(() => {});
  });
  chip.append(btn);
  return chip;
}

class CodeChipWidget extends WidgetType {
  constructor(readonly text: string) { super(); }
  eq(o: CodeChipWidget) { return o.text === this.text; }
  toDOM(view: EditorView) {
    const chip = codeChip(this.text);
    // Clicking the code itself edits it: the caret goes inside the backticks.
    chip.addEventListener('mousedown', e => {
      if (e.button !== 0) return;
      e.preventDefault();
      view.dispatch({ selection: { anchor: view.posAtDOM(chip) + 1 } });
      view.focus();
    });
    return chip;
  }
  ignoreEvent() { return true; }
}

class BulletWidget extends WidgetType {
  eq() { return true; }
  toDOM() { const s = el('span', 'cm-bullet'); s.append(el('span')); return s; }
}

class CheckboxWidget extends WidgetType {
  constructor(readonly checked: boolean, readonly ctx: PreviewCtx) { super(); }
  eq(o: CheckboxWidget) { return o.checked === this.checked; }
  toDOM(view: EditorView) {
    const box = el('span', 'cm-checkbox' + (this.checked ? ' checked' : ''));
    const inner = el('span');
    if (this.checked) inner.append(svg(TICK));
    box.append(inner);
    box.addEventListener('mousedown', e => {
      e.preventDefault();
      const line = view.state.doc.lineAt(view.posAtDOM(box));
      const m = line.text.match(/^(\s*[-*+] \[)([ xX])\]/);
      if (!m) return;
      if (!this.checked && this.ctx.sound) playDone();
      view.dispatch({ changes: { from: line.from + m[1].length, to: line.from + m[1].length + 1, insert: this.checked ? ' ' : 'x' } });
    });
    return box;
  }
  ignoreEvent() { return true; }
}

class PriWidget extends WidgetType {
  constructor(readonly pri: 'h' | 'm' | 'l') { super(); }
  eq(o: PriWidget) { return o.pri === this.pri; }
  toDOM() { const s = el('span', 'cm-pri'); s.style.background = PRI[this.pri].color; s.title = `${PRI[this.pri].label} priority`; return s; }
}

class HrWidget extends WidgetType {
  eq() { return true; }
  toDOM() { return el('span', 'cm-hr'); }
}

/** A file in the vault, with a paperclip; click opens it. */
class FileWidget extends WidgetType {
  constructor(readonly label: string, readonly rel: string | null, readonly target: string, readonly ctx: PreviewCtx) { super(); }
  eq(o: FileWidget) { return o.label === this.label && o.rel === this.rel; }
  toDOM() {
    const s = el('span', 'attachment' + (this.rel ? '' : ' missing'));
    s.title = this.rel ? `Open ${this.rel}` : `Not found in the vault: ${this.target}`;
    s.append(svg(PAPERCLIP), this.label);
    s.addEventListener('mousedown', e => { e.preventDefault(); e.stopPropagation(); if (this.rel) this.ctx.openFile(this.rel); });
    return s;
  }
  ignoreEvent() { return true; }
}

/** An image (or an embedded file) on a line of its own. */
class ImageWidget extends WidgetType {
  constructor(readonly name: string, readonly target: string, readonly rel: string | null, readonly ctx: PreviewCtx) { super(); }
  eq(o: ImageWidget) { return o.rel === this.rel && o.target === this.target && o.name === this.name; }
  toDOM(view: EditorView) {
    let dom: HTMLElement;
    if (this.rel && isImage(this.rel)) {
      dom = el('div', 'note-image');
      const img = el('img');
      img.src = vaultUrl(this.rel); img.alt = this.name; img.draggable = false;
      const open = el('button', 'image-open');
      open.append(svg(EXTERNAL), 'Open');
      open.addEventListener('mousedown', e => { e.preventDefault(); e.stopPropagation(); this.ctx.openFile(this.rel!); });
      dom.append(img, open);
    } else if (this.rel) {
      dom = el('div', 'cm-block-line');
      dom.append(new FileWidget(this.name.split('/').pop()!, this.rel, this.target, this.ctx).toDOM());
    } else {
      dom = el('div', 'cm-missing');
      dom.append(el('span', 'cm-missing-name', this.target), el('span', 'cm-missing-note', 'This file isn’t in the vault.'));
    }
    dom.addEventListener('mousedown', e => { if (e.button === 0) { e.preventDefault(); editAt(view, dom); } });
    return dom;
  }
  ignoreEvent() { return true; }
}

class CodeWidget extends WidgetType {
  constructor(readonly lang: string, readonly body: string[]) { super(); }
  eq(o: CodeWidget) { return o.lang === this.lang && o.body.join('\n') === this.body.join('\n'); }
  toDOM(view: EditorView) {
    const dom = el('div', 'cm-codewidget');
    const head = el('div', 'cm-codewidget-head');
    const copy = el('button', 'hov-text', 'Copy');
    copy.addEventListener('mousedown', e => {
      e.preventDefault(); e.stopPropagation();
      window.journal.copyText(this.body.join('\n')).catch(() => {});
      copy.textContent = 'Copied';
      setTimeout(() => { copy.textContent = 'Copy'; }, 1400);
    });
    head.append(el('span', '', this.lang === 'text' ? '' : this.lang), copy);
    const body = el('div', 'cm-codewidget-body');
    for (const ln of this.body) {
      const row = el('div');
      for (const t of codeToks(ln, this.lang)) { const s = el('span', '', t.text); s.style.cssText = css(t.style as Record<string, unknown>); row.append(s); }
      if (!ln) row.append('​');
      body.append(row);
    }
    dom.append(head, body);
    dom.addEventListener('mousedown', e => { if (e.button === 0) { e.preventDefault(); editAt(view, dom); } });
    return dom;
  }
  ignoreEvent() { return true; }
}

/** Inline Markdown as DOM, for table cells. */
function inlineDom(text: string, ctx: PreviewCtx): Node[] {
  return inlineToks(text).map(tk => {
    if (tk.attachment) return new FileWidget(tk.text, ctx.resolve(tk.attachment, !!tk.wiki), tk.attachment, ctx).toDOM();
    if (tk.code) return codeChip(tk.text);
    const s = el('span', '', tk.text);
    s.style.cssText = css(tk.style as Record<string, unknown>);
    if (tk.href) s.dataset.href = tk.href;
    if (tk.link) s.dataset.note = tk.link;
    return s;
  });
}

class TableWidget extends WidgetType {
  constructor(readonly src: string, readonly ctx: PreviewCtx) { super(); }
  eq(o: TableWidget) { return o.src === this.src; }
  toDOM(view: EditorView) {
    const rows = this.src.split('\n')
      .filter(l => l.trim() && !/^\|?[\s:|-]+\|?$/.test(l.trim()))
      .map(l => l.trim().replace(/^\|/, '').replace(/\|$/, '').split('|').map(c => c.trim()));
    const n = Math.max(...rows.map(r => r.length));
    const numeric = Array.from({ length: n }, (_, c) => rows.slice(1).every(r => /^[\d.,\s]+(s|ms|%)?$/.test(r[c] || '')));
    const dom = el('div', 'cm-table');
    rows.forEach((r, ri) => {
      const row = el('div', ri === 0 ? 'cm-table-row head' : 'cm-table-row');
      row.style.gridTemplateColumns = `repeat(${n}, minmax(0,1fr))`;
      for (let c = 0; c < n; c++) {
        const cell = el('div');
        if (numeric[c] && c > 0) cell.style.textAlign = 'right';
        cell.append(...inlineDom(r[c] || '', this.ctx));
        row.append(cell);
      }
      dom.append(row);
    });
    dom.addEventListener('mousedown', e => {
      if (e.button !== 0 || (e.target as HTMLElement).closest('[data-href],[data-note],.attachment')) return;
      e.preventDefault(); editAt(view, dom);
    });
    return dom;
  }
  ignoreEvent() { return true; }
}

/* ---------- decorations ---------- */

const hide = Decoration.replace({});
const line = (cls: string) => Decoration.line({ class: cls });
const mark = (cls: string, attrs?: Record<string, string>) => Decoration.mark({ class: cls, attributes: attrs });

/** `[[x]]`, `![[x]]`, `[[x|shown]]`, `[[x#heading]]`. */
const WIKI = /(!?)\[\[([^\]]+)\]\]/g;
const WHOLE_IMAGE = /^\s*(?:!\[\[([^\]]+)\]\]|!\[([^\]]*)\]\(([^)\s]+)\))\s*$/;

function build(state: EditorState, ctx: PreviewCtx): DecorationSet {
  const doc = state.doc, out: Range<Decoration>[] = [];
  const isFocused = state.field(focused);
  const ranges = state.selection.ranges;
  /** The caret or selection is on these characters. */
  const touches = (from: number, to: number) => isFocused && ranges.some(r => r.from <= to && r.to >= from);
  const lineShown = new Map<number, boolean>();
  /** Lines with the caret or selection show their Markdown. */
  const raw = (pos: number) => {
    const l = doc.lineAt(pos);
    let v = lineShown.get(l.number);
    if (v === undefined) lineShown.set(l.number, (v = touches(l.from, l.to)));
    return v;
  };
  const add = (from: number, to: number, d: Decoration) => { if (from < to || (d.spec.widget && from <= to)) out.push(d.range(from, to)); };
  const tree = ensureSyntaxTree(state, doc.length, 200) ?? syntaxTree(state);

  /** Ranges drawn as one block or widget; nothing else goes inside them. */
  const taken: [number, number][] = [];
  const overlapsTaken = (from: number, to: number) => taken.some(([a, b]) => from < b && to > a);
  /** Inside one of those ranges (the document and the like contain them, and are fine). */
  const inTaken = (from: number, to: number) => taken.some(([a, b]) => from >= a && to <= b);

  const inFence = (pos: number) => {
    for (let n: ReturnType<typeof tree.resolveInner> | null = tree.resolveInner(pos, 1); n; n = n.parent) if (n.name === 'FencedCode') return true;
    return false;
  };

  // Tables: lines starting with `|`, kept together like the vault keeps them (see splitBlocks).
  for (let n = 1; n <= doc.lines; n++) {
    if (!doc.line(n).text.startsWith('|') || inFence(doc.line(n).from)) continue;
    const first = doc.line(n);
    while (n < doc.lines && doc.line(n + 1).text.startsWith('|')) n++;
    const last = doc.line(n);
    taken.push([first.from, last.to]);
    if (!touches(first.from, last.to)) out.push(Decoration.replace({ widget: new TableWidget(doc.sliceString(first.from, last.to), ctx), block: true }).range(first.from, last.to));
    else for (let k = first.number; k <= last.number; k++) out.push(line('cm-tableline').range(doc.line(k).from));
  }

  // Whole-line images and embedded files.
  for (let n = 1; n <= doc.lines; n++) {
    const l = doc.line(n), m = l.text.match(WHOLE_IMAGE);
    if (!m || inFence(l.from)) continue;
    const wiki = m[1] != null, target = (wiki ? m[1].split('|')[0] : m[3]).trim();
    if (!wiki && hasScheme(target)) continue;
    taken.push([l.from, l.to]);
    if (raw(l.from)) continue;
    const name = wiki ? target : m[2] || fileOf(target);
    out.push(Decoration.replace({ widget: new ImageWidget(name, target, ctx.resolve(target, wiki), ctx), block: true }).range(l.from, l.to));
  }

  // Wiki links, which CommonMark doesn't know.
  const wikis: [number, number][] = [];
  for (let n = 1; n <= doc.lines; n++) {
    const l = doc.line(n);
    if (!l.text.includes('[[')) continue;
    for (const m of l.text.matchAll(WIKI)) {
      const from = l.from + m.index!, to = from + m[0].length;
      if (overlapsTaken(from, to) || /Code/.test(tree.resolveInner(from, 1).name)) continue;
      wikis.push([from, to]);
      const [target, alias] = m[2].split('|'), t = target.trim();
      if (isFileName(t)) {
        if (raw(from)) add(from, to, mark('cm-link-raw'));
        else add(from, to, Decoration.replace({ widget: new FileWidget(alias?.trim() || fileOf(t), ctx.resolve(t, true), t, ctx) }));
        continue;
      }
      const note = t.split('#')[0].trim();
      if (raw(from)) { add(from, to, mark('cm-wikilink', { 'data-note': note })); continue; }
      const shownFrom = alias !== undefined ? from + m[1].length + 2 + target.length + 1 : from + m[1].length + 2;
      add(from, shownFrom, hide);
      add(shownFrom, to - 2, mark('cm-wikilink', { 'data-note': note }));
      add(to - 2, to, hide);
    }
  }
  const inWiki = (from: number, to: number) => wikis.some(([a, b]) => from < b && to > a);

  const child = (node: SyntaxNodeRef, name: string) => node.node.getChild(name);
  const children = (node: SyntaxNodeRef, name: string) => node.node.getChildren(name);
  /** Hide a marker, with the space after it. */
  const hideMark = (from: number, to: number) => add(from, doc.sliceString(to, to + 1) === ' ' ? to + 1 : to, hide);

  tree.iterate({
    enter(node) {
      const { name, from, to } = node;
      if (inTaken(from, to)) return false;
      if (name === 'FencedCode') {
        const first = doc.lineAt(from), last = doc.lineAt(to);
        taken.push([first.from, last.to]);
        const lines: string[] = [];
        for (let n = first.number; n <= last.number; n++) lines.push(doc.line(n).text);
        const lang = lines[0].replace(/^\s*`{3,}/, '').trim() || 'text';
        const closed = lines.length > 1 && /^\s*`{3,}\s*$/.test(lines[lines.length - 1]);
        const body = lines.slice(1, closed ? -1 : undefined);
        if (!touches(first.from, last.to)) {
          out.push(Decoration.replace({ widget: new CodeWidget(lang, body), block: true }).range(first.from, last.to));
          return false;
        }
        for (let n = first.number; n <= last.number; n++) {
          const l = doc.line(n);
          out.push(line('cm-codeline' + (n === first.number ? ' first' : '') + (n === last.number ? ' last' : '')).range(l.from));
          if (n === first.number || (closed && n === last.number)) { add(l.from, l.to, mark('cm-fence')); continue; }
          let p = l.from;
          for (const t of codeToks(l.text, lang)) {
            if (t.color) add(p, p + t.text.length, Decoration.mark({ attributes: { style: css(t.style as Record<string, unknown>) } }));
            p += t.text.length;
          }
        }
        return false;
      }
      const h = name.match(/^ATXHeading(\d)$/);
      if (h) {
        out.push(line('cm-h' + Math.min(3, +h[1])).range(doc.lineAt(from).from));
        if (!raw(from)) for (const m of children(node, 'HeaderMark')) hideMark(m.from, m.to);
        return;
      }
      if (name === 'Blockquote') {
        // Only lines starting with `>`: a line after a quote is its own line here, as in the vault.
        for (let n = doc.lineAt(from).number; n <= doc.lineAt(to).number; n++) if (/^\s*>/.test(doc.line(n).text)) out.push(line('cm-quote').range(doc.line(n).from));
        return;
      }
      if (name === 'QuoteMark') { if (!raw(from)) hideMark(from, to); return; }
      if (name === 'ListItem') {
        const lm = child(node, 'ListMark'), task = child(node, 'Task');
        if (!lm) return;
        const tm = task?.getChild('TaskMarker');
        if (tm) {
          const checked = /x/i.test(doc.sliceString(tm.from, tm.to));
          const end = doc.sliceString(tm.to, tm.to + 1) === ' ' ? tm.to + 1 : tm.to;
          const l = doc.lineAt(from);
          if (checked) out.push(line('cm-done').range(l.from));
          if (!touches(lm.from, tm.to)) add(lm.from, end, Decoration.replace({ widget: new CheckboxWidget(checked, ctx) }));
          // `!high` / `!low` at the end of the item: a coloured dot, or nothing.
          const pm = l.text.match(PRI_MARK);
          if (pm && !raw(from)) {
            const pri = splitPriMark(l.text).pri;
            add(l.from + pm.index!, l.to, ctx.showPri && pri && pri !== 'm' ? Decoration.replace({ widget: new PriWidget(pri) }) : hide);
          }
        } else if (node.node.parent?.name === 'BulletList' && !raw(from) && doc.sliceString(lm.to, lm.to + 1) === ' ') {
          add(lm.from, lm.to + 1, Decoration.replace({ widget: new BulletWidget() }));
        }
        return;
      }
      if (name === 'HorizontalRule') {
        if (!raw(from)) add(from, to, Decoration.replace({ widget: new HrWidget() }));
        return false;
      }
      if (name === 'InlineCode') {
        // Drawn as a chip with a copy button; on the line being edited, as styled Markdown.
        if (raw(from)) { add(from, to, mark('cm-icode')); return false; }
        const marks = children(node, 'CodeMark');
        const text = marks.length >= 2 ? doc.sliceString(marks[0].to, marks[marks.length - 1].from) : doc.sliceString(from, to);
        add(from, to, Decoration.replace({ widget: new CodeChipWidget(text.trim() ? text.replace(/^ (.*) $/, '$1') : text) }));
        return false;
      }
      if (name === 'Emphasis' || name === 'StrongEmphasis' || name === 'Strikethrough') {
        add(from, to, mark({ Emphasis: 'cm-em', StrongEmphasis: 'cm-strong', Strikethrough: 'cm-strike' }[name]));
        if (!raw(from)) for (const m of children(node, name === 'Strikethrough' ? 'StrikethroughMark' : 'EmphasisMark')) add(m.from, m.to, hide);
        return;
      }
      if (name === 'Link' || name === 'Image') {
        if (inWiki(from, to)) return false;
        const marks = children(node, 'LinkMark'), url = child(node, 'URL');
        if (!url || marks.length < 2) return false;
        const href = doc.sliceString(url.from, url.to), textFrom = marks[0].to, textTo = marks[1].from;
        const label = doc.sliceString(textFrom, textTo);
        if (!hasScheme(href)) {
          // A file in the vault, or an inline image.
          if (raw(from)) { add(from, to, mark('cm-link-raw')); return false; }
          const rel = ctx.resolve(href, false);
          add(from, to, Decoration.replace({ widget: new FileWidget(label || fileOf(href), rel, href, ctx) }));
          return false;
        }
        if (raw(from)) {
          add(textFrom, textTo, mark('cm-link', { 'data-href': href }));
          add(textTo, to, mark('cm-url'));
          return false;
        }
        add(from, textFrom, hide);
        add(textFrom, textTo, mark('cm-link', { 'data-href': href, title: href }));
        add(textTo, to, hide);
        return false;
      }
      if (name === 'URL' || name === 'Autolink') {
        if (inWiki(from, to)) return false;
        const u = name === 'URL' ? node : child(node, 'URL');
        if (!u) return false;
        const href = doc.sliceString(u.from, u.to);
        add(u.from, u.to, mark('cm-link', { 'data-href': href }));
        if (name === 'Autolink' && !raw(from)) { add(from, u.from, hide); add(u.to, to, hide); }
        return false;
      }
    },
  });

  return Decoration.set(out, true);
}

/** The live preview extension, drawing with `ctx` (read each time it draws). */
export function livePreview(ctx: { current: PreviewCtx }): Extension {
  const field = StateField.define<DecorationSet>({
    create: s => build(s, ctx.current),
    update(deco, tr) {
      if (tr.docChanged || tr.selection || tr.effects.length || syntaxTree(tr.state) !== syntaxTree(tr.startState)) return build(tr.state, ctx.current);
      return deco;
    },
    provide: f => EditorView.decorations.from(f),
  });
  return [
    focused, field,
    EditorView.focusChangeEffect.of((_, on) => setFocused.of(on)),
  ];
}
