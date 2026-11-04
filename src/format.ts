/** Markdown formatting shortcuts for the line being edited. */

export type FormatId = 'bold' | 'italic' | 'strike' | 'code' | 'link' | 'h1' | 'h2' | 'h3' | 'para' | 'bullet' | 'task' | 'quote' | 'check';

/** The shortcuts, with `key` as keyName() writes it, for help text and the README. */
export const FORMATS: { id: FormatId; label: string; key: string }[] = [
  { id: 'bold', label: 'Bold', key: 'Ctrl+B' },
  { id: 'italic', label: 'Italic', key: 'Ctrl+I' },
  { id: 'strike', label: 'Strikethrough', key: 'Ctrl+Shift+X' },
  { id: 'code', label: 'Inline code', key: 'Ctrl+E' },
  { id: 'link', label: 'Link', key: 'Ctrl+Shift+K' },
  { id: 'h1', label: 'Heading 1', key: 'Ctrl+1' },
  { id: 'h2', label: 'Heading 2', key: 'Ctrl+2' },
  { id: 'h3', label: 'Heading 3', key: 'Ctrl+3' },
  { id: 'para', label: 'Plain text', key: 'Ctrl+0' },
  { id: 'bullet', label: 'Bullet list', key: 'Ctrl+Shift+8' },
  { id: 'task', label: 'Checklist', key: 'Ctrl+Shift+9' },
  { id: 'quote', label: 'Quote', key: 'Ctrl+Shift+.' },
  { id: 'check', label: 'Check or uncheck', key: 'Ctrl+Enter' },
];

/**
 * The formatting a key event asks for. Keys are matched by their physical position, so they
 * work with any keyboard layout; AltGr (Ctrl+Alt on Windows) never counts.
 */
export function formatOf(e: { code: string; key: string; ctrlKey: boolean; metaKey: boolean; altKey: boolean; shiftKey: boolean }): FormatId | null {
  if (!(e.ctrlKey || e.metaKey) || e.altKey) return null;
  const code = e.code;
  if (!e.shiftKey) {
    if (code === 'KeyB') return 'bold';
    if (code === 'KeyI') return 'italic';
    if (code === 'KeyE') return 'code';
    if (code === 'Digit1') return 'h1';
    if (code === 'Digit2') return 'h2';
    if (code === 'Digit3') return 'h3';
    if (code === 'Digit0') return 'para';
    if (e.key === 'Enter') return 'check';
    return null;
  }
  if (code === 'KeyX') return 'strike';
  if (code === 'KeyK') return 'link';
  if (code === 'Digit8') return 'bullet';
  if (code === 'Digit9') return 'task';
  if (code === 'Period') return 'quote';
  return null;
}

export type InlineFormat = 'bold' | 'italic' | 'strike' | 'code' | 'link';
export const isInline = (id: FormatId): id is InlineFormat => id === 'bold' || id === 'italic' || id === 'strike' || id === 'code' || id === 'link';

/** An edit of a text box: replace `from`–`to` with `text`, then select `selStart`–`selEnd`. */
export interface TextEdit { from: number; to: number; text: string; selStart: number; selEnd: number }

const MARK: Record<'bold' | 'italic' | 'strike' | 'code', string> = { bold: '**', italic: '*', strike: '~~', code: '`' };

/**
 * Wrap the selection in Markdown markers, or unwrap it when it's already wrapped. With nothing
 * selected, the word at the caret is used; outside a word, empty markers go in with the caret
 * between them. A link puts the caret where the URL goes.
 */
