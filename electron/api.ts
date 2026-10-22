/** The bridge the preload script exposes to the renderer as `window.journal`. Types only. */

export interface VaultSnapshot {
  /** Absolute path of the vault folder. */
  root: string;
  /** Every Markdown file in the vault, keyed by path relative to the root, using `/`. */
  files: Record<string, string>;
  /** Every folder in the vault (relative, using `/`), including empty ones. */
  dirs: string[];
  /** Every other (non-Markdown) file: images, PDFs and other attachments. */
  assets: string[];
  /** Contents of `.journal/state.json`, or null on a fresh vault. */
  state: unknown | null;
  /** Obsidian's daily notes settings (`.obsidian/daily-notes.json`), when the vault has them. */
  obsidianDaily: { folder?: string; format?: string } | null;
}

export interface VaultSync {
  /** Relative paths to remove. Applied before writes, so a case-only rename is safe on Windows. */
  deletes: string[];
  writes: Record<string, string>;
  /** Folders to remove if they are empty once deletes are done, deepest first. */
  prune: string[];
}

/** Where an app update stands. `available` is for installs that can't update themselves (the .deb). */
export type UpdateStatus =
  | { state: 'idle' | 'checking' | 'none' | 'unsupported' }
  | { state: 'available'; version: string; url: string }
  | { state: 'downloading'; version: string; percent: number }
  | { state: 'ready'; version: string }
  | { state: 'error'; error: string };

export interface JournalApi {
  platform: NodeJS.Platform;
  load(): Promise<VaultSnapshot>;
  sync(change: VaultSync): Promise<void>;
  writeState(json: string): Promise<void>;
  /**
   * Saves a file into the vault folder `dir`, renaming it if the name is taken. Pass `path` to
   * copy a file from disk, or `data` for clipboard contents. Resolves to its vault-relative path.
   */
  saveAttachment(dir: string, name: string, src: { path?: string; data?: ArrayBuffer }): Promise<string>;
  /** Opens a vault file in its default app. */
  openAsset(rel: string): Promise<void>;
  /** The disk path of a pasted or dropped File, when it has one. */
  pathForFile(file: File): string;
  /** Of the given file:// URIs or absolute paths, the ones that are existing files (as paths); null if any isn't. */
  existingFiles(candidates: string[]): Promise<string[] | null>;
  /** Moves a vault file or folder to the OS trash. */
  trash(rel: string): Promise<void>;
  /** Creates a folder (and any missing parents) inside the vault. */
  mkdir(rel: string): Promise<void>;
  /** Shows a folder picker; resolves to the new root, or null if cancelled. */
  chooseVault(): Promise<string | null>;
  revealVault(): Promise<void>;
  openExternal(url: string): Promise<void>;
  copyText(text: string): Promise<void>;
  /** Fetches a web page's title for a pasted link; null if it can't be read. */
  fetchTitle(url: string): Promise<string | null>;
  setTitleBar(colors: { color: string; symbolColor: string }): void;
  /** Whether the app starts when the user logs in. */
  getAutostart(): Promise<boolean>;
  setAutostart(on: boolean): Promise<void>;
  /** Tells the main process the app has rendered, so the splash screen can go. */
  ready(): void;
  version: string;
  updateStatus(): Promise<UpdateStatus>;
  checkForUpdates(): Promise<UpdateStatus>;
  /** Restarts into a downloaded update. */
  installUpdate(): Promise<void>;
  /** Calls `fn` whenever the update status changes; returns a function that stops it. */
  onUpdateStatus(fn: (s: UpdateStatus) => void): () => void;
  /** Registers the function that writes pending changes; the window waits for it before closing. */
  onFlush(fn: () => Promise<void>): void;
}
