// Trade-Disk — a tool's auth: the shared Supabase session (one login across all
// apps, same origin), the Authorization header for API calls, and a gate that
// sends a signed-out visitor to the Station to log in.
import { createClient } from '@supabase/supabase-js';
import { useState, useEffect } from 'react';

export const supabase = createClient(
  'https://ahuqsbkzeyxwtxzjnaug.supabase.co',
  'sb_publishable_Sy0xHVv3OFQ_Z45Vk1Kl3A_YHrOaTlI',
  { auth: { persistSession: true, autoRefreshToken: true, storageKey: 'td-auth' } },
);

export async function authHeader() {
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  return token ? { Authorization: `Bearer ${token}` } : {};
}

async function ensureProfile() {
  const { data } = await supabase.auth.getUser();
  if (!data.user) return;
  try {
    await supabase.from('profile').upsert({ id: data.user.id, email: data.user.email }, { onConflict: 'id', ignoreDuplicates: true });
  } catch { /* already exists — fine */ }
}

// Gate a tool behind the shared login: no session → go to the Station to sign in.
export function useGate() {
  const [ready, setReady] = useState(false);
  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      if (!data.session) { window.location.replace('/'); return; }
      ensureProfile();          // background — the gate opens on the local session check
      setReady(true);
    });
  }, []);
  return ready;
}

export const signOut = () => supabase.auth.signOut().then(() => window.location.replace('/'));
