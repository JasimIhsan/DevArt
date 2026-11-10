import { useEffect, useState, useSyncExternalStore } from 'react';
import { Icon } from './components/ui.tsx';

type InstallEvent = Event & { prompt: () => Promise<void>; userChoice: Promise<{ outcome: string }> };

let installEvent: InstallEvent | null = null;
let waitingWorker: ServiceWorker | null = null;
const subs = new Set<() => void>();
const notify = () => subs.forEach((f) => f());
const subscribe = (f: () => void) => { subs.add(f); return () => { subs.delete(f); }; };

export function registerPwa() {
  window.addEventListener('beforeinstallprompt', (e) => { e.preventDefault(); installEvent = e as InstallEvent; notify(); });
  window.addEventListener('appinstalled', () => { installEvent = null; notify(); });
  // Dev builds have no generated worker, so only production registers one.
  if (!import.meta.env.PROD || !('serviceWorker' in navigator)) return;
  window.addEventListener('load', async () => {
    try {
      const reg = await navigator.serviceWorker.register('/sw.js');
      const watch = (w: ServiceWorker | null) => {
        if (!w) return;
        const check = () => { if (w.state === 'installed' && navigator.serviceWorker.controller) { waitingWorker = w; notify(); } };
        w.addEventListener('statechange', check);
        check();
      };
      watch(reg.waiting);
      reg.addEventListener('updatefound', () => watch(reg.installing));
    } catch (e) {
      console.warn('Service worker registration failed', e);
    }
  });
}

export function InstallButton() {
  const available = useSyncExternalStore(subscribe, () => installEvent !== null);
  if (!available) return null;
  return (
    <button onClick={async () => {
      const e = installEvent!;
      await e.prompt();
      await e.userChoice;
      installEvent = null;
      notify();
    }}><Icon name="download" /> Install app</button>
  );
}

/** Tells the user when a new version of the app is ready. */
export function PwaStatus() {
  const update = useSyncExternalStore(subscribe, () => waitingWorker !== null);
  const [applying, setApplying] = useState(false);

  useEffect(() => {
    if (!applying || !('serviceWorker' in navigator)) return;
    const reload = () => location.reload();
    navigator.serviceWorker.addEventListener('controllerchange', reload);
    return () => navigator.serviceWorker.removeEventListener('controllerchange', reload);
  }, [applying]);

  if (!update) return null;
  return (
    <div className="pwa-status" role="status">
      {update && (
        <>
          <span>A new version of DevArt is ready.</span>
          <button onClick={() => { setApplying(true); waitingWorker?.postMessage('skip-waiting'); }}>Update</button>
        </>
      )}
    </div>
  );
}
