// The avatar in the top bar. It opens a small menu with the account's name and email, and Sign out.
import { useEffect, useRef, useState } from 'react';
import { profileOf, signOut, useSession } from '../lib/auth.ts';
import { ConnectDialog } from './ConnectDialog.tsx';
import { applyUpdate, useUpdateReady } from '../pwa.tsx';

export function UserMenu() {
  const session = useSession();
  const [open, setOpen] = useState(false);
  const [connect, setConnect] = useState(false);
  const updateReady = useUpdateReady();
  const [updateOpen, setUpdateOpen] = useState(false);
  const updateRef = useRef<HTMLDivElement>(null);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const close = (e: PointerEvent) => { if (!ref.current?.contains(e.target as Node)) setOpen(false); };
    const esc = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false); };
    window.addEventListener('pointerdown', close);
    window.addEventListener('keydown', esc);
    return () => { window.removeEventListener('pointerdown', close); window.removeEventListener('keydown', esc); };
  }, [open]);
  useEffect(() => {
    if (!updateOpen) return;
    const close = (e: PointerEvent) => { if (!updateRef.current?.contains(e.target as Node)) setUpdateOpen(false); };
    const esc = (e: KeyboardEvent) => { if (e.key === 'Escape') setUpdateOpen(false); };
    window.addEventListener('pointerdown', close);
    window.addEventListener('keydown', esc);
    return () => { window.removeEventListener('pointerdown', close); window.removeEventListener('keydown', esc); };
  }, [updateOpen]);
  if (!session) return null;
  const me = profileOf(session);
  const face = me.avatarUrl
    ? <img className="avatar" src={me.avatarUrl} alt="" referrerPolicy="no-referrer" />
    : <span className="avatar avatar-fallback" aria-hidden="true">{me.name.slice(0, 1).toUpperCase()}</span>;

  return (
    <>
    {updateReady && (
      <div className="menu" ref={updateRef}>
        <button className="update-pill" aria-haspopup="menu" aria-expanded={updateOpen} onClick={() => setUpdateOpen(!updateOpen)}>
          Update <span aria-hidden="true">⋮</span>
        </button>
        {updateOpen && (
          <div className="menu-pop update-pop" role="menu">
            <p className="muted small">A new version of DevArt is ready.</p>
            <button role="menuitem" className="primary" onClick={applyUpdate}>Reload to update</button>
          </div>
        )}
      </div>
    )}
    <div className="menu" ref={ref}>
      <button className="avatar-btn" aria-label={`Account: ${me.name}`} aria-haspopup="menu" aria-expanded={open} onClick={() => setOpen(!open)}>{face}</button>
      {open && (
        <div className="menu-pop account-pop" role="menu">
          <div className="account-head">
            {face}
            <div className="account-who">
              <b className="truncate">{me.name}</b>
              <span className="muted small truncate">{me.email}</span>
            </div>
          </div>
          <div className="menu-sep" />
          {updateReady && <button role="menuitem" onClick={applyUpdate}>Reload to update</button>}
          <button role="menuitem" onClick={() => { setOpen(false); setConnect(true); }}>Connect to Claude</button>
          <button role="menuitem" onClick={() => { setOpen(false); void signOut(); }}>Sign out</button>
        </div>
      )}
      {connect && <ConnectDialog onClose={() => setConnect(false)} />}
    </div>
    </>
  );
}
