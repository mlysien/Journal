import { StrictMode, useEffect, useState } from 'react';
import { createRoot } from 'react-dom/client';
import '@fontsource/geist-sans/400.css';
import '@fontsource/geist-sans/500.css';
import '@fontsource/geist-sans/600.css';
import '@fontsource/jetbrains-mono/400.css';
import '@fontsource/jetbrains-mono/500.css';
import '@fontsource/cascadia-code/400.css';
import '@fontsource/cascadia-code/500.css';
import { App } from './App';
import { todayIso } from './dates';
import { fromSnapshot, type Loaded } from './vault';
import './styles.css';

/** Reads the vault from disk, then hands it to the app. */
function Root() {
  const [loaded, setLoaded] = useState<Loaded | null>(null);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    window.journal.load()
      .then(snap => setLoaded(fromSnapshot(snap, todayIso())))
      .catch(e => setError(e instanceof Error ? e.message : String(e)));
  }, []);
  // The main process shows the window (and closes the splash screen) once there's something to see.
  useEffect(() => { if (loaded || error) window.journal.ready(); }, [loaded, error]);
  if (error) return <div className="boot">Could not open the vault folder.<br /><small>{error}</small></div>;
  if (!loaded) return <div className="boot" />;
  return <App initial={loaded} />;
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <Root />
  </StrictMode>,
);
