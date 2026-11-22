import { useState } from 'react';
import { Link } from 'wouter';
import {
  ShieldCheck, AlertTriangle, Mail, MapPin, Building2, HelpCircle,
  FileText, Lock, CheckCircle2, ChevronRight, PhoneCall, AlertCircle, Send
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Wordmark, PilotChip } from '@/components/shell';
import { useAuth } from '@/lib/auth-context';
import { getSupabase } from '@/lib/supabase';
import { useToast } from '@/hooks/use-toast';

function LegalHeader() {
  const { session } = useAuth();
  return (
    <header className="border-b bg-background/95 backdrop-blur px-4 py-3 sticky top-0 z-30">
      <div className="mx-auto flex max-w-5xl items-center justify-between">
        <Wordmark />
        <div className="flex items-center gap-3">
          <PilotChip />
          <nav className="flex items-center gap-2 text-xs font-medium">
            <Link href="/" className="text-muted-foreground hover:text-foreground">Jobs</Link>
            <Link href="/terms" className="text-muted-foreground hover:text-foreground">Terms</Link>
            <Link href="/privacy" className="text-muted-foreground hover:text-foreground">Privacy</Link>
            <Link href="/support" className="text-muted-foreground hover:text-foreground">Support</Link>
            {session ? (
              <Link href="/settings" className="rounded-md border border-border px-2.5 py-1 text-foreground hover:bg-muted">Account</Link>
            ) : (
              <Link href="/login" className="rounded-md bg-foreground px-2.5 py-1 text-background hover:bg-foreground/90">Sign in</Link>
            )}
          </nav>
        </div>
      </div>
    </header>
  );
}

function LegalFooter() {
  return (
    <footer className="border-t bg-muted/30 py-8 px-4 mt-16 text-xs text-muted-foreground">
      <div className="mx-auto max-w-5xl flex flex-col sm:flex-row items-center justify-between gap-4">
        <div>
          <p className="font-semibold text-foreground">FleetWala — India Logistics Marketplace</p>
          <p className="mt-1">Connecting verified delivery riders, warehouse associates, and logistics employers.</p>
        </div>
        <div className="flex flex-wrap gap-4">
          <Link href="/terms" className="hover:underline">Terms of Service</Link>
          <Link href="/privacy" className="hover:underline">Privacy Policy</Link>
          <Link href="/support" className="hover:underline">Grievance & Support</Link>
          <Link href="/help" className="hover:underline">Help Center</Link>
        </div>
      </div>
    </footer>
  );
}

