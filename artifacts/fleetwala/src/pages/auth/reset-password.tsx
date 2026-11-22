import { useState } from 'react';
import { Link, useLocation } from 'wouter';
import { Lock, Eye, EyeOff, CheckCircle2, AlertCircle, Loader2, ArrowRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Wordmark, PilotChip } from '@/components/shell';
import { updateUserPassword } from '@/lib/supabase';

export function ResetPasswordPage() {
  const [, navigate] = useLocation();
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [busy, setBusy] = useState(false);
  const [success, setSuccess] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const hasMinLength = password.length >= 8;
  const hasLetter = /[A-Za-z]/.test(password);
  const hasNumber = /[0-9]/.test(password);
  const passwordsMatch = password.length > 0 && password === confirmPassword;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);

    if (!hasMinLength || !hasLetter || !hasNumber) {
      setErrorMsg('Password must be at least 8 characters and contain both letters and numbers.');
      return;
    }
    if (password !== confirmPassword) {
      setErrorMsg('Passwords do not match.');
      return;
    }

    setBusy(true);

    try {
      const res = await updateUserPassword(password);
      if (res.ok) {
        setSuccess(true);
      } else {
        setErrorMsg(res.error || 'Failed to update password. Recovery link may have expired.');
      }
    } catch {
      setErrorMsg('Network error. Please try again.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="min-h-[100dvh] bg-background flex flex-col justify-between">
      <header className="border-b bg-background/95 backdrop-blur px-4 py-3">
        <div className="mx-auto flex max-w-6xl items-center justify-between">
          <Wordmark />
          <PilotChip />
        </div>
      </header>

      <main className="flex-1 flex items-center justify-center p-4 py-12">
        <div className="w-full max-w-md mx-auto">
          <div className="rise rounded-2xl border bg-card p-6 md:p-8 shadow-md">
            {success ? (
              <div className="text-center space-y-4">
                <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-signal/10 text-signal">
                  <CheckCircle2 className="h-7 w-7" />
                </div>
                <h1 className="text-2xl font-bold tracking-tight text-foreground" data-testid="heading-reset-success">
                  Password updated
                </h1>
                <p className="text-xs text-muted-foreground leading-relaxed">
                  Your password has been securely changed. You can now sign in with your new credentials.
                </p>
                <div className="pt-4">
                  <Link
                    href="/login"
                    className="inline-flex w-full items-center justify-center gap-1.5 rounded-lg bg-primary h-10 px-4 text-xs font-semibold text-primary-foreground hover:bg-primary/90"
                    data-testid="button-to-login"
                  >
                    Proceed to sign in
                    <ArrowRight className="h-4 w-4" />
                  </Link>
                </div>
              </div>
            ) : (
              <div>
                <div className="text-center mb-6">
                  <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-primary/10 text-primary">
                    <Lock className="h-6 w-6" />
                  </div>
                  <h1 className="text-2xl font-bold tracking-tight text-foreground" data-testid="heading-reset-password">
                    Set new password
                  </h1>
                  <p className="text-xs text-muted-foreground mt-1">
                    Enter your new secure password below.
                  </p>
                </div>

                {errorMsg && (
                  <div className="mb-4 flex items-start gap-2.5 rounded-lg border border-destructive/30 bg-destructive/10 p-3 text-xs text-destructive" role="alert">
                    <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
                    <span>{errorMsg}</span>
                  </div>
                )}

                <form onSubmit={handleSubmit} className="space-y-4">
                  <div className="space-y-1.5">
                    <Label htmlFor="new-password" className="text-xs font-medium">New password</Label>
                    <div className="relative">
                      <Input
                        id="new-password"
                        type={showPassword ? 'text' : 'password'}
                        autoComplete="new-password"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        placeholder="Min 8 characters"
                        required
                        disabled={busy}
                        className="h-10 pr-9 text-sm"
                        data-testid="input-reset-password"
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
                    <Label htmlFor="confirm-new-password" className="text-xs font-medium">Confirm new password</Label>
                    <Input
                      id="confirm-new-password"
                      type={showPassword ? 'text' : 'password'}
                      autoComplete="new-password"
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      placeholder="Repeat password"
                      required
                      disabled={busy}
                      className="h-10 text-sm"
                      data-testid="input-reset-confirm"
                    />
                  </div>

                  {password.length > 0 && (
                    <div className="rounded-lg bg-muted/60 p-2.5 text-[11px] space-y-1">
                      <div className="flex items-center gap-1.5">
                        <span className={hasMinLength && hasLetter && hasNumber ? 'text-signal font-medium' : 'text-muted-foreground'}>
                          ✓ Minimum 8 characters with letters & numbers
                        </span>
                      </div>
                      {confirmPassword.length > 0 && (
                        <div className="flex items-center gap-1.5">
                          <span className={passwordsMatch ? 'text-signal font-medium' : 'text-destructive font-medium'}>
                            {passwordsMatch ? '✓ Passwords match' : '✗ Passwords do not match'}
                          </span>
                        </div>
                      )}
                    </div>
                  )}

                  <Button
                    type="submit"
                    className="w-full h-10 font-semibold text-sm"
                    disabled={busy || !hasMinLength || !passwordsMatch}
                    data-testid="button-reset-submit"
                  >
                    {busy ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Updating password...
                      </>
                    ) : (
                      'Update password'
                    )}
                  </Button>
                </form>
              </div>
            )}
          </div>
        </div>
      </main>

      <footer className="border-t py-4 text-center text-xs text-muted-foreground px-4">
        <span>FleetWala &copy; 2026. All rights reserved. </span>
        <Link href="/legal/terms" className="underline hover:text-foreground ml-2">Terms</Link>
        <span className="mx-1.5">·</span>
        <Link href="/legal/privacy" className="underline hover:text-foreground">Privacy</Link>
      </footer>
    </div>
  );
}
