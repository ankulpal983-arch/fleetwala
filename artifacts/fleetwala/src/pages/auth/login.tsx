import { useEffect, useState } from 'react';
import { Link, useLocation } from 'wouter';
import {
  AlertCircle, CheckCircle2, Eye, EyeOff, Github, Lock, Mail,
  ShieldCheck, ArrowRight, Loader2, Building2, UserRound
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Wordmark, PilotChip } from '@/components/shell';
import { signInWithEmail, signInWithOAuth, useSession, supabaseConfigured } from '@/lib/supabase';
import { resolveUserRoleStatus } from '@/lib/repo';
import heroImg from '@/assets/hero-street.webp';

export function LoginPage() {
  const [, navigate] = useLocation();
  const { session, user } = useSession();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [busy, setBusy] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // If already signed in, resolve trusted backend role and redirect
  useEffect(() => {
    if (session && user) {
      resolveUserRoleStatus().then((status) => {
        if (status.role === 'admin') {
          navigate('/admin');
        } else if (status.role === 'employer') {
          navigate(status.onboarded ? '/employer' : '/onboarding/employer');
        } else {
          navigate(status.onboarded ? '/' : '/onboarding/worker');
        }
      });
    }
  }, [session, user, navigate]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    setBusy(true);

    try {
      const res = await signInWithEmail(email.trim(), password);
      if (!res.ok) {
        setErrorMsg(res.error || 'Invalid email or password.');
        setBusy(false);
        return;
      }

      // Resolve trusted database role
      const status = await resolveUserRoleStatus();
      if (status.role === 'admin') {
        navigate('/admin');
      } else if (status.role === 'employer') {
        navigate(status.onboarded ? '/employer' : '/onboarding/employer');
      } else {
        navigate(status.onboarded ? '/' : '/onboarding/worker');
      }
    } catch {
      setErrorMsg('Network error. Please check your connection and try again.');
    } finally {
      setBusy(false);
    }
  };

  const handleOAuth = async (provider: 'google' | 'github') => {
    setErrorMsg(null);
    setBusy(true);
    const res = await signInWithOAuth(provider);
    if (!res.ok) {
      setErrorMsg(res.error);
      setBusy(false);
    }
  };

  return (
    <div className="min-h-[100dvh] bg-background flex flex-col justify-between">
      {/* Top Header */}
      <header className="border-b bg-background/95 backdrop-blur px-4 py-3">
        <div className="mx-auto flex max-w-6xl items-center justify-between">
          <Wordmark />
          <div className="flex items-center gap-3">
            <PilotChip />
            <Link href="/" className="text-xs font-medium text-muted-foreground hover:text-foreground">
              Browse jobs
            </Link>
          </div>
        </div>
      </header>

      {/* Main Content: 2-Column Desktop, 1-Column Mobile */}
      <main className="flex-1 flex items-center justify-center p-4 py-8">
        <div className="w-full max-w-5xl grid gap-8 lg:grid-cols-[1.1fr_1fr] items-center">
          {/* Left Column: Brand Showcase */}
          <div className="hidden lg:flex flex-col space-y-6 pr-6">
            <div className="inline-flex items-center gap-2 rounded-full border border-primary/20 bg-primary/10 px-3 py-1 text-xs font-semibold text-primary w-fit">
              <ShieldCheck className="h-4 w-4" />
              Verified Logistics Identity Network
            </div>
            <h1 className="font-display text-4xl font-extrabold tracking-tight text-foreground leading-tight">
              India&apos;s privacy-first hiring platform for <span className="text-primary">blue-collar logistics</span>.
            </h1>
            <p className="text-muted-foreground text-sm leading-relaxed">
              Sign in to manage active delivery listings, review anonymous worker applicants, or track your local job applications with zero phone spam.
            </p>

            <div className="relative rounded-2xl border bg-card p-4 overflow-hidden shadow-sm">
              <img
                src={heroImg}
                alt="FleetWala street hiring"
                className="w-full h-44 object-cover rounded-xl border mb-3"
              />
              <div className="grid grid-cols-2 gap-3 text-xs">
                <div className="flex items-center gap-2 p-2 rounded-lg bg-muted/60">
                  <UserRound className="h-4 w-4 text-primary shrink-0" />
                  <span><strong>Workers:</strong> Contact remains 100% hidden.</span>
                </div>
                <div className="flex items-center gap-2 p-2 rounded-lg bg-muted/60">
                  <Building2 className="h-4 w-4 text-primary shrink-0" />
                  <span><strong>Employers:</strong> Verified morning dispatch hiring.</span>
                </div>
              </div>
            </div>
          </div>

          {/* Right Column: Sign In Card */}
          <div className="w-full max-w-md mx-auto">
            <div className="rise rounded-2xl border bg-card p-6 md:p-8 shadow-md">
              <div className="mb-6">
                <h2 className="text-2xl font-bold tracking-tight text-foreground" data-testid="heading-login">
                  Sign in
                </h2>
                <p className="text-xs text-muted-foreground mt-1">
                  Enter your credentials to access your FleetWala account.
                </p>
              </div>

              {errorMsg && (
                <div className="mb-4 flex items-start gap-2.5 rounded-lg border border-destructive/30 bg-destructive/10 p-3 text-xs text-destructive" role="alert">
                  <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
                  <span>{errorMsg}</span>
                </div>
              )}

              {/* OAuth Buttons */}
              <div className="grid grid-cols-2 gap-2 mb-4">
                <Button
                  type="button"
                  variant="outline"
                  className="w-full justify-center gap-2 text-xs font-medium h-10"
                  disabled={busy || !supabaseConfigured}
                  onClick={() => handleOAuth('google')}
                  data-testid="button-login-google"
                >
                  <svg className="h-4 w-4 shrink-0" viewBox="0 0 24 24">
                    <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                    <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                    <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z" />
                    <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z" />
                  </svg>
                  Google
                </Button>

                <Button
                  type="button"
                  variant="outline"
                  className="w-full justify-center gap-2 text-xs font-medium h-10"
                  disabled={busy || !supabaseConfigured}
                  onClick={() => handleOAuth('github')}
                  data-testid="button-login-github"
                >
                  <Github className="h-4 w-4 shrink-0" />
                  GitHub
                </Button>
              </div>

              <div className="relative my-4 text-center text-xs">
                <div className="absolute inset-0 flex items-center"><span className="w-full border-t" /></div>
                <span className="relative bg-card px-2 text-muted-foreground uppercase tracking-wider text-[10px]">
                  Or with email
                </span>
              </div>

              {/* Email + Password Form */}
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="space-y-1.5">
                  <Label htmlFor="login-email" className="text-xs font-medium">Email address</Label>
                  <Input
                    id="login-email"
                    type="email"
                    autoComplete="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="name@example.com"
                    required
                    disabled={busy}
                    className="h-10 text-sm"
                    data-testid="input-login-email"
                  />
                </div>

                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <Label htmlFor="login-password" className="text-xs font-medium">Password</Label>
                    <Link
                      href="/forgot-password"
                      className="text-[11px] font-medium text-primary hover:underline"
                      data-testid="link-forgot-password"
                    >
                      Forgot password?
                    </Link>
                  </div>
                  <div className="relative">
                    <Input
                      id="login-password"
                      type={showPassword ? 'text' : 'password'}
                      autoComplete="current-password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="••••••••"
                      required
                      disabled={busy}
                      className="h-10 pr-10 text-sm"
                      data-testid="input-login-password"
                    />
                    <button
                      type="button"
                      aria-label={showPassword ? 'Hide password' : 'Show password'}
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                      data-testid="toggle-show-password"
                    >
                      {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                </div>

                <Button
                  type="submit"
                  className="w-full h-10 font-semibold text-sm"
                  disabled={busy || !email || !password}
                  data-testid="button-login-submit"
                >
                  {busy ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Signing in...
                    </>
                  ) : (
                    <>
                      Sign in
                      <ArrowRight className="ml-1.5 h-4 w-4" />
                    </>
                  )}
                </Button>
              </form>

              <div className="mt-6 border-t pt-4 text-center text-xs text-muted-foreground">
                Don&apos;t have an account?{' '}
                <Link href="/signup" className="font-semibold text-primary underline" data-testid="link-to-signup">
                  Create an account
                </Link>
              </div>
            </div>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="border-t py-4 text-center text-xs text-muted-foreground px-4">
        <span>FleetWala &copy; 2026. All rights reserved. </span>
        <Link href="/legal/terms" className="underline hover:text-foreground ml-2">Terms</Link>
        <span className="mx-1.5">·</span>
        <Link href="/legal/privacy" className="underline hover:text-foreground">Privacy</Link>
      </footer>
    </div>
  );
}
