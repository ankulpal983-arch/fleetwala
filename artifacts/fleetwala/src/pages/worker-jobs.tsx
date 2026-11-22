import { useEffect, useMemo, useState } from 'react';
import { Link, useParams } from 'wouter';
import {
  ArrowLeft, Bookmark, BookmarkCheck, Crosshair, EyeOff, Fuel, IdCard, LocateFixed, MapPin, Search, SearchX, ShieldCheck, SlidersHorizontal, WifiOff, X,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { useToast } from '@/hooks/use-toast';
import { JobCard } from '@/components/job-card';
import { CardSkeleton, EmptyState, Meter, Monogram, SampleTag, StatusPill } from '@/components/common';
import { CATEGORIES, CITIES, CITY_NAMES } from '@/lib/fixtures';
import { DAILY_LIMIT, profileProgress, usePilot } from '@/lib/store';
import { DEFAULT_RADIUS_KM, isLiveJob, liveJobs } from '@/lib/rules';
import { ago, daysLeft, istDate, salaryRange } from '@/lib/format';
import { cn } from '@/lib/utils';
import type { Application, Job, JobStatus } from '@/lib/types';
import { liveMode, useSession, getSupabase } from '@/lib/supabase';
import { getLiveJobs, applyToLiveJob, getLiveSavedJobs, toggleLiveSavedJob } from '@/lib/repo';

type Sort = 'newest' | 'salary' | 'expiring';

function useMyApps() {
  const { state } = usePilot();
  return useMemo(() => {
    const m = new Map<string, Application>();
    state.applications.filter((a) => a.candidate_id === 'me' && a.status !== 'withdrawn').forEach((a) => m.set(a.job_id, a));
    return m;
  }, [state.applications]);
}

export function FindJobs() {
  const { state, actions, usageToday, online } = usePilot();
  const { session } = useSession();
  const [liveDbJobs, setLiveDbJobs] = useState<Job[] | null>(null);
  const { toast } = useToast();
  const p = state.profile;
  const myApps = useMyApps();
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState('');
  const [city, setCity] = useState(p.city || 'Bengaluru');
  const [area, setArea] = useState('any');
  const [radius, setRadius] = useState(String(DEFAULT_RADIUS_KM));
  const [cats, setCats] = useState<string[]>([]);
  const [fuelOnly, setFuelOnly] = useState(false);
  const [noLicence, setNoLicence] = useState(false);
  const [sort, setSort] = useState<Sort>('newest');
  const [gpsOpen, setGpsOpen] = useState(false);
  const [gpsNote, setGpsNote] = useState<string | null>(null);
  const [filtersOpen, setFiltersOpen] = useState(false);

  useEffect(() => {
    let active = true;
    if (liveMode) {
      setLoading(true);
      getLiveJobs()
        .then((data) => {
          if (!active) return;
          setLiveDbJobs(data ?? []);
          setLoading(false);
        })
        .catch(() => {
          if (!active) return;
          setLoading(false);
        });
      return () => { active = false; };
    }
    const t = setTimeout(() => {
      if (active) setLoading(false);
    }, 250);
    return () => {
      active = false;
      clearTimeout(t);
    };
  }, [session]);

  const baseJobs = liveMode ? (liveDbJobs ?? []) : state.jobs;

  const jobs = useMemo(() => {
    const term = q.trim().toLowerCase();
    const list = liveJobs(baseJobs).filter((j) =>
      j.city === city &&
      (area === 'any' || j.area === area) &&
      (cats.length === 0 || cats.includes(j.category)) &&
      (!fuelOnly || j.fuel_allowance) &&
      (!noLicence || !j.licence_required) &&
      (!term || `${j.title} ${j.company} ${j.area} ${j.category}`.toLowerCase().includes(term)));
    return list.sort((a, b) =>
      sort === 'salary' ? b.max_salary - a.max_salary
        : sort === 'expiring' ? +new Date(a.expires_at) - +new Date(b.expires_at)
          : +new Date(b.created_at) - +new Date(a.created_at));
  }, [baseJobs, q, city, area, cats, fuelOnly, noLicence, sort]);

  const prog = profileProgress(p);
  const activeFilters = cats.length + (fuelOnly ? 1 : 0) + (noLicence ? 1 : 0) + (area !== 'any' ? 1 : 0);
  const clear = () => { setCats([]); setFuelOnly(false); setNoLicence(false); setArea('any'); setQ(''); };

  const requestGps = () => {
    setGpsOpen(false);
    if (!('geolocation' in navigator)) {
      setGpsNote('This device does not share location. Pick your city and area below.');
      return;
    }
    navigator.geolocation.getCurrentPosition(
      () => setGpsNote('Location read on this device only and not stored. The pilot matches by city and area, so choose them below.'),
      () => setGpsNote('Location permission was not given. That is fine: choose your city and area below.'),
      { timeout: 8000, maximumAge: 600000 },
    );
  };

  const filters = (
    <div className="space-y-5">
      <div>
        <Label className="mb-2 block font-mono text-[10px] uppercase tracking-[0.16em] text-muted-foreground">Work type</Label>
        <div className="flex flex-wrap gap-1.5">
          {CATEGORIES.map((c) => {
            const on = cats.includes(c);
            return (
              <button key={c} type="button" aria-pressed={on} onClick={() => setCats(on ? cats.filter((x) => x !== c) : [...cats, c])}
                className={cn('rounded-full border px-3 py-1.5 text-sm font-medium transition-colors', on ? 'border-foreground bg-foreground text-background' : 'bg-card hover:bg-muted')}
                data-testid={`filter-category-${c}`}>{c}</button>
            );
          })}
        </div>
      </div>
      <div>
        <Label className="mb-2 block font-mono text-[10px] uppercase tracking-[0.16em] text-muted-foreground">Area in {city}</Label>
        <Select value={area} onValueChange={setArea}>
          <SelectTrigger data-testid="select-area"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="any">Any area</SelectItem>
            {CITIES[city].map((a) => <SelectItem key={a} value={a}>{a}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>
      <div className="space-y-3">
        <label className="flex items-center justify-between gap-3 text-sm"><span className="flex items-center gap-2"><Fuel className="h-4 w-4" />Fuel allowance</span>
          <Switch checked={fuelOnly} onCheckedChange={setFuelOnly} data-testid="switch-fuel" /></label>
        <label className="flex items-center justify-between gap-3 text-sm"><span className="flex items-center gap-2"><IdCard className="h-4 w-4" />No licence needed</span>
          <Switch checked={noLicence} onCheckedChange={setNoLicence} data-testid="switch-no-licence" /></label>
      </div>
      {activeFilters > 0 && <Button variant="ghost" size="sm" onClick={clear} data-testid="button-clear-filters"><X className="mr-1 h-4 w-4" />Clear filters</Button>}
    </div>
  );

  return (
    <div className="space-y-6">
      <section className="rise relative overflow-hidden rounded-2xl bg-tarmac p-5 text-sidebar-foreground md:p-7">
        <div className="tarmac-grid absolute inset-0 opacity-70" />
        <div className="relative grid gap-6 lg:grid-cols-[1.4fr_1fr]">
          <div>
            <p className="font-mono text-[11px] uppercase tracking-[0.2em] text-sidebar-foreground/60">Namaste{p.first_name ? `, ${p.first_name}` : ''}</p>
            <h1 className="mt-1 font-display text-3xl font-extrabold leading-[1.05] md:text-5xl">
              {jobs.length} jobs open<br /><span className="text-plate">around {area === 'any' ? city : area}</span>
            </h1>
            <div className="mt-4 flex flex-wrap items-center gap-2">
              <Select value={city} onValueChange={(v) => { setCity(v); setArea('any'); }}>
                <SelectTrigger className="h-9 w-auto gap-2 border-sidebar-border bg-sidebar-accent text-sidebar-foreground" data-testid="select-city">
                  <MapPin className="h-4 w-4 text-plate" /><SelectValue />
                </SelectTrigger>
                <SelectContent>{CITY_NAMES.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent>
              </Select>
              <Select value={radius} onValueChange={setRadius}>
                <SelectTrigger className="h-9 w-auto gap-2 border-sidebar-border bg-sidebar-accent text-sidebar-foreground" data-testid="select-radius">
                  <Crosshair className="h-4 w-4 text-plate" /><SelectValue />
                </SelectTrigger>
                <SelectContent>{['5', '10', '15', '25'].map((r) => <SelectItem key={r} value={r}>{r} km radius</SelectItem>)}</SelectContent>
              </Select>
              <Button size="sm" variant="secondary" onClick={() => setGpsOpen(true)} data-testid="button-use-location"><LocateFixed className="mr-1.5 h-4 w-4" />Use my location</Button>
            </div>
            <p className="mt-2 text-xs text-sidebar-foreground/60">
              Radius is approximate and city based. The pilot does not calculate exact distances.
            </p>
            {gpsNote && <p className="mt-2 rounded-md bg-sidebar-accent px-3 py-2 text-xs" role="status" data-testid="text-gps-note">{gpsNote}</p>}
          </div>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-1">
            <Link href="/profile" className="rounded-xl bg-sidebar-accent/80 p-4 transition-colors hover:bg-sidebar-accent" data-testid="card-profile-progress">
              <div className="flex items-center justify-between text-sm"><span>Profile strength</span><span className="font-mono font-bold text-plate">{prog.pct}%</span></div>
              <div className="mt-2"><Meter value={prog.pct} max={100} tone="plate" /></div>
              <p className="mt-2 flex items-center gap-1.5 text-xs text-sidebar-foreground/65">
                <EyeOff className="h-3.5 w-3.5" />{p.discoverable ? 'Visible to verified employers' : 'Hidden from employer search'}
              </p>
            </Link>
            <div className="rounded-xl bg-sidebar-accent/80 p-4" data-testid="card-daily-usage">
              <div className="flex items-center justify-between text-sm"><span>Applications today</span><span className="font-mono font-bold">{usageToday}/{DAILY_LIMIT}</span></div>
              <div className="mt-2"><Meter value={usageToday} max={DAILY_LIMIT} tone="signal" /></div>
              <p className="mt-2 text-xs text-sidebar-foreground/65">Counted by IST date. Demo-only limit.</p>
            </div>
          </div>
        </div>
      </section>

      {!online && (
        <div className="flex items-center gap-3 rounded-xl border border-chart-4/40 bg-chart-4/10 p-3 text-sm" role="status" data-testid="banner-offline">
          <WifiOff className="h-4 w-4 text-chart-4" />You are offline. Showing jobs saved on this device; applying still works in the pilot.
        </div>
      )}

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input type="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search rider, packer, company, area" className="h-11 bg-card pl-9" aria-label="Search jobs" data-testid="input-search" />
        </div>
        <div className="flex gap-2">
          <Select value={sort} onValueChange={(v) => setSort(v as Sort)}>
            <SelectTrigger className="h-11 w-[170px] bg-card" data-testid="select-sort"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="newest">Newest first</SelectItem>
              <SelectItem value="salary">Highest pay</SelectItem>
              <SelectItem value="expiring">Closing soon</SelectItem>
            </SelectContent>
          </Select>
          <Button variant="outline" className="h-11 lg:hidden" onClick={() => setFiltersOpen(true)} data-testid="button-open-filters">
            <SlidersHorizontal className="mr-1.5 h-4 w-4" />Filters{activeFilters > 0 && ` (${activeFilters})`}
          </Button>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-[240px_1fr]">
        <aside className="hidden lg:block"><div className="sticky top-20 rounded-xl border bg-card p-4">{filters}</div></aside>
        <div>
          {loading ? (
            <div className="grid gap-4 xl:grid-cols-2">{[0, 1, 2, 3].map((i) => <CardSkeleton key={i} />)}</div>
          ) : jobs.length === 0 ? (
            <EmptyState icon={SearchX} title={liveMode && baseJobs.length === 0 ? "No jobs available yet" : "No jobs match yet"} body={liveMode && baseJobs.length === 0 ? "No published jobs have been approved in the live network yet. Please check back soon." : `Nothing in ${area === 'any' ? city : area} with these filters. Try another area or remove a filter.`}
              action={<Button onClick={clear} data-testid="button-empty-clear">Clear filters</Button>} />
          ) : (
            <div className="grid gap-4 xl:grid-cols-2">
              {jobs.map((j, i) => (
                <JobCard key={j.id} job={j} index={i} saved={state.saved.includes(j.id)} appStatus={myApps.get(j.id)?.status}
                  onToggleSave={() => { const s = actions.toggleSave(j.id); toast({ title: s ? 'Saved' : 'Removed from saved', description: j.title }); }} />
              ))}
            </div>
          )}
        </div>
      </div>

      <Dialog open={filtersOpen} onOpenChange={setFiltersOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Filters</DialogTitle><DialogDescription>Narrow jobs in {city}.</DialogDescription></DialogHeader>
          {filters}
          <DialogFooter><Button onClick={() => setFiltersOpen(false)} data-testid="button-apply-filters">Show {jobs.length} jobs</Button></DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={gpsOpen} onOpenChange={setGpsOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Share your location once?</AlertDialogTitle>
            <AlertDialogDescription>
              Your phone will ask for permission. FleetWala reads it on this device only, never shows it to employers, and does not store it. If you say no, just choose your city and area.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel data-testid="button-gps-decline">Choose manually</AlertDialogCancel>
            <AlertDialogAction onClick={requestGps} data-testid="button-gps-allow">Allow once</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

export function JobDetail() {
  const { id } = useParams<{ id: string }>();
  const { state, actions, usageToday } = usePilot();
  const { session } = useSession();
  const [liveJob, setLiveJob] = useState<Job | null>(null);
  const { toast } = useToast();
  const myApps = useMyApps();
  const [confirm, setConfirm] = useState(false);

  useEffect(() => {
    let active = true;
    if (liveMode && id) {
      getLiveJobs().then((jobs) => {
        if (!active) return;
        const match = jobs.find((j) => j.id === id);
        if (match) setLiveJob(match);
      });
    }
    return () => { active = false; };
  }, [id]);

  const job = liveMode ? liveJob : state.jobs.find((j) => j.id === id);

  if (!job || (!isLiveJob(job) && !myApps.has(job.id))) {
    return <EmptyState icon={SearchX} title="Job not available" body="This job may have closed, expired or is not yet approved." action={<Link href="/" className="font-semibold text-primary underline">Back to jobs</Link>} />;
  }
  const app = myApps.get(job.id);
  const saved = state.saved.includes(job.id);
  const p = state.profile;

  const doApply = async () => {
    if (!session) {
      toast({
        title: 'Sign in required',
        description: 'Please sign in or create a free worker account to apply.',
      });
      return;
    }
    if (liveMode) {
      const res = await applyToLiveJob(job.id);
      if (res.ok) {
        actions.apply(job.id);
        toast({
          title: 'Application sent',
          description: res.data?.wasExisting ? 'Already applied previously.' : 'Recorded in database via apply_to_job RPC.',
        });
      } else {
        toast({
          title: 'Could not apply',
          description: res.error,
          variant: 'destructive',
        });
      }
      return;
    }
    const r = actions.apply(job.id);
    toast({ title: r.ok ? 'Application sent' : 'Could not apply', description: r.message, variant: r.ok ? 'default' : 'destructive' });
  };

  return (
    <div className="mx-auto max-w-4xl">
      <Link href="/" className="mb-4 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground" data-testid="link-back"><ArrowLeft className="h-4 w-4" />All jobs</Link>
      <div className="rise overflow-hidden rounded-2xl border bg-card">
        <div className="flex flex-col gap-4 p-5 md:flex-row md:items-start md:p-7">
          <Monogram name={job.company} size="lg" />
          <div className="flex-1">
            <div className="flex flex-wrap items-center gap-2"><SampleTag /><span className="font-mono text-xs text-muted-foreground">{job.category}</span>{app && <StatusPill status={app.status} />}</div>
            <h1 className="mt-1 text-3xl font-extrabold md:text-4xl" data-testid="text-job-title">{job.title}</h1>
            <p className="text-muted-foreground">{job.company} · {job.area}, {job.city}</p>
          </div>
        </div>
        <div className="road-dash" />
        <dl className="grid grid-cols-2 gap-px bg-border md:grid-cols-4">
          {[
            ['Monthly pay', salaryRange(job)], ['Shift', job.shift], ['Vehicle', job.vehicle], ['Experience', job.experience],
            ['Fuel allowance', job.fuel_allowance ? 'Yes' : 'No'], ['Licence', job.licence_required ? 'Required' : 'Not needed'],
            ['Openings', String(job.openings)], ['Closes', `${istDate(job.expires_at)} (${Math.max(0, daysLeft(job.expires_at))}d)`],
          ].map(([k, v]) => (
            <div key={k} className="bg-card p-4"><dt className="font-mono text-[10px] uppercase tracking-[0.16em] text-muted-foreground">{k}</dt><dd className="mt-1 font-semibold">{v}</dd></div>
          ))}
        </dl>
        <div className="grid gap-6 p-5 md:grid-cols-[1fr_280px] md:p-7">
          <div>
            <h2 className="text-lg font-bold">About the work</h2>
            <p className="mt-2 leading-relaxed text-foreground/85">{job.description}</p>
            <p className="mt-4 text-xs text-muted-foreground">Posted {ago(job.created_at)}.</p>
            <div className="mt-5 rounded-xl border border-chart-4/30 bg-chart-4/5 p-4 text-sm">
              <p className="font-semibold">Never pay to get a job</p>
              <p className="mt-1 text-muted-foreground">Genuine employers on FleetWala do not ask for deposits, fees or ID photos in chat. <Link href="/support" className="underline">Report a concern</Link>.</p>
            </div>
          </div>
          <div className="space-y-3">
            {app ? (
              <div className="rounded-xl bg-muted p-4 text-sm">
                <p className="font-semibold">You applied {ago(app.created_at)}</p>
                <Link href="/applications" className="mt-1 inline-block text-primary underline" data-testid="link-track-application">Track application</Link>
              </div>
            ) : (
              <Button size="lg" className="w-full" onClick={() => setConfirm(true)} data-testid="button-apply">Apply now</Button>
            )}
            <Button variant="outline" className="w-full" onClick={() => actions.toggleSave(job.id)} data-testid="button-save-detail">
              {saved ? <><BookmarkCheck className="mr-1.5 h-4 w-4" />Saved</> : <><Bookmark className="mr-1.5 h-4 w-4" />Save for later</>}
            </Button>
            <p className="text-center font-mono text-[11px] text-muted-foreground">{usageToday}/{DAILY_LIMIT} applications today (IST)</p>
          </div>
        </div>
      </div>

      <AlertDialog open={confirm} onOpenChange={setConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Apply to {job.company}?</AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="space-y-3 text-sm">
                <p>They will see only:</p>
                <ul className="grid grid-cols-2 gap-2 rounded-lg bg-muted p-3 text-foreground">
                  <li><span className="text-muted-foreground">Name</span><br />{p.first_name || 'Not set'}</li>
                  <li><span className="text-muted-foreground">Area</span><br />{p.area || p.city || 'Not set'}</li>
                  <li><span className="text-muted-foreground">Experience</span><br />{p.experience || 'Not set'}</li>
                  <li><span className="text-muted-foreground">Vehicle</span><br />{p.vehicle || 'Not set'}</li>
                </ul>
                <p className="flex items-center gap-1.5"><ShieldCheck className="h-4 w-4 text-signal" />Your phone number stays hidden.</p>
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Not now</AlertDialogCancel>
            <AlertDialogAction onClick={doApply} data-testid="button-confirm-apply">Send application</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

export function SavedJobs() {
  const { state, actions } = usePilot();
  const { session } = useSession();
  const myApps = useMyApps();
  const [liveSavedIds, setLiveSavedIds] = useState<string[] | null>(null);
  const [liveJobsList, setLiveJobsList] = useState<Job[] | null>(null);

  useEffect(() => {
    if (liveMode && session) {
      getLiveSavedJobs().then(setLiveSavedIds);
      getLiveJobs().then(setLiveJobsList);
    }
  }, [session]);

  const savedIds = liveMode && session ? (liveSavedIds ?? []) : state.saved;
  const poolJobs = liveMode && session ? (liveJobsList ?? []) : state.jobs;
  const jobs = savedIds.map((id) => poolJobs.find((j) => j.id === id)).filter((j): j is NonNullable<typeof j> => !!j);
  return (
    <div>
      <PageHeaderLite title="Saved jobs" sub={`${jobs.length} saved on this device`} />
      {jobs.length === 0 ? (
        <EmptyState icon={Bookmark} title="Nothing saved yet" body="Tap the bookmark on any job to keep it here for later." action={<Link href="/" className="font-semibold text-primary underline">Browse jobs</Link>} />
      ) : (
        <div className="grid gap-4 lg:grid-cols-2 xl:grid-cols-3">
          {jobs.map((j, i) => (
            <div key={j.id} className={cn(!isLiveJob(j) && 'opacity-60')}>
              <JobCard
                job={j}
                index={i}
                saved
                onToggleSave={async () => {
                  if (liveMode && session) {
                    await toggleLiveSavedJob(j.id, true);
                    setLiveSavedIds((prev) => (prev ? prev.filter((x) => x !== j.id) : []));
                  } else {
                    actions.toggleSave(j.id);
                  }
                }}
                appStatus={myApps.get(j.id)?.status}
              />
              {!isLiveJob(j) && <p className="mt-1 text-xs text-muted-foreground">No longer accepting applications.</p>}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function PageHeaderLite({ title, sub }: { title: string; sub: string }) {
  return (
    <div className="rise mb-6">
      <h1 className="text-3xl font-extrabold md:text-4xl" data-testid="text-page-title">{title}</h1>
      <p className="mt-1 text-sm text-muted-foreground">{sub}</p>
    </div>
  );
}
