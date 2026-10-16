import type { CSSProperties } from 'react';
import { MONO } from './theme';

/**
 * A note is stored as a list of blocks. Most blocks are a single Markdown line;
 * fenced code and tables are kept together as one multi-line block so they can
 * be rendered (and edited) as a unit.
 */

export type Block =
  | { type: 'code'; lang: string; body: string[] }
  | { type: 'table'; rows: string[][] }
  /** A whole-line image: `![[name.png]]` (Obsidian, found by name) or `![alt](path)` (relative path in `src`). */
  | { type: 'image'; name: string; src?: string }
  | { type: 'h1' | 'h2' | 'h3'; text: string }
  | { type: 'task'; checked: boolean; text: string; indent: number }
  | { type: 'li'; text: string; indent: number }
  | { type: 'quote'; text: string }
  | { type: 'hr' }
  | { type: 'empty' }
  | { type: 'p'; text: string };

/** `https:`, `mailto:` and the like; links without one point at files in the vault. */
const hasScheme = (href: string) => /^[a-z][a-z0-9+.-]*:/i.test(href) || href.startsWith('#');
const fileOf = (href: string) => { const f = href.split('/').pop() ?? href; try { return decodeURIComponent(f); } catch { return f; } };
/** `[[x]]` names a file rather than a note when it has an extension other than .md. */
const isFileName = (name: string) => /\.[a-z0-9]{1,6}$/i.test(name) && !/\.md$/i.test(name);

