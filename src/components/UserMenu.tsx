// The avatar in the top bar. It opens a small menu with the account's name and email, and Sign out.
import { useEffect, useRef, useState } from 'react';
import { profileOf, signOut, useSession } from '../lib/auth.ts';
import { ConnectDialog } from './ConnectDialog.tsx';

export function UserMenu() {
  const session = useSession();
  const [open, setOpen] = useState(false);
  const [connect, setConnect] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const close = (e: PointerEvent) => { if (!ref.current?.contains(e.target as Node)) setOpen(false); };
    const esc = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false); };
    window.addEventListener('pointerdown', close);
    window.addEventListener('keydown', esc);
    return () => { window.removeEventListener('pointerdown', close); window.removeEventListener('keydown', esc); };
  }, [open]);
  if (!session) return null;
  const me = profileOf(session);
  const face = me.avatarUrl
    ? <img className="avatar" src={me.avatarUrl} alt="" referrerPolicy="no-referrer" />
    : <span className="avatar avatar-fallback" aria-hidden="true">{me.name.slice(0, 1).toUpperCase()}</span>;

  return (
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
          <button role="menuitem" onClick={() => { setOpen(false); setConnect(true); }}>Connect to Claude</button>
          <button role="menuitem" onClick={() => { setOpen(false); void signOut(); }}>Sign out</button>
        </div>
      )}
      {connect && <ConnectDialog onClose={() => setConnect(false)} />}
    </div>
  );
}
