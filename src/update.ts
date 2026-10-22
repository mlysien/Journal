import { useEffect, useState } from 'react';
import type { UpdateStatus } from '../electron/api';

/** The app update status, kept current. */
export function useUpdate(): UpdateStatus {
  const [status, setStatus] = useState<UpdateStatus>({ state: 'idle' });
  useEffect(() => {
    window.journal.updateStatus().then(setStatus).catch(() => {});
    return window.journal.onUpdateStatus(setStatus);
  }, []);
  return status;
}

/** A one-line description of the status, for Settings. */
export function updateText(s: UpdateStatus): string {
  switch (s.state) {
    case 'checking': return 'Checking for updates…';
    case 'none': return 'You have the latest version.';
    case 'available': return `Version ${s.version} is available.`;
    case 'downloading': return `Downloading version ${s.version}… ${s.percent}%`;
    case 'ready': return `Version ${s.version} is ready. It installs when you restart Journal.`;
    case 'error': {
      // The updater's messages run to several lines of HTTP details; the first sentence says enough.
      const first = s.error.split(/\n|: HttpError/)[0];
      return `Couldn’t check for updates. ${first.length > 140 ? first.slice(0, 140) + '…' : first}`;
    }
    case 'unsupported': return 'Updates are off in development builds.';
    default: return 'Updates are checked automatically.';
  }
}
