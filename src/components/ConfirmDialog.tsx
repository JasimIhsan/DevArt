// An in-app replacement for window.confirm: `await confirmDialog({...})` resolves true or false.
// <ConfirmHost /> must be rendered once, near the app root.
import { useEffect, useRef, useSyncExternalStore } from 'react';

export interface ConfirmOptions {
  title: string;
  message?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  /** Styles the confirm button as destructive. */
  danger?: boolean;
}
interface Pending extends ConfirmOptions { resolve: (ok: boolean) => void }

let pending: Pending | null = null;
const subs = new Set<() => void>();
const set = (p: Pending | null) => { pending = p; subs.forEach((f) => f()); };

export function confirmDialog(opts: ConfirmOptions): Promise<boolean> {
  // A second request while one is open cancels the first.
  pending?.resolve(false);
  return new Promise((resolve) => set({ ...opts, resolve }));
}

export function ConfirmHost() {
  const p = useSyncExternalStore((f) => { subs.add(f); return () => subs.delete(f); }, () => pending);
  const confirmRef = useRef<HTMLButtonElement>(null);
  const close = (ok: boolean) => { p?.resolve(ok); set(null); };

  useEffect(() => {
    if (!p) return;
    const previous = document.activeElement as HTMLElement | null;
    confirmRef.current?.focus();
    const key = (e: KeyboardEvent) => {
      if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); close(false); }
    };
    window.addEventListener('keydown', key, true);
    return () => { window.removeEventListener('keydown', key, true); previous?.focus?.(); };
  }, [p]);

  if (!p) return null;
  return (
    <div className="modal-backdrop" onPointerDown={(e) => { if (e.target === e.currentTarget) close(false); }}>
      <div className="modal confirm" role="alertdialog" aria-modal="true" aria-labelledby="confirm-title" aria-describedby={p.message ? 'confirm-msg' : undefined}>
        <div className="confirm-body">
          <h2 id="confirm-title">{p.title}</h2>
          {p.message && <p id="confirm-msg" className="muted">{p.message}</p>}
        </div>
        <div className="confirm-foot">
          <button onClick={() => close(false)}>{p.cancelLabel ?? 'Cancel'}</button>
          <button ref={confirmRef} className={p.danger ? 'confirm-danger' : 'primary'} onClick={() => close(true)}>{p.confirmLabel ?? 'OK'}</button>
        </div>
      </div>
    </div>
  );
}
