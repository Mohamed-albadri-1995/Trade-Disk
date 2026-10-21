// Trade-Disk — Supabase access (hosted mode). All database access goes through
// Supabase's HTTPS API (PostgREST) via supabase-js; raw Postgres TCP is not used
// (it is blocked in some run environments, and HTTPS scales/pools better anyway).
//
// Public config (URL + publishable key) is safe to ship in code. The service-role
// key is a secret, read only from the environment, and is used solely for
// background jobs / global writes that have no signed-in user. Per-user requests
// act AS the user via their JWT, so row-level security scopes every query to that
// account — no secret required for the interactive app.

import { createClient } from '@supabase/supabase-js';

export const SUPABASE_URL = process.env.SUPABASE_URL || 'https://ahuqsbkzeyxwtxzjnaug.supabase.co';
export const SUPABASE_PUBLISHABLE_KEY =
  process.env.SUPABASE_PUBLISHABLE_KEY || 'sb_publishable_Sy0xHVv3OFQ_Z45Vk1Kl3A_YHrOaTlI';
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

const BASE = { auth: { persistSession: false, autoRefreshToken: false } };

// A client that acts as the signed-in user (their access token). Row-level
// security then limits every read/write to that account's own rows.
export function userClient(accessToken) {
  return createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
    ...BASE,
    global: { headers: { Authorization: `Bearer ${accessToken}` } },
  });
}

// The service-role client bypasses RLS — for background jobs and global/operator
// writes only. null when the secret is not configured (the interactive app does
// not need it).
export const admin = SERVICE_ROLE_KEY ? createClient(SUPABASE_URL, SERVICE_ROLE_KEY, BASE) : null;
export const hasServiceRole = !!SERVICE_ROLE_KEY;

// Verify a Supabase access token and return its user ({ id, email, ... }) or null.
// Uses the Auth API over HTTPS; no secret needed.
export async function getUser(accessToken) {
  if (!accessToken) return null;
  const client = createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, BASE);
  const { data, error } = await client.auth.getUser(accessToken);
  return error ? null : data.user;
}
