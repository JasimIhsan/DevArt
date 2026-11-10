import { useEffect, useState } from 'react';
import type { Session } from '@supabase/supabase-js';
import { supabase } from './supabase.ts';

export interface Profile { id: string; email: string; name: string; avatarUrl: string | null }

/** `undefined` while the stored session is being read, `null` when signed out. */
export function useSession() {
  const [session, setSession] = useState<Session | null | undefined>(undefined);
  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setSession(data.session));
    const { data } = supabase.auth.onAuthStateChange((_event, s) => setSession(s));
    return () => data.subscription.unsubscribe();
  }, []);
  return session;
}

export const signInWithGoogle = () =>
  supabase.auth.signInWithOAuth({ provider: 'google', options: { redirectTo: `${location.origin}/` } });

export const signOut = () => supabase.auth.signOut();

export function profileOf(session: Session): Profile {
  const m = session.user.user_metadata ?? {};
  return {
    id: session.user.id,
    email: session.user.email ?? '',
    name: m.full_name ?? m.name ?? session.user.email ?? 'You',
    avatarUrl: m.avatar_url ?? m.picture ?? null,
  };
}
