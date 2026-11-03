import type { CSSProperties } from 'react';

/** The colours in use. */
export type Theme = 'dark' | 'light';
/** The setting: a theme, or `system` to follow the OS. */
export type ThemePref = 'system' | Theme;
/** The accent colour, as #rrggbb. */
export type Accent = string;
export const DEFAULT_ACCENT: Accent = '#8582cc';
/** The three accents of earlier versions, by the hex they were closest to. */
export const LEGACY_ACCENTS: Record<string, Accent> = { violet: '#8582cc', teal: '#1da09a', amber: '#c48225' };

/** `#abc`, `abc`, `#aabbcc` or `aabbcc` (any case, with spaces around) as `#aabbcc`; null if it isn't a hex colour. */
export function parseHex(text: string): Accent | null {
  const m = text.trim().match(/^#?([0-9a-f]{3}|[0-9a-f]{6})$/i);
  if (!m) return null;
  const h = m[1].length === 3 ? m[1].replace(/./g, c => c + c) : m[1];
  return '#' + h.toLowerCase();
}
export const isAccent = (a: unknown): a is Accent => typeof a === 'string' && parseHex(a) === a;

/** Dark or white text on top of the colour, whichever reads better (WCAG relative luminance). */
function onColor(hex: Accent) {
  const lin = (i: number) => { const c = parseInt(hex.slice(i, i + 2), 16) / 255; return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4; };
  const y = 0.2126 * lin(1) + 0.7152 * lin(3) + 0.0722 * lin(5);
  return y > 0.18 ? '#1d1d1f' : '#ffffff';
}

// Windows renders its own hinted fonts much more crisply than web fonts, so it gets Segoe UI (as
// Obsidian and VS Code do); elsewhere the bundled Geist is used. Code is in Cascadia Code on
// Windows and JetBrains Mono elsewhere, both bundled: Windows 10 has no system Cascadia, and the
// system copy on Windows 11 didn't show the programming ligatures. 'Journal Arrows' (styles.css)
// takes - < > from Geist, so -> and <- turn into arrows in Segoe UI text as they do in Geist.
const WIN = typeof window !== 'undefined' && window.journal?.platform === 'win32';
export const UI = WIN
  ? "'Journal Arrows', 'Segoe UI Variable Text', 'Segoe UI', system-ui, sans-serif"
  : "'Geist Sans', ui-sans-serif, system-ui, sans-serif";
export const MONO = WIN
  ? "'Cascadia Code', Consolas, ui-monospace, monospace"
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
    '--warm': 'oklch(0.77 0.07 68)',
    '--pri-h': 'oklch(0.70 0.10 28)', '--pri-m': 'oklch(0.79 0.09 82)', '--pri-l': 'oklch(0.62 0.02 260)',
    '--kw': 'oklch(0.76 0.08 305)', '--str': 'oklch(0.78 0.07 150)', '--num': 'oklch(0.79 0.07 65)',
    '--fn': 'oklch(0.79 0.07 235)', '--type': 'oklch(0.80 0.06 190)', '--com': '#6d6d75',
  },
  light: {
    '--bg': '#fcfcfb', '--side': '#f4f4f2', '--elev': '#ffffff', '--code': '#f5f5f3',
    '--border': '#e7e7e4', '--border-strong': '#d2d2ce',
    '--text': '#252529', '--text-2': '#45454b', '--muted': '#6f6f77', '--faint': '#8e8e95',
    '--hover': 'rgba(0,0,0,0.035)', '--active': 'rgba(0,0,0,0.06)',
    '--warm': 'oklch(0.56 0.09 60)',
    '--pri-h': 'oklch(0.60 0.13 28)', '--pri-m': 'oklch(0.72 0.11 78)', '--pri-l': 'oklch(0.72 0.02 260)',
    '--kw': 'oklch(0.50 0.13 305)', '--str': 'oklch(0.50 0.10 150)', '--num': 'oklch(0.55 0.11 55)',
    '--fn': 'oklch(0.50 0.11 245)', '--type': 'oklch(0.50 0.08 195)', '--com': '#9a9aa0',
  },
};

function accentVars(theme: Theme, accent: Accent): Record<string, string> {
  return {
    '--accent': accent,
    '--accent-fill': accent,
    '--accent-soft': `color-mix(in srgb, ${accent} ${theme === 'dark' ? 16 : 11}%, transparent)`,
    '--accent-ring': `color-mix(in srgb, ${accent} 55%, transparent)`,
    '--on-accent': onColor(accent),
  };
}

export function themeStyle(theme: Theme, accent: Accent): CSSProperties {
  return { ...THEMES[theme], ...accentVars(theme, accent) } as CSSProperties;
}
