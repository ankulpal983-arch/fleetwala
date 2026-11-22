import { useEffect, useState } from 'react';
import { Link } from 'wouter';
import { Mail, CheckCircle2, ArrowLeft, RefreshCw, AlertCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Wordmark, PilotChip } from '@/components/shell';
import { getSupabase } from '@/lib/supabase';

export function VerifyEmailPage() {
  const [email, setEmail] = useState('');
  const [cooldown, setCooldown] = useState(60);
  const [resending, setResending] = useState(false);
  const [resendStatus, setResendStatus] = useState<string | null>(null);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      const emailParam = params.get('email');
      if (emailParam) setEmail(emailParam);
    }
  }, []);

  useEffect(() => {
    if (cooldown <= 0) return;
    const timer = setInterval(() => setCooldown((c) => Math.max(0, c - 1)), 1000);
    return () => clearInterval(timer);
  }, [cooldown]);

  const handleResend = async () => {
    if (!email || cooldown > 0 || resending) return;
    setResending(true);
    setResendStatus(null);

    const c = getSupabase();
    if (!c) {
      setResendStatus('Database client not configured.');
      setResending(false);
      return;
    }

    try {
      const { error } = await c.auth.resend({
        type: 'signup',
        email: email.trim(),
      });
      if (error) {
        setResendStatus(error.message);
      } else {
        setResendStatus('Confirmation email resent! Please check your inbox.');
        setCooldown(60);
      }
    } catch {
      setResendStatus('Failed to resend confirmation email.');
    } finally {
      setResending(false);
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
          <div className="rise rounded-2xl border bg-card p-6 md:p-8 shadow-md text-center">
            <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-primary/10 text-primary">
              <Mail className="h-7 w-7" />
            </div>

            <h1 className="text-2xl font-bold tracking-tight text-foreground" data-testid="heading-verify-email">
              Check your email
            </h1>

            <p className="mt-2 text-sm text-muted-foreground leading-relaxed">
              We&apos;ve sent an account confirmation link to:
            </p>

            <div className="my-3 rounded-lg bg-muted px-3 py-2 font-mono text-sm font-semibold text-foreground break-all">
              {email || 'your email address'}
            </div>

            <p className="text-xs text-muted-foreground leading-relaxed">
              Click the link in the email to activate your account. If you don&apos;t see the message within a minute, check your spam or promotions folder.
            </p>

            {resendStatus && (
              <div className="mt-4 rounded-lg bg-muted/60 p-3 text-xs text-foreground" role="status">
                {resendStatus}
              </div>
            )}

            <div className="mt-6 space-y-3">
              <Button
                variant="outline"
                className="w-full text-xs font-semibold"
                disabled={cooldown > 0 || resending || !email}
                onClick={handleResend}
                data-testid="button-resend-verification"
              >
                <RefreshCw className={`mr-2 h-3.5 w-3.5 ${resending ? 'animate-spin' : ''}`} />
                {cooldown > 0 ? `Resend email in ${cooldown}s` : 'Resend confirmation email'}
              </Button>

              <Link
                href="/login"
                className="inline-flex w-full items-center justify-center gap-1.5 text-xs text-muted-foreground hover:text-foreground pt-2"
                data-testid="link-back-login"
              >
                <ArrowLeft className="h-3.5 w-3.5" />
                Return to sign in
              </Link>
            </div>
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
