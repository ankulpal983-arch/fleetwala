import { useEffect, useState } from 'react';
import { useLocation, Link } from 'wouter';
import { Loader2, AlertCircle, ArrowRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Wordmark, PilotChip } from '@/components/shell';
import { getSupabase } from '@/lib/supabase';
import { resolveUserRoleStatus } from '@/lib/repo';

export function AuthCallbackPage() {
  const [, navigate] = useLocation();
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [processing, setProcessing] = useState(true);

  useEffect(() => {
    async function handleAuth() {
      const c = getSupabase();
      if (!c) {
        setErrorMsg('Authentication client is not configured.');
        setProcessing(false);
        return;
      }

      try {
        const url = new URL(window.location.href);
        const code = url.searchParams.get('code');
        const error = url.searchParams.get('error_description') || url.searchParams.get('error');

        if (error) {
          setErrorMsg(error);
          setProcessing(false);
          return;
        }

        // Exchange code if PKCE OAuth flow
        if (code) {
          const { error: exchangeError } = await c.auth.exchangeCodeForSession(code);
          if (exchangeError) {
            setErrorMsg(exchangeError.message);
            setProcessing(false);
            return;
          }
        }

        // Check hash fragments for recovery or implicit flow
        if (window.location.hash.includes('type=recovery')) {
          navigate('/reset-password');
          return;
        }

        // Get session and resolve trusted role
        const { data: { session } } = await c.auth.getSession();
        if (!session) {
          // If no session found yet, wait for onAuthStateChange once
          const { data: authListener } = c.auth.onAuthStateChange(async (event, s) => {
            if (s) {
              authListener.subscription.unsubscribe();
              if (event === 'PASSWORD_RECOVERY') {
                navigate('/reset-password');
                return;
              }
              const status = await resolveUserRoleStatus();
              if (status.role === 'admin') {
                navigate('/admin');
              } else if (status.role === 'employer') {
                navigate(status.onboarded ? '/employer' : '/onboarding/employer');
              } else {
                navigate(status.onboarded ? '/' : '/onboarding/worker');
              }
            }
          });
          return;
        }

        const status = await resolveUserRoleStatus();
        if (status.role === 'admin') {
          navigate('/admin');
        } else if (status.role === 'employer') {
          navigate(status.onboarded ? '/employer' : '/onboarding/employer');
        } else {
          navigate(status.onboarded ? '/' : '/onboarding/worker');
        }
      } catch (err: any) {
        setErrorMsg(err?.message || 'Authentication exchange failed.');
        setProcessing(false);
      }
    }

    handleAuth();
  }, [navigate]);

  return (
    <div className="min-h-[100dvh] bg-background flex flex-col justify-between">
      <header className="border-b bg-background/95 backdrop-blur px-4 py-3">
        <div className="mx-auto flex max-w-6xl items-center justify-between">
          <Wordmark />
          <PilotChip />
        </div>
      </header>

      <main className="flex-1 flex items-center justify-center p-4 py-12">
        <div className="w-full max-w-md mx-auto text-center">
          <div className="rise rounded-2xl border bg-card p-8 shadow-md">
            {processing && !errorMsg ? (
              <div className="space-y-4">
                <Loader2 className="mx-auto h-10 w-10 animate-spin text-primary" />
                <h1 className="text-xl font-bold tracking-tight text-foreground">
                  Completing authentication...
                </h1>
                <p className="text-xs text-muted-foreground">
                  Securing your session with Supabase and verifying permissions.
                </p>
              </div>
            ) : (
              <div className="space-y-4">
                <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-destructive/10 text-destructive">
                  <AlertCircle className="h-6 w-6" />
                </div>
                <h1 className="text-xl font-bold tracking-tight text-foreground">
                  Authentication Failed
                </h1>
                <p className="text-xs text-destructive bg-destructive/10 p-3 rounded-lg leading-relaxed">
                  {errorMsg}
                </p>
                <div className="pt-2">
                  <Link href="/login">
                    <Button className="w-full font-semibold text-xs">
                      Return to sign in
                      <ArrowRight className="ml-1.5 h-4 w-4" />
                    </Button>
                  </Link>
                </div>
              </div>
            )}
          </div>
        </div>
      </main>

      <footer className="border-t py-4 text-center text-xs text-muted-foreground px-4">
        <span>FleetWala &copy; 2026. All rights reserved.</span>
      </footer>
    </div>
  );
}