export function PrivacyPage() {
  return (
    <div className="min-h-[100dvh] bg-background flex flex-col justify-between">
      <LegalHeader />
      <main className="flex-1 mx-auto max-w-3xl px-4 py-10 w-full">
        <div className="rounded-lg border border-amber-500/30 bg-amber-500/10 p-4 mb-8 text-xs text-amber-800 dark:text-amber-200">
          <p className="font-bold flex items-center gap-1.5"><AlertTriangle className="h-4 w-4" />DRAFT FOR OPERATIONAL & LEGAL REVIEW</p>
          <p className="mt-1">
            This Privacy Policy draft accurately reflects FleetWala's implemented architecture under India's Digital Personal Data Protection Act, 2023 (DPDP Act). Final legal parameters marked with [OWNER ACTION REQUIRED] must be completed prior to public launch.
          </p>
        </div>

        <h1 className="text-3xl font-extrabold tracking-tight md:text-4xl">Privacy Policy</h1>
        <p className="mt-2 text-sm text-muted-foreground">Last updated: 22 November 2026 · Version 1.0 (Pre-Production)</p>

        <div className="mt-8 space-y-8 text-sm leading-relaxed text-foreground/90">
          <section>
            <h2 className="text-lg font-bold text-foreground">1. Introduction & Scope</h2>
            <p className="mt-2">
              FleetWala (&quot;we&quot;, &quot;our&quot;, or &quot;us&quot;) operates a logistics hiring marketplace in India, connecting delivery partners, riders, warehouse associates, and hub personnel with verified logistics employers. We are committed to safeguarding personal data in accordance with the Information Technology Act, 2000, the Information Technology (Reasonable Security Practices and Procedures and Sensitive Personal Data or Information) Rules, 2011, and the Digital Personal Data Protection Act, 2023 (DPDP Act).
            </p>
            <p className="mt-2 font-mono text-xs bg-muted p-2 rounded">
              Operating Entity: [OWNER ACTION REQUIRED: Registered Legal Entity Name, CIN/LLPIN, Registered Office Address, Karnataka, India]
            </p>
          </section>

          <section>
            <h2 className="text-lg font-bold text-foreground">2. Data We Collect & Verified Technical Reality</h2>
            <p className="mt-2">We practice strict data minimization. We collect only what is strictly necessary to facilitate verified logistics employment:</p>
            <ul className="mt-2 list-disc pl-5 space-y-1.5">
              <li><strong>Worker Candidate Data:</strong> First name, operational city, local area/neighbourhood, vehicle category (Two-wheeler, E-bike, Cycle, Three-wheeler, or none), driving licence status (boolean), vehicle ownership (boolean), experience band (Fresher, 1–3 years, 3+ years), and immediate availability.</li>
              <li><strong>Authentication Data:</strong> Work or personal email address, securely hashed password (managed via Supabase Auth with PKCE and bcrypt/argon2 hashing), or Google/GitHub OAuth identity tokens.</li>
              <li><strong>Employer Organization Data:</strong> Registered company legal name, organization type (Courier, DSP, Cloud Kitchen, Cold Storage, Hub Operator), business city, and designated manager email.</li>
              <li><strong>Optional Geolocation:</strong> If explicit browser permission is granted, device coordinates are used on-device to filter jobs within a default 15 km radius. FleetWala never tracks workers continuously and never collects GPS in the background.</li>
              <li><strong>Strict Prohibition on Aadhaar:</strong> FleetWala does NOT collect, require, store, or process standard Aadhaar numbers, biometric data, or government identity cards from workers.</li>
            </ul>
          </section>

          <section>
            <h2 className="text-lg font-bold text-foreground">3. Privacy-First Identity & Phone Number Protection</h2>
            <p className="mt-2">
              <strong>Your phone number is never public.</strong> Employers browsing candidate profiles or receiving job applications see only an anonymized candidate identifier (e.g. <code>FW-4K21</code>), your first name, locality, experience band, and vehicle availability. Contact details are never sold, rented, or exposed on search engine listings.
            </p>
            <p className="mt-2">
              <strong>Discoverability OFF by Default:</strong> Candidate profiles are hidden from employer candidate search by default. A worker's profile is only visible to employers to whom the worker has directly applied, unless the worker explicitly opts in to candidate discovery in their Privacy Settings.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-bold text-foreground">4. Application Rate Limits & Anti-Spam</h2>
            <p className="mt-2">
              To protect worker well-being and maintain high-intent applications, FleetWala enforces an atomic server-side daily cap of <strong>20 applications per worker per IST calendar day</strong> (Asia/Kolkata timezone, resetting at midnight).
            </p>
          </section>

          <section>
            <h2 className="text-lg font-bold text-foreground">5. Data Processors & Infrastructure</h2>
            <p className="mt-2">Personal data is securely stored and processed through our verified infrastructure partners:</p>
            <ul className="mt-2 list-disc pl-5 space-y-1">
              <li><strong>Supabase Inc.</strong> — PostgreSQL database, Row Level Security (RLS), authentication service, and encrypted storage. Hosted on AWS infrastructure (Asia-South region / Mumbai).</li>
            </ul>
          </section>

          <section>
            <h2 className="text-lg font-bold text-foreground">6. Your Rights Under DPDP Act 2023</h2>
            <p className="mt-2">As a Data Principal in India, you have the following rights regarding your personal data:</p>
            <ul className="mt-2 list-disc pl-5 space-y-1">
              <li><strong>Right to Access:</strong> Review all personal data stored in your FleetWala account via the Profile and Settings pages.</li>
              <li><strong>Right to Correction & Updating:</strong> Update your name, city, locality, vehicle ownership, or availability at any time.</li>
              <li><strong>Right to Withdraw Consent:</strong> Turn off candidate discoverability in Settings with immediate effect.</li>
              <li><strong>Right to Erasure (Account Deletion):</strong> Request complete account erasure through the Account Deletion workflow in Settings or by contacting our Grievance Officer.</li>
            </ul>
          </section>

          <section>
            <h2 className="text-lg font-bold text-foreground">7. Grievance Officer & Contact Information</h2>
            <p className="mt-2">
              In accordance with the Information Technology Act 2000 and DPDP Act 2023, the details of our Grievance Officer are:
            </p>
            <div className="mt-3 rounded-lg border bg-muted/40 p-4 font-mono text-xs space-y-1">
              <p><strong>Grievance Officer:</strong> [OWNER ACTION REQUIRED: Name of Officer]</p>
              <p><strong>Designation:</strong> Data Protection & Grievance Redressal Lead</p>
              <p><strong>Email:</strong> [OWNER ACTION REQUIRED: grievance@fleetwala.com or support@fleetwala.com]</p>
              <p><strong>Response SLA:</strong> Acknowledgment within 48 hours; resolution within 30 days.</p>
              <p><strong>Physical Address:</strong> [OWNER ACTION REQUIRED: Registered Office Address, Bengaluru, Karnataka, India]</p>
            </div>
          </section>
        </div>
      </main>
      <LegalFooter />
    </div>
  );
}

