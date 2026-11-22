import { useEffect, useState } from 'react';
import { liveGate } from './rules';
import { createClient, type Session, type SupabaseClient, type User } from '@supabase/supabase-js';

// Isomorphic environment resolution safe for both browser (Vite import.meta.env) and Node.js test runners (process.env)
const getEnvVar = (name: 'VITE_SUPABASE_URL' | 'VITE_SUPABASE_PUBLISHABLE_KEY' | 'VITE_ENABLE_LIVE' | 'BASE_URL'): string | undefined => {
  try {
    if (typeof import.meta !== 'undefined' && import.meta.env) {
      const val = import.meta.env[name];
      if (typeof val === 'string' && val.trim().length > 0) return val.trim();
    }
  } catch {}
  try {
    if (typeof process !== 'undefined' && process.env) {
      const val = process.env[name];
      if (typeof val === 'string' && val.trim().length > 0) return val.trim();
    }
  } catch {}
  return undefined;
};

// Direct literals ensure Vite's AST static replacement plugin can substitute values in client builds
const rawUrl =
  (typeof import.meta !== 'undefined' && import.meta.env ? import.meta.env.VITE_SUPABASE_URL : undefined) ||
  getEnvVar('VITE_SUPABASE_URL');

const rawKey =
  (typeof import.meta !== 'undefined' && import.meta.env ? import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY : undefined) ||
  getEnvVar('VITE_SUPABASE_PUBLISHABLE_KEY');

const rawLive =
  (typeof import.meta !== 'undefined' && import.meta.env ? import.meta.env.VITE_ENABLE_LIVE : undefined) ||
  getEnvVar('VITE_ENABLE_LIVE');

const url = rawUrl;
const key = rawKey;

export const supabaseConfigured = Boolean(url && key && !url.includes('YOUR-STAGING-PROJECT'));
export const liveRequested = rawLive === 'true';
/** Live mode only when explicitly enabled AND Supabase is configured. */
export const liveMode = liveRequested && supabaseConfigured;
/** Live portal data gate: fail-closed if requested without credentials. */
export const gate = liveGate({ enableFlag: liveRequested, supabaseConfigured });

let client: SupabaseClient | null = null;
export function getSupabase(): SupabaseClient | null {
  if (!supabaseConfigured || !url || !key) return null;
  if (!client) {
    client = createClient(url, key, {
      auth: {
        persistSession: true,
        detectSessionInUrl: true,
        autoRefreshToken: true,
        flowType: 'pkce',
      },
    });
  }
  return client;
}

export type AuthResult = { ok: true; user?: User; session?: Session } | { ok: false; error: string };
const notConfigured: AuthResult = {
  ok: false,
  error: 'Supabase is not configured. Add VITE_SUPABASE_URL and VITE_SUPABASE_PUBLISHABLE_KEY.',
};

export { INDIAN_MOBILE, normalizeIndianPhone } from './rules';
import { normalizeIndianPhone } from './rules';

/** Get the configured redirect origin for OAuth and email confirmations */
export function getRedirectUrl(path: string = '/'): string {
  const origin = typeof window !== 'undefined' ? window.location.origin : '';
  const rawBase =
    (typeof import.meta !== 'undefined' && import.meta.env ? import.meta.env.BASE_URL : undefined) ||
    getEnvVar('BASE_URL') ||
    '/';
  const base = rawBase.replace(/\/$/, '');
  const cleanPath = path.startsWith('/') ? path : `/${path}`;
  return `${origin}${base}${cleanPath}`;
}

/** Email + Password Sign In */
export async function signInWithEmail(email: string, password: string): Promise<AuthResult> {
  const c = getSupabase();
  if (!c) return notConfigured;
  const { data, error } = await c.auth.signInWithPassword({ email, password });
  if (error) return { ok: false, error: error.message };
  return { ok: true, user: data.user, session: data.session };
}

/** Email + Password Registration with user metadata (role & name) */
export async function signUpWithEmail(
  email: string,
  password: string,
  role: 'worker' | 'employer',
  fullName?: string
): Promise<AuthResult> {
  const c = getSupabase();
  if (!c) return notConfigured;
  const redirect = getRedirectUrl(role === 'employer' ? '/employer' : '/');
  const { data, error } = await c.auth.signUp({
    email,
    password,
    options: {
      data: {
        role,
        full_name: fullName?.trim() || (role === 'worker' ? 'Worker' : 'Employer'),
      },
      emailRedirectTo: redirect,
    },
  });
  if (error) return { ok: false, error: error.message };
  return { ok: true, user: data.user ?? undefined, session: data.session ?? undefined };
}

