import type { CSSProperties } from 'react';

/** The colours in use. */
export type Theme = 'dark' | 'light';
/** The setting: a theme, or `system` to follow the OS. */
export type ThemePref = 'system' | Theme;
export type Accent = 'violet' | 'teal' | 'amber';

/** Hue of each accent, plus a lightness/chroma tweak so all three read equally strong. */
const ACCENTS: Record<Accent, { hue: number; dL: number; dC: number }> = {
  violet: { hue: 285, dL: 0, dC: 0 },
  teal: { hue: 190, dL: 0, dC: -0.005 },
  amber: { hue: 70, dL: 0.02, dC: 0.02 },
};
export const isAccent = (a: unknown): a is Accent => typeof a === 'string' && a in ACCENTS;

// Windows renders its own hinted fonts much more crisply than web fonts, so it gets Segoe UI and
// Cascadia (as Obsidian and VS Code do); elsewhere the bundled Geist and JetBrains Mono are used.
// Cascadia Code, not Cascadia Mono: only Code has the programming ligatures. Where it isn't
// installed, the bundled JetBrains Mono (which has them too) comes before Consolas.
const WIN = typeof window !== 'undefined' && window.journal?.platform === 'win32';
export const UI = WIN
  ? "'Segoe UI Variable Text', 'Segoe UI', system-ui, sans-serif"
  : "'Geist Sans', ui-sans-serif, system-ui, sans-serif";
export const MONO = WIN
  ? "'Cascadia Code', 'JetBrains Mono', Consolas, ui-monospace, monospace"
  : "'JetBrains Mono', ui-monospace, SFMono-Regular, monospace";

/**
 * The type scale, in whole pixels (fractional sizes render unevenly on Windows). Modelled on
 * Obsidian and the Windows 11 type ramp: 13px interface, 16px note text.
 */
export const FS = {
  /** Keyboard hints, file paths, tiny labels. */
  xs: 11,
  /** Counts, dates, captions, the status bar. */
  sm: 12,
  /** Sidebar, tabs, buttons, menus, secondary text. */
  ui: 13,
  /** Settings labels, search results, page subtitles. */
  md: 14,
  /** Daily task titles. */
  lg: 15,
  /** Note text. */
  body: 16,
  h3: 18,
  h2: 22,
  h1: 28,
  /** The title at the top of a note or page. */
  title: 30,
} as const;

const THEMES: Record<Theme, Record<string, string>> = {
  dark: {
    '--bg': '#1d1d1f', '--side': '#18181a', '--elev': '#252528', '--code': '#212124',
    '--border': '#2c2c30', '--border-strong': '#3e3e43',
    '--text': '#dddde0', '--text-2': '#b6b6bb', '--muted': '#8e8e95', '--faint': '#727279',
    '--hover': 'rgba(255,255,255,0.04)', '--active': 'rgba(255,255,255,0.075)',
    '--warm': 'oklch(0.77 0.07 68)', '--warm-text': 'oklch(0.87 0.035 72)',
    '--pri-h': 'oklch(0.70 0.10 28)', '--pri-m': 'oklch(0.79 0.09 82)', '--pri-l': 'oklch(0.62 0.02 260)',
    '--kw': 'oklch(0.76 0.08 305)', '--str': 'oklch(0.78 0.07 150)', '--num': 'oklch(0.79 0.07 65)',
    '--fn': 'oklch(0.79 0.07 235)', '--type': 'oklch(0.80 0.06 190)', '--com': '#6d6d75',
    '--on-accent': '#1d1d1f',
  },
  light: {
    '--bg': '#fcfcfb', '--side': '#f4f4f2', '--elev': '#ffffff', '--code': '#f5f5f3',
    '--border': '#e7e7e4', '--border-strong': '#d2d2ce',
    '--text': '#252529', '--text-2': '#45454b', '--muted': '#6f6f77', '--faint': '#8e8e95',
    '--hover': 'rgba(0,0,0,0.035)', '--active': 'rgba(0,0,0,0.06)',
    '--warm': 'oklch(0.56 0.09 60)', '--warm-text': 'oklch(0.42 0.06 55)',
    '--pri-h': 'oklch(0.60 0.13 28)', '--pri-m': 'oklch(0.72 0.11 78)', '--pri-l': 'oklch(0.72 0.02 260)',
    '--kw': 'oklch(0.50 0.13 305)', '--str': 'oklch(0.50 0.10 150)', '--num': 'oklch(0.55 0.11 55)',
    '--fn': 'oklch(0.50 0.11 245)', '--type': 'oklch(0.50 0.08 195)', '--com': '#9a9aa0',
    '--on-accent': '#ffffff',
  },
};

function accentVars(theme: Theme, accent: Accent): Record<string, string> {
  const { hue, dL, dC } = ACCENTS[accent];
  const d = theme === 'dark', L = (d ? 0.76 : 0.52) + dL, C = (d ? 0.085 : 0.12) + dC;
  return {
    '--accent': `oklch(${L} ${C} ${hue})`,
    '--accent-fill': `oklch(${(d ? 0.71 : 0.54) + dL} ${C} ${hue})`,
    '--accent-soft': `oklch(${L} ${C} ${hue} / ${d ? 0.16 : 0.11})`,
    '--accent-ring': `oklch(${L} ${C} ${hue} / 0.55)`,
  };
}

export function themeStyle(theme: Theme, accent: Accent): CSSProperties {
  return { ...THEMES[theme], ...accentVars(theme, accent) } as CSSProperties;
}