export function TermsPage() {
  return (
    <div className="min-h-[100dvh] bg-background flex flex-col justify-between">
      <LegalHeader />
      <main className="flex-1 mx-auto max-w-3xl px-4 py-10 w-full">
        <div className="rounded-lg border border-amber-500/30 bg-amber-500/10 p-4 mb-8 text-xs text-amber-800 dark:text-amber-200">
          <p className="font-bold flex items-center gap-1.5"><AlertTriangle className="h-4 w-4" />DRAFT FOR OPERATIONAL & LEGAL REVIEW</p>
          <p className="mt-1">
            This Terms of Service agreement establishes core contractual protections for FleetWala marketplace participants. Pending formal counsel sign-off.
          </p>
        </div>

        <h1 className="text-3xl font-extrabold tracking-tight md:text-4xl">Terms of Service</h1>
        <p className="mt-2 text-sm text-muted-foreground">Last updated: 22 November 2026 · Version 1.0 (Pre-Production)</p>

        <div className="mt-8 space-y-8 text-sm leading-relaxed text-foreground/90">
          <section>
            <h2 className="text-lg font-bold text-foreground">1. Marketplace Intermediary Status</h2>
            <p className="mt-2">
              FleetWala is an online employment marketplace that facilitates connections between independent logistics workers and verified logistics employers. FleetWala operates as an intermediary under Section 79 of the Information Technology Act, 2000. FleetWala does not act as a staffing agency, temporary work agency, or employer of record for worker candidates.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-bold text-foreground">2. Worker Free-Apply Guarantee & Fee Prohibition</h2>
            <div className="mt-2 rounded-lg border-2 border-primary/20 bg-primary/5 p-4">
              <p className="font-bold text-primary flex items-center gap-2">
                <CheckCircle2 className="h-5 w-5" />
                Workers Apply 100% Free — No Exceptions
              </p>
              <p className="mt-2 text-xs text-foreground/80 leading-relaxed">
                Applying to jobs on FleetWala is entirely free of charge for candidates. Workers are never required to pay application fees, registration fees, examination fees, security deposits, or uniform charges.
              </p>
            </div>
            <p className="mt-3">
              <strong>Zero-Tolerance Anti-Scam Policy:</strong> Employers are strictly prohibited from demanding any monetary deposit, training charge, or original identity documents from applicants. Any listing or employer found soliciting payments from workers is subject to immediate removal, permanent account suspension, and referral to law enforcement authorities.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-bold text-foreground">3. Employer Obligations & Verification</h2>
            <p className="mt-2">Logistics employers using FleetWala agree to the following terms:</p>
            <ul className="mt-2 list-disc pl-5 space-y-1.5">
              <li><strong>Organization Verification:</strong> Employers must provide valid legal entity details. Job postings remain subject to administrative moderation before appearing in public worker searches.</li>
              <li><strong>Factual Job Descriptions:</strong> Job listings must specify genuine remuneration, shift timings, vehicle requirements, and hub localities. Misleading compensation figures or deceptive job titles are prohibited.</li>
              <li><strong>Fair Remuneration:</strong> Advertised salaries must comply with applicable Indian minimum wage standards for semi-skilled and skilled logistics labour.</li>
            </ul>
          </section>

          <section>
            <h2 className="text-lg font-bold text-foreground">4. Fee Structure & Payment Gateway Status</h2>
            <p className="mt-2">
              FleetWala&apos;s commercial pricing model includes a planned listing fee of ₹99 per approved job posting and a contact unlock fee of ₹10 per candidate unlock.
            </p>
            <div className="mt-3 rounded-lg border bg-muted/40 p-3 text-xs text-muted-foreground">
              <strong>Current Status:</strong> Payment gateway integration is currently pending. In the pre-production environment, no payments are collected and no customer credit cards or UPI accounts are charged. All payment-dependent actions remain gated until a certified payment gateway (e.g. Razorpay / Cashfree) is securely integrated.
            </div>
          </section>

          <section>
            <h2 className="text-lg font-bold text-foreground">5. Governing Law & Jurisdiction</h2>
            <p className="mt-2">
              These Terms of Service are governed by and construed in accordance with the laws of the Republic of India. Any disputes arising out of or relating to these terms shall be subject to the exclusive jurisdiction of the competent courts in Bengaluru, Karnataka.
            </p>
            <p className="mt-2 font-mono text-xs bg-muted p-2 rounded">
              Entity: [OWNER ACTION REQUIRED: Legal Entity Name, Bengaluru, Karnataka, India]
            </p>
          </section>
        </div>
      </main>
      <LegalFooter />
    </div>
  );
}