export function inlineEdit(value: string, start: number, end: number, id: InlineFormat): TextEdit {
  // Keep spaces at the edges of the selection (a double-clicked word, say) out of the markers.
  while (start < end && /\s/.test(value[start])) start++;
  while (end > start && /\s/.test(value[end - 1])) end--;
  if (start === end) {
    const before = value.slice(0, start).match(/[\p{L}\p{N}_]*$/u)![0], after = value.slice(end).match(/^[\p{L}\p{N}_]*/u)![0];
    // Unwrap empty markers the caret is between (`**|**`) instead of adding more.
    if (id !== 'link' && !before && !after) {
      const m = MARK[id];
      if (value.slice(start - m.length, start) === m && value.slice(start, start + m.length) === m && !(id === 'italic' && value.slice(start - 2, start + 2) === '****'))
        return { from: start - m.length, to: start + m.length, text: '', selStart: start - m.length, selEnd: start - m.length };
    }
    if (before || after) { start -= before.length; end += after.length; }
  }
  const sel = value.slice(start, end);

  if (id === 'link') {
    if (!sel) return { from: start, to: end, text: '[]()', selStart: start + 1, selEnd: start + 1 };
    if (/^(https?:\/\/|mailto:)\S+$/i.test(sel)) return { from: start, to: end, text: `[](${sel})`, selStart: start + 1, selEnd: start + 1 };
    return { from: start, to: end, text: `[${sel}]()`, selStart: start + sel.length + 3, selEnd: start + sel.length + 3 };
  }

  const m = MARK[id];
  if (id === 'bold' || id === 'italic') {
    // `***x***` is bold and italic: count the asterisks on each side to tell which is which.
    const outBefore = value.slice(0, start).match(/\*{0,3}$/)![0].length, outAfter = value.slice(end).match(/^\*{0,3}/)![0].length;
    const inBefore = sel.match(/^\*{0,3}/)![0].length, inAfter = sel.match(/\*{0,3}$/)![0].length;
    const has = (n: number) => (id === 'bold' ? n >= 2 : n === 1 || n === 3);
    const out = Math.min(outBefore, outAfter), inn = sel.length > 2 * Math.min(inBefore, inAfter) ? Math.min(inBefore, inAfter) : 0;
    if (has(out)) return unwrap(start - m.length, end + m.length, sel, start - m.length);
    if (has(inn)) { const inner = sel.slice(m.length, sel.length - m.length); return unwrap(start, end, inner, start); }
  } else {
    if (value.slice(start - m.length, start) === m && value.slice(end, end + m.length) === m) return unwrap(start - m.length, end + m.length, sel, start - m.length);
    if (sel.length > 2 * m.length && sel.startsWith(m) && sel.endsWith(m)) return unwrap(start, end, sel.slice(m.length, -m.length), start);
  }
  return { from: start, to: end, text: m + sel + m, selStart: start + m.length, selEnd: start + m.length + sel.length };
}

const unwrap = (from: number, to: number, inner: string, at: number): TextEdit =>
  ({ from, to, text: inner, selStart: at, selEnd: at + inner.length });

/** A line split into its indent, its prefix (`# `, `- `, `- [ ] `, `> `) and the rest. */
const PREFIX = /^(\s*)(#{1,3} |- \[[ xX]\] ?|[-*] |> ?)?/;

export type LineFormat = 'h1' | 'h2' | 'h3' | 'para' | 'bullet' | 'task' | 'quote' | 'check';

/** Whether the line already is that kind of line. */
export function isKind(line: string, id: LineFormat): boolean {
  const prefix = line.match(PREFIX)![2] ?? '';
  switch (id) {
    case 'para': return !prefix;
    case 'check': return /^- \[[xX]\]/.test(prefix);
    case 'task': return /^- \[/.test(prefix);
    case 'bullet': return /^[-*] $/.test(prefix);
    case 'quote': return prefix.startsWith('>');
    default: return prefix === { h1: '# ', h2: '## ', h3: '### ' }[id];
  }
}

/**
 * Change what kind of line this is: a heading, a bullet, a checklist item, a quote or plain text;
 * `check` checks or unchecks a checklist item. `on` says whether to make it that kind or plain
 * text, and toggles by default. Returns the new line, how far the text after the prefix moved
 * (so the caret can move with it) and where that text now starts; null when nothing changes.
 */
export function lineEdit(line: string, id: LineFormat, on = !isKind(line, id)): { line: string; shift: number; at: number } | null {
  const m = line.match(PREFIX)!, indent = m[1], prefix = m[2] ?? '', rest = line.slice(m[0].length), old = m[0].length;
  let next: string, keep = '';
  if (id === 'check') {
    if (!/^- \[/.test(prefix)) return null;
    next = on ? '- [x] ' : '- [ ] ';
    keep = indent;
  } else {
    next = on ? { h1: '# ', h2: '## ', h3: '### ', para: '', bullet: '- ', task: '- [ ] ', quote: '> ' }[id] : '';
    // Lists keep their indent; everything else starts at the edge.
    if (next === '- ' || next === '- [ ] ') keep = indent;
  }
  const out = keep + next + rest;
  if (out === line) return null;
  return { line: out, shift: keep.length + next.length - old, at: keep.length + next.length };
}
