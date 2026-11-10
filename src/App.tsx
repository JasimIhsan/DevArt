import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import { useSession } from './lib/auth.ts';
import { supabaseConfigured } from './lib/supabase.ts';
import { useToasts } from './lib/ui.ts';
import { HomePage } from './pages/Home.tsx';
import { EditorPage } from './pages/Editor.tsx';
import { LoginPage } from './pages/Login.tsx';
import { PwaStatus } from './pwa.tsx';
import { TooltipProvider } from '@/components/ui/tooltip';
import { ConfirmHost } from './components/ConfirmDialog.tsx';

function Toasts() {
  const toasts = useToasts();
  return <div className="toasts" role="status">{toasts.map((t) => <div key={t.id} className={`toast ${t.error ? 'err' : ''}`}>{t.text}</div>)}</div>;
}

function SetupNeeded() {
  return (
    <div className="center"><div>
      <h2>Supabase isn't configured</h2>
      <p className="muted">Copy <code>.env.example</code> to <code>.env.local</code>, fill in <code>VITE_SUPABASE_URL</code> and <code>VITE_SUPABASE_ANON_KEY</code>, then restart.</p>
    </div></div>
  );
}

export function App() {
  const session = useSession();
  if (!supabaseConfigured) return <SetupNeeded />;
  if (session === undefined) return <div className="center muted">Loading…</div>;
  return (
    <TooltipProvider>
    <BrowserRouter>
      {session ? (
        <Routes>
          <Route path="/" element={<HomePage />} />
          <Route path="/f/:id" element={<EditorPage />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      ) : <LoginPage />}
      <PwaStatus />
      <Toasts />
      <ConfirmHost />
    </BrowserRouter>
    </TooltipProvider>
  );
}