export function parseBlock(src: string): Block {
  if (src.startsWith('```')) {
    const L = src.split('\n');
    const lang = L[0].slice(3).trim() || 'text';
    let body = L.slice(1);
    if (body.length && body[body.length - 1].trim() === '```') body = body.slice(0, -1);
    return { type: 'code', lang, body };
  }
  if (src.startsWith('|')) {
    const rows = src.split('\n')
      .filter(l => l.trim() && !/^\|?[\s:|-]+\|?$/.test(l.trim()))
      .map(l => l.trim().replace(/^\|/, '').replace(/\|$/, '').split('|').map(c => c.trim()));
    return { type: 'table', rows };
  }
  let m: RegExpMatchArray | null;
  if ((m = src.match(/^!\[\[(.+)\]\]\s*$/))) return { type: 'image', name: m[1] };
  if ((m = src.match(/^!\[([^\]]*)\]\(([^)\s]+)\)\s*$/)) && !hasScheme(m[2])) return { type: 'image', name: m[1] || fileOf(m[2]), src: m[2] };
  if ((m = src.match(/^(#{1,3})\s+(.*)$/))) return { type: `h${m[1].length}` as 'h1' | 'h2' | 'h3', text: m[2] };
  if ((m = src.match(/^(\s*)- \[([ xX])\]\s?(.*)$/))) return { type: 'task', checked: m[2] !== ' ', text: m[3], indent: m[1].length };
  if ((m = src.match(/^(\s*)[-*]\s(.*)$/))) return { type: 'li', text: m[2], indent: m[1].length };
  if ((m = src.match(/^>\s?(.*)$/))) return { type: 'quote', text: m[1] };
  if (/^(---|\*\*\*)\s*$/.test(src)) return { type: 'hr' };
  if (src.trim() === '') return { type: 'empty' };
  return { type: 'p', text: src };
}

/** Split raw Markdown text into blocks, keeping fences and tables together. */
export function splitBlocks(text: string): string[] {
  const lines = text.replace(/\r\n?/g, '\n').split('\n');
  const out: string[] = [];
  for (let i = 0; i < lines.length; i++) {
    const l = lines[i];
    if (l.startsWith('```')) {
      const buf = [l];
      while (++i < lines.length) { buf.push(lines[i]); if (lines[i].trim() === '```') break; }
      out.push(buf.join('\n'));
    } else if (l.startsWith('|')) {
      const buf = [l];
      while (i + 1 < lines.length && lines[i + 1].startsWith('|')) buf.push(lines[++i]);
      out.push(buf.join('\n'));
    } else out.push(l);
  }
  return out.length ? out : [''];
}

export interface InlineTok {
  key: number;
  text: string;
  style: CSSProperties;
  link?: string;
  /** Inline `code`, which gets a copy button. */
  code?: boolean;
  /** A file in the vault: a relative path, or a name when `wiki` (from `[[name]]`). */
  attachment?: string;
  wiki?: boolean;
  href?: string;
}

const LINK: CSSProperties = { color: 'var(--accent)', textDecoration: 'underline', textDecorationColor: 'var(--accent-soft)', textUnderlineOffset: 3, cursor: 'pointer' };

export function inlineToks(src: string): InlineTok[] {
  const re = /(`[^`]+`)|(\*\*[^*]+\*\*)|(\*[^*\s][^*]*\*)|(!?\[\[[^\]]+\]\])|(!?\[(?:\\.|[^\]\\])*\]\([^)\s]+\))|<(https?:\/\/[^\s>]+)>|(https?:\/\/[^\s<>()]*[^\s<>().,;:!?'"])/g;
  const out: InlineTok[] = [];
  let last = 0, k = 0, m: RegExpExecArray | null;
  const push = (text: string, style: CSSProperties = {}, extra: Partial<InlineTok> = {}) =>
    out.push({ key: k++, text, style, ...extra });
  while ((m = re.exec(src))) {
    if (m.index > last) push(src.slice(last, m.index));
    const s = m[0];
    if (m[1]) push(s.slice(1, -1), { fontFamily: MONO, fontSize: '0.84em', background: 'var(--code)', border: '1px solid var(--border)', borderRadius: 4, padding: '1px 5px' }, { code: true });
    else if (m[2]) push(s.slice(2, -2), { fontWeight: 600 });
    else if (m[3]) push(s.slice(1, -1), { fontStyle: 'italic' });
    else if (m[4]) {
      // Obsidian style: [[Note|shown text]] shows the alias; [[Note#Heading]] links to the note.
      const [target, alias] = s.replace(/^!/, '').slice(2, -2).split('|');
      if (isFileName(target.trim())) push(alias?.trim() || fileOf(target.trim()), {}, { attachment: target.trim(), wiki: true });
      else push(alias?.trim() || target, { color: 'var(--accent)', cursor: 'pointer', borderBottom: '1px solid var(--accent-soft)' }, { link: target.split('#')[0].trim() });
    }
    else if (m[5]) {
      const mm = s.replace(/^!/, '').match(/^\[((?:\\.|[^\]\\])*)\]\(([^)\s]+)\)$/)!;
      const label = mm[1].replace(/\\([[\]])/g, '$1');
      if (!hasScheme(mm[2])) push(label || fileOf(mm[2]), {}, { attachment: mm[2] });
      else push(label || mm[2], LINK, { href: mm[2] });
    } else push(m[6] ?? m[7], LINK, { href: m[6] ?? m[7] });
    last = re.lastIndex;
  }
  if (last < src.length) push(src.slice(last));
  if (!out.length) push(' ');
  return out;
}

export interface CodeTok { key: number; text: string; color?: string; style: CSSProperties }

const KW = new Set('const let var function return if else for while do new import from export default async await type interface class extends implements of in try catch finally throw true false null undefined this typeof as'.split(' '));

export function codeToks(line: string, lang: string): CodeTok[] {
  const out: CodeTok[] = [];
  let k = 0, first = true;
  const add = (text: string, color?: string, extra?: CSSProperties) => {
    const last = out[out.length - 1];
    if (!color && last && !last.color) { last.text += text; return; }
    out.push({ key: k++, text, color, style: color ? { color, ...extra } : {} });
  };
  const bash = lang === 'bash' || lang === 'sh';
  const re = new RegExp(
    (bash ? '(#.*$)' : '(\\/\\/.*$)') +
    '|(\'(?:[^\'\\\\]|\\\\.)*\'|"(?:[^"\\\\]|\\\\.)*"|`[^`]*`)|(\\b\\d+(?:\\.\\d+)?\\b)|' +
    (bash ? '(--?[a-zA-Z][\\w-]*)' : '((?!x)x)') +
    '|([A-Za-z_$][\\w$]*)|(\\s+|.)', 'g');
  let m: RegExpExecArray | null;
  while ((m = re.exec(line))) {
    const s = m[0];
    if (m[1]) add(s, 'var(--com)', { fontStyle: 'italic' });
    else if (m[2]) add(s, lang === 'json' && /^\s*:/.test(line.slice(re.lastIndex)) ? 'var(--fn)' : 'var(--str)');
    else if (m[3]) add(s, 'var(--num)');
    else if (m[4]) add(s, 'var(--type)');
    else if (m[5]) {
      if (KW.has(s)) add(s, 'var(--kw)');
      else if (bash && first) add(s, 'var(--fn)');
      else if (/^\s*\(/.test(line.slice(re.lastIndex))) add(s, 'var(--fn)');
      else if (/^[A-Z]/.test(s)) add(s, 'var(--type)');
      else add(s);
      first = false;
    } else add(s);
  }
  return out;
}

export const wordsOf = (L: string[]) =>
  L.join(' ').replace(/[#*`>\-[\]|]/g, ' ').split(/\s+/).filter(Boolean).length;
