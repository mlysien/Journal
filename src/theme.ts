import type { CSSProperties } from 'react';

export type Theme = 'dark' | 'light';
export type Accent = 'violet' | 'blue';

export const UI = "'Geist Sans', ui-sans-serif, system-ui, sans-serif";
export const MONO = "'JetBrains Mono', ui-monospace, SFMono-Regular, monospace";

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

function accentVars(theme: Theme, hue: number): Record<string, string> {
  const d = theme === 'dark', L = d ? 0.76 : 0.52, C = d ? 0.085 : 0.12;
  return {
    '--accent': `oklch(${L} ${C} ${hue})`,
    '--accent-fill': `oklch(${d ? 0.71 : 0.54} ${C} ${hue})`,
    '--accent-soft': `oklch(${L} ${C} ${hue} / ${d ? 0.16 : 0.11})`,
    '--accent-ring': `oklch(${L} ${C} ${hue} / 0.55)`,
  };
}

export function themeStyle(theme: Theme, accent: Accent): CSSProperties {
  return { ...THEMES[theme], ...accentVars(theme, accent === 'blue' ? 245 : 285) } as CSSProperties;
}
