/** Dates are handled as local-calendar ISO strings (YYYY-MM-DD). */

export const iso = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

export const todayIso = () => iso(new Date());

export const parseIso = (s: string) => {
  const [y, m, d] = s.split('-').map(Number);
  return new Date(y, m - 1, d);
};

/** Whole calendar days from `a` to `b` (positive when b is later). */
export const daysBetween = (a: string, b: string) =>
  Math.round((parseIso(b).getTime() - parseIso(a).getTime()) / 86400000);

export const fmt = (s: string, o: Intl.DateTimeFormatOptions) => parseIso(s).toLocaleDateString('en-US', o);

export const isoWeek = (s: string) => {
  const d = parseIso(s);
  const t = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
  const n = t.getUTCDay() || 7;
  t.setUTCDate(t.getUTCDate() + 4 - n);
  const y = new Date(Date.UTC(t.getUTCFullYear(), 0, 1));
  return Math.ceil(((t.getTime() - y.getTime()) / 86400000 + 1) / 7);
};

export const isIsoDate = (s: string) => /^\d{4}-\d{2}-\d{2}$/.test(s);
