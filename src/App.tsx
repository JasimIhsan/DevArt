import { Toaster } from "@/components/ui/toast";
import { TooltipProvider } from "@/components/ui/tooltip";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import { ConfirmHost } from "./components/ConfirmDialog.tsx";
import { useSession } from "./lib/auth.ts";
import { supabaseConfigured } from "./lib/supabase.ts";
import { EditorPage } from "./pages/Editor.tsx";
import { HomePage } from "./pages/Home.tsx";
import { LoginPage } from "./pages/Login.tsx";
import { NotFoundPage } from "./pages/NotFound.tsx";
import { PwaStatus } from "./pwa.tsx";

function SetupNeeded() {
   return (
      <div className="center">
         <div>
            <h2>Supabase isn't configured</h2>
            <p className="muted">
               Copy <code>.env.example</code> to <code>.env.local</code>, fill in <code>VITE_SUPABASE_URL</code> and <code>VITE_SUPABASE_ANON_KEY</code>, then restart.
            </p>
         </div>
      </div>
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
                  <Route path="*" element={<NotFoundPage />} />
               </Routes>
            ) : (
               <Routes>
                  <Route path="/" element={<LoginPage />} />
                  <Route path="/f/:id" element={<LoginPage />} />
                  <Route path="*" element={<NotFoundPage />} />
               </Routes>
            )}
            <PwaStatus />
            <Toaster />
            <ConfirmHost />
         </BrowserRouter>
      </TooltipProvider>
   );
}
