// Trade-Disk — auth helpers shared by the gate. useSession tracks the logged-in
// session; ensureProfile creates the account's profile row on first sign-in (the
// app does this instead of a database trigger on auth.users); signOut ends it.
import { useState, useEffect } from 'react';
import { supabase } from './supabase.js';

export function useSession() {
  const [session, setSession] = useState(null);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => { setSession(data.session); setLoading(false); });
    const { data: sub } = supabase.auth.onAuthStateChange((_event, s) => setSession(s));
    return () => sub.subscription.unsubscribe();
  }, []);
  return { session, loading };
}

// Create the profile row the first time (INSERT ... ON CONFLICT DO NOTHING via
// ignoreDuplicates). RLS lets a user insert only their own row (id = auth.uid()).
export async function ensureProfile(user) {
  if (!user) return;
  try {
    await supabase.from('profile').upsert(
      { id: user.id, email: user.email },
      { onConflict: 'id', ignoreDuplicates: true },
    );
  } catch { /* already exists or offline — not fatal */ }
}

export const signOut = () => supabase.auth.signOut();
