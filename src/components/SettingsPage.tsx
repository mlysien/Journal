import { useEffect, useState, type CSSProperties } from 'react';
import { FS, MONO } from '../theme';
import { SHORTCUTS, type Prefs, type ShortcutId } from '../vault';
import { keyLabel, keyName } from '../keys';
import { updateText, useUpdate } from '../update';
import { dailyPath, formatProblem, normalizeFolder } from '../dailyFormat';

type Row =
  | { kind: 'seg'; label: string; desc: string; options: [string, string][]; value: string; set: (k: string) => void }
  | { kind: 'toggle'; label: string; desc: string; key: 'carry' | 'showPri' | 'showAge' | 'showCarried' | 'sound' | 'live' | 'spell' | 'pomoSound' }
  | { kind: 'switch'; label: string; desc: string; on: boolean; set: (on: boolean) => void }
  | { kind: 'shortcut'; label: string; desc: string; id: ShortcutId }
  | { kind: 'update'; label: string; desc: string }
  | { kind: 'path'; label: string; desc: string; value: string; actions?: [string, () => void][] }
  | { kind: 'daily'; label: string; desc: string };

const segBtn = (on: boolean): CSSProperties => ({ border: 'none', fontFamily: 'inherit', fontSize: FS.sm, padding: '4px 12px', borderRadius: 5, cursor: 'pointer', background: on ? 'var(--bg)' : 'transparent', color: on ? 'var(--text)' : 'var(--muted)', boxShadow: on ? '0 0 0 1px var(--border)' : 'none' });

interface Props {
  prefs: Prefs;
  setPrefs: (p: Partial<Prefs>) => void;
  root: string;
  today: string;
  /** Moves daily notes to a new folder / format; returns an error message, or null when done. */
  onDailyLocation: (folder: string, format: string) => string | null;
  onReveal: () => void;
  onChangeVault: () => void;
}

const field: CSSProperties = { width: '100%', boxSizing: 'border-box', fontFamily: MONO, fontSize: FS.ui, color: 'var(--text)', background: 'var(--elev)', border: '1px solid var(--border-strong)', borderRadius: 6, padding: '6px 10px', outline: 'none' };

/** A key binding; click it, then press the new keys. Esc cancels, Backspace clears. */
function ShortcutField({ value, fallback, onChange }: { value: string; fallback: string; onChange: (v: string) => void }) {
  const [recording, setRecording] = useState(false);
  const platform = window.journal.platform;
  return (
    <span style={{ display: 'flex', alignItems: 'center', gap: 4, flex: 'none' }}>
      <button data-recording={recording ? '1' : undefined} onClick={() => setRecording(true)} onBlur={() => setRecording(false)}
        onKeyDown={e => {
          if (!recording) return;
          e.preventDefault(); e.stopPropagation();
          if (e.key === 'Escape') { setRecording(false); return; }
          if ((e.key === 'Backspace' || e.key === 'Delete') && !e.ctrlKey && !e.metaKey && !e.altKey) { onChange(''); setRecording(false); return; }
          const name = keyName(e.nativeEvent);
          if (name) { onChange(name); setRecording(false); }
        }}
        style={{ minWidth: 120, fontFamily: MONO, fontSize: FS.sm, padding: '5px 10px', borderRadius: 6, cursor: 'pointer', textAlign: 'center', outline: 'none',
          border: `1px solid ${recording ? 'var(--accent)' : 'var(--border-strong)'}`, background: 'var(--elev)', color: recording || !value ? 'var(--muted)' : 'var(--text)' }}>
        {recording ? 'Press keys…' : keyLabel(value, platform) || 'None'}
      </button>
      <button onClick={() => onChange(fallback)} disabled={value === fallback} title={`Reset to ${keyLabel(fallback, platform)}`} className="hov-text-active"
        style={{ border: 'none', background: 'transparent', color: 'var(--muted)', font: 'inherit', fontSize: FS.sm, padding: '3px 8px', borderRadius: 6, cursor: value === fallback ? 'default' : 'pointer', opacity: value === fallback ? 0 : 1 }}>Reset</button>
    </span>
  );
}

