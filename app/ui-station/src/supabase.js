// Trade-Disk — browser Supabase client (hosted mode). The URL + publishable key
// are public by design; row-level security is what protects each account's data.
// The session is persisted in localStorage and, because every Trade-Disk app is
// served from the same origin, one login is shared across the Station and all tools.
import { createClient } from '@supabase/supabase-js';

export const SUPABASE_URL = 'https://ahuqsbkzeyxwtxzjnaug.supabase.co';
export const SUPABASE_KEY = 'sb_publishable_Sy0xHVv3OFQ_Z45Vk1Kl3A_YHrOaTlI';

export const supabase = createClient(SUPABASE_URL, SUPABASE_KEY, {
  auth: { persistSession: true, autoRefreshToken: true, storageKey: 'td-auth' },
});
