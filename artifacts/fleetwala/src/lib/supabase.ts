import { useEffect, useState } from 'react';
import { liveGate } from './rules';
import { createClient, type Session, type SupabaseClient } from '@supabase/supabase-js';

const url = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const key = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string | undefined;

export const supabaseConfigured = Boolean(url && key);
export const liveRequested = import.meta.env.VITE_ENABLE_LIVE === 'true';
/** Live mode only when explicitly enabled AND Supabase is configured. */
export const liveMode = liveRequested && supabaseConfigured;
/** Live portal data is never shown until wired; signed-in live users see a setup screen. */
export const gate = liveGate({ enableFlag: liveRequested, supabaseConfigured });

let client: SupabaseClient | null = null;
export function getSupabase(): SupabaseClient | null {
  if (!supabaseConfigured || !url || !key) return null;
  if (!client) {
    client = createClient(url, key, {
      auth: { persistSession: true, detectSessionInUrl: true, autoRefreshToken: true },
    });
  }
  return client;
}

export type AuthResult = { ok: true } | { ok: false; error: string };
const notConfigured: AuthResult = {
  ok: false,
  error: 'Supabase is not configured. Add VITE_SUPABASE_URL and VITE_SUPABASE_PUBLISHABLE_KEY.',
};

export { INDIAN_MOBILE, normalizeIndianPhone } from './rules';
import { normalizeIndianPhone } from './rules';

export async function sendPhoneOtp(phone: string): Promise<AuthResult> {
  const c = getSupabase();
  if (!c) return notConfigured;
  const e164 = normalizeIndianPhone(phone);
  if (!e164) return { ok: false, error: 'Enter a valid 10-digit Indian mobile number starting with 6, 7, 8 or 9.' };
  const { error } = await c.auth.signInWithOtp({ phone: e164 });
  return error ? { ok: false, error: error.message } : { ok: true };
}

export async function verifyPhoneOtp(phone: string, token: string): Promise<AuthResult> {
  const c = getSupabase();
  if (!c) return notConfigured;
  const e164 = normalizeIndianPhone(phone);
  if (!e164) return { ok: false, error: 'Phone number is invalid.' };
  if (!/^\d{6}$/.test(token)) return { ok: false, error: 'Enter the 6-digit code sent by SMS.' };
  const { error } = await c.auth.verifyOtp({ phone: e164, token, type: 'sms' });
  return error ? { ok: false, error: error.message } : { ok: true };
}

export async function sendEmailMagicLink(email: string): Promise<AuthResult> {
  const c = getSupabase();
  if (!c) return notConfigured;
  const redirect = `${window.location.origin}${import.meta.env.BASE_URL.replace(/\/$/, '')}/employer`;
  const { error } = await c.auth.signInWithOtp({ email, options: { emailRedirectTo: redirect } });
  return error ? { ok: false, error: error.message } : { ok: true };
}

export async function signOut(): Promise<AuthResult> {
  const c = getSupabase();
  if (!c) return notConfigured;
  const { error } = await c.auth.signOut();
  return error ? { ok: false, error: error.message } : { ok: true };
}

export function useSession() {
  const [session, setSession] = useState<Session | null>(null);
  const [ready, setReady] = useState(!supabaseConfigured);
  useEffect(() => {
    const c = getSupabase();
    if (!c) return;
    c.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setReady(true);
    });
    const { data } = c.auth.onAuthStateChange((_e, s) => setSession(s));
    return () => data.subscription.unsubscribe();
  }, []);
  return { session, ready };
}
