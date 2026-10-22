/**
 * Updates from GitHub Releases. The Windows installer and the AppImage update themselves: a new
 * version downloads in the background and is installed when the app quits (or on "Restart now").
 * Other installs (the .deb) can't replace themselves, so they're only told a new version exists.
 */
import { app, BrowserWindow, ipcMain, net } from 'electron';
import { autoUpdater } from 'electron-updater';
import type { UpdateStatus } from './api';

const REPO = 'mlysien/journal';
const RELEASES = `https://github.com/${REPO}/releases/latest`;
const FIRST_CHECK = 10_000, EVERY = 4 * 60 * 60 * 1000;

/** Whether this install can update itself. */
const selfUpdating = () => process.platform === 'win32' || process.platform === 'darwin' || !!process.env.APPIMAGE;

let status: UpdateStatus = { state: app.isPackaged ? 'idle' : 'unsupported' };

function setStatus(s: UpdateStatus) {
  status = s;
  for (const w of BrowserWindow.getAllWindows()) w.webContents.send('update:status', s);
}

/** 1.10.0 > 1.9.2; pre-release suffixes are ignored. */
function newer(a: string, b: string) {
  const pa = a.split(/[.-]/).map(Number), pb = b.split(/[.-]/).map(Number);
  for (let i = 0; i < 3; i++) if ((pa[i] || 0) !== (pb[i] || 0)) return (pa[i] || 0) > (pb[i] || 0);
  return false;
}

/** For installs that can't update themselves: compare with the latest release's tag. */
async function checkRelease() {
  const res = await net.fetch(`https://api.github.com/repos/${REPO}/releases/latest`, { headers: { Accept: 'application/vnd.github+json' } });
  if (!res.ok) throw new Error(`GitHub answered ${res.status}`);
  const { tag_name, html_url } = await res.json() as { tag_name: string; html_url: string };
  const version = tag_name.replace(/^v/, '');
  setStatus(newer(version, app.getVersion()) ? { state: 'available', version, url: html_url || RELEASES } : { state: 'none' });
}

async function check() {
  if (!app.isPackaged || status.state === 'downloading' || status.state === 'ready') return status;
  setStatus({ state: 'checking' });
  try {
    if (selfUpdating()) await autoUpdater.checkForUpdates();
    else await checkRelease();
  } catch (e) {
    setStatus({ state: 'error', error: e instanceof Error ? e.message : String(e) });
  }
  return status;
}

export function setupUpdates() {
  ipcMain.handle('update:status', () => status);
  ipcMain.handle('update:check', () => check());
  ipcMain.handle('update:install', () => { if (status.state === 'ready') autoUpdater.quitAndInstall(true, true); });
  if (!app.isPackaged) return;

  autoUpdater.autoDownload = true;
  autoUpdater.autoInstallOnAppQuit = true;
  autoUpdater.on('update-available', info => setStatus({ state: 'downloading', version: info.version, percent: 0 }));
  autoUpdater.on('download-progress', p => setStatus({ state: 'downloading', version: 'version' in status ? status.version : '', percent: Math.round(p.percent) }));
  autoUpdater.on('update-not-available', () => setStatus({ state: 'none' }));
  autoUpdater.on('update-downloaded', info => setStatus({ state: 'ready', version: info.version }));
  autoUpdater.on('error', e => setStatus({ state: 'error', error: e.message }));

  setTimeout(check, FIRST_CHECK);
  setInterval(check, EVERY);
}