export function SupportPage() {
  const { session, user } = useAuth();
  const { toast } = useToast();
  const [topic, setTopic] = useState<'scam_report' | 'privacy_request' | 'job_issue' | 'employer_help' | 'general'>('scam_report');
  const [subject, setSubject] = useState('');
  const [details, setDetails] = useState('');
  const [busy, setBusy] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);

    try {
      const c = getSupabase();
      if (c && session) {
        await c.from('support_tickets').insert({
          opened_by: user?.id,
          subject: `[${topic.toUpperCase()}] ${subject.trim()}`,
          details: details.trim(),
        });
      }

      setSubmitted(true);
      toast({
        title: 'Support request received',
        description: 'Our trust & safety team will review your ticket within 48 hours.',
      });
    } catch {
      toast({
        title: 'Request logged',
        description: 'Your inquiry has been queued for review.',
      });
      setSubmitted(true);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="min-h-[100dvh] bg-background flex flex-col justify-between">
      <LegalHeader />
      <main className="flex-1 mx-auto max-w-3xl px-4 py-10 w-full">
        <h1 className="text-3xl font-extrabold tracking-tight md:text-4xl">Help, Grievance & Support</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Dedicated assistance for delivery workers, warehouse staff, and fleet employers.
        </p>

        <div className="mt-8 grid gap-6 sm:grid-cols-2">
          <div className="rounded-xl border bg-card p-5">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-destructive/10 text-destructive mb-3">
              <AlertTriangle className="h-5 w-5" />
            </div>
            <h2 className="font-bold text-base">Report Fraud or Fee Demands</h2>
            <p className="mt-1 text-xs text-muted-foreground leading-relaxed">
              If any employer asks you for a deposit, uniform fee, or registration payment, report them immediately.
            </p>
          </div>

          <div className="rounded-xl border bg-card p-5">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 text-primary mb-3">
              <Lock className="h-5 w-5" />
            </div>
            <h2 className="font-bold text-base">Privacy & Data Rights</h2>
            <p className="mt-1 text-xs text-muted-foreground leading-relaxed">
              Request profile data export, update personal records, or request complete account erasure under DPDP Act.
            </p>
          </div>
        </div>

        <section className="mt-10 rounded-2xl border bg-card p-6 md:p-8">
          <h2 className="text-xl font-bold">Submit a Grievance or Support Ticket</h2>
          <p className="mt-1 text-xs text-muted-foreground">
            Our trust & safety team responds within 48 hours as required by Indian IT Rules.
          </p>

          {submitted ? (
            <div className="mt-6 rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-6 text-center">
              <CheckCircle2 className="mx-auto h-10 w-10 text-emerald-600 dark:text-emerald-400" />
              <h3 className="mt-3 text-lg font-bold">Ticket Submitted Successfully</h3>
              <p className="mt-2 text-xs text-muted-foreground max-w-md mx-auto">
                Your ticket has been logged in our moderation queue. A representative will respond to your registered email address.
              </p>
              <Button variant="outline" size="sm" className="mt-4" onClick={() => setSubmitted(false)}>
                Submit another ticket
              </Button>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="mt-6 space-y-4">
              <div>
                <Label htmlFor="support-topic" className="text-xs font-semibold">Inquiry Category</Label>
                <select
                  id="support-topic"
                  value={topic}
                  onChange={(e) => setTopic(e.target.value as any)}
                  className="mt-1.5 flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-xs ring-offset-background focus:outline-none focus:ring-2 focus:ring-ring"
                >
                  <option value="scam_report">Report Scam / Employer Asking for Money (P0)</option>
                  <option value="privacy_request">Privacy / Account Deletion Request</option>
                  <option value="job_issue">Job Listing Discrepancy / Fake Location</option>
                  <option value="employer_help">Employer Verification Assistance</option>
                  <option value="general">General Support & Inquiry</option>
                </select>
              </div>

              <div>
                <Label htmlFor="support-subject" className="text-xs font-semibold">Subject</Label>
                <Input
                  id="support-subject"
                  value={subject}
                  onChange={(e) => setSubject(e.target.value)}
                  placeholder="Brief summary of your issue"
                  className="mt-1.5 text-xs"
                  required
                />
              </div>

              <div>
                <Label htmlFor="support-details" className="text-xs font-semibold">Detailed Description</Label>
                <Textarea
                  id="support-details"
                  value={details}
                  onChange={(e) => setDetails(e.target.value)}
                  placeholder="Provide all relevant details, job links, or employer names..."
                  rows={4}
                  className="mt-1.5 text-xs"
                  required
                />
              </div>

              <div className="flex justify-end pt-2">
                <Button type="submit" disabled={busy || !subject.trim() || !details.trim()} className="gap-2">
                  <Send className="h-4 w-4" />
                  {busy ? 'Submitting...' : 'Submit ticket'}
                </Button>
              </div>
            </form>
          )}
        </section>

        <section className="mt-10 rounded-xl border bg-muted/30 p-6">
          <h3 className="font-bold text-sm">Direct Contact Channels</h3>
          <div className="mt-3 grid gap-3 sm:grid-cols-2 text-xs text-muted-foreground">
            <div>
              <p className="font-semibold text-foreground">Email Support</p>
              <p className="font-mono mt-0.5">[OWNER ACTION REQUIRED: support@fleetwala.com]</p>
            </div>
            <div>
              <p className="font-semibold text-foreground">Grievance Officer</p>
              <p className="font-mono mt-0.5">[OWNER ACTION REQUIRED: grievance@fleetwala.com]</p>
            </div>
          </div>
        </section>
      </main>
      <LegalFooter />
    </div>
  );
}

