import { useState } from 'react';
import { Link } from 'wouter';
import { KeyRound, ArrowLeft, Mail, Loader2, CheckCircle2, AlertCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Wordmark, PilotChip } from '@/components/shell';
import { resetPasswordForEmail } from '@/lib/supabase';

export function ForgotPasswordPage() {
  const [email, setEmail] = useState('');
  const [busy, setBusy] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    setBusy(true);

    try {
      const res = await resetPasswordForEmail(email.trim());
      if (res.ok) {
        setSubmitted(true);
      } else {
        setErrorMsg(res.error || 'Failed to send password reset email.');
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
            {submitted ? (
              <div className="text-center space-y-4">
                <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-signal/10 text-signal">
                  <CheckCircle2 className="h-7 w-7" />
                </div>
                <h1 className="text-2xl font-bold tracking-tight text-foreground" data-testid="heading-reset-sent">
                  Reset link sent
                </h1>
                <p className="text-xs text-muted-foreground leading-relaxed">
                  If an account exists for <span className="font-semibold text-foreground">{email}</span>, we have sent instructions to reset your password.
                </p>
                <div className="pt-4">
                  <Link
                    href="/login"
                    className="inline-flex w-full items-center justify-center gap-1.5 rounded-lg bg-primary h-10 px-4 text-xs font-semibold text-primary-foreground hover:bg-primary/90"
                    data-testid="link-back-login"
                  >
                    <ArrowLeft className="h-4 w-4" />
                    Return to sign in
                  </Link>
                </div>
              </div>
            ) : (
              <div>
                <div className="text-center mb-6">
                  <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-primary/10 text-primary">
                    <KeyRound className="h-6 w-6" />
                  </div>
                  <h1 className="text-2xl font-bold tracking-tight text-foreground" data-testid="heading-forgot-password">
                    Forgot password?
                  </h1>
                  <p className="text-xs text-muted-foreground mt-1 leading-relaxed">
                    Enter the email associated with your account and we&apos;ll send you a link to reset your password.
                  </p>
                </div>

                {errorMsg && (
                  <div className="mb-4 rounded-lg border border-destructive/30 bg-destructive/10 p-3 text-xs text-destructive space-y-1.5" role="alert">
                    <div className="flex items-start gap-2.5">
                      <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
                      <span className="leading-relaxed">{errorMsg}</span>
                    </div>
                    {errorMsg.toLowerCase().includes('rate limit') && (
                      <p className="text-[11px] text-muted-foreground pl-6.5 leading-relaxed">
                        <strong>Tip:</strong> Email sending limits are enforced by Supabase. Please wait a short while or configure Custom SMTP in your project dashboard.
                      </p>
                    )}
                  </div>
                )}

                <form onSubmit={handleSubmit} className="space-y-4">
                  <div className="space-y-1.5">
                    <Label htmlFor="forgot-email" className="text-xs font-medium">Email address</Label>
                    <Input
                      id="forgot-email"
                      type="email"
                      autoComplete="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="name@example.com"
                      required
                      disabled={busy}
                      className="h-10 text-sm"
                      data-testid="input-forgot-email"
                    />
                  </div>

                  <Button
                    type="submit"
                    className="w-full h-10 font-semibold text-sm"
                    disabled={busy || !email}
                    data-testid="button-forgot-submit"
                  >
                    {busy ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Sending reset link...
                      </>
                    ) : (
                      <>
                        <Mail className="mr-2 h-4 w-4" />
                        Send reset instructions
                      </>
                    )}
                  </Button>
                </form>

                <div className="mt-6 border-t pt-4 text-center">
                  <Link
                    href="/login"
                    className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground"
                    data-testid="link-back-login"
                  >
                    <ArrowLeft className="h-3.5 w-3.5" />
                    Back to sign in
                  </Link>
                </div>
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
