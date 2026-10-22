import { app, BrowserWindow, clipboard, dialog, ipcMain, nativeTheme, net, protocol, shell } from 'electron';
import { readFileSync, promises as fs } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import type { VaultSnapshot, VaultSync } from './api';
import { setupUpdates } from './updater';

const DEV_URL = process.env.VITE_DEV_SERVER_URL;
const STATE_FILE = '.journal/state.json';
const TITLE_BAR_HEIGHT = 42;

/* ---------- config: where the vault lives ---------- */

const configPath = () => path.join(app.getPath('userData'), 'config.json');

async function readConfig(): Promise<{ vaultPath: string }> {
  if (process.env.JOURNAL_VAULT) return { vaultPath: process.env.JOURNAL_VAULT };
  try {
    const c = JSON.parse(await fs.readFile(configPath(), 'utf8'));
    if (typeof c.vaultPath === 'string') return c;
  } catch { /* first run */ }
  return { vaultPath: path.join(app.getPath('documents'), 'Journal') };
}

async function writeConfig(c: { vaultPath: string }) {
  await fs.mkdir(path.dirname(configPath()), { recursive: true });
  await fs.writeFile(configPath(), JSON.stringify(c, null, 2));
}

/* ---------- vault files ---------- */

let root = '';

/** Resolve a vault-relative path, refusing anything that escapes the vault. */
function inVault(rel: string): string {
  const abs = path.resolve(root, rel);
  if (abs !== root && !abs.startsWith(root + path.sep)) throw new Error(`Path outside vault: ${rel}`);
  return abs;
}

async function writeAtomic(abs: string, data: string | Buffer) {
  await fs.mkdir(path.dirname(abs), { recursive: true });
  const tmp = `${abs}.${process.pid}.tmp`;
  await fs.writeFile(tmp, data);
  await fs.rename(tmp, abs);
}

const rel = (abs: string) => path.relative(root, abs).split(path.sep).join('/');

async function walk(dir: string, files: Record<string, string>, dirs: string[], assets: string[]) {
  for (const e of await fs.readdir(dir, { withFileTypes: true })) {
    if (e.name.startsWith('.') || e.name === 'node_modules') continue;
    const abs = path.join(dir, e.name);
    if (e.isDirectory()) { dirs.push(rel(abs)); await walk(abs, files, dirs, assets); }
    else if (!e.isFile()) continue;
    else if (e.name.toLowerCase().endsWith('.md')) files[rel(abs)] = await fs.readFile(abs, 'utf8');
    else if (!e.name.endsWith('.tmp')) assets.push(rel(abs));
  }
}

