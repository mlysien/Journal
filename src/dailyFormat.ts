/**
 * Daily note paths, configured like Obsidian's Daily notes plugin: a folder plus a date format
 * using moment.js tokens, where `/` in the format makes subfolders. `YYYY/MM/DD.MM.YYYY` puts
 * 16 Oct 2026 at `<folder>/2026/10/16.10.2026.md`.
 */
import { iso, parseIso } from './dates';

export interface DailyLocation { folder: string; format: string }

export const DEFAULT_DAILY: DailyLocation = { folder: 'Journal', format: 'YYYY/MM/DD.MM.YYYY' };

const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
const DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const TOKEN = /\[([^\]]*)\]|YYYY|YY|MMMM|MMM|MM|M|Do|DD|D|dddd|ddd/g;
const pad = (n: number) => String(n).padStart(2, '0');
const ordinal = (n: number) => n + (n % 100 >= 11 && n % 100 <= 13 ? 'th' : ['th', 'st', 'nd', 'rd'][n % 10] ?? 'th');
const escapeRe = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

export function formatDate(isoDate: string, format: string): string {
  const d = parseIso(isoDate), y = d.getFullYear(), m = d.getMonth(), day = d.getDate();
  return format.replace(TOKEN, (t, literal: string | undefined) => {
    if (literal !== undefined) return literal;
    switch (t) {
      case 'YYYY': return String(y);
      case 'YY': return String(y).slice(-2);
      case 'MMMM': return MONTHS[m];
      case 'MMM': return MONTHS[m].slice(0, 3);
      case 'MM': return pad(m + 1);
      case 'M': return String(m + 1);
      case 'Do': return ordinal(day);
      case 'DD': return pad(day);
      case 'D': return String(day);
      case 'dddd': return DAYS[d.getDay()];
      default: return DAYS[d.getDay()].slice(0, 3);
    }
  });
}

type Part = 'y' | 'y2' | 'mon' | 'm' | 'd' | null;

/** A regex for one stretch of a format, and which date part each capture group holds. */
function compile(format: string): { source: string; parts: Part[] } {
  const parts: Part[] = [];
  let source = '', last = 0, m: RegExpExecArray | null;
  TOKEN.lastIndex = 0;
  while ((m = TOKEN.exec(format))) {
    source += escapeRe(format.slice(last, m.index));
    last = TOKEN.lastIndex;
    const t = m[0];
    if (m[1] !== undefined) { source += escapeRe(m[1]); continue; }
    const [re, part]: [string, Part] =
      t === 'YYYY' ? ['(\\d{4})', 'y'] : t === 'YY' ? ['(\\d{2})', 'y2'] :
      t === 'MMMM' ? [`(${MONTHS.join('|')})`, 'mon'] : t === 'MMM' ? [`(${MONTHS.map(x => x.slice(0, 3)).join('|')})`, 'mon'] :
      t === 'MM' ? ['(\\d{2})', 'm'] : t === 'M' ? ['(\\d{1,2})', 'm'] :
      t === 'Do' ? ['(\\d{1,2})(?:st|nd|rd|th)', 'd'] : t === 'DD' ? ['(\\d{2})', 'd'] : t === 'D' ? ['(\\d{1,2})', 'd'] :
      t === 'dddd' ? [`(?:${DAYS.join('|')})`, null] : [`(?:${DAYS.map(x => x.slice(0, 3)).join('|')})`, null];
    source += re;
    if (part) parts.push(part);
  }
  return { source: source + escapeRe(format.slice(last)), parts };
}

/** The date a string written in `format` stands for, or null. */
export function parseDate(text: string, format: string): string | null {
  const { source, parts } = compile(format);
  const m = text.match(new RegExp(`^${source}$`, 'i'));
  if (!m) return null;
  let y: number | null = null, mo: number | null = null, d: number | null = null;
  parts.forEach((p, i) => {
    const v = m[i + 1];
    if (p === 'y') y = +v;
    else if (p === 'y2' && y == null) y = 2000 + +v;
    else if (p === 'mon') mo = MONTHS.findIndex(x => x.toLowerCase().startsWith(v.toLowerCase().slice(0, 3))) + 1;
    else if (p === 'm') mo = +v;
    else if (p === 'd') d = +v;
  });
  if (y == null || mo == null || d == null) return null;
  const date = iso(new Date(y, mo - 1, d));
  // Reject 31.02 and the like, and repeated tokens that disagree (2025/10/01.11.2025).
  return formatDate(date, format).toLowerCase() === text.toLowerCase() ? date : null;
}

/** Why a format can't name daily notes, or null if it can. */
export function formatProblem(format: string): string | null {
  if (!format.trim()) return 'Enter a format';
  if (/^\/|\/$|\/\//.test(format)) return 'The format can’t start or end with / or contain //';
  const { parts } = compile(format);
  if (!parts.some(p => p === 'y' || p === 'y2') || !parts.some(p => p === 'm' || p === 'mon') || !parts.includes('d')) return 'The format needs a year, a month and a day';
  if (/[\\:*?"<>|]/.test(format.replace(/\[[^\]]*\]/g, ''))) return 'The format contains characters not allowed in file names';
  return null;
}

export const normalizeFolder = (f: string) => f.trim().replace(/\\/g, '/').replace(/^\/+|\/+$/g, '').replace(/\/{2,}/g, '/');

export const dailyPath = (loc: DailyLocation, date: string) => (loc.folder ? loc.folder + '/' : '') + formatDate(date, loc.format) + '.md';

/** The date a vault path is the daily note for, or null. */
export function dailyDateOf(loc: DailyLocation, path: string): string | null {
  const prefix = loc.folder ? loc.folder + '/' : '';
  if (!path.startsWith(prefix) || !path.toLowerCase().endsWith('.md')) return null;
  return parseDate(path.slice(prefix.length, -3), loc.format);
}

/** True for folders that are part of the daily notes structure, like `Journal/2026` or `Journal/2026/10`. */
export function isDailyDir(loc: DailyLocation, dir: string): boolean {
  const prefix = loc.folder ? loc.folder + '/' : '';
  if (!dir.startsWith(prefix) || dir === loc.folder) return false;
  const segs = dir.slice(prefix.length).split('/'), fmtSegs = loc.format.split('/').slice(0, -1);
  if (!segs.length || segs.length > fmtSegs.length) return false;
  return segs.every((s, i) => new RegExp(`^${compile(fmtSegs[i]).source}$`, 'i').test(s));
}

/** The name a daily note's file has, as used in `[[links]]`: `16.10.2026` for the default format. */
export const dailyName = (loc: DailyLocation, date: string) => formatDate(date, loc.format).split('/').pop()!;

/** The date a `[[link]]` name points to, if it is a daily note's file name (or an ISO date). */
export function dateFromName(loc: DailyLocation, name: string): string | null {
  if (/^\d{4}-\d{2}-\d{2}$/.test(name)) return name;
  return parseDate(name, loc.format.split('/').pop()!);
}

/** Where the first version of this app kept daily notes; such files are moved on load. */
export const LEGACY_DAILY = /^Journal\/\d{4}-\d{2}\/(\d{4}-\d{2}-\d{2})\.md$/;
