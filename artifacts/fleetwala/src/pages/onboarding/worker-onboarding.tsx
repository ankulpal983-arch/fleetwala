import { useEffect, useState } from 'react';
import { useLocation } from 'wouter';
import {
  UserRound, MapPin, Bike, Briefcase, Eye, EyeOff, ShieldCheck,
  ArrowRight, Loader2, CheckCircle2, AlertCircle
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Wordmark, PilotChip } from '@/components/shell';
import { cn } from '@/lib/utils';
import { CITIES, CITY_NAMES, CATEGORIES, VEHICLES, EXPERIENCE } from '@/lib/fixtures';
import { useSession } from '@/lib/supabase';
import { getLiveWorkerProfile, saveLiveWorkerProfile } from '@/lib/repo';

export function WorkerOnboardingPage() {
  const [, navigate] = useLocation();
  const { session, user } = useSession();

  const [step, setStep] = useState(1);
  const [fullName, setFullName] = useState(user?.user_metadata?.full_name || '');
  const [city, setCity] = useState('Bengaluru');
  const [area, setArea] = useState('');
  const [category, setCategory] = useState<string>('Delivery');
  const [vehicle, setVehicle] = useState('Two-wheeler');
  const [ownVehicle, setOwnVehicle] = useState(true);
  const [experience, setExperience] = useState('Fresher');
  const [discoverable, setDiscoverable] = useState(false); // DEFAULT FALSE as per security requirement
  const [available, setAvailable] = useState(true);

  const [busy, setBusy] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Resume partial onboarding if profile already exists in DB
  useEffect(() => {
    if (session) {
      getLiveWorkerProfile().then((p) => {
        if (p) {
          if (p.first_name) setFullName((prev: string) => prev || p.first_name);
          if (p.city) setCity(p.city);
          if (p.area) setArea(p.area);
          if (p.vehicle) setVehicle(p.vehicle);
          if (p.experience) setExperience(p.experience);
          setOwnVehicle(p.own_vehicle);
          setDiscoverable(p.discoverable);
        }
      });
    }
  }, [session]);

  const areas = CITIES[city] ?? [];

  const handleComplete = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);

    if (!fullName.trim() || fullName.trim().length < 2) {
      setErrorMsg('Please enter your full name.');
      return;
    }
    if (!area.trim()) {
      setErrorMsg('Please select your preferred working area.');
      return;
    }

    setBusy(true);

    try {
      const res = await saveLiveWorkerProfile({
        first_name: fullName.trim(),
        city,
        area: area.trim(),
        experience,
        vehicle,
        own_vehicle: ownVehicle,
        available,
        discoverable,
      });

      if (!res.ok) {
        setErrorMsg(res.error || 'Failed to save profile. Please try again.');
        setBusy(false);
        return;
      }

      navigate('/');
    } catch {
      setErrorMsg('Network error while saving profile.');
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
            <span className="text-xs font-mono text-muted-foreground uppercase">Worker Onboarding</span>
            <PilotChip />
          </div>
        </div>
      </header>

      <main className="flex-1 flex items-center justify-center p-4 py-8">
        <div className="w-full max-w-2xl mx-auto">
          {/* Progress Indicator */}
          <div className="mb-6 flex items-center justify-between">
            <div>
              <p className="text-xs font-mono uppercase tracking-wider text-primary font-bold">
                Step {step} of 2
              </p>
              <h1 className="text-2xl font-extrabold text-foreground tracking-tight mt-0.5">
                {step === 1 ? 'Location & Vehicle' : 'Preferences & Privacy'}
              </h1>
            </div>
            <div className="flex gap-1.5">
              <span className={cn('h-2 w-12 rounded-full transition-colors', step >= 1 ? 'bg-primary' : 'bg-muted')} />
              <span className={cn('h-2 w-12 rounded-full transition-colors', step >= 2 ? 'bg-primary' : 'bg-muted')} />
            </div>
          </div>

          <div className="rise rounded-2xl border bg-card p-6 md:p-8 shadow-md">
            {errorMsg && (
              <div className="mb-5 flex items-start gap-2.5 rounded-lg border border-destructive/30 bg-destructive/10 p-3 text-xs text-destructive" role="alert">
                <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
                <span>{errorMsg}</span>
              </div>
            )}

            <form onSubmit={step === 1 ? (e) => { e.preventDefault(); setStep(2); } : handleComplete} className="space-y-5">
              {step === 1 ? (
                <>
                  <div className="space-y-1.5">
                    <Label htmlFor="worker-fullname" className="text-xs font-medium">Your Full Name</Label>
                    <Input
                      id="worker-fullname"
                      type="text"
                      value={fullName}
                      onChange={(e) => setFullName(e.target.value)}
                      placeholder="e.g. Ramesh Kumar"
                      required
                      className="h-10 text-sm"
                      data-testid="input-onboarding-name"
                    />
                    <p className="text-[11px] text-muted-foreground">
                      Only your first name is shown to employers. Your phone and identity stay completely hidden.
                    </p>
                  </div>

                  <div className="grid gap-4 sm:grid-cols-2">
                    <div className="space-y-1.5">
                      <Label htmlFor="worker-city" className="text-xs font-medium">City</Label>
                      <Select value={city} onValueChange={(v) => { setCity(v); setArea(''); }}>
                        <SelectTrigger id="worker-city" className="h-10 text-sm" data-testid="select-onboarding-city">
                          <SelectValue placeholder="Select city" />
                        </SelectTrigger>
                        <SelectContent>
                          {CITY_NAMES.map((c) => (
                            <SelectItem key={c} value={c}>{c}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="space-y-1.5">
                      <Label htmlFor="worker-area" className="text-xs font-medium">Preferred Area in {city}</Label>
                      <Select value={area} onValueChange={setArea}>
                        <SelectTrigger id="worker-area" className="h-10 text-sm" data-testid="select-onboarding-area">
                          <SelectValue placeholder="Select area" />
                        </SelectTrigger>
                        <SelectContent>
                          {areas.map((a) => (
                            <SelectItem key={a} value={a}>{a}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  <div className="grid gap-4 sm:grid-cols-2">
                    <div className="space-y-1.5">
                      <Label htmlFor="worker-vehicle" className="text-xs font-medium">Vehicle Available to Ride</Label>
                      <Select value={vehicle} onValueChange={setVehicle}>
                        <SelectTrigger id="worker-vehicle" className="h-10 text-sm" data-testid="select-onboarding-vehicle">
                          <SelectValue placeholder="Select vehicle" />
                        </SelectTrigger>
                        <SelectContent>
                          {VEHICLES.map((v) => (
                            <SelectItem key={v} value={v}>{v}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="space-y-1.5">
                      <Label htmlFor="worker-experience" className="text-xs font-medium">Experience Level</Label>
                      <Select value={experience} onValueChange={setExperience}>
                        <SelectTrigger id="worker-experience" className="h-10 text-sm" data-testid="select-onboarding-experience">
                          <SelectValue placeholder="Select experience" />
                        </SelectTrigger>
                        <SelectContent>
                          {EXPERIENCE.map((exp) => (
                            <SelectItem key={exp} value={exp}>{exp}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  <div className="flex items-center justify-between rounded-xl border p-3 bg-muted/30">
                    <div>
                      <Label htmlFor="own-vehicle" className="text-xs font-medium cursor-pointer">I own this vehicle</Label>
                      <p className="text-[11px] text-muted-foreground">Allows qualification for fuel allowance listings.</p>
                    </div>
                    <Switch
                      id="own-vehicle"
                      checked={ownVehicle}
                      onCheckedChange={setOwnVehicle}
                      data-testid="switch-onboarding-own-vehicle"
                    />
                  </div>

                  <div className="pt-2 flex justify-end">
                    <Button
                      type="submit"
                      disabled={!fullName.trim() || !area}
                      className="font-semibold text-xs h-10 px-6"
                      data-testid="button-onboarding-next"
                    >
                      Continue
                      <ArrowRight className="ml-1.5 h-4 w-4" />
                    </Button>
                  </div>
                </>
              ) : (
                <>
                  <div className="space-y-2">
                    <Label className="text-xs font-medium">Preferred Work Category</Label>
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                      {CATEGORIES.map((cat) => (
                        <button
                          key={cat}
                          type="button"
                          onClick={() => setCategory(cat)}
                          className={cn(
                            'p-3 rounded-xl border text-center text-xs font-semibold transition-all',
                            category === cat
                              ? 'border-primary bg-primary text-primary-foreground shadow-sm'
                              : 'border-border bg-card hover:bg-muted'
                          )}
                          data-testid={`button-cat-${cat}`}
                        >
                          {cat}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Immediate Availability */}
                  <div className="flex items-center justify-between rounded-xl border p-3 bg-muted/30">
                    <div>
                      <Label htmlFor="available-now" className="text-xs font-medium cursor-pointer">Available to start this week</Label>
                      <p className="text-[11px] text-muted-foreground">Highlight ready status for fast morning hiring.</p>
                    </div>
                    <Switch
                      id="available-now"
                      checked={available}
                      onCheckedChange={setAvailable}
                      data-testid="switch-onboarding-available"
                    />
                  </div>

                  {/* Privacy & Candidate Discovery Opt-In (Default OFF) */}
                  <div className={cn(
                    'rounded-xl border-2 p-4 transition-all',
                    discoverable ? 'border-primary/50 bg-primary/5' : 'border-dashed border-border bg-muted/20'
                  )}>
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <div className="flex items-center gap-1.5 font-bold text-xs text-foreground">
                          {discoverable ? <Eye className="h-4 w-4 text-primary" /> : <EyeOff className="h-4 w-4 text-muted-foreground" />}
                          Let verified logistics employers find me
                        </div>
                        <p className="text-[11px] text-muted-foreground mt-1 leading-relaxed">
                          <strong>Privacy guarantee:</strong> Off by default. When switched on, verified employers can only see your anonymous card (Area, Experience, Vehicle). Your real name, phone number, and documents remain 100% private.
                        </p>
                      </div>
                      <Switch
                        id="discoverable-toggle"
                        checked={discoverable}
                        onCheckedChange={setDiscoverable}
                        data-testid="switch-onboarding-discoverable"
                      />
                    </div>
                  </div>

                  <div className="pt-2 flex items-center justify-between">
                    <Button
                      type="button"
                      variant="ghost"
                      onClick={() => setStep(1)}
                      className="text-xs"
                    >
                      Back
                    </Button>

                    <Button
                      type="submit"
                      disabled={busy}
                      className="font-semibold text-xs h-10 px-6"
                      data-testid="button-onboarding-complete"
                    >
                      {busy ? (
                        <>
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                          Saving profile...
                        </>
                      ) : (
                        <>
                          Complete & Go to Dashboard
                          <ArrowRight className="ml-1.5 h-4 w-4" />
                        </>
                      )}
                    </Button>
                  </div>
                </>
              )}
            </form>
          </div>
        </div>
      </main>

      <footer className="border-t py-4 text-center text-xs text-muted-foreground px-4">
        <span>FleetWala &copy; 2026. Data protection conforms to Digital Personal Data Protection Act 2023.</span>
      </footer>
    </div>
  );
}
