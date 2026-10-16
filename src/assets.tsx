/** Attachments: resolving a note's references to vault files, and saving pasted or dropped files. */
import { createContext, useContext } from 'react';

export const ATTACHMENTS = 'Attachments';

const IMAGE_EXT = /\.(png|jpe?g|gif|webp|svg|bmp|avif|ico)$/i;
export const isImage = (name: string) => IMAGE_EXT.test(name);

const dirOf = (p: string) => p.slice(0, Math.max(0, p.lastIndexOf('/')));
const baseOf = (p: string) => p.slice(p.lastIndexOf('/') + 1);

/** `a/b/../c/./d` → `a/c/d`. */
function normalize(p: string) {
  const out: string[] = [];
  for (const seg of p.split('/')) {
    if (!seg || seg === '.') continue;
    if (seg === '..') out.pop(); else out.push(seg);
  }
  return out.join('/');
}

/** URL for showing a vault file in the page. */
export const vaultUrl = (rel: string) => 'vault://local/' + rel.split('/').map(encodeURIComponent).join('/');

/** How a note links to a file in its Attachments folder: spaces and brackets are %-encoded. */
export const linkTarget = (fromDir: string, rel: string) => {
  const r = fromDir && rel.startsWith(fromDir + '/') ? rel.slice(fromDir.length + 1) : rel;
  return r.split('/').map(s => encodeURIComponent(s).replace(/%2C/g, ',').replace(/%40/g, '@')).join('/');
};

export interface Assets {
  /** Vault path a reference points to, or null if no such file. `wiki` is for `[[name]]` / `![[name]]`. */
  resolve(ref: string, wiki: boolean): string | null;
  open(rel: string): void;
}

export function makeAssets(all: string[], noteDir: string, open: (rel: string) => void): Assets {
  const exact = new Map(all.map(p => [p.toLowerCase(), p]));
  return {
    open,
    resolve(ref, wiki) {
      if (wiki) {
        // Obsidian resolves by file name; prefer the note's own Attachments folder, then nearby files.
        const name = ref.split('|')[0].trim();
        const direct = exact.get(normalize(name).toLowerCase()) ?? exact.get(normalize((noteDir ? noteDir + '/' : '') + name).toLowerCase());
        if (direct) return direct;
        const base = baseOf(name).toLowerCase();
        const hits = all.filter(p => baseOf(p).toLowerCase() === base);
        const near = (p: string) => (dirOf(p) === (noteDir ? noteDir + '/' : '') + ATTACHMENTS ? 0 : dirOf(p) === noteDir ? 1 : 2);
        return hits.sort((a, b) => near(a) - near(b) || a.length - b.length)[0] ?? null;
      }
      let decoded = ref;
      try { decoded = decodeURIComponent(ref); } catch { /* keep as written */ }
      const rel = decoded.startsWith('/') ? normalize(decoded) : normalize((noteDir ? noteDir + '/' : '') + decoded);
      return exact.get(rel.toLowerCase()) ?? null;
    },
  };
}

export const AssetContext = createContext<Assets>({ resolve: () => null, open: () => {} });
export const useAssets = () => useContext(AssetContext);

/** "Pasted image 20261016143201.png", like Obsidian names pasted screenshots. */
export function pastedImageName(type: string) {
  const d = new Date(), p = (n: number) => String(n).padStart(2, '0');
  const ext = type.split('/')[1]?.replace('jpeg', 'jpg').replace(/\+.*/, '') || 'png';
  return `Pasted image ${d.getFullYear()}${p(d.getMonth() + 1)}${p(d.getDate())}${p(d.getHours())}${p(d.getMinutes())}${p(d.getSeconds())}.${ext}`;
}

export interface Incoming { name: string; path?: string; file?: File }

/** Save files into `<noteDir>/Attachments` and return the Markdown that links each one. */
export async function saveIncoming(noteDir: string, items: Incoming[]): Promise<{ rel: string; markdown: string; image: boolean }[]> {
  const dir = (noteDir ? noteDir + '/' : '') + ATTACHMENTS;
  const out = [];
  for (const it of items) {
    const rel = await window.journal.saveAttachment(dir, it.name, it.path ? { path: it.path } : { data: await it.file!.arrayBuffer() });
    const name = baseOf(rel), target = linkTarget(noteDir, rel), image = isImage(name);
    out.push({ rel, image, markdown: image ? `![${name.replace(/[[\]]/g, '')}](${target})` : `[${name.replace(/[[\]]/g, '')}](${target})` });
  }
  return out;
}

/** Files in a paste: screenshots and copied images, files copied in a file manager (as File objects or paths). */
export async function filesFromClipboard(data: DataTransfer): Promise<Incoming[] | null> {
  const files = Array.from(data.files);
  if (files.length) {
    return files.map(f => {
      const path = window.journal.pathForFile(f) || undefined;
      // Screenshots arrive as an unnamed "image.png".
      const name = !path && f.type.startsWith('image/') && /^image\.\w+$/.test(f.name) ? pastedImageName(f.type) : f.name || pastedImageName(f.type);
      return { name, path, file: f };
    });
  }
  const image = Array.from(data.items).find(it => it.kind === 'file' && it.type.startsWith('image/'))?.getAsFile();
  if (image) return [{ name: pastedImageName(image.type), file: image }];
  // Linux file managers put copied files on the clipboard as file:// URIs or plain paths.
  const text = (data.getData('text/uri-list') || data.getData('text/plain')).trim();
  const lines = text.split(/\r?\n/).map(l => l.trim()).filter(l => l && !l.startsWith('#'));
  if (!lines.length || !lines.every(l => /^(file:\/\/|\/|[A-Za-z]:\\)/.test(l))) return null;
  const paths = await window.journal.existingFiles(lines);
  return paths ? paths.map(p => ({ name: baseOf(p.replace(/\\/g, '/')), path: p })) : null;
}

/** True when a paste might hold files, so the caller should stop the default paste and check. */
export function mayHoldFiles(data: DataTransfer) {
  if (data.files.length || Array.from(data.items).some(it => it.kind === 'file')) return true;
  const text = (data.getData('text/uri-list') || data.getData('text/plain')).trim();
  return !!text && text.split(/\r?\n/).every(l => /^(file:\/\/|\/|[A-Za-z]:\\)/.test(l.trim()) || l.trim().startsWith('#'));
}
