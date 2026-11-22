import { useState } from 'react';
import { Link, useLocation } from 'wouter';
import {
  AlertCircle, CheckCircle2, Eye, EyeOff, Github, Lock, Mail,
  ShieldCheck, ArrowRight, Loader2, Building2, UserRound, Check, X
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Wordmark, PilotChip } from '@/components/shell';
import { cn } from '@/lib/utils';
import { signUpWithEmail, signInWithOAuth, supabaseConfigured } from '@/lib/supabase';

type AccountType = 'worker' | 'employer';

export function SignupPage() {
  const [, navigate] = useLocation();
  const [role, setRole] = useState<AccountType>('worker');
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [agreeTerms, setAgreeTerms] = useState(false);
  const [busy, setBusy] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Password validation rules
  const hasMinLength = password.length >= 8;
  const hasLetter = /[A-Za-z]/.test(password);
  const hasNumber = /[0-9]/.test(password);
  const passwordsMatch = password.length > 0 && password === confirmPassword;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);

    if (!fullName.trim() || fullName.trim().length < 2) {
      setErrorMsg('Please enter your full name (at least 2 characters).');
      return;
    }
    if (!email.trim() || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
      setErrorMsg('Please enter a valid email address.');
      return;
    }
    if (!hasMinLength || !hasLetter || !hasNumber) {
      setErrorMsg('Password must be at least 8 characters and contain both letters and numbers.');
      return;
    }
    if (password !== confirmPassword) {
      setErrorMsg('Passwords do not match.');
      return;
    }
    if (!agreeTerms) {
      setErrorMsg('Please accept the Terms of Service and Privacy Policy to continue.');
      return;
    }

    setBusy(true);

    try {
      const res = await signUpWithEmail(email.trim(), password, role, fullName.trim());
      if (!res.ok) {
        setErrorMsg(res.error || 'Registration failed. Please try again.');
        setBusy(false);
        return;
      }

      // If user session exists immediately (email confirmation disabled in Supabase)
      if (res.session) {
        navigate(role === 'employer' ? '/onboarding/employer' : '/onboarding/worker');
      } else {
        // Confirmation link sent
        navigate(`/verify-email?email=${encodeURIComponent(email.trim())}`);
      }
    } catch {
      setErrorMsg('Network error occurred. Please verify your connection and try again.');
    } finally {
      setBusy(false);
    }
  };

  const handleOAuth = async (provider: 'google' | 'github') => {
    setErrorMsg(null);
    setBusy(true);
    const res = await signInWithOAuth(provider, role);
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
            <Link href="/login" className="text-xs font-semibold text-primary hover:underline">
              Sign in instead
            </Link>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 flex items-center justify-center p-4 py-8">
        <div className="w-full max-w-xl mx-auto">
          <div className="rise rounded-2xl border bg-card p-6 md:p-8 shadow-md">
            <div className="text-center max-w-md mx-auto mb-6">
              <h1 className="text-2xl md:text-3xl font-extrabold tracking-tight text-foreground" data-testid="heading-signup">
                Create your FleetWala account
              </h1>
              <p className="text-xs text-muted-foreground mt-1">
                Select your account type to get started with verified logistics hiring.
              </p>
            </div>

            {/* Role Selection Cards */}
            <div className="grid grid-cols-2 gap-3 mb-6" role="radiogroup" aria-label="Select account type">
              <button
                type="button"
                onClick={() => setRole('worker')}
                className={cn(
                  'flex flex-col items-start p-4 rounded-xl border-2 text-left transition-all',
                  role === 'worker'
                    ? 'border-primary bg-primary/5 shadow-sm'
                    : 'border-border bg-card hover:bg-muted/50'
                )}
                data-testid="card-role-worker"
              >
                <div className="flex items-center justify-between w-full mb-2">
                  <div className={cn('p-2 rounded-lg', role === 'worker' ? 'bg-primary text-primary-foreground' : 'bg-muted text-foreground')}>
                    <UserRound className="h-5 w-5" />
                  </div>
                  {role === 'worker' && <span className="h-2 w-2 rounded-full bg-primary" />}
                </div>
                <h3 className="font-bold text-sm text-foreground">Worker / Partner</h3>
                <p className="text-[11px] text-muted-foreground mt-0.5 leading-snug">
                  Rider, Delivery, Warehouse, Hub Staff. 100% Free. Phone stays hidden.
                </p>
              </button>

              <button
                type="button"
                onClick={() => setRole('employer')}
                className={cn(
                  'flex flex-col items-start p-4 rounded-xl border-2 text-left transition-all',
                  role === 'employer'
                    ? 'border-primary bg-primary/5 shadow-sm'
                    : 'border-border bg-card hover:bg-muted/50'
                )}
                data-testid="card-role-employer"
              >
                <div className="flex items-center justify-between w-full mb-2">
                  <div className={cn('p-2 rounded-lg', role === 'employer' ? 'bg-primary text-primary-foreground' : 'bg-muted text-foreground')}>
                    <Building2 className="h-5 w-5" />
                  </div>
                  {role === 'employer' && <span className="h-2 w-2 rounded-full bg-primary" />}
                </div>
                <h3 className="font-bold text-sm text-foreground">Employer / Recruiter</h3>
                <p className="text-[11px] text-muted-foreground mt-0.5 leading-snug">
                  Logistics Company, DSP Partner, Agency. Post jobs and hire verified staff.
                </p>
              </button>
            </div>

            {errorMsg && (
              <div className="mb-4 rounded-lg border border-destructive/30 bg-destructive/10 p-3 text-xs text-destructive space-y-1.5" role="alert">
                <div className="flex items-start gap-2.5">
                  <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
                  <span className="leading-relaxed">{errorMsg}</span>
                </div>
                {errorMsg.toLowerCase().includes('rate limit') && (
                  <p className="text-[11px] text-muted-foreground pl-6.5 leading-relaxed">
                    <strong>Tip:</strong> If you are testing pre-production accounts, wait for the rate limit window to reset, use Google sign-in below, or configure a Custom SMTP provider (such as Resend or Brevo) in your Supabase project dashboard.
                  </p>
                )}
              </div>
            )}

            {/* OAuth Quick Sign Up */}
            <div className="grid grid-cols-2 gap-2 mb-4">
              <Button
                type="button"
                variant="outline"
                className="w-full justify-center gap-2 text-xs font-medium h-10"
                disabled={busy || !supabaseConfigured}
                onClick={() => handleOAuth('google')}
                data-testid="button-signup-google"
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
                data-testid="button-signup-github"
              >
                <Github className="h-4 w-4 shrink-0" />
                GitHub
              </Button>
            </div>

            <div className="relative my-4 text-center text-xs">
              <div className="absolute inset-0 flex items-center"><span className="w-full border-t" /></div>
              <span className="relative bg-card px-2 text-muted-foreground uppercase tracking-wider text-[10px]">
                Or register with email
              </span>
            </div>

            {/* Email Registration Form */}
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-1.5">
                <Label htmlFor="signup-name" className="text-xs font-medium">Full name</Label>
                <Input
                  id="signup-name"
                  type="text"
                  autoComplete="name"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  placeholder={role === 'worker' ? 'e.g. Ramesh Kumar' : 'e.g. Anand Sharma'}
                  required
                  disabled={busy}
                  className="h-10 text-sm"
                  data-testid="input-signup-name"
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="signup-email" className="text-xs font-medium">
                  {role === 'employer' ? 'Work email address' : 'Email address'}
                </Label>
                <Input
                  id="signup-email"
                  type="email"
                  autoComplete="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder={role === 'employer' ? 'name@logistics.com' : 'you@example.com'}
                  required
                  disabled={busy}
                  className="h-10 text-sm"
                  data-testid="input-signup-email"
                />
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <Label htmlFor="signup-password" className="text-xs font-medium">Password</Label>
                  <div className="relative">
                    <Input
                      id="signup-password"
                      type={showPassword ? 'text' : 'password'}
                      autoComplete="new-password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="Min 8 characters"
                      required
                      disabled={busy}
                      className="h-10 pr-9 text-sm"
                      data-testid="input-signup-password"
                    />
                    <button
                      type="button"
                      aria-label={showPassword ? 'Hide password' : 'Show password'}
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                    >
                      {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="signup-confirm-password" className="text-xs font-medium">Confirm password</Label>
                  <Input
                    id="signup-confirm-password"
                    type={showPassword ? 'text' : 'password'}
                    autoComplete="new-password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    placeholder="Repeat password"
                    required
                    disabled={busy}
                    className="h-10 text-sm"
                    data-testid="input-signup-confirm"
                  />
                </div>
              </div>

              {/* Password Quality Checks */}
              {password.length > 0 && (
                <div className="rounded-lg bg-muted/60 p-2.5 text-[11px] space-y-1">
                  <div className="flex items-center gap-1.5">
                    {hasMinLength ? <Check className="h-3.5 w-3.5 text-signal" /> : <X className="h-3.5 w-3.5 text-muted-foreground" />}
                    <span className={hasMinLength ? 'text-signal font-medium' : 'text-muted-foreground'}>At least 8 characters</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    {hasLetter && hasNumber ? <Check className="h-3.5 w-3.5 text-signal" /> : <X className="h-3.5 w-3.5 text-muted-foreground" />}
                    <span className={hasLetter && hasNumber ? 'text-signal font-medium' : 'text-muted-foreground'}>Contains letters & numbers</span>
                  </div>
                  {confirmPassword.length > 0 && (
                    <div className="flex items-center gap-1.5">
                      {passwordsMatch ? <Check className="h-3.5 w-3.5 text-signal" /> : <X className="h-3.5 w-3.5 text-destructive" />}
                      <span className={passwordsMatch ? 'text-signal font-medium' : 'text-destructive'}>Passwords match</span>
                    </div>
                  )}
                </div>
              )}

              {/* Terms Checkbox */}
              <div className="flex items-start gap-2 pt-1">
                <input
                  id="agree-terms"
                  type="checkbox"
                  checked={agreeTerms}
                  onChange={(e) => setAgreeTerms(e.target.checked)}
                  required
                  className="mt-0.5 h-4 w-4 rounded border-gray-300 text-primary focus:ring-primary"
                  data-testid="checkbox-agree-terms"
                />
                <Label htmlFor="agree-terms" className="text-xs font-normal text-muted-foreground leading-snug cursor-pointer">
                  I agree to the <Link href="/legal/terms" className="text-primary underline">Terms of Service</Link> and{' '}
                  <Link href="/legal/privacy" className="text-primary underline">Privacy Policy</Link>. FleetWala protects worker contact details and guarantees zero registration fees.
                </Label>
              </div>

              <Button
                type="submit"
                className="w-full h-10 font-semibold text-sm"
                disabled={busy || !agreeTerms || !email || !password || !confirmPassword}
                data-testid="button-signup-submit"
              >
                {busy ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Creating account...
                  </>
                ) : (
                  <>
                    Create {role === 'worker' ? 'Worker' : 'Employer'} Account
                    <ArrowRight className="ml-1.5 h-4 w-4" />
                  </>
                )}
              </Button>
            </form>

            <div className="mt-6 border-t pt-4 text-center text-xs text-muted-foreground">
              Already have an account?{' '}
              <Link href="/login" className="font-semibold text-primary underline" data-testid="link-to-login">
                Sign in
              </Link>
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
