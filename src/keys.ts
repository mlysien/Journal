/** Key bindings as text, like `Ctrl+Shift+T`. Cmd on macOS counts as Ctrl. */

const MODIFIERS = new Set(['Control', 'Shift', 'Alt', 'Meta', 'AltGraph', 'CapsLock', 'Dead', 'Unidentified']);

/** A key event's binding, or null for a lone modifier. Plain keys need Ctrl or Alt, or are F-keys. */
export function keyName(e: KeyboardEvent | { key: string; code: string; ctrlKey: boolean; metaKey: boolean; altKey: boolean; shiftKey: boolean }): string | null {
  if (MODIFIERS.has(e.key)) return null;
  // The physical key for letters and digits, so Shift and keyboard layouts don't change the name.
  let key = /^Key[A-Z]$/.test(e.code) ? e.code.slice(3) : /^Digit\d$/.test(e.code) ? e.code.slice(5) : e.key.length === 1 ? e.key.toUpperCase() : e.key;
  if (key === ' ') key = 'Space';
  const fkey = /^F\d{1,2}$/.test(key);
  if (!e.ctrlKey && !e.metaKey && !e.altKey && !fkey) return null;
  return [(e.ctrlKey || e.metaKey) && 'Ctrl', e.altKey && 'Alt', e.shiftKey && 'Shift', key].filter(Boolean).join('+');
}

/** How a binding is shown: `⌘K` style on macOS, `Ctrl+K` elsewhere. */
export function keyLabel(binding: string, platform: string): string {
  if (!binding) return '';
  if (platform !== 'darwin') return binding;
  return binding.replace('Ctrl+', '⌘').replace('Alt+', '⌥').replace('Shift+', '⇧');
}