/** Password Reset Request via Email */
export async function resetPasswordForEmail(email: string): Promise<AuthResult> {
  const c = getSupabase();
  if (!c) return notConfigured;
  const redirect = getRedirectUrl('/login?reset=true');
  const { error } = await c.auth.resetPasswordForEmail(email, {
    redirectTo: redirect,
  });
  if (error) return { ok: false, error: error.message };
  return { ok: true };
}

/** Update user password (used after password reset recovery) */
export async function updateUserPassword(newPassword: string): Promise<AuthResult> {
  const c = getSupabase();
  if (!c) return notConfigured;
  const { data, error } = await c.auth.updateUser({ password: newPassword });
  if (error) return { ok: false, error: error.message };
  return { ok: true, user: data.user };
}

/** OAuth Sign In via Google or GitHub */
export async function signInWithOAuth(provider: 'google' | 'github', targetRole: 'worker' | 'employer' = 'worker'): Promise<AuthResult> {
  const c = getSupabase();
  if (!c) return notConfigured;
  const redirect = getRedirectUrl(targetRole === 'employer' ? '/employer' : '/');
  const { error } = await c.auth.signInWithOAuth({
    provider,
    options: {
      redirectTo: redirect,
      queryParams: {
        access_type: 'offline',
        prompt: 'consent',
      },
    },
  });
  if (error) return { ok: false, error: error.message };
  return { ok: true };
}

/**
 * Mobile Phone OTP (MSG91 / SMS gateway integration)
 * NOTE: Deferred for Pre-Production as per owner confirmed decisions.
 * Preserved for future SMS provider hook integration.
 */
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

/** Email Magic Link fallback */
export async function sendEmailMagicLink(email: string): Promise<AuthResult> {
  const c = getSupabase();
  if (!c) return notConfigured;
  const redirect = getRedirectUrl('/employer');
  const { error } = await c.auth.signInWithOtp({ email, options: { emailRedirectTo: redirect } });
  return error ? { ok: false, error: error.message } : { ok: true };
}

/** Sign Out */
export async function signOut(): Promise<AuthResult> {
  const c = getSupabase();
  if (!c) return notConfigured;
  const { error } = await c.auth.signOut();
  return error ? { ok: false, error: error.message } : { ok: true };
}

export type AuthStatus = 'initializing' | 'authenticated' | 'unauthenticated' | 'error';

/** Session Hook with resilient state machine & bounded timeout */
export function useSession() {
  const [session, setSession] = useState<Session | null>(null);
  const [status, setStatus] = useState<AuthStatus>(supabaseConfigured ? 'initializing' : 'unauthenticated');
  const [ready, setReady] = useState(!supabaseConfigured);
  const [authError, setAuthError] = useState<string | null>(null);

  useEffect(() => {
    const c = getSupabase();
    if (!c) {
      setReady(true);
      setStatus('unauthenticated');
      return;
    }

    let isMounted = true;

    // Timeout guard: never hang on infinite loading screen
    const timeoutTimer = setTimeout(() => {
      if (isMounted) {
        setReady(true);
        setStatus('unauthenticated');
      }
    }, 4000);

    c.auth.getSession()
      .then(({ data, error }) => {
        if (!isMounted) return;
        clearTimeout(timeoutTimer);
        if (error) {
          console.warn('[Auth] getSession returned error:', error.message);
          setAuthError(error.message);
          setSession(null);
          setStatus('error');
        } else {
          setSession(data.session);
          setStatus(data.session ? 'authenticated' : 'unauthenticated');
        }
        setReady(true);
      })
      .catch((err) => {
        if (!isMounted) return;
        clearTimeout(timeoutTimer);
        console.warn('[Auth] getSession threw exception:', err);
        setAuthError(err instanceof Error ? err.message : String(err));
        setSession(null);
        setStatus('unauthenticated');
        setReady(true);
      });

    const { data: authSub } = c.auth.onAuthStateChange((_e, s) => {
      if (!isMounted) return;
      setSession(s);
      setStatus(s ? 'authenticated' : 'unauthenticated');
      setReady(true);
    });

    return () => {
      isMounted = false;
      clearTimeout(timeoutTimer);
      authSub?.subscription?.unsubscribe();
    };
  }, []);

  return { session, ready, status, authError, user: session?.user ?? null };
}