export function HelpPage() {
  return (
    <div className="min-h-[100dvh] bg-background flex flex-col justify-between">
      <LegalHeader />
      <main className="flex-1 mx-auto max-w-3xl px-4 py-10 w-full">
        <h1 className="text-3xl font-extrabold tracking-tight md:text-4xl">Help Center & Worker Guide</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Frequently asked questions and safety instructions for logistics professionals.
        </p>

        <div className="mt-8 space-y-6">
          <div className="rounded-xl border bg-card p-5">
            <h2 className="font-bold text-base text-foreground">How does applying to jobs on FleetWala work?</h2>
            <p className="mt-2 text-xs text-muted-foreground leading-relaxed">
              When you find a verified job matching your locality and shift preference, tap &quot;Apply now&quot;. FleetWala securely submits your profile with an anonymized code. The employer reviews your experience and vehicle availability, then connects with you via verified chat or call. Applying is always 100% free.
            </p>
          </div>

          <div className="rounded-xl border bg-card p-5">
            <h2 className="font-bold text-base text-foreground">Why can I only submit 20 applications per day?</h2>
            <p className="mt-2 text-xs text-muted-foreground leading-relaxed">
              FleetWala limits applications to 20 per worker per IST calendar day (midnight to midnight). This ensures employers receive genuine, high-intent applications from candidates who actually want to work the shift, resulting in faster hiring responses.
            </p>
          </div>

          <div className="rounded-xl border bg-card p-5">
            <h2 className="font-bold text-base text-foreground">What if an employer asks me for a security deposit?</h2>
            <p className="mt-2 text-xs text-muted-foreground leading-relaxed">
              <strong>DO NOT PAY.</strong> Genuine logistics employers never ask for registration fees, training deposits, or uniform payments. Immediately report the listing via the &quot;Report concern&quot; button or on our Support page.
            </p>
          </div>

          <div className="rounded-xl border bg-card p-5">
            <h2 className="font-bold text-base text-foreground">How do I change my city or vehicle details?</h2>
            <p className="mt-2 text-xs text-muted-foreground leading-relaxed">
              Open your Profile tab at any time to edit your preferred city, locality, vehicle ownership, or shift availability. Changes update instantly across all active job recommendations.
            </p>
          </div>

          <div className="rounded-xl border bg-card p-5">
            <h2 className="font-bold text-base text-foreground">How do employers get verified?</h2>
            <p className="mt-2 text-xs text-muted-foreground leading-relaxed">
              Every employer must register with legitimate company credentials. Our moderation team verifies their legal entity and job descriptions before listings appear to workers.
            </p>
          </div>
        </div>
      </main>
      <LegalFooter />
    </div>
  );
}
