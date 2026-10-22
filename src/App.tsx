import { useEffect, useMemo, useRef, useState } from 'react';
import { fmt, isIsoDate, isoWeek } from './dates';
import { wordsOf } from './markdown';
import { FS, MONO, themeStyle, UI, type Theme, type ThemePref } from './theme';
import { dailyName, dateFromName } from './dailyFormat';
import { AssetContext, makeAssets } from './assets';
import {
  addFolder, dailyDates, dailyFile, dailyTaskItems, folderPath, moveFolder, removeDaily, removeFolder, setDailyLocation, LINE_WIDTH, notePath, renameNote, sorter, TEXT_ZOOM, uid, useVault,
  type Loaded, type Pri, type Prefs, type ShortcutId, type TabId,
} from './vault';
import { keyName } from './keys';
import { playDone } from './sound';
import { clock, usePomodoro } from './pomodoro';
import { useUpdate } from './update';
import { Editor } from './components/Editor';
import { Search } from './components/Search';
import { Sidebar, type DeleteTarget } from './components/Sidebar';
import { SettingsPage } from './components/SettingsPage';
import { PastTasks, TodayTasks, type TaskActions } from './components/Tasks';
import { ChevronLeft, ChevronRight, Close, CupIcon, PauseIcon, PlayIcon, Plus, SidebarIcon, StopIcon, TomatoIcon } from './components/icons';

const iconBtn = { width: 28, height: 28, display: 'flex', alignItems: 'center', justifyContent: 'center', border: 'none', background: 'transparent', color: 'var(--muted)', borderRadius: 6, cursor: 'pointer', padding: 0 } as const;
const navBtn = (disabled: boolean) => ({ width: 24, height: 24, display: 'flex', alignItems: 'center', justifyContent: 'center', border: 'none', background: 'transparent', color: 'var(--muted)', borderRadius: 6, cursor: disabled ? 'default' : 'pointer', padding: 0, opacity: disabled ? 0.35 : 1, pointerEvents: disabled ? 'none' : 'auto' } as const);
const H1 = { margin: '22px 0 6px', fontSize: FS.title, fontWeight: 600, letterSpacing: '-0.025em', lineHeight: 1.2, color: 'var(--text)' } as const;

/** The theme to show: the chosen one, or the OS's light/dark mode for `system`, kept up to date. */
function useResolvedTheme(pref: ThemePref): Theme {
  const query = '(prefers-color-scheme: dark)';
  const [osDark, setOsDark] = useState(() => window.matchMedia(query).matches);
  useEffect(() => {
    const mq = window.matchMedia(query), on = () => setOsDark(mq.matches);
    mq.addEventListener('change', on);
    return () => mq.removeEventListener('change', on);
  }, []);
  return pref === 'system' ? (osDark ? 'dark' : 'light') : pref;
}

const TITLE_BAR = {
  dark: { color: '#18181a', symbolColor: '#8e8e95' },
  light: { color: '#f4f4f2', symbolColor: '#6f6f77' },
};

