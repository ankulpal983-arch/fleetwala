import { useState } from 'react';
import { Link, useParams } from 'wouter';
import { ArrowRight, EyeOff, Lock, Mail, MapPin, Phone, ShieldCheck, Settings2, Gauge, Building2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { PilotChip, Wordmark } from '@/components/shell';
import { Monogram } from '@/components/common';
import {
  gate, liveRequested, normalizeIndianPhone, sendEmailMagicLink, sendPhoneOtp, signOut, supabaseConfigured, useSession, verifyPhoneOtp,
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
            <Monogram name="Ghar-Tak Parcels" size="sm" />
            <div className="text-sm"><p className="font-bold">Parcel delivery partner</p><p className="text-xs text-muted-foreground">Koramangala · sample job</p></div>
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
          <span>FleetWala pilot. All jobs and companies shown are sample data.</span>
          <Link href="/legal/terms" className="underline">Terms (draft)</Link>
          <Link href="/legal/privacy" className="underline">Privacy (draft)</Link>
          <Link href="/support" className="underline">Help</Link>
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
      <p className="mt-3">You can keep exploring the <Link href="/" className="underline">pilot with sample data</Link>.</p>
    </div>
  );
}

export function Login() {
  const { session } = useSession();
  const [phone, setPhone] = useState('');
  const [otp, setOtp] = useState('');
  const [otpSent, setOtpSent] = useState(false);
  const [email, setEmail] = useState('');
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  const run = async (fn: () => Promise<{ ok: boolean; error?: string }>, success: string, after?: () => void) => {
    setBusy(true); setMsg(null);
    try {
      const r = await fn();
      if (r.ok) { setMsg({ ok: true, text: success }); after?.(); } else setMsg({ ok: false, text: r.error ?? 'Something went wrong.' });
    } catch {
      setMsg({ ok: false, text: 'Network error. Check your connection and try again.' });
    } finally { setBusy(false); }
  };
  const phoneValid = normalizeIndianPhone(phone) !== null;

  return (
    <div className="min-h-[100dvh]">
      <PublicHeader />
      <div className="mx-auto grid max-w-5xl gap-8 px-4 py-10 md:grid-cols-[1fr_420px]">
        <div className="rise">
          <h1 className="text-4xl font-extrabold md:text-5xl">Sign in</h1>
          <p className="mt-3 max-w-md text-muted-foreground">Workers sign in with an SMS code on an Indian mobile number. Employers use an email link.</p>
          <p className="mt-6 max-w-md rounded-lg border border-dashed p-3 text-xs text-muted-foreground">Signing in does not yet unlock live data. Live workspaces stay blocked until the portal integration is connected; you will see a setup screen instead of sample data.</p>
        </div>
        <div className="rise rounded-2xl border bg-card p-6" style={{ animationDelay: '80ms' }}>
          {session ? (
            <div className="space-y-4">
              <p className="font-semibold" data-testid="text-signed-in">You are signed in.</p>
              <Button variant="outline" onClick={() => run(signOut, 'Signed out.')} disabled={busy} data-testid="button-signout">Sign out</Button>
              {msg && <p className={msg.ok ? 'text-sm text-signal' : 'text-sm text-destructive'} role="status">{msg.text}</p>}
            </div>
          ) : !supabaseConfigured ? <ConfigMissing /> : (
            <Tabs defaultValue="worker" onValueChange={() => setMsg(null)}>
              <TabsList className="grid w-full grid-cols-2"><TabsTrigger value="worker" data-testid="tab-worker-login">Worker</TabsTrigger><TabsTrigger value="employer" data-testid="tab-employer-login">Employer</TabsTrigger></TabsList>
              <TabsContent value="worker" className="mt-5">
                {!otpSent ? (
                  <form className="space-y-3" onSubmit={(e) => { e.preventDefault(); run(() => sendPhoneOtp(phone), 'Code sent by SMS.', () => setOtpSent(true)); }}>
                    <Label htmlFor="phone">Mobile number</Label>
                    <div className="flex"><span className="flex items-center rounded-l-md border border-r-0 bg-muted px-3 font-mono text-sm">+91</span>
                      <Input id="phone" inputMode="tel" autoComplete="tel-national" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="98xxxxxxxx" className="rounded-l-none" aria-invalid={phone.length > 0 && !phoneValid} data-testid="input-phone" /></div>
                    {phone.length >= 10 && !phoneValid && <p className="text-xs text-destructive">Enter a 10-digit Indian mobile number starting with 6 to 9.</p>}
                    <Button type="submit" className="w-full" disabled={busy || !phoneValid} data-testid="button-send-otp"><Phone className="mr-1.5 h-4 w-4" />{busy ? 'Sending' : 'Send code'}</Button>
                  </form>
                ) : (
                  <form className="space-y-3" onSubmit={(e) => { e.preventDefault(); run(() => verifyPhoneOtp(phone, otp), 'Verified. You are signed in.'); }}>
                    <Label htmlFor="otp">6-digit code sent to {normalizeIndianPhone(phone)}</Label>
                    <Input id="otp" inputMode="numeric" autoComplete="one-time-code" maxLength={6} value={otp} onChange={(e) => setOtp(e.target.value.replace(/\D/g, ''))} className="font-mono tracking-[0.5em]" data-testid="input-otp" />
                    <Button type="submit" className="w-full" disabled={busy || otp.length !== 6} data-testid="button-verify-otp">{busy ? 'Checking' : 'Verify'}</Button>
                    <button type="button" className="text-xs underline" onClick={() => { setOtpSent(false); setOtp(''); }}>Change number</button>
                  </form>
                )}
              </TabsContent>
              <TabsContent value="employer" className="mt-5">
                <form className="space-y-3" onSubmit={(e) => { e.preventDefault(); run(() => sendEmailMagicLink(email), 'Check your inbox for a sign-in link.'); }}>
                  <Label htmlFor="email">Work email</Label>
                  <Input id="email" type="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} required data-testid="input-email" />
                  <Button type="submit" className="w-full" disabled={busy || !/^\S+@\S+\.\S+$/.test(email)} data-testid="button-send-link"><Mail className="mr-1.5 h-4 w-4" />{busy ? 'Sending' : 'Email me a link'}</Button>
                </form>
              </TabsContent>
            </Tabs>
          )}
          {msg && !session && <p className={`mt-3 text-sm ${msg.ok ? 'text-signal' : 'text-destructive'}`} role="status" data-testid="text-auth-message">{msg.text}</p>}
          {liveRequested && !supabaseConfigured && <p className="mt-3 text-xs text-muted-foreground">VITE_ENABLE_LIVE is set, but live mode stays off until Supabase is configured.</p>}
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
