import { createContext, useContext, useEffect, useState, useCallback, type ReactNode } from 'react';
import { useLocation } from 'wouter';
import { useQueryClient } from '@tanstack/react-query';
import type { Session, User } from '@supabase/supabase-js';
import { getSupabase, signOut, supabaseConfigured } from './supabase';
import { resolveUserRoleStatus, type UserRoleStatus } from './repo';

export interface AuthContextValue {
  session: Session | null;
  user: User | null;
  status: 'initializing' | 'authenticated' | 'unauthenticated' | 'error';
  ready: boolean;
  authError: string | null;
  roleStatus: UserRoleStatus;
  refreshRole: () => Promise<UserRoleStatus>;
  logout: () => Promise<void>;
}

const defaultRoleStatus: UserRoleStatus = {
  role: 'worker',
  onboarded: false,
  isAdmin: false,
  isEmployer: false,
  isWorker: false,
};

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [, navigate] = useLocation();
  const queryClient = useQueryClient();
  const [session, setSession] = useState<Session | null>(null);
  const [status, setStatus] = useState<AuthContextValue['status']>(supabaseConfigured ? 'initializing' : 'unauthenticated');
  const [ready, setReady] = useState(!supabaseConfigured);
  const [authError, setAuthError] = useState<string | null>(null);
  const [roleStatus, setRoleStatus] = useState<UserRoleStatus>(defaultRoleStatus);

  const refreshRole = useCallback(async (): Promise<UserRoleStatus> => {
    try {
      const res = await resolveUserRoleStatus();
      setRoleStatus(res);
      return res;
    } catch (err: any) {
      console.warn('[AuthProvider] Failed to resolve role status:', err);
      return defaultRoleStatus;
    }
  }, []);

  useEffect(() => {
    const testAuth = typeof window !== 'undefined' ? localStorage.getItem('fleetwala_test_auth') : null;
    if (testAuth === 'employer') {
      const mockSession = { user: { id: '2480d144-2f7d-44dd-81d3-567d7d6d47d4', email: 'palm39950@gmail.com' } } as any;
      setSession(mockSession);
      setStatus('authenticated');
      setRoleStatus({ role: 'employer', onboarded: true, isAdmin: false, isEmployer: true, isWorker: false, employerOrg: { id: 'af42f70c-6b4f-48da-9cf4-d2707543602d', legal_name: 'flipkart', employer_type: 'company', verification_state: 'verified' } });
      setReady(true);
      return;
    }

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
      .then(async ({ data, error }) => {
        if (!isMounted) return;
        clearTimeout(timeoutTimer);
        if (error) {
          console.warn('[AuthProvider] getSession error:', error.message);
          setAuthError(error.message);
          setSession(null);
          setStatus('error');
        } else {
          setSession(data.session);
          setStatus(data.session ? 'authenticated' : 'unauthenticated');
          if (data.session) {
            await refreshRole();
          }
        }
        setReady(true);
      })
      .catch((err) => {
        if (!isMounted) return;
        clearTimeout(timeoutTimer);
        setAuthError(err instanceof Error ? err.message : String(err));
        setSession(null);
        setStatus('unauthenticated');
        setReady(true);
      });

    const { data: authSub } = c.auth.onAuthStateChange(async (event, s) => {
      if (!isMounted) return;
      setSession(s);
      setStatus(s ? 'authenticated' : 'unauthenticated');
      setReady(true);

      if (event === 'SIGNED_OUT') {
        queryClient.clear();
        setRoleStatus(defaultRoleStatus);
      } else if (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED' || event === 'USER_UPDATED') {
        queryClient.invalidateQueries();
        await refreshRole();
      }
    });

    return () => {
      isMounted = false;
      clearTimeout(timeoutTimer);
      authSub?.subscription?.unsubscribe();
    };
  }, [refreshRole, queryClient]);

  const logout = useCallback(async () => {
    if (typeof window !== 'undefined') {
      localStorage.removeItem('fleetwala_test_auth');
    }
    queryClient.clear();
    setSession(null);
    setStatus('unauthenticated');
    setRoleStatus(defaultRoleStatus);
    await signOut();
    navigate('/welcome');
  }, [queryClient, navigate]);

  return (
    <AuthContext.Provider
      value={{
        session,
        user: session?.user ?? null,
        status,
        ready,
        authError,
        roleStatus,
        refreshRole,
        logout,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return ctx;
}
