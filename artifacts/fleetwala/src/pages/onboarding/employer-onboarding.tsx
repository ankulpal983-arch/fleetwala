import { useState, useEffect } from 'react';
import { useLocation } from 'wouter';
import {
  Building2, ShieldAlert, CheckCircle2, AlertCircle, ArrowRight,
  Loader2, MapPin, Globe, Mail, UserRound
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Wordmark, PilotChip } from '@/components/shell';
import { CITIES, CITY_NAMES } from '@/lib/fixtures';
import { useSession } from '@/lib/supabase';
import { registerLiveEmployer, getLiveEmployerOrg } from '@/lib/repo';

type EmployerType = 'company' | 'vendor_dsp' | 'recruitment_agency';

export function EmployerOnboardingPage() {
  const [, navigate] = useLocation();
  const { session, user } = useSession();

  const [legalName, setLegalName] = useState('');
  const [employerType, setEmployerType] = useState<EmployerType>('company');
  const [city, setCity] = useState('Bengaluru');
  const [address, setAddress] = useState('');
  const [contactName, setContactName] = useState(user?.user_metadata?.full_name || '');
  const [website, setWebsite] = useState('');
  const [busy, setBusy] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  useEffect(() => {
    if (session) {
      getLiveEmployerOrg().then((org) => {
        if (org) {
          navigate('/employer');
        }
      });
    }
  }, [session]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);

    if (!legalName.trim() || legalName.trim().length < 2) {
      setErrorMsg('Please enter your organization legal name (at least 2 characters).');
      return;
    }
    if (!address.trim()) {
      setErrorMsg('Please enter your primary operating address or hub location.');
      return;
    }

    setBusy(true);

    try {
      const res = await registerLiveEmployer(legalName.trim(), employerType);
      if (!res.ok) {
        setErrorMsg(res.error || 'Failed to register organization. Please try again.');
        setBusy(false);
        return;
      }

      navigate('/employer');
    } catch {
      setErrorMsg('Network error while registering employer organization.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="min-h-[100dvh] bg-background flex flex-col justify-between">
      <header className="border-b bg-background/95 backdrop-blur px-4 py-3">
        <div className="mx-auto flex max-w-4xl items-center justify-between">
          <Wordmark />
          <div className="flex items-center gap-2">
            <span className="text-xs font-mono text-muted-foreground uppercase">Employer Setup</span>
            <PilotChip />
          </div>
        </div>
      </header>

      <main className="flex-1 flex items-center justify-center p-4 py-8">
        <div className="w-full max-w-2xl mx-auto">
          <div className="mb-6">
            <p className="text-xs font-mono uppercase tracking-wider text-primary font-bold">
              Organization Onboarding
            </p>
            <h1 className="text-2xl md:text-3xl font-extrabold text-foreground tracking-tight mt-0.5">
              Set up your employer workspace
            </h1>
            <p className="text-xs text-muted-foreground mt-1">
              Register your logistics company or DSP agency to start hiring verified delivery partners.
            </p>
          </div>

          <div className="rise rounded-2xl border bg-card p-6 md:p-8 shadow-md">
            {errorMsg && (
              <div className="mb-5 flex items-start gap-2.5 rounded-lg border border-destructive/30 bg-destructive/10 p-3 text-xs text-destructive" role="alert">
                <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
                <span>{errorMsg}</span>
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-1.5">
                <Label htmlFor="employer-legal-name" className="text-xs font-medium">Organization / Legal Name</Label>
                <Input
                  id="employer-legal-name"
                  type="text"
                  value={legalName}
                  onChange={(e) => setLegalName(e.target.value)}
                  placeholder="e.g. Ghar-Tak Parcels Pvt Ltd"
                  required
                  disabled={busy}
                  className="h-10 text-sm"
                  data-testid="input-org-legal-name"
                />
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <Label htmlFor="employer-type" className="text-xs font-medium">Organization Type</Label>
                  <Select value={employerType} onValueChange={(v) => setEmployerType(v as EmployerType)}>
                    <SelectTrigger id="employer-type" className="h-10 text-sm" data-testid="select-org-type">
                      <SelectValue placeholder="Select type" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="company">Direct Enterprise / Logistics Co</SelectItem>
                      <SelectItem value="vendor_dsp">Vendor / DSP Delivery Service Partner</SelectItem>
                      <SelectItem value="recruitment_agency">Logistics Recruitment Agency</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="employer-city" className="text-xs font-medium">Headquarters / Hub City</Label>
                  <Select value={city} onValueChange={setCity}>
                    <SelectTrigger id="employer-city" className="h-10 text-sm" data-testid="select-org-city">
                      <SelectValue placeholder="Select city" />
                    </SelectTrigger>
                    <SelectContent>
                      {CITY_NAMES.map((c) => (
                        <SelectItem key={c} value={c}>{c}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="employer-address" className="text-xs font-medium">Operating Address / Hub Location</Label>
                <Input
                  id="employer-address"
                  type="text"
                  value={address}
                  onChange={(e) => setAddress(e.target.value)}
                  placeholder="e.g. Plot 42, HSR Layout Sector 2, Bengaluru"
                  required
                  disabled={busy}
                  className="h-10 text-sm"
                  data-testid="input-org-address"
                />
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <Label htmlFor="employer-contact" className="text-xs font-medium">Contact Person Name</Label>
                  <Input
                    id="employer-contact"
                    type="text"
                    value={contactName}
                    onChange={(e) => setContactName(e.target.value)}
                    placeholder="e.g. Anand Sharma (Operations Lead)"
                    required
                    disabled={busy}
                    className="h-10 text-sm"
                    data-testid="input-org-contact-name"
                  />
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="employer-website" className="text-xs font-medium">Company Website (Optional)</Label>
                  <Input
                    id="employer-website"
                    type="url"
                    value={website}
                    onChange={(e) => setWebsite(e.target.value)}
                    placeholder="https://company.com"
                    disabled={busy}
                    className="h-10 text-sm"
                    data-testid="input-org-website"
                  />
                </div>
              </div>

              {/* Trust & Safety Notice */}
              <div className="rounded-xl border border-primary/20 bg-primary/5 p-4 text-xs text-muted-foreground space-y-1.5 mt-2">
                <div className="flex items-center gap-1.5 font-bold text-foreground">
                  <ShieldAlert className="h-4 w-4 text-primary" />
                  Verification & Trust Guidelines
                </div>
                <p>
                  Newly registered employers are created in a <span className="font-semibold text-foreground">Pending Verification</span> state. You will be able to manage your dashboard and save draft job postings immediately. Listings are published to jobseekers following administrator review.
                </p>
              </div>

              <div className="pt-3">
                <Button
                  type="submit"
                  disabled={busy || !legalName.trim() || !address.trim()}
                  className="w-full h-11 font-semibold text-sm"
                  data-testid="button-complete-employer-onboarding"
                >
                  {busy ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Creating Organization Workspace...
                    </>
                  ) : (
                    <>
                      Complete Setup & Open Workspace
                      <ArrowRight className="ml-1.5 h-4 w-4" />
                    </>
                  )}
                </Button>
              </div>
            </form>
          </div>
        </div>
      </main>

      <footer className="border-t py-4 text-center text-xs text-muted-foreground px-4">
        <span>FleetWala &copy; 2026. B2B Employer Portal.</span>
      </footer>
    </div>
  );
}