/** Folder and file name format for daily notes, applied with a button because it moves files. */
function DailyLocationEditor({ prefs, today, onApply }: { prefs: Prefs; today: string; onApply: Props['onDailyLocation'] }) {
  const [folder, setFolder] = useState(prefs.daily.folder);
  const [format, setFormat] = useState(prefs.daily.format);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  useEffect(() => { setFolder(prefs.daily.folder); setFormat(prefs.daily.format); }, [prefs.daily.folder, prefs.daily.format]);

  const problem = formatProblem(format);
  const changed = normalizeFolder(folder) !== prefs.daily.folder || format.trim() !== prefs.daily.format;
  const apply = () => {
    const e = onApply(folder, format);
    setError(e);
    setDone(!e);
  };
  const label = (text: string) => <span style={{ fontSize: FS.sm, color: 'var(--muted)' }}>{text}</span>;
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginTop: 4 }}>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1.4fr', gap: 12 }}>
        <label style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>{label('Folder')}
          <input value={folder} placeholder="(vault root)" spellCheck={false} style={field}
            onChange={e => { setFolder(e.target.value); setDone(false); setError(null); }} onKeyDown={e => { if (e.key === 'Enter' && changed && !problem) apply(); }} />
        </label>
        <label style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>{label('File name format')}
          <input value={format} placeholder="YYYY/MM/DD.MM.YYYY" spellCheck={false} style={{ ...field, borderColor: problem ? 'var(--pri-h)' : 'var(--border-strong)' }}
            onChange={e => { setFormat(e.target.value); setDone(false); setError(null); }} onKeyDown={e => { if (e.key === 'Enter' && changed && !problem) apply(); }} />
        </label>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16 }}>
        <span style={{ fontSize: FS.ui, color: problem || error ? 'var(--pri-h)' : 'var(--muted)', minWidth: 0 }}>
          {problem ?? error ?? <>Today: <span style={{ fontFamily: MONO, fontSize: FS.sm, color: 'var(--text-2)' }}>{dailyPath({ folder: normalizeFolder(folder), format: format.trim() }, today)}</span>{done && ' · moved'}</>}
        </span>
        <button onClick={apply} disabled={!changed || !!problem} className="btn-outline"
          style={{ flex: 'none', border: '1px solid var(--border-strong)', background: 'var(--elev)', color: 'var(--text)', font: 'inherit', fontSize: FS.ui, padding: '5px 12px', borderRadius: 7, cursor: changed && !problem ? 'pointer' : 'default', opacity: changed && !problem ? 1 : 0.45 }}>
          Apply and move notes
        </button>
      </div>
      <span style={{ fontSize: FS.sm, color: 'var(--faint)', lineHeight: 1.5 }}>
        Same tokens as Obsidian: YYYY, YY, MMMM, MMM, MM, M, DD, D, Do, dddd, ddd, and [text] for literal text. A / in the format makes subfolders.
      </span>
    </div>
  );
}