/** A file name that's safe on Linux and Windows. */
const safeName = (name: string) => path.basename(name).replace(/[\\/:*?"<>|\u0000-\u001f]/g, '-').replace(/[. ]+$/, '').trim() || 'file';

/** `name`, or `name 2.ext`, `name 3.ext`… whichever is free in `dir`. */
async function freeName(dir: string, name: string) {
  const ext = path.extname(name), stem = name.slice(0, name.length - ext.length);
  for (let n = 1; ; n++) {
    const candidate = n === 1 ? name : `${stem} ${n}${ext}`;
    try { await fs.access(path.join(dir, candidate)); } catch { return candidate; }
  }
}

ipcMain.handle('vault:load', async (): Promise<VaultSnapshot> => {
  root = path.resolve((await readConfig()).vaultPath);
  await fs.mkdir(root, { recursive: true });
  const files: Record<string, string> = {}, dirs: string[] = [], assets: string[] = [];
  await walk(root, files, dirs, assets);
  let state: unknown = null;
  try { state = JSON.parse(await fs.readFile(inVault(STATE_FILE), 'utf8')); } catch { /* fresh vault */ }
  let obsidianDaily = null;
  try { obsidianDaily = JSON.parse(await fs.readFile(inVault('.obsidian/daily-notes.json'), 'utf8')); } catch { /* not an Obsidian vault */ }
  return { root, files, dirs, assets, state, obsidianDaily };
});

ipcMain.handle('vault:sync', async (_e, { deletes, writes, prune }: VaultSync) => {
  for (const p of deletes) await fs.rm(inVault(p), { force: true });
  for (const d of prune) await fs.rmdir(inVault(d)).catch(() => { /* not empty */ });
  for (const [p, content] of Object.entries(writes)) await writeAtomic(inVault(p), content);
});

ipcMain.handle('vault:writeState', (_e, json: string) => writeAtomic(inVault(STATE_FILE), json));

ipcMain.handle('vault:saveAttachment', async (_e, dir: string, name: string, src: { path?: string; data?: ArrayBuffer }) => {
  const absDir = inVault(dir);
  await fs.mkdir(absDir, { recursive: true });
  const file = await freeName(absDir, safeName(name));
  const abs = path.join(absDir, file);
  if (src.path) await fs.copyFile(src.path, abs);
  else if (src.data) await writeAtomic(abs, Buffer.from(src.data));
  else throw new Error('Nothing to save');
  return rel(abs);
});

ipcMain.handle('vault:openAsset', async (_e, p: string) => {
  const err = await shell.openPath(inVault(p));
  if (err) throw new Error(err);
});

ipcMain.handle('fs:existingFiles', async (_e, candidates: string[]) => {
  const out: string[] = [];
  for (const c of candidates) {
    let p: string;
    try { p = c.startsWith('file://') ? fileURLToPath(c) : c; } catch { return null; }
    if (!path.isAbsolute(p)) return null;
    try { if (!(await fs.stat(p)).isFile()) return null; } catch { return null; }
    out.push(p);
  }
  return out;
});

ipcMain.handle('vault:trash', async (_e, p: string) => {
  const abs = inVault(p);
  if (abs === root) throw new Error('Refusing to delete the vault');
  // A note or folder made a moment ago may not be on disk yet.
  try { await fs.access(abs); } catch { return; }
  await shell.trashItem(abs);
});

ipcMain.handle('vault:mkdir', async (_e, p: string) => { await fs.mkdir(inVault(p), { recursive: true }); });

ipcMain.handle('vault:choose', async e => {
  const win = BrowserWindow.fromWebContents(e.sender)!;
  const r = await dialog.showOpenDialog(win, { title: 'Choose vault folder', defaultPath: root, properties: ['openDirectory', 'createDirectory'] });
  if (r.canceled || !r.filePaths[0]) return null;
  await writeConfig({ vaultPath: r.filePaths[0] });
  return r.filePaths[0];
});

ipcMain.handle('vault:reveal', async () => { await shell.openPath(root); });

ipcMain.handle('shell:openExternal', async (_e, url: string) => {
  if (/^(https?|mailto):/i.test(url)) await shell.openExternal(url);
});

/* ---------- page titles for pasted links ---------- */

const LOGIN = /log ?in|sign[ _-]?in|signin|authenticate|\bsso\b|id\.atlassian\.com/i;
/** Titles that only name the site (as some apps show before their scripts run), or bot checks and error pages. */
const GENERIC = /^(jira|gitlab|github|confluence|bitbucket|atlassian|jira software|jira service management)$|^just a moment|attention required|access denied|^(404|403|401)\b|not found|forbidden/i;
const ENTITIES: Record<string, string> = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ' };
const decodeEntities = (s: string) => s.replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (m, e: string) => {
  if (e[0] === '#') { const n = e[1] === 'x' || e[1] === 'X' ? parseInt(e.slice(2), 16) : parseInt(e.slice(1), 10); return Number.isFinite(n) ? String.fromCodePoint(n) : m; }
  return ENTITIES[e.toLowerCase()] ?? m;
});

ipcMain.handle('link:title', async (_e, url: string): Promise<string | null> => {
  if (!/^https?:\/\//i.test(url)) return null;
  try {
    const res = await net.fetch(url, { signal: AbortSignal.timeout(6000), headers: { Accept: 'text/html,application/xhtml+xml' } });
    if (!res.ok || !/html/i.test(res.headers.get('content-type') ?? '')) return null;
    // Private Jira / GitLab pages redirect to a login form; its title is no use as a label.
    const landed = new URL(res.url || url);
    if (LOGIN.test(landed.hostname + landed.pathname)) return null;
    // The title is near the top; don't download whole pages.
    const reader = res.body!.getReader();
    let html = '';
    const decoder = new TextDecoder();
    while (html.length < 300_000) {
      const { done, value } = await reader.read();
      if (done) break;
      html += decoder.decode(value, { stream: true });
      if (/<\/head>/i.test(html)) break;
    }
    reader.cancel().catch(() => {});
    const og = html.match(/<meta[^>]+property=["']og:title["'][^>]*content=["']([^"']+)["']/i) ?? html.match(/<meta[^>]+content=["']([^"']+)["'][^>]*property=["']og:title["']/i);
    const title = og?.[1] ?? html.match(/<title[^>]*>([^<]*)<\/title>/i)?.[1];
    const clean = title && decodeEntities(title).replace(/\s+/g, ' ').trim();
    if (!clean || LOGIN.test(clean) || GENERIC.test(clean)) return null;
    // GitLab and GitHub append "· Merge requests · Group / Project · GitLab"; the first part is the title.
    return clean.split(' · ')[0].slice(0, 140);
  } catch {
    return null;
  }
});

ipcMain.on('app:version', e => { e.returnValue = app.getVersion(); });

ipcMain.handle('clipboard:write', (_e, text: string) => { clipboard.writeText(String(text)); });

ipcMain.on('window:titleBar', (e, colors: { color: string; symbolColor: string }) => {
  BrowserWindow.fromWebContents(e.sender)?.setTitleBarOverlay({ ...colors, height: TITLE_BAR_HEIGHT });
});

/* ---------- start at login ---------- */

// Windows and macOS have a login items API; on Linux it's an XDG autostart entry.
const autostartFile = () => path.join(process.env.XDG_CONFIG_HOME || path.join(os.homedir(), '.config'), 'autostart', 'journal.desktop');
/** The command that starts this app: the AppImage when run from one, otherwise the binary (plus the app folder in development). */
const launchCommand = () => {
  const q = (s: string) => `"${s.replace(/(["`$\\])/g, '\\$1')}"`;
  if (process.env.APPIMAGE) return q(process.env.APPIMAGE);
  return app.isPackaged ? q(process.execPath) : `${q(process.execPath)} ${q(app.getAppPath())}`;
};

ipcMain.handle('app:getAutostart', async () => {
  if (process.platform !== 'linux') return app.getLoginItemSettings().openAtLogin;
  try { await fs.access(autostartFile()); return true; } catch { return false; }
});

ipcMain.handle('app:setAutostart', async (_e, on: boolean) => {
  if (process.platform !== 'linux') { app.setLoginItemSettings({ openAtLogin: on }); return; }
  if (!on) { await fs.rm(autostartFile(), { force: true }); return; }
  await fs.mkdir(path.dirname(autostartFile()), { recursive: true });
  await fs.writeFile(autostartFile(), ['[Desktop Entry]', 'Type=Application', 'Name=Journal', 'Comment=Markdown journal with daily notes and tasks', `Exec=${launchCommand()}`, 'Icon=journal', 'X-GNOME-Autostart-enabled=true', ''].join('\n'));
});

/* ---------- splash screen ---------- */

/** A small window shown at once, like JetBrains IDEs do, while the app and the vault load. */
function createSplash(dark: boolean): BrowserWindow {
  let icon = '';
  try { icon = 'data:image/png;base64,' + readFileSync(path.join(__dirname, '../build/icon.png')).toString('base64'); } catch { /* no icon */ }
  const [bg, fg, sub, track, bar] = dark ? ['#1d1d1f', '#dddde0', '#8e8e95', '#2c2c30', '#8e8e95'] : ['#fcfcfb', '#252529', '#6f6f77', '#e7e7e4', '#6f6f77'];
  const html = `<!doctype html><meta charset="utf-8"><style>
    html,body{margin:0;height:100%;background:${bg};color:${fg};font:14px 'Segoe UI',system-ui,sans-serif;-webkit-user-select:none;cursor:default;overflow:hidden}
    body{display:flex;flex-direction:column;align-items:center;justify-content:center;gap:14px;box-sizing:border-box;border:1px solid ${track}}
    img{width:72px;height:72px}
    h1{margin:0;font-size:22px;font-weight:600;letter-spacing:-.02em}
    p{margin:-8px 0 0;color:${sub};font-size:12px}
    .t{position:absolute;left:0;right:0;bottom:0;height:3px;background:${track};overflow:hidden}
    .t i{position:absolute;top:0;bottom:0;width:30%;background:${bar};animation:s 1.2s ease-in-out infinite}
    @keyframes s{from{left:-30%}to{left:100%}}
  </style>${icon ? `<img src="${icon}">` : ''}<h1>Journal</h1><p>Opening your vault…</p><div class="t"><i></i></div>`;
  const splash = new BrowserWindow({
    width: 380, height: 240, frame: false, resizable: false, movable: true, show: false, skipTaskbar: false,
    backgroundColor: bg, title: 'Journal', icon: path.join(__dirname, '../build/icon.png'),
    webPreferences: { sandbox: true, contextIsolation: true, nodeIntegration: false },
  });
  splash.once('ready-to-show', () => splash.show());
  splash.loadURL('data:text/html;charset=utf-8,' + encodeURIComponent(html));
  return splash;
}

/* ---------- window ---------- */

function createWindow() {
  // Until the app has loaded its theme setting, match the OS so a light setup doesn't flash dark.
  const dark = nativeTheme.shouldUseDarkColors;
  const splash = createSplash(dark);
  const win = new BrowserWindow({
    width: 1360, height: 860, minWidth: 900, minHeight: 560,
    title: 'Journal',
    backgroundColor: dark ? '#1d1d1f' : '#fcfcfb',
    show: false,
    autoHideMenuBar: true,
    titleBarStyle: 'hidden',
    titleBarOverlay: dark ? { color: '#18181a', symbolColor: '#8e8e95', height: TITLE_BAR_HEIGHT } : { color: '#f4f4f2', symbolColor: '#6f6f77', height: TITLE_BAR_HEIGHT },
    icon: path.join(__dirname, '../build/icon.png'),
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      contextIsolation: true,
      sandbox: true,
      nodeIntegration: false,
      spellcheck: true,
    },
  });
  win.setMenu(null);
  // The main window appears once the app has rendered the vault; the splash screen covers the wait.
  let shown = false;
  const reveal = () => {
    if (shown || win.isDestroyed()) return;
    shown = true;
    win.show();
    if (!splash.isDestroyed()) splash.destroy();
  };
  const onReady = (e: Electron.IpcMainEvent) => { if (e.sender === win.webContents) reveal(); };
  ipcMain.on('app:ready', onReady);
  win.on('closed', () => ipcMain.removeListener('app:ready', onReady));
  win.webContents.once('did-fail-load', reveal);
  setTimeout(reveal, 15000);

  // Give the renderer a moment to write unsaved edits before the window goes away.
  let flushed = false;
  win.on('close', e => {
    if (flushed) return;
    e.preventDefault();
    const done = () => { flushed = true; ipcMain.removeListener('app:flushed', done); win.close(); };
    ipcMain.on('app:flushed', done);
    win.webContents.send('app:flush');
    setTimeout(done, 3000);
  });

  // Links never navigate the app window; web links open in the default browser.
  win.webContents.setWindowOpenHandler(({ url }) => {
    if (/^https?:/i.test(url)) shell.openExternal(url);
    return { action: 'deny' };
  });
  win.webContents.on('will-navigate', (e, url) => {
    if (DEV_URL && url.startsWith(DEV_URL)) return;
    e.preventDefault();
  });
  if (DEV_URL) {
    win.webContents.on('before-input-event', (_e, input) => {
      if (input.type === 'keyDown' && input.key === 'F12') win.webContents.toggleDevTools();
    });
    win.loadURL(DEV_URL);
  } else {
    win.loadFile(path.join(__dirname, '../dist/index.html'));
  }
}

// vault://local/<path> serves files from the open vault, so notes can show their images.
protocol.registerSchemesAsPrivileged([{ scheme: 'vault', privileges: { standard: true, secure: true, supportFetchAPI: true, stream: true } }]);

function serveVault() {
  protocol.handle('vault', req => {
    try {
      const p = decodeURIComponent(new URL(req.url).pathname.slice(1));
      if (!root) return new Response('Vault not open', { status: 503 });
      return net.fetch(pathToFileURL(inVault(p)).toString());
    } catch {
      return new Response('Not found', { status: 404 });
    }
  });
}

if (!app.requestSingleInstanceLock()) app.quit();
else {
  app.on('second-instance', () => {
    const win = BrowserWindow.getAllWindows()[0];
    if (win) { if (win.isMinimized()) win.restore(); win.focus(); }
  });
  app.whenReady().then(() => { serveVault(); createWindow(); setupUpdates(); });
  app.on('window-all-closed', () => app.quit());
}