export function App({ initial }: { initial: Loaded }) {
  const { today, vault, update, ui, setUi, saveError, save, trash } = useVault(initial);
  /** A note just created, and whether its title or its body should get the caret. */
  const [justCreated, setJustCreated] = useState<{ id: string; focus: 'title' | 'body' } | null>(null);
  const titleInput = useRef<HTMLInputElement>(null);
  const scroller = useRef<HTMLDivElement>(null);
  const { prefs } = vault;
  const upd = useUpdate();
  const timer = usePomodoro(prefs);
  /** The update banner can be dismissed until the next version comes along. */
  const [dismissed, setDismissed] = useState<string | null>(null);
  const banner = (upd.state === 'ready' || upd.state === 'available') && dismissed !== upd.version ? upd : null;

  const items = useMemo(() => dailyTaskItems(vault, today), [vault, today]);
  const dates = useMemo(() => dailyDates(vault, today), [vault, today]);
  const dailyById = useMemo(() => new Map(vault.tasks.map(t => [t.id, t])), [vault.tasks]);

  const validTab = (id: TabId) => id === 'settings' || (id.startsWith('daily:') && isIsoDate(id.slice(6))) || (id.startsWith('note:') && !!vault.notes[id.slice(5)]);
  const tabs = ui.tabs.filter(validTab);
  const active = ui.active && validTab(ui.active) ? ui.active : null;

  useEffect(() => { scroller.current?.scrollTo(0, 0); }, [active]);

  /* ---------- search and keyboard shortcuts ---------- */

  const [searching, setSearching] = useState(false);
  /** A block to scroll to and flash once its note is showing. */
  const [jump, setJump] = useState<{ tab: TabId; block: number } | null>(null);
  /** Tabs closed this session, most recent last, for reopening. */
  const closed = useRef<TabId[]>([]);
  /** Bumped by Enter in a note's title, to move the caret into the note. */
  const [focusStart, setFocusStart] = useState(0);
  const shortcut = useRef<(id: ShortcutId) => void>(() => {});
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      // While a shortcut is being recorded in Settings, keys go to it.
      if ((e.target as HTMLElement | null)?.closest?.('[data-recording]')) return;
      const k = e.key.toLowerCase();
      if ((e.ctrlKey || e.metaKey) && !e.altKey && e.shiftKey && k === 'f') { e.preventDefault(); setSearching(s => !s); return; }
      const name = keyName(e);
      if (!name) return;
      const id = (Object.keys(latestKeys.current) as ShortcutId[]).find(s => latestKeys.current[s] === name);
      if (id) { e.preventDefault(); e.stopPropagation(); shortcut.current(id); }
    };
    window.addEventListener('keydown', onKey, true);
    return () => window.removeEventListener('keydown', onKey, true);
  }, []);
  const latestKeys = useRef(prefs.keys);
  latestKeys.current = prefs.keys;
  useEffect(() => {
    if (!jump || jump.tab !== active) return;
    const id = requestAnimationFrame(() => {
      const el = scroller.current?.querySelector<HTMLElement>(`[data-bi="${jump.block}"]`);
      if (el) {
        el.scrollIntoView({ block: 'center' });
        el.classList.remove('search-hit'); void el.offsetWidth; el.classList.add('search-hit');
      }
      setJump(null);
    });
    return () => cancelAnimationFrame(id);
  }, [jump, active]);
  const theme = useResolvedTheme(prefs.theme);
  useEffect(() => { window.journal.setTitleBar(TITLE_BAR[theme]); }, [theme]);
  useEffect(() => {
    if (justCreated?.focus === 'title' && active === 'note:' + justCreated.id) { titleInput.current?.focus(); titleInput.current?.select(); }
  }, [justCreated, active]);
  const newFolder = (parent: string | null, name: string) => {
    const r = folderPath(vault, parent, name);
    if ('error' in r) return r.error;
    update(v => addFolder(v, r.path));
    return null;
  };

  /* ---------- navigation ---------- */

  const openTab = (id: TabId) => {
    if (id !== 'note:' + justCreated?.id) setJustCreated(null);
    setUi(u => ({ ...u, tabs: u.tabs.includes(id) ? u.tabs : [...u.tabs, id], active: id }));
  };
  const closeTab = (id: TabId) => {
    closed.current = [...closed.current.filter(t => t !== id), id].slice(-30);
    setUi(u => {
      const live = u.tabs.filter(validTab), i = live.indexOf(id), rest = live.filter(t => t !== id);
      return { ...u, tabs: rest, active: u.active === id ? rest[Math.min(i, rest.length - 1)] ?? null : u.active };
    });
  };
  /** Opens the most recently closed tab that still exists and isn't open. */
  const reopenTab = () => {
    while (closed.current.length) {
      const id = closed.current.pop()!;
      if (validTab(id) && !tabs.includes(id)) { openTab(id); return; }
    }
  };
  const newNote = (title = 'Untitled', folder: string | null = null, focus: 'title' | 'body' = 'title') => {
    const id = notePath(vault, folder, title);
    update(v => ({ ...v, notes: { ...v.notes, [id]: { id, path: id, title, folder, blocks: [''] } } }));
    setJustCreated({ id, focus });
    setUi(u => ({ ...u, tabs: [...u.tabs, 'note:' + id], active: 'note:' + id }));
  };
  const openByTitle = (name: string) => {
    // Obsidian links may carry an alias or a heading: [[Note|shown text]], [[Note#Section]].
    name = name.split('|')[0].split('#')[0].trim();
    const day = dateFromName(vault.prefs.daily, name);
    if (day) return openTab('daily:' + day);
    const hit = Object.values(vault.notes).find(n => n.title.toLowerCase() === name.toLowerCase());
    if (hit) openTab('note:' + hit.id); else newNote(name, null, 'body');
  };
  const openToday = () => openTab('daily:' + today);
  shortcut.current = id => {
    if (id === 'today') openToday();
    else if (id === 'search') setSearching(s => !s);
    else if (id === 'newNote') newNote();
    else if (id === 'closeTab') { if (active) closeTab(active); }
    else if (id === 'reopenTab') reopenTab();
    else if (id === 'sidebar') setUi(u => ({ ...u, sidebarHidden: !u.sidebarHidden }));
  };

  /* ---------- sidebar: delete, icons, folder order ---------- */

  const deleteItem = (t: DeleteTarget) => {
    const what = t.kind === 'folder' ? `the folder “${t.label}” and everything in it` : `“${t.label}”`;
    if (!confirm(`Move ${what} to the trash?`)) return;
    const done = t.kind === 'folder' ? trash(t.path, v => removeFolder(v, t.path))
      : t.kind === 'daily' ? trash(dailyFile(vault, t.date), v => removeDaily(v, t.date))
      : trash(vault.notes[t.id].path, v => { const notes = { ...v.notes }; const icons = { ...v.icons }; delete icons['n:' + notes[t.id].path]; delete notes[t.id]; return { ...v, notes, icons }; });
    done.catch(err => alert(`Could not delete ${t.label}.\n${err instanceof Error ? err.message : err}`));
  };
  /* ---------- tasks ---------- */

  const actions: TaskActions = {
    toggle: t => {
      if (!t.done && prefs.sound) playDone();
      update(v => ({ ...v, tasks: v.tasks.map(x => x.id !== t.id ? x : x.done ? { ...x, done: false, doneOn: undefined, day: today } : { ...x, done: true, doneOn: today }) }));
    },
    setPri: (t, pri) => update(v => ({ ...v, tasks: v.tasks.map(x => (x.id === t.id ? { ...x, pri } : x)) })),
    remove: t => {
      if (timer.pomo?.taskId === t.id) timer.stop();
      update(v => ({ ...v, tasks: v.tasks.filter(x => x.id !== t.id) }));
    },
    openLink: name => openByTitle(name),
    rename: (t, title) => update(v => ({ ...v, tasks: v.tasks.map(x => (x.id === t.id ? { ...x, title } : x)) })),
    relink: (draft, final) => update(v => ({ ...v, tasks: v.tasks.map(x => (x.title.includes(draft) ? { ...x, title: x.title.replace(draft, final) } : x)) })),
    timer,
  };
  const pomo = timer.pomo, pomoTitle = pomo ? dailyById.get(pomo.taskId)?.title ?? pomo.title : '';
  const addTask = (title: string, pri: Pri) =>
    update(v => ({ ...v, tasks: [...v.tasks, { id: uid(), title, pri, createdOn: today, carried: 0, day: today }] }));

  const tasksOn = (d: string) => ({
    open: items.filter(t => !t.done && dailyById.get(t.id)?.day === d).sort(sorter('priority')),
    done: items.filter(t => t.done && dailyById.get(t.id)?.doneOn === d).sort(sorter('priority')),
  });

  /* ---------- active view ---------- */

  const date = active?.startsWith('daily:') ? active.slice(6) : null;
  const note = active?.startsWith('note:') ? vault.notes[active.slice(5)] : null;
  const blocks = date ? vault.daily[date] ?? [''] : note ? note.blocks : null;
  const words = blocks ? wordsOf(blocks) : 0;
  // Attachments resolve relative to the open note's folder.
  const noteDir = date ? dailyFile(vault, date).split('/').slice(0, -1).join('/') : note?.folder ?? '';
  const assets = useMemo(() => makeAssets(vault.assets, noteDir, rel => {
    window.journal.openAsset(rel).catch(err => alert(`Could not open ${rel}.\n${err instanceof Error ? err.message : err}`));
  }), [vault.assets, noteDir]);
  const addAssets = (rels: string[]) => update(v => ({ ...v, assets: [...v.assets, ...rels] }));

  const updateDoc = (fn: (L: string[]) => void) => update(v => {
    if (date) { const L = [...(v.daily[date] ?? [''])]; fn(L); return { ...v, daily: { ...v.daily, [date]: L } }; }
    if (note) { const n = v.notes[note.id]; const L = [...n.blocks]; fn(L); return { ...v, notes: { ...v.notes, [n.id]: { ...n, blocks: L } } }; }
    return v;
  });
  const setPrefs = (p: Partial<Prefs>) => update(v => ({ ...v, prefs: { ...v.prefs, ...p } }));

  const tabTitle = (id: TabId) => id === 'settings' ? 'Settings' : id.startsWith('daily:') ? dailyName(vault.prefs.daily, id.slice(6)) : vault.notes[id.slice(5)]?.title || 'Untitled';

  let crumbs: string[] = [];
  let prevDay: string | undefined, nextDay: string | undefined;
  if (date) {
    crumbs = dailyFile(vault, date).split('/');
    prevDay = dates.find(d => d < date);
    nextDay = [...dates].reverse().find(d => d > date);
  } else if (note) crumbs = [note.folder || 'Vault', (note.title || 'Untitled') + '.md'];

  let statusLeft = '', statusRight = '';
  const saved = saveError ? `Not saved: ${saveError}` : 'Saved';
  if (date) { statusLeft = dailyFile(vault, date); statusRight = `${words} words · Markdown · ${saved}`; }
  else if (note) { statusLeft = note.path; statusRight = `${words} words · Markdown · ${saved}`; }

  const todayTasks = tasksOn(today);
  const show = { pri: prefs.showPri, age: prefs.showAge, carried: prefs.showCarried };

  return (
    <div style={{ height: '100%', ...themeStyle(theme, prefs.accent) }}>
      <div style={{ height: '100%', display: 'flex', flexDirection: 'column', background: 'var(--bg)', color: 'var(--text)', fontFamily: UI, fontSize: FS.ui, WebkitFontSmoothing: 'antialiased', overflow: 'hidden' }}>

        {/* title bar + tabs */}
        <div className="titlebar" style={{ height: 42, flex: 'none', display: 'flex', alignItems: 'center', background: 'var(--side)' }}>
          <div style={{ width: ui.sidebarHidden ? 'auto' : ui.sidebarWidth * TEXT_ZOOM[prefs.textScale], flex: 'none', boxSizing: 'border-box', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, padding: '0 10px 0 16px' }}>
            <span style={{ fontSize: FS.ui, fontWeight: 600, color: 'var(--text-2)', letterSpacing: '-0.01em' }}>Journal</span>
            <button onClick={() => setUi(u => ({ ...u, sidebarHidden: !u.sidebarHidden }))} title="Toggle sidebar" className="hov-text-active" style={iconBtn}><SidebarIcon /></button>
          </div>
          <div style={{ flex: 1, minWidth: 0, alignSelf: 'flex-end', display: 'flex', alignItems: 'flex-end', gap: 2, paddingLeft: 6, overflow: 'hidden' }}>
            {tabs.map(id => {
              const act = id === active;
              return (
                <div key={id} onClick={() => openTab(id)} onAuxClick={e => { if (e.button === 1) closeTab(id); }} className={'tab' + (act ? ' active' : '')}
                  style={{ height: 34, display: 'flex', alignItems: 'center', gap: 6, padding: '0 6px 0 14px', minWidth: 0, flex: '0 1 200px', boxSizing: 'border-box', borderRadius: '8px 8px 0 0', background: act ? 'var(--bg)' : undefined, color: act ? 'var(--text)' : 'var(--muted)', fontSize: FS.ui, cursor: 'default' }}>
                  <span style={{ flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{tabTitle(id)}</span>
                  <button onClick={e => { e.stopPropagation(); closeTab(id); }} title="Close tab" className="tab-close"
                    style={{ width: 20, height: 20, flex: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center', border: 'none', background: 'transparent', color: 'var(--faint)', borderRadius: 5, padding: 0, cursor: 'pointer' }}>
                    <Close />
                  </button>
                </div>
              );
            })}
            <button onClick={() => newNote()} title="New note" className="hov-text-active" style={{ ...iconBtn, margin: '0 0 2px 4px', flex: 'none' }}><Plus /></button>
          </div>
          {/* room for the native minimize / maximize / close buttons */}
          <div style={{ width: 'calc(100vw - env(titlebar-area-x, 0px) - env(titlebar-area-width, 100vw) + 12px)', flex: 'none' }} />
        </div>

        <div style={{ flex: 1, display: 'flex', minHeight: 0, zoom: TEXT_ZOOM[prefs.textScale] }}>
          {!ui.sidebarHidden && (
            <Sidebar vault={vault} ui={{ ...ui, active }} setUi={setUi} today={today} dates={dates}
              zoom={TEXT_ZOOM[prefs.textScale]} todayOpen={todayTasks.open.length} open={openTab} onSearch={() => setSearching(true)}
              onNewNote={folder => newNote('Untitled', folder)} onNewFolder={newFolder} onDelete={deleteItem}
              onIcon={(key, choice) => update(v => { const icons = { ...v.icons }; if (choice) icons[key] = choice; else delete icons[key]; return { ...v, icons }; })}
              onMoveFolder={(parent, siblings, name, before) => update(v => moveFolder(v, parent, siblings, name, before))} />
          )}

          <AssetContext.Provider value={assets}>
          <main style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', background: 'var(--bg)' }}>
            <div ref={scroller} data-scroll="1" style={{ flex: 1, overflowY: 'auto', position: 'relative' }}>

              {blocks && (
                <div style={{ maxWidth: LINE_WIDTH[prefs.lineWidth], margin: '0 auto', padding: '40px 56px 0' }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16, fontSize: FS.sm, color: 'var(--faint)', height: 28 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, minWidth: 0 }}>
                      {crumbs.map((c, i) => (
                        <span key={i} style={{ display: 'contents' }}>
                          <span style={{ color: i === crumbs.length - 1 ? 'var(--text-2)' : 'var(--faint)', whiteSpace: 'nowrap' }}>{c}</span>
                          {i < crumbs.length - 1 && <span style={{ opacity: 0.6 }}>/</span>}
                        </span>
                      ))}
                    </div>
                    {date && (
                      <div style={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                        <button onClick={() => prevDay && openTab('daily:' + prevDay)} title="Previous day" className="hov-text-active" style={navBtn(!prevDay)}><ChevronLeft /></button>
                        {date !== today && <button onClick={openToday} className="hov-text-active" style={{ border: 'none', background: 'transparent', color: 'var(--muted)', font: 'inherit', fontSize: FS.sm, padding: '3px 8px', borderRadius: 6, cursor: 'pointer' }}>Today</button>}
                        <button onClick={() => nextDay && openTab('daily:' + nextDay)} title="Next day" className="hov-text-active" style={navBtn(!nextDay)}><ChevronRight /></button>
                      </div>
                    )}
                  </div>

                  {date ? (
                    <>
                      <h1 style={H1}>{fmt(date, { weekday: 'long', month: 'long', day: 'numeric' })}</h1>
                      <div style={{ fontSize: FS.md, color: 'var(--muted)' }}>{(date === today ? 'Today' : dailyName(prefs.daily, date)) + ` · Week ${isoWeek(date)}, ${date.slice(0, 4)}`}</div>
                    </>
                  ) : note && (
                    <>
                      <input ref={titleInput} value={note.title} placeholder="Untitled" spellCheck={false}
                        onChange={e => { const title = e.target.value; update(v => renameNote(v, note.id, title)); }}
                        onKeyDown={e => { if (e.key === 'Enter' || e.key === 'ArrowDown') { e.preventDefault(); setFocusStart(n => n + 1); } }}
                        style={{ ...H1, display: 'block', width: '100%', padding: 0, border: 'none', outline: 'none', background: 'transparent', fontFamily: 'inherit' }} />
                      <div style={{ fontSize: FS.md, color: 'var(--muted)' }}>{words} words</div>
                      <div style={{ height: 26 }} />
                    </>
                  )}

                  {date === today && <TodayTasks rows={todayTasks.open.concat(todayTasks.done)} actions={actions} show={show} onAdd={addTask} />}
                  {date && date < today && (() => { const p = tasksOn(date); return <PastTasks open={p.open} done={p.done} actions={actions} show={show} onOpenToday={openToday} />; })()}
                  {date && (
                    <div style={{ display: 'flex', alignItems: 'baseline', gap: 10, paddingBottom: 10, marginBottom: 14, borderBottom: '1px solid var(--border)' }}>
                      <span style={{ fontSize: FS.ui, fontWeight: 600, color: 'var(--text)' }}>Notes</span>
                      <span style={{ fontSize: FS.sm, color: 'var(--faint)' }}>{words ? `${words} word${words === 1 ? '' : 's'}` : 'Nothing written yet'}</span>
                    </div>
                  )}

                  <Editor key={active} blocks={blocks} update={updateDoc} isDaily={!!date} live={prefs.live} spell={prefs.spell}
                    showPri={prefs.showPri} sound={prefs.sound} focusStart={focusStart}
                    onOpenLink={openByTitle} autoFocus={!!note && justCreated?.id === note.id && justCreated.focus === 'body'}
                    noteDir={noteDir} onAssetsAdded={addAssets} />
                </div>
              )}


              {active === 'settings' && (
                <SettingsPage prefs={prefs} setPrefs={setPrefs} root={vault.root} today={today}
                  onDailyLocation={(folder, format) => {
                    const r = setDailyLocation(vault, folder, format);
                    if ('error' in r) return r.error;
                    update(v => { const again = setDailyLocation(v, folder, format); return 'error' in again ? v : again.vault; });
                    return null;
                  }}
                  onReveal={() => window.journal.revealVault()}
                  onChangeVault={async () => { await save(); if (await window.journal.chooseVault()) location.reload(); }} />
              )}

              {!active && (
                <div style={{ height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8, alignItems: 'center', textAlign: 'center' }}>
                    <span style={{ fontSize: FS.lg, fontWeight: 500, color: 'var(--text-2)' }}>No open notes</span>
                    <span style={{ fontSize: FS.ui, color: 'var(--muted)' }}>Open one from the sidebar, or start something new.</span>
                    <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
                      <button onClick={openToday} className="btn-outline" style={{ border: '1px solid var(--border-strong)', background: 'var(--elev)', color: 'var(--text)', font: 'inherit', fontSize: FS.ui, padding: '6px 12px', borderRadius: 7, cursor: 'pointer' }}>Open today</button>
                      <button onClick={() => newNote()} className="btn-ghost" style={{ border: '1px solid transparent', background: 'transparent', color: 'var(--muted)', font: 'inherit', fontSize: FS.ui, padding: '6px 12px', borderRadius: 7, cursor: 'pointer' }}>New note</button>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {banner && (
              <div style={{ flex: 'none', display: 'flex', alignItems: 'center', gap: 12, padding: '8px 10px 8px 16px', borderTop: '1px solid var(--border)', background: 'var(--accent-soft)', fontSize: FS.ui, color: 'var(--text)' }}>
                <span style={{ flex: 1, minWidth: 0 }}>
                  {banner.state === 'ready' ? `Journal ${banner.version} is ready. It installs when you restart, or close the app.` : `Journal ${banner.version} is available.`}
                </span>
                <button className="btn-outline" onClick={async () => {
                  if (banner.state === 'ready') { await save(); window.journal.installUpdate(); }
                  else window.journal.openExternal(banner.url);
                }} style={{ border: '1px solid var(--border-strong)', background: 'var(--elev)', color: 'var(--text)', font: 'inherit', fontSize: FS.ui, padding: '4px 12px', borderRadius: 7, cursor: 'pointer' }}>
                  {banner.state === 'ready' ? 'Restart now' : 'Download'}
                </button>
                <button onClick={() => setDismissed(banner.version)} title="Not now" className="hov-text-active" style={iconBtn}><Close /></button>
              </div>
            )}
            <div style={{ height: 28, flex: 'none', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16, padding: '0 16px', fontSize: FS.sm, color: saveError ? 'var(--pri-h)' : 'var(--faint)', borderTop: '1px solid var(--border)' }}>
              {pomo ? (
                // The running pomodoro, visible from any tab; its task is on today's note.
                <span style={{ display: 'flex', alignItems: 'center', gap: 2, minWidth: 0, color: pomo.endsAt === null ? 'var(--muted)' : pomo.phase === 'break' ? 'var(--accent)' : 'var(--pri-h)' }}>
                  <button onClick={openToday} title="Open today’s tasks" className="hov-active"
                    style={{ display: 'flex', alignItems: 'center', gap: 6, minWidth: 0, height: 22, padding: '0 6px', margin: '0 0 0 -6px', border: 'none', borderRadius: 5, background: 'transparent', color: 'inherit', font: 'inherit', cursor: 'pointer' }}>
                    {pomo.phase === 'break' ? <CupIcon /> : <TomatoIcon />}
                    <span style={{ fontFamily: MONO, fontVariantNumeric: 'tabular-nums' }}>{clock(timer.left)}</span>
                    <span style={{ color: 'var(--muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{pomo.phase === 'break' ? 'Break' : pomoTitle}</span>
                  </button>
                  <button onClick={timer.toggle} title={pomo.endsAt === null ? 'Resume' : 'Pause'} className="hov-text-active" style={{ ...iconBtn, width: 22, height: 22, color: 'var(--faint)' }}>{pomo.endsAt === null ? <PlayIcon /> : <PauseIcon />}</button>
                  <button onClick={timer.stop} title="Stop the timer" className="hov-text-active" style={{ ...iconBtn, width: 22, height: 22, color: 'var(--faint)' }}><StopIcon /></button>
                </span>
              ) : (
                <span style={{ fontFamily: MONO, fontSize: FS.xs, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', color: 'var(--faint)' }}>{statusLeft}</span>
              )}
              <span style={{ whiteSpace: 'nowrap' }}>{statusRight}</span>
            </div>
          </main>
          </AssetContext.Provider>
          {searching && (
            <Search vault={vault} onClose={() => setSearching(false)}
              onOpen={(tab, block) => { setSearching(false); openTab(tab); if (block !== null) setJump({ tab, block }); }} />
          )}
        </div>
      </div>
    </div>
  );
}