export function SettingsPage({ prefs, setPrefs, root, today, onDailyLocation, onReveal, onChangeVault }: Props) {
  // Starting at login is an OS setting, not a vault one, so it's read from the system.
  const [autostart, setAutostart] = useState<boolean | null>(null);
  useEffect(() => { window.journal.getAutostart().then(setAutostart).catch(() => setAutostart(false)); }, []);
  const toggleAutostart = (on: boolean) => {
    setAutostart(on);
    window.journal.setAutostart(on).catch(err => { setAutostart(!on); alert(`Could not change this setting.\n${err instanceof Error ? err.message : err}`); });
  };
  const update = useUpdate();
  const groups: { label: string; rows: Row[] }[] = [
    { label: 'Appearance', rows: [
      { kind: 'seg', label: 'Theme', desc: 'System follows your computer’s light or dark mode.', options: [['system', 'System'], ['dark', 'Dark'], ['light', 'Light']], value: prefs.theme, set: k => setPrefs({ theme: k as Prefs['theme'] }) },
      { kind: 'seg', label: 'Text size', desc: 'Scales text and spacing across the app.', options: [['small', 'Small'], ['medium', 'Medium'], ['large', 'Large']], value: prefs.textScale, set: k => setPrefs({ textScale: k as Prefs['textScale'] }) },
      { kind: 'seg', label: 'Accent', desc: 'Used for links, focus rings and checked tasks.', options: [['violet', 'Violet'], ['teal', 'Teal'], ['amber', 'Amber']], value: prefs.accent, set: k => setPrefs({ accent: k as Prefs['accent'] }) },
    ] },
    { label: 'Daily notes', rows: [
      { kind: 'toggle', key: 'carry', label: 'Carry over unfinished tasks', desc: 'Open tasks move into the next day’s note when it is created.' },
      { kind: 'toggle', key: 'showPri', label: 'Show priority', desc: 'The coloured dot next to each task, and the priority picker when adding one.' },
      { kind: 'toggle', key: 'showAge', label: 'Show task age', desc: 'Displays “5d old” next to each task.' },
      { kind: 'toggle', key: 'showCarried', label: 'Show carry-over count', desc: 'Displays “↻ 3” next to tasks that moved to a new day.' },
      { kind: 'toggle', key: 'sound', label: 'Sound on completing a task', desc: 'A short chime when you check off a task.' },
      { kind: 'daily', label: 'Location and file names', desc: 'Where daily notes are saved. Existing daily notes are moved when you apply a change.' },
    ] },
    { label: 'Pomodoro', rows: [
      { kind: 'seg', label: 'Focus', desc: 'Start a pomodoro with the tomato button on a task, or press T on a focused task.', options: [['15', '15 min'], ['25', '25 min'], ['45', '45 min'], ['50', '50 min']], value: String(prefs.pomoFocus), set: k => setPrefs({ pomoFocus: +k }) },
      { kind: 'seg', label: 'Short break', desc: 'Starts on its own when a pomodoro ends.', options: [['5', '5 min'], ['10', '10 min']], value: String(prefs.pomoBreak), set: k => setPrefs({ pomoBreak: +k }) },
      { kind: 'seg', label: 'Long break', desc: 'Instead of the short break after every fourth pomodoro on a task.', options: [['15', '15 min'], ['20', '20 min'], ['30', '30 min']], value: String(prefs.pomoLong), set: k => setPrefs({ pomoLong: +k }) },
      { kind: 'toggle', key: 'pomoSound', label: 'Sound when time is up', desc: 'A bell at the end of each pomodoro and break, along with a notification.' },
    ] },
    { label: 'Editor', rows: [
      { kind: 'seg', label: 'Readable line length', desc: 'How wide notes can get. Shorter lines are easier to read.', options: [['narrow', 'Narrow'], ['default', 'Default'], ['wide', 'Wide'], ['full', 'Full width']], value: prefs.lineWidth, set: k => setPrefs({ lineWidth: k as Prefs['lineWidth'] }) },
      { kind: 'toggle', key: 'live', label: 'Live preview', desc: 'Render Markdown inline; the line you are editing shows raw syntax.' },
      { kind: 'toggle', key: 'spell', label: 'Spellcheck', desc: 'Underline misspelled words in notes.' },
    ] },
    { label: 'Keyboard shortcuts', rows: SHORTCUTS.map(s => ({ kind: 'shortcut' as const, id: s.id, label: s.label, desc: '' })) },
    { label: 'System', rows: [
      { kind: 'update', label: `Version ${window.journal.version}`, desc: updateText(update) },
      { kind: 'switch', label: 'Start at login', desc: 'Open Journal when you sign in to your computer.', on: !!autostart, set: toggleAutostart },
    ] },
    { label: 'Vault', rows: [
      { kind: 'path', label: 'Location', desc: 'All notes are plain Markdown files in this folder.', value: root, actions: [['Show folder', onReveal], ['Change…', onChangeVault]] },
    ] },
  ];

  return (
    <div style={{ maxWidth: 720, margin: '0 auto', padding: '40px 56px 120px' }}>
      <div style={{ fontSize: FS.sm, color: 'var(--faint)', height: 28, display: 'flex', alignItems: 'center' }}>Settings</div>
      <h1 style={{ margin: '22px 0 6px', fontSize: FS.title, fontWeight: 600, letterSpacing: '-0.025em', lineHeight: 1.2 }}>Settings</h1>
      <div style={{ fontSize: FS.md, color: 'var(--muted)' }}>Stored in .journal/state.json inside your vault</div>
      {groups.map(g => (
        <div key={g.label} style={{ marginTop: 40 }}>
          <div style={{ fontSize: FS.ui, fontWeight: 600, color: 'var(--text)', paddingBottom: 10, borderBottom: '1px solid var(--border)' }}>{g.label}</div>
          {g.rows.map(r => (
            <div key={r.label} style={{ display: 'flex', flexDirection: r.kind === 'daily' ? 'column' : 'row', alignItems: r.kind === 'daily' ? 'stretch' : 'center', justifyContent: 'space-between', gap: r.kind === 'daily' ? 8 : 24, padding: '14px 0', borderBottom: '1px solid var(--border)' }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 3, minWidth: 0 }}>
                <span style={{ fontSize: FS.md, color: 'var(--text)' }}>{r.label}</span>
                {r.desc && <span style={{ fontSize: FS.ui, color: 'var(--muted)', lineHeight: 1.5 }}>{r.desc}</span>}
              </div>
              {r.kind === 'daily' && <DailyLocationEditor prefs={prefs} today={today} onApply={onDailyLocation} />}
              {r.kind === 'seg' && (
                <div style={{ display: 'flex', gap: 2, padding: 2, background: 'var(--hover)', borderRadius: 7, flex: 'none' }}>
                  {r.options.map(([k, l]) => <button key={k} onClick={() => r.set(k)} style={segBtn(r.value === k)}>{l}</button>)}
                </div>
              )}
              {r.kind === 'update' && (() => {
                const busy = update.state === 'checking' || update.state === 'downloading' || update.state === 'unsupported';
                const ready = update.state === 'ready';
                return (
                  <button className="btn-outline" disabled={busy}
                    onClick={() => (ready ? window.journal.installUpdate() : update.state === 'available' ? window.journal.openExternal(update.url) : window.journal.checkForUpdates())}
                    style={{ flex: 'none', border: '1px solid var(--border-strong)', background: 'var(--elev)', color: 'var(--text)', font: 'inherit', fontSize: FS.ui, padding: '5px 12px', borderRadius: 7, cursor: busy ? 'default' : 'pointer', opacity: busy ? 0.45 : 1 }}>
                    {ready ? 'Restart now' : update.state === 'available' ? 'Download' : 'Check for updates'}
                  </button>
                );
              })()}
              {r.kind === 'shortcut' && (
                <ShortcutField value={prefs.keys[r.id]} fallback={SHORTCUTS.find(s => s.id === r.id)!.default}
                  onChange={v => {
                    // A binding belongs to one action; taking it clears it from any other.
                    const keys = Object.fromEntries(Object.entries(prefs.keys).map(([id, k]) => [id, v && k === v ? '' : k])) as Prefs['keys'];
                    setPrefs({ keys: { ...keys, [r.id]: v } });
                  }} />
              )}
              {(r.kind === 'toggle' || r.kind === 'switch') && (() => {
                const on = r.kind === 'toggle' ? prefs[r.key] : r.on;
                const set = () => (r.kind === 'toggle' ? setPrefs({ [r.key]: !on }) : r.set(!on));
                return (
                  <button role="switch" aria-checked={on} aria-label={r.label} onClick={set}
                    style={{ width: 34, height: 20, flex: 'none', borderRadius: 999, border: 'none', padding: 2, cursor: 'pointer', background: on ? 'var(--accent-fill)' : 'var(--border-strong)', display: 'flex', justifyContent: on ? 'flex-end' : 'flex-start', transition: 'background .15s' }}>
                    <span style={{ width: 16, height: 16, borderRadius: '50%', background: on ? 'var(--on-accent)' : 'var(--text-2)' }} />
                  </button>
                );
              })()}
              {r.kind === 'path' && (
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 8, minWidth: 0 }}>
                  <span title={r.value} style={{ fontFamily: MONO, fontSize: FS.sm, color: 'var(--text-2)', padding: '5px 10px', border: '1px solid var(--border-strong)', borderRadius: 6, maxWidth: 320, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{r.value}</span>
                  {r.actions && (
                    <div style={{ display: 'flex', gap: 4 }}>
                      {r.actions.map(([label, fn]) => <button key={label} onClick={fn} className="hov-text-active" style={{ border: 'none', background: 'transparent', color: 'var(--muted)', font: 'inherit', fontSize: FS.sm, padding: '3px 8px', borderRadius: 6, cursor: 'pointer' }}>{label}</button>)}
                    </div>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      ))}
    </div>
  );
}
