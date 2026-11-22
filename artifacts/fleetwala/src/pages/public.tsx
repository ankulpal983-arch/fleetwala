import { useEffect, useState } from 'react';
import { Link, useParams } from 'wouter';
import {
  ArrowRight, EyeOff, Lock, Mail, MapPin, Phone, ShieldCheck, Settings2, Gauge, Building2,
  Github, KeyRound, AlertCircle, CheckCircle2, Info,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { PilotChip, Wordmark } from '@/components/shell';
import { Monogram } from '@/components/common';
import { cn } from '@/lib/utils';
import {
  gate, liveRequested, normalizeIndianPhone, sendEmailMagicLink, sendPhoneOtp, signOut,
  supabaseConfigured, useSession, verifyPhoneOtp, signInWithEmail, signUpWithEmail,
  signInWithOAuth, resetPasswordForEmail, updateUserPassword,
} from '@/lib/supabase';
import heroImg from '@/assets/hero-street.webp';

function PublicHeader() {
  return (
    <header className="mx-auto flex max-w-6xl items-center gap-3 px-4 py-4">
      <Wordmark />
      <div className="hidden sm:block"><PilotChip /></div>
      <nav className="ml-auto flex items-center gap-2 text-sm">
        <Link href="/" className="rounded-md px-3 py-1.5 hover:bg-muted" data-testid="link-find-jobs">Find jobs</Link>
        <Link href="/login" className="rounded-md bg-foreground px-3 py-1.5 font-medium text-background" data-testid="link-signin">Sign in</Link>
      </nav>
    </header>
  );
}

export function Welcome() {
  return (
    <div className="min-h-[100dvh]">
      <PublicHeader />
      <section className="mx-auto grid max-w-6xl gap-10 px-4 pb-16 pt-8 lg:grid-cols-[1.1fr_1fr] lg:items-center">
        <div className="rise">
          <p className="font-mono text-xs uppercase tracking-[0.22em] text-muted-foreground">Delivery · Pickup-drop · Warehouse · Hub</p>
          <h1 className="mt-3 text-5xl font-extrabold leading-[0.95] md:text-7xl">Local work,<br />without giving<br /><span className="relative inline-block">your number away.<span className="absolute -bottom-1 left-0 h-3 w-full -z-10 bg-plate" /></span></h1>
          <p className="mt-6 max-w-lg text-lg text-foreground/75">FleetWala connects riders, packers and hub staff with verified logistics employers in their own city. Employers see your first name, area and experience. Never your phone, never your ID.</p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Link href="/" className="inline-flex h-12 items-center gap-2 rounded-lg bg-primary px-6 font-semibold text-primary-foreground" data-testid="link-hero-find">Find jobs near me<ArrowRight className="h-4 w-4" /></Link>
            <Link href="/employer" className="inline-flex h-12 items-center gap-2 rounded-lg border-2 border-foreground px-6 font-semibold" data-testid="link-hero-employer">I am hiring</Link>
          </div>
        </div>
        <div className="rise relative" style={{ animationDelay: '120ms' }}>
          <img src={heroImg} alt="Illustration of a delivery rider and warehouse worker on a city street at dawn" className="aspect-[4/3] w-full rounded-2xl border-2 border-foreground object-cover" />
          <div className="absolute -bottom-5 -left-4 flex items-center gap-3 rounded-xl border-2 border-foreground bg-card p-3 shadow-lg">
            <Monogram name="Logistics Partner" size="sm" />
            <div className="text-sm"><p className="font-bold">Delivery partner</p><p className="text-xs text-muted-foreground">Delhi NCR · Verified hiring partner</p></div>
          </div>
        </div>
      </section>
      <div className="overflow-hidden bg-tarmac py-3"><div className="road-dash road-dash-anim" /></div>
      <section className="mx-auto grid max-w-6xl gap-px overflow-hidden px-4 py-16 md:grid-cols-[1.2fr_1fr_1fr]">
        {[
          { icon: EyeOff, t: 'Hidden by default', b: 'Your profile is not searchable until you switch it on. Employers can only see people who applied to them.' },
          { icon: MapPin, t: 'Your city, your area', b: 'Jobs are matched by city and neighbourhood, within about 15 km. We do not guess distances we cannot measure.' },
          { icon: ShieldCheck, t: 'No fees, ever', b: 'Listings asking for deposits are blocked at moderation. Report anything off in one tap.' },
        ].map((f, i) => (
          <div key={f.t} className="rise border-t-2 border-foreground p-6" style={{ animationDelay: `${i * 80}ms` }}>
            <f.icon className="h-6 w-6 text-primary" /><h3 className="mt-4 text-xl font-bold">{f.t}</h3><p className="mt-2 text-sm text-muted-foreground">{f.b}</p>
          </div>
        ))}
      </section>
      <section className="mx-auto max-w-6xl px-4 pb-16">
        <div className="grid gap-8 rounded-3xl bg-tarmac p-8 text-sidebar-foreground md:grid-cols-2 md:p-12">
          <div><p className="font-mono text-xs uppercase tracking-[0.2em] text-plate">For employers</p>
            <h2 className="mt-2 text-4xl font-extrabold">Fill the morning shift by Thursday.</h2></div>
          <ul className="space-y-3 text-sm">
            {[[Building2, 'Verified employer badge before your first job goes live'], [Gauge, 'Applicant pipeline: applied, viewed, shortlisted, hired'], [Lock, 'Anonymised candidate preview, consent-first contact']].map(([I, t]) => {
              const Icon = I as typeof Lock;
              return <li key={t as string} className="flex gap-3"><Icon className="h-5 w-5 shrink-0 text-plate" />{t as string}</li>;
            })}
          </ul>
        </div>
      </section>
      <footer className="border-t">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-4 px-4 py-6 text-xs text-muted-foreground">
          <span>FleetWala — India Logistics Marketplace. Verified employers and privacy-protected hiring.</span>
          <Link href="/terms" className="underline">Terms</Link>
          <Link href="/privacy" className="underline">Privacy</Link>
          <Link href="/support" className="underline">Support</Link>
          <Link href="/help" className="underline">Help</Link>
        </div>
      </footer>
    </div>
  );
}

function ConfigMissing() {
  return (
    <div className="rounded-xl border-2 border-dashed border-plate bg-plate/10 p-5 text-sm" role="status" data-testid="status-auth-not-configured">
      <p className="flex items-center gap-2 font-bold"><Settings2 className="h-4 w-4" />Sign-in is not configured yet</p>
      <p className="mt-2 text-muted-foreground">Add these environment variables to enable Supabase sign-in. FleetWala never simulates OTP or sign-in.</p>
      <pre className="mt-3 overflow-x-auto rounded-md bg-tarmac p-3 font-mono text-xs text-sidebar-foreground">VITE_SUPABASE_URL=...{'\n'}VITE_SUPABASE_PUBLISHABLE_KEY=...</pre>
      <p className="mt-3">You can browse <Link href="/" className="underline">available jobs</Link>.</p>
    </div>
  );
}

export function Login() {
  const { session, user } = useSession();
  const [role, setRole] = useState<'worker' | 'employer'>('worker');
  const [mode, setMode] = useState<'signin' | 'signup' | 'forgot'>('signin');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [isResetFlow, setIsResetFlow] = useState(false);

  // Phone OTP state (deferred pre-production feature)
  const [showPhoneTab, setShowPhoneTab] = useState(false);
  const [phone, setPhone] = useState('');
  const [otp, setOtp] = useState('');
  const [otpSent, setOtpSent] = useState(false);
  const [cooldown, setCooldown] = useState(0);

  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  useEffect(() => {
    if (typeof window !== 'undefined' && window.location.search.includes('reset=true')) {
      setIsResetFlow(true);
    }
  }, []);

  useEffect(() => {
    if (cooldown <= 0) return;
    const timer = setInterval(() => setCooldown((c) => Math.max(0, c - 1)), 1000);
    return () => clearInterval(timer);
  }, [cooldown]);

  const run = async (fn: () => Promise<{ ok: boolean; error?: string }>, success: string, after?: () => void) => {
    setBusy(true);
    setMsg(null);
    try {
      const r = await fn();
      if (r.ok) {
        setMsg({ ok: true, text: success });
        after?.();
      } else {
        setMsg({ ok: false, text: r.error ?? 'Something went wrong.' });
      }
    } catch {
      setMsg({ ok: false, text: 'Network error. Check your connection and try again.' });
    } finally {
      setBusy(false);
    }
  };

  const handleEmailAuth = (e: React.FormEvent) => {
    e.preventDefault();
    if (mode === 'signin') {
      run(() => signInWithEmail(email, password), 'Signed in successfully.');
    } else if (mode === 'signup') {
      run(
        () => signUpWithEmail(email, password, role, fullName),
        'Account created! Check your email for a confirmation link (if enabled), or sign in.'
      );
    } else if (mode === 'forgot') {
      run(() => resetPasswordForEmail(email), 'Password reset link sent! Check your inbox.');
    }
  };

  const handlePasswordUpdate = (e: React.FormEvent) => {
    e.preventDefault();
    run(() => updateUserPassword(newPassword), 'Password updated successfully! You can now sign in.', () => {
      setIsResetFlow(false);
      setMode('signin');
    });
  };

  const phoneValid = normalizeIndianPhone(phone) !== null;

  return (
    <div className="min-h-[100dvh]">
      <PublicHeader />
      <div className="mx-auto grid max-w-5xl gap-8 px-4 py-10 md:grid-cols-[1fr_440px]">
        <div className="rise">
          <h1 className="text-4xl font-extrabold md:text-5xl">Sign in</h1>
          <p className="mt-3 max-w-md text-muted-foreground">
            Sign in with Email + Password, Google, or GitHub. Secure authentication powered by Supabase.
          </p>

          <div className="mt-6 space-y-3 max-w-md">
            <div className="flex items-start gap-2.5 rounded-lg border border-dashed p-3 text-xs text-muted-foreground">
              <ShieldCheck className="h-4 w-4 shrink-0 text-primary mt-0.5" />
              <span>
                <strong>Pre-Production Authentication:</strong> Roles are enforced on the backend via PostgreSQL RLS. Workers and Employers sign in with verified accounts.
              </span>
            </div>

            <div className="flex items-start gap-2.5 rounded-lg border border-primary/20 bg-primary/5 p-3 text-xs text-muted-foreground">
              <Info className="h-4 w-4 shrink-0 text-primary mt-0.5" />
              <span>
                <strong>Phone OTP Notice:</strong> SMS OTP (MSG91) is deferred for pre-production to remove external gateway blockers. Phone numbers remain optional profile fields.
              </span>
            </div>
          </div>
        </div>

        <div className="rise rounded-2xl border bg-card p-6 shadow-sm" style={{ animationDelay: '80ms' }}>
          {session ? (
            <div className="space-y-4" data-testid="auth-signed-in-container">
              <div className="flex items-center gap-2 text-signal">
                <CheckCircle2 className="h-5 w-5" />
                <p className="font-semibold text-foreground" data-testid="text-signed-in">
                  You are signed in.
                </p>
              </div>
              <div className="rounded-lg bg-muted p-3 text-xs space-y-1">
                <p><span className="text-muted-foreground">Email:</span> <span className="font-mono">{user?.email ?? 'Unknown'}</span></p>
                <p><span className="text-muted-foreground">Role:</span> <span className="font-semibold capitalize">{String(user?.user_metadata?.role ?? 'Worker')}</span></p>
              </div>
              <div className="flex gap-2">
                <Link
                  href={user?.user_metadata?.role === 'employer' ? '/employer' : '/'}
                  className="inline-flex h-9 items-center justify-center rounded-md bg-primary px-4 text-xs font-semibold text-primary-foreground hover:bg-primary/90"
                >
                  Go to Workspace
                </Link>
                <Button
                  variant="outline"
                  onClick={() => run(signOut, 'Signed out.')}
                  disabled={busy}
                  data-testid="button-signout"
                >
                  Sign out
                </Button>
              </div>
              {msg && <p className={msg.ok ? 'text-sm text-signal' : 'text-sm text-destructive'} role="status">{msg.text}</p>}
            </div>
          ) : !supabaseConfigured ? (
            <ConfigMissing />
          ) : isResetFlow ? (
            <form className="space-y-3" onSubmit={handlePasswordUpdate}>
              <h2 className="text-lg font-bold">Set new password</h2>
              <p className="text-xs text-muted-foreground">Enter a new secure password for your account.</p>
              <Label htmlFor="new-password">New password</Label>
              <Input
                id="new-password"
                type="password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder="At least 8 characters"
                minLength={8}
                required
                data-testid="input-new-password"
              />
              <Button type="submit" className="w-full" disabled={busy || newPassword.length < 8}>
                {busy ? 'Updating...' : 'Update password'}
              </Button>
            </form>
          ) : (
            <div className="space-y-5">
              {/* Role Selector Tabs */}
              <Tabs value={role} onValueChange={(v) => { setRole(v as 'worker' | 'employer'); setMsg(null); }}>
                <TabsList className="grid w-full grid-cols-2">
                  <TabsTrigger value="worker" data-testid="tab-worker-login">Worker</TabsTrigger>
                  <TabsTrigger value="employer" data-testid="tab-employer-login">Employer</TabsTrigger>
                </TabsList>
              </Tabs>

              {/* OAuth Provider Buttons */}
              <div className="space-y-2">
                <Button
                  type="button"
                  variant="outline"
                  className="w-full justify-center gap-2 text-xs font-medium"
                  disabled={busy}
                  onClick={() => run(() => signInWithOAuth('google', role), 'Redirecting to Google...')}
                  data-testid="button-oauth-google"
                >
                  <svg className="h-4 w-4" viewBox="0 0 24 24">
                    <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                    <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                    <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z" />
                    <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z" />
                  </svg>
                  Continue with Google
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  className="w-full justify-center gap-2 text-xs font-medium"
                  disabled={busy}
                  onClick={() => run(() => signInWithOAuth('github', role), 'Redirecting to GitHub...')}
                  data-testid="button-oauth-github"
                >
                  <Github className="h-4 w-4" />
                  Continue with GitHub
                </Button>
              </div>

              <div className="relative my-3 text-center text-xs">
                <div className="absolute inset-0 flex items-center"><span className="w-full border-t" /></div>
                <span className="relative bg-card px-2 text-muted-foreground uppercase tracking-wider text-[10px]">Or continue with email</span>
              </div>

              {/* Email + Password Form */}
              <form className="space-y-3" onSubmit={handleEmailAuth}>
                {mode === 'signup' && (
                  <div className="space-y-1">
                    <Label htmlFor="fullName" className="text-xs">Full name</Label>
                    <Input
                      id="fullName"
                      type="text"
                      autoComplete="name"
                      value={fullName}
                      onChange={(e) => setFullName(e.target.value)}
                      placeholder={role === 'worker' ? 'e.g. Ramesh Kumar' : 'e.g. Anand Sharma'}
                      data-testid="input-fullname"
                    />
                  </div>
                )}

                <div className="space-y-1">
                  <Label htmlFor="email" className="text-xs">Email address</Label>
                  <Input
                    id="email"
                    type="email"
                    autoComplete="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder={role === 'employer' ? 'name@company.com' : 'you@example.com'}
                    required
                    data-testid="input-email"
                  />
                </div>

                {mode !== 'forgot' && (
                  <div className="space-y-1">
                    <div className="flex items-center justify-between">
                      <Label htmlFor="password" className="text-xs">Password</Label>
                      {mode === 'signin' && (
                        <button
                          type="button"
                          className="text-[11px] text-primary hover:underline"
                          onClick={() => { setMode('forgot'); setMsg(null); }}
                          data-testid="link-forgot-password"
                        >
                          Forgot password?
                        </button>
                      )}
                    </div>
                    <Input
                      id="password"
                      type="password"
                      autoComplete={mode === 'signup' ? 'new-password' : 'current-password'}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="At least 8 characters"
                      minLength={mode === 'signup' ? 8 : 6}
                      required
                      data-testid="input-password"
                    />
                  </div>
                )}

                <Button
                  type="submit"
                  className="w-full"
                  disabled={busy || !email || (mode !== 'forgot' && !password)}
                  data-testid="button-submit-auth"
                >
                  <Mail className="mr-1.5 h-4 w-4" />
                  {busy
                    ? 'Processing...'
                    : mode === 'signin'
                    ? `Sign in as ${role === 'worker' ? 'Worker' : 'Employer'}`
                    : mode === 'signup'
                    ? `Create ${role === 'worker' ? 'Worker' : 'Employer'} Account`
                    : 'Send Reset Link'}
                </Button>

                <div className="flex items-center justify-between pt-1 text-xs text-muted-foreground">
                  {mode === 'signin' ? (
                    <>
                      <span>Don't have an account?</span>
                      <button
                        type="button"
                        className="font-medium text-primary underline"
                        onClick={() => { setMode('signup'); setMsg(null); }}
                        data-testid="button-switch-signup"
                      >
                        Create account
                      </button>
                    </>
                  ) : (
                    <>
                      <span>Already have an account?</span>
                      <button
                        type="button"
                        className="font-medium text-primary underline"
                        onClick={() => { setMode('signin'); setMsg(null); }}
                        data-testid="button-switch-signin"
                      >
                        Sign in
                      </button>
                    </>
                  )}
                </div>
              </form>

              {/* Deferred Phone OTP Accordion / Notice */}
              <div className="border-t pt-3">
                <button
                  type="button"
                  className="flex w-full items-center justify-between text-xs text-muted-foreground hover:text-foreground"
                  onClick={() => setShowPhoneTab(!showPhoneTab)}
                  data-testid="toggle-phone-otp"
                >
                  <span className="flex items-center gap-1.5 font-medium">
                    <Phone className="h-3.5 w-3.5" />
                    Mobile Phone OTP (MSG91)
                  </span>
                  <span className="rounded bg-muted px-1.5 py-0.5 text-[10px] font-mono uppercase text-muted-foreground">
                    {showPhoneTab ? 'Hide' : 'Deferred (Coming Soon)'}
                  </span>
                </button>

                {showPhoneTab && (
                  <div className="mt-3 rounded-lg border bg-muted/40 p-3 text-xs space-y-3">
                    <p className="text-muted-foreground">
                      Mobile OTP with MSG91 DLT gateway is deferred for pre-production to avoid third-party SMS failures. You can test the input validation below:
                    </p>
                    {!otpSent ? (
                      <form
                        className="space-y-2"
                        onSubmit={(e) => {
                          e.preventDefault();
                          run(
                            () => sendPhoneOtp(phone),
                            'SMS code requested via Supabase.',
                            () => { setOtpSent(true); setCooldown(45); }
                          );
                        }}
                      >
                        <Label htmlFor="phone" className="text-xs">Mobile number</Label>
                        <div className="flex">
                          <span className="flex items-center rounded-l-md border border-r-0 bg-muted px-2.5 font-mono text-xs">+91</span>
                          <Input
                            id="phone"
                            inputMode="tel"
                            autoComplete="tel-national"
                            value={phone}
                            onChange={(e) => setPhone(e.target.value)}
                            placeholder="98xxxxxxxx"
                            className="h-8 rounded-l-none text-xs"
                            aria-invalid={phone.length > 0 && !phoneValid}
                            data-testid="input-phone"
                          />
                        </div>
                        {phone.length >= 10 && !phoneValid && (
                          <p className="text-[11px] text-destructive">Enter a 10-digit Indian mobile starting with 6 to 9.</p>
                        )}
                        <Button
                          type="submit"
                          size="sm"
                          variant="secondary"
                          className="w-full text-xs"
                          disabled={busy || !phoneValid}
                          data-testid="button-send-otp"
                        >
                          <Phone className="mr-1 h-3.5 w-3.5" />
                          {busy ? 'Sending...' : 'Send SMS code'}
                        </Button>
                      </form>
                    ) : (
                      <form
                        className="space-y-2"
                        onSubmit={(e) => {
                          e.preventDefault();
                          run(() => verifyPhoneOtp(phone, otp), 'Verified successfully.');
                        }}
                      >
                        <Label htmlFor="otp" className="text-xs">6-digit code sent to {normalizeIndianPhone(phone)}</Label>
                        <Input
                          id="otp"
                          inputMode="numeric"
                          maxLength={6}
                          value={otp}
                          onChange={(e) => setOtp(e.target.value.replace(/\D/g, ''))}
                          className="h-8 font-mono tracking-widest text-xs"
                          data-testid="input-otp"
                        />
                        <Button
                          type="submit"
                          size="sm"
                          className="w-full text-xs"
                          disabled={busy || otp.length !== 6}
                          data-testid="button-verify-otp"
                        >
                          {busy ? 'Checking...' : 'Verify SMS Code'}
                        </Button>
                        <div className="flex items-center justify-between text-[11px]">
                          <button
                            type="button"
                            className="underline text-muted-foreground"
                            onClick={() => { setOtpSent(false); setOtp(''); }}
                          >
                            Change number
                          </button>
                          <button
                            type="button"
                            disabled={busy || cooldown > 0}
                            className={cn('font-medium', cooldown > 0 ? 'text-muted-foreground cursor-not-allowed' : 'text-primary underline')}
                            onClick={() => run(() => sendPhoneOtp(phone), 'New SMS code requested.', () => setCooldown(45))}
                            data-testid="button-resend-otp"
                          >
                            {cooldown > 0 ? `Resend in ${cooldown}s` : 'Resend code'}
                          </button>
                        </div>
                      </form>
                    )}
                  </div>
                )}
              </div>
            </div>
          )}

          {msg && !session && (
            <p
              className={cn(
                'mt-3 rounded p-2 text-xs font-medium',
                msg.ok ? 'bg-signal/10 text-signal' : 'bg-destructive/10 text-destructive'
              )}
              role="status"
              data-testid="text-auth-message"
            >
              {msg.text}
            </p>
          )}

          {liveRequested && !supabaseConfigured && (
            <p className="mt-3 text-[11px] text-muted-foreground">
              VITE_ENABLE_LIVE is true, but live mode remains blocked until VITE_SUPABASE_URL and VITE_SUPABASE_PUBLISHABLE_KEY are supplied.
            </p>
          )}
        </div>
      </div>
    </div>
  );
}

const LEGAL: Record<string, { title: string; body: [string, string][] }> = {
  terms: {
    title: 'Terms of use',
    body: [
      ['Pilot service', 'FleetWala is in a pilot. Listings, companies and candidates shown are sample data and are not real offers of work.'],
      ['No fees for workers', 'Employers may not charge workers deposits, registration or training fees. Listings that do will be removed.'],
      ['Accounts', 'Workers sign in with an Indian mobile number; employers with a work email. Roles shown in the pilot switcher are for demonstration and grant no access.'],
      ['Payments', 'No payments are processed during the pilot.'],
    ],
  },
  privacy: {
    title: 'Privacy notice',
    body: [
      ['What employers see', 'First name, city, area, experience and vehicle. Never your phone number, photo or ID documents.'],
      ['Discovery', 'Your profile is not searchable by employers unless you turn discovery on. It is off by default.'],
      ['Location', 'If you allow location, it is read on your device only and not stored. Matching is by city and area.'],
      ['Pilot storage', 'Pilot data is stored only in your browser and can be reset from Settings.'],
    ],
  },
};

export function Legal() {
  const { doc } = useParams<{ doc: string }>();
  const d = LEGAL[doc ?? ''] ?? LEGAL.terms;
  return (
    <div className="min-h-[100dvh]">
      <PublicHeader />
      <article className="mx-auto max-w-2xl px-4 py-10">
        <p className="inline-block rounded bg-plate px-2 py-1 font-mono text-xs font-bold uppercase text-accent-foreground" data-testid="status-legal-draft">Draft, not legally approved</p>
        <h1 className="mt-4 text-4xl font-extrabold">{d.title}</h1>
        <p className="mt-2 text-sm text-muted-foreground">This draft has not been reviewed or approved by counsel and is not a binding agreement.</p>
        <div className="mt-8 space-y-6">{d.body.map(([h, b]) => <section key={h}><h2 className="text-lg font-bold">{h}</h2><p className="mt-1 text-foreground/80">{b}</p></section>)}</div>
        <div className="mt-10 flex gap-4 text-sm"><Link href="/legal/terms" className="underline">Terms</Link><Link href="/legal/privacy" className="underline">Privacy</Link></div>
      </article>
    </div>
  );
}

export function LiveSetup() {
  const { session } = useSession();
  return (
    <div className="flex min-h-[100dvh] items-center justify-center p-4">
      <div className="max-w-lg rounded-2xl border-2 border-foreground bg-card p-8" data-testid="screen-live-setup">
        <Wordmark />
        <h1 className="mt-6 text-3xl font-extrabold">Live portal not connected yet</h1>
        <p className="mt-3 text-muted-foreground">Live mode is enabled, but the live data integration has not been delivered. To keep you safe, this workspace is blocked and does not show sample data as if it were real.</p>
        <ul className="mt-4 space-y-1 font-mono text-xs">
          <li>VITE_ENABLE_LIVE = true</li>
          <li>Supabase configured = yes</li>
          <li>Live data wired = {gate.showLiveData ? 'yes' : 'no'}</li>
          <li>Session = {session ? 'signed in' : 'none'}</li>
        </ul>
        <p className="mt-4 text-sm">To explore the pilot, unset <code className="font-mono">VITE_ENABLE_LIVE</code>.</p>
        <div className="mt-6 flex gap-2">
          <Link href="/login" className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground">Account</Link>
          <Link href="/legal/privacy" className="rounded-md border px-4 py-2 text-sm">Privacy (draft)</Link>
        </div>
      </div>
    </div>
  );
}
