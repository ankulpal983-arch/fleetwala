import { useMemo, useState } from 'react';
import { Link } from 'wouter';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Briefcase, CreditCard, Lock, Pencil, Plus, Send, Trash2, UserPlus, Users, UsersRound, Pause, Play, XCircle, ListChecks } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { useToast } from '@/hooks/use-toast';
import { EmptyState, PageHeader, SampleTag, Stat, StatusPill } from '@/components/common';
import { CATEGORIES, CITIES, CITY_NAMES, EXPERIENCE, PILOT_EMPLOYER_ID, SHIFTS, VEHICLES } from '@/lib/fixtures';
import { usePilot, type JobInput } from '@/lib/store';
import { ago, istDate, salaryRange } from '@/lib/format';
import { cn } from '@/lib/utils';
import type { AppStatus, Job, JobCategory, JobStatus, TeamMember } from '@/lib/types';

const COMPANY = 'Ghar-Tak Parcels';

function useEmployer() {
  const p = usePilot();
  const jobs = p.state.jobs.filter((j) => j.employer_id === PILOT_EMPLOYER_ID);
  const jobIds = new Set(jobs.map((j) => j.id));
  const apps = p.state.applications.filter((a) => jobIds.has(a.job_id));
  const employer = p.state.employers.find((e) => e.id === PILOT_EMPLOYER_ID);
  return { ...p, jobs, apps, employer };
}

export function EmployerOverview() {
  const { jobs, apps, employer } = useEmployer();
  const by = (s: string) => apps.filter((a) => a.status === s).length;
  const funnel: [string, number][] = [['Applied', apps.length], ['Viewed', apps.filter((a) => a.history.some((h) => h.status === 'viewed')).length], ['Shortlisted', apps.filter((a) => a.history.some((h) => h.status === 'shortlisted')).length], ['Hired', by('hired')]];
  const max = Math.max(1, funnel[0][1]);
  return (
    <div>
      <PageHeader eyebrow={`${COMPANY} · sample employer`} title="Hiring overview"
        description={<span className="inline-flex items-center gap-2">Verification: <StatusPill status={employer?.status ?? 'unverified'} /></span>}
        actions={<Link href="/employer/jobs" className="inline-flex h-9 items-center gap-1.5 rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground" data-testid="link-post-job"><Plus className="h-4 w-4" />Post a job</Link>} />
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat label="Live jobs" value={jobs.filter((j) => j.status === 'approved').length} hint={`${jobs.filter((j) => j.status === 'pending').length} awaiting review`} testId="stat-live-jobs" />
        <Stat label="New applicants" value={by('applied')} hint="Not yet viewed" />
        <Stat label="Shortlisted" value={by('shortlisted')} />
        <Stat label="Hired" value={by('hired')} hint="This pilot" />
      </div>
      <div className="mt-6 grid gap-6 lg:grid-cols-[1.3fr_1fr]">
        <section className="rounded-2xl border bg-card p-5">
          <h2 className="font-bold">Applicant funnel</h2>
          <div className="mt-4 space-y-3">
            {funnel.map(([k, v]) => (
              <div key={k} className="grid grid-cols-[90px_1fr_32px] items-center gap-3 text-sm">
                <span className="text-muted-foreground">{k}</span>
                <div className="h-6 overflow-hidden rounded bg-muted"><div className="h-full origin-left bg-primary transition-transform duration-700" style={{ transform: `scaleX(${v / max})` }} /></div>
                <span className="text-right font-mono font-bold">{v}</span>
              </div>
            ))}
          </div>
        </section>
        <section className="rounded-2xl border bg-card p-5">
          <h2 className="font-bold">Latest applicants</h2>
          <ul className="mt-3 divide-y text-sm">
            {[...apps].sort((a, b) => +new Date(b.created_at) - +new Date(a.created_at)).slice(0, 5).map((a) => (
              <li key={a.id} className="flex items-center justify-between py-2.5">
                <span><span className="font-mono font-semibold">{a.candidate_id === 'me' ? 'Pilot worker' : a.candidate_id.toUpperCase()}</span><span className="block text-xs text-muted-foreground">{jobs.find((j) => j.id === a.job_id)?.title}</span></span>
                <StatusPill status={a.status} />
              </li>
            ))}
          </ul>
          <Link href="/employer/applicants" className="mt-3 inline-block text-sm font-medium text-primary underline">Review all</Link>
        </section>
      </div>
    </div>
  );
}

const jobSchema = z.object({
  title: z.string().trim().min(4, 'Title is too short').max(60),
  category: z.enum(['Delivery', 'Pickup-Drop', 'Warehouse', 'Hub']),
  city: z.string().min(1),
  area: z.string().min(1, 'Choose an area'),
  min_salary: z.string().regex(/^\d{4,6}$/, 'Monthly amount in rupees'),
  max_salary: z.string().regex(/^\d{4,6}$/, 'Monthly amount in rupees'),
  shift: z.string().min(1),
  vehicle: z.string().min(1),
  experience: z.string().min(1),
  openings: z.string().regex(/^\d{1,3}$/, 'Number of openings'),
  expires_at: z.string().min(1, 'Pick a closing date'),
  fuel_allowance: z.boolean(),
  licence_required: z.boolean(),
  description: z.string().trim().min(30, 'Describe the work in at least 30 characters').max(1200)
    .refine((v) => !/(deposit|registration fee|pay to join)/i.test(v), 'Listings cannot ask workers for money'),
}).refine((v) => Number(v.max_salary) >= Number(v.min_salary), { path: ['max_salary'], message: 'Must be at least the minimum' });
type JobForm = z.infer<typeof jobSchema>;

const toForm = (j?: Job): JobForm => ({
  title: j?.title ?? '', category: j?.category ?? 'Delivery', city: j?.city ?? 'Bengaluru', area: j?.area ?? '',
  min_salary: j ? String(j.min_salary) : '', max_salary: j ? String(j.max_salary) : '', shift: j?.shift ?? SHIFTS[1],
  vehicle: j?.vehicle ?? VEHICLES[0], experience: j?.experience ?? EXPERIENCE[0], openings: j ? String(j.openings) : '1',
  expires_at: (j?.expires_at ?? new Date(Date.now() + 21 * 86400000).toISOString()).slice(0, 10),
  fuel_allowance: j?.fuel_allowance ?? false, licence_required: j?.licence_required ?? false, description: j?.description ?? '',
});

function JobDialog({ open, onOpenChange, job }: { open: boolean; onOpenChange: (o: boolean) => void; job?: Job }) {
  const { actions } = usePilot();
  const { toast } = useToast();
  const form = useForm<JobForm>({ resolver: zodResolver(jobSchema), values: toForm(job) });
  const city = form.watch('city');

  const save = (v: JobForm, submit: boolean) => {
    const input: JobInput = {
      ...v, category: v.category as JobCategory, min_salary: Number(v.min_salary), max_salary: Number(v.max_salary),
      openings: Number(v.openings), expires_at: new Date(`${v.expires_at}T23:59:00+05:30`).toISOString(),
    };
    const id = actions.saveJob(input, PILOT_EMPLOYER_ID, COMPANY, job?.id);
    if (submit) actions.setJobStatus(id, 'pending', COMPANY);
    toast({ title: submit ? 'Submitted for review' : 'Draft saved', description: submit ? 'A pilot admin can approve it under Admin > Job moderation.' : v.title });
    onOpenChange(false);
  };

  const sel = (name: 'category' | 'city' | 'area' | 'shift' | 'vehicle' | 'experience', label: string, options: readonly string[]) => (
    <FormField control={form.control} name={name} render={({ field }) => (
      <FormItem><FormLabel>{label}</FormLabel>
        <Select value={field.value} onValueChange={(v) => { field.onChange(v); if (name === 'city') form.setValue('area', ''); }}>
          <FormControl><SelectTrigger data-testid={`select-job-${name}`}><SelectValue placeholder="Choose" /></SelectTrigger></FormControl>
          <SelectContent>{options.map((o) => <SelectItem key={o} value={o}>{o}</SelectItem>)}</SelectContent>
        </Select><FormMessage /></FormItem>)} />
  );
  const txt = (name: 'title' | 'min_salary' | 'max_salary' | 'openings' | 'expires_at', label: string, type = 'text') => (
    <FormField control={form.control} name={name} render={({ field }) => (
      <FormItem><FormLabel>{label}</FormLabel><FormControl><Input type={type} inputMode={type === 'text' && name !== 'title' ? 'numeric' : undefined} {...field} data-testid={`input-job-${name}`} /></FormControl><FormMessage /></FormItem>)} />
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90dvh] max-w-2xl overflow-y-auto">
        <DialogHeader><DialogTitle>{job ? 'Edit job' : 'New job'}</DialogTitle><DialogDescription>Saved as pilot sample data. Submitting sends it to the admin moderation queue.</DialogDescription></DialogHeader>
        <Form {...form}>
          <form className="grid gap-4 sm:grid-cols-2" onSubmit={(e) => e.preventDefault()}>
            <div className="sm:col-span-2">{txt('title', 'Job title')}</div>
            {sel('category', 'Category', CATEGORIES)}
            {sel('city', 'City', CITY_NAMES)}
            {sel('area', 'Area', CITIES[city] ?? [])}
            {sel('shift', 'Shift', SHIFTS)}
            {txt('min_salary', 'Min monthly pay (Rs)')}
            {txt('max_salary', 'Max monthly pay (Rs)')}
            {sel('vehicle', 'Vehicle', VEHICLES)}
            {sel('experience', 'Experience', EXPERIENCE)}
            {txt('openings', 'Openings')}
            {txt('expires_at', 'Closes on', 'date')}
            {(['fuel_allowance', 'licence_required'] as const).map((n) => (
              <FormField key={n} control={form.control} name={n} render={({ field }) => (
                <FormItem className="flex items-center justify-between rounded-lg border p-3"><FormLabel>{n === 'fuel_allowance' ? 'Fuel allowance' : 'Driving licence required'}</FormLabel>
                  <FormControl><Switch checked={field.value} onCheckedChange={field.onChange} data-testid={`switch-job-${n}`} /></FormControl></FormItem>)} />
            ))}
            <FormField control={form.control} name="description" render={({ field }) => (
              <FormItem className="sm:col-span-2"><FormLabel>Description</FormLabel><FormControl><Textarea rows={4} {...field} data-testid="input-job-description" /></FormControl><FormMessage /></FormItem>)} />
          </form>
        </Form>
        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={form.handleSubmit((v) => save(v, false))} data-testid="button-save-draft">Save draft</Button>
          <Button onClick={form.handleSubmit((v) => save(v, true))} data-testid="button-submit-job"><Send className="mr-1.5 h-4 w-4" />Submit for review</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

const STATUS_TABS: (JobStatus | 'all')[] = ['all', 'draft', 'pending', 'approved', 'paused', 'closed'];

export function EmployerJobs() {
  const { jobs, apps, actions } = useEmployer();
  const { toast } = useToast();
  const [filter, setFilter] = useState<JobStatus | 'all'>('all');
  const [editing, setEditing] = useState<Job | undefined>();
  const [open, setOpen] = useState(false);
  const list = jobs.filter((j) => filter === 'all' || j.status === filter);
  const act = (j: Job, s: JobStatus, msg: string) => { actions.setJobStatus(j.id, s, COMPANY); toast({ title: msg, description: j.title }); };

  return (
    <div>
      <PageHeader eyebrow={COMPANY} title="Jobs" description="Drafts stay private. Submitted jobs go live only after admin approval."
        actions={<Button onClick={() => { setEditing(undefined); setOpen(true); }} data-testid="button-new-job"><Plus className="mr-1.5 h-4 w-4" />New job</Button>} />
      <div className="scrollbar-none mb-4 flex gap-1 overflow-x-auto">
        {STATUS_TABS.map((s) => (
          <button key={s} onClick={() => setFilter(s)} className={cn('shrink-0 rounded-full border px-3 py-1 text-sm capitalize', filter === s ? 'border-foreground bg-foreground text-background' : 'bg-card hover:bg-muted')} data-testid={`filter-job-${s}`}>
            {s} <span className="font-mono text-xs opacity-60">{s === 'all' ? jobs.length : jobs.filter((j) => j.status === s).length}</span>
          </button>
        ))}
      </div>
      {list.length === 0 ? (
        <EmptyState icon={Briefcase} title="No jobs here" body="Create a draft, then submit it for review when ready." action={<Button onClick={() => { setEditing(undefined); setOpen(true); }}>New job</Button>} />
      ) : (
        <div className="overflow-hidden rounded-xl border bg-card">
          <Table>
            <TableHeader><TableRow><TableHead>Job</TableHead><TableHead className="hidden md:table-cell">Pay</TableHead><TableHead>Status</TableHead><TableHead className="hidden lg:table-cell">Applicants</TableHead><TableHead className="hidden lg:table-cell">Closes</TableHead><TableHead className="text-right">Actions</TableHead></TableRow></TableHeader>
            <TableBody>
              {list.map((j) => (
                <TableRow key={j.id} data-testid={`row-job-${j.id}`}>
                  <TableCell><p className="font-semibold">{j.title}</p><p className="text-xs text-muted-foreground">{j.area}, {j.city} · {j.category}</p>
                    {j.moderation_note && <p className="mt-1 text-xs text-chart-4">{j.moderation_note}</p>}</TableCell>
                  <TableCell className="hidden font-mono text-xs md:table-cell">{salaryRange(j)}</TableCell>
                  <TableCell><StatusPill status={j.status} testId={`status-job-${j.id}`} /></TableCell>
                  <TableCell className="hidden font-mono lg:table-cell">{apps.filter((a) => a.job_id === j.id).length}</TableCell>
                  <TableCell className="hidden text-xs lg:table-cell">{istDate(j.expires_at)}</TableCell>
                  <TableCell>
                    <div className="flex justify-end gap-1">
                      {j.status === 'draft' && <>
                        <Button size="sm" variant="ghost" onClick={() => { setEditing(j); setOpen(true); }} aria-label="Edit" data-testid={`button-edit-${j.id}`}><Pencil className="h-4 w-4" /></Button>
                        <Button size="sm" onClick={() => act(j, 'pending', 'Submitted for review')} data-testid={`button-submit-${j.id}`}>Submit</Button>
                        <AlertDialog>
                          <AlertDialogTrigger asChild><Button size="sm" variant="ghost" aria-label="Delete draft" data-testid={`button-delete-${j.id}`}><Trash2 className="h-4 w-4 text-destructive" /></Button></AlertDialogTrigger>
                          <AlertDialogContent><AlertDialogHeader><AlertDialogTitle>Delete this draft?</AlertDialogTitle><AlertDialogDescription>{j.title} will be removed from pilot data.</AlertDialogDescription></AlertDialogHeader>
                            <AlertDialogFooter><AlertDialogCancel>Cancel</AlertDialogCancel><AlertDialogAction onClick={() => actions.deleteJob(j.id)} data-testid="button-confirm-delete">Delete</AlertDialogAction></AlertDialogFooter></AlertDialogContent>
                        </AlertDialog>
                      </>}
                      {j.status === 'pending' && <Button size="sm" variant="outline" onClick={() => act(j, 'draft', 'Moved back to draft')} data-testid={`button-recall-${j.id}`}>Recall</Button>}
                      {j.status === 'approved' && <Button size="sm" variant="outline" onClick={() => act(j, 'paused', 'Paused')} data-testid={`button-pause-${j.id}`}><Pause className="mr-1 h-3.5 w-3.5" />Pause</Button>}
                      {j.status === 'paused' && <Button size="sm" variant="outline" onClick={() => act(j, 'approved', 'Resumed')} data-testid={`button-resume-${j.id}`}><Play className="mr-1 h-3.5 w-3.5" />Resume</Button>}
                      {(j.status === 'approved' || j.status === 'paused') && <Button size="sm" variant="ghost" onClick={() => act(j, 'closed', 'Closed')} data-testid={`button-close-${j.id}`}><XCircle className="mr-1 h-3.5 w-3.5" />Close</Button>}
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
      <JobDialog open={open} onOpenChange={setOpen} job={editing} />
    </div>
  );
}

const NEXT: Record<AppStatus, AppStatus[]> = {
  applied: ['viewed', 'rejected'], viewed: ['shortlisted', 'rejected'], shortlisted: ['hired', 'rejected'], hired: [], rejected: [], withdrawn: [],
};

export function EmployerApplicants() {
  const { jobs, apps, state, actions } = useEmployer();
  const { toast } = useToast();
  const [jobFilter, setJobFilter] = useState('all');
  const list = apps.filter((a) => jobFilter === 'all' || a.job_id === jobFilter).sort((a, b) => +new Date(b.created_at) - +new Date(a.created_at));
  return (
    <div>
      <PageHeader eyebrow={COMPANY} title="Applicants" description="Anonymous until hire. Contact details are never shown in the pilot."
        actions={<Select value={jobFilter} onValueChange={setJobFilter}><SelectTrigger className="w-60" data-testid="select-applicant-job"><SelectValue /></SelectTrigger>
          <SelectContent><SelectItem value="all">All jobs</SelectItem>{jobs.map((j) => <SelectItem key={j.id} value={j.id}>{j.title}</SelectItem>)}</SelectContent></Select>} />
      {list.length === 0 ? <EmptyState icon={ListChecks} title="No applicants yet" body="Applicants appear once a job is approved and workers apply." /> : (
        <div className="overflow-hidden rounded-xl border bg-card">
          <Table>
            <TableHeader><TableRow><TableHead>Candidate</TableHead><TableHead className="hidden md:table-cell">Job</TableHead><TableHead className="hidden md:table-cell">Applied</TableHead><TableHead>Status</TableHead><TableHead className="text-right">Move to</TableHead></TableRow></TableHeader>
            <TableBody>
              {list.map((a) => {
                const c = state.candidates.find((x) => x.id === a.candidate_id);
                const p = state.profile;
                const label = c ? c.code : 'FW-PILOT';
                const detail = c ? `${c.area} · ${c.experience} · ${c.vehicle}` : `${p.first_name} · ${p.area} · ${p.experience} · ${p.vehicle}`;
                return (
                  <TableRow key={a.id} data-testid={`row-applicant-${a.id}`}>
                    <TableCell><p className="font-mono font-bold">{label} <SampleTag className="ml-1" /></p><p className="text-xs text-muted-foreground">{detail}</p></TableCell>
                    <TableCell className="hidden text-sm md:table-cell">{jobs.find((j) => j.id === a.job_id)?.title}</TableCell>
                    <TableCell className="hidden text-xs md:table-cell">{ago(a.created_at)}</TableCell>
                    <TableCell><StatusPill status={a.status} testId={`status-applicant-${a.id}`} /></TableCell>
                    <TableCell><div className="flex justify-end gap-1">
                      {NEXT[a.status].length === 0 ? <span className="text-xs text-muted-foreground">Final</span> : NEXT[a.status].map((s) => (
                        <Button key={s} size="sm" variant={s === 'rejected' ? 'ghost' : 'outline'} className="capitalize" onClick={() => { actions.setAppStatus(a.id, s); toast({ title: `Marked ${s}`, description: label }); }} data-testid={`button-${s}-${a.id}`}>{s === 'viewed' ? 'Mark viewed' : s === 'rejected' ? 'Reject' : s}</Button>
                      ))}
                    </div></TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}

export function EmployerCandidates() {
  const { state } = usePilot();
  const { toast } = useToast();
  const [area, setArea] = useState('all');
  const list = useMemo(() => state.candidates.filter((c) => area === 'all' || c.area === area), [state.candidates, area]);
  return (
    <div>
      <PageHeader eyebrow={COMPANY} title="Candidate preview" description="Anonymised sample cards of workers who opted in to discovery. Names, phones and photos are never shown."
        actions={<Select value={area} onValueChange={setArea}><SelectTrigger className="w-48" data-testid="select-candidate-area"><SelectValue /></SelectTrigger>
          <SelectContent><SelectItem value="all">All Bengaluru areas</SelectItem>{CITIES.Bengaluru.map((a) => <SelectItem key={a} value={a}>{a}</SelectItem>)}</SelectContent></Select>} />
      {list.length === 0 ? <EmptyState icon={UsersRound} title="No candidates in this area" body="Try another area." /> : (
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {list.map((c, i) => (
            <article key={c.id} className="rise rounded-xl border bg-card p-4" style={{ animationDelay: `${i * 40}ms` }} data-testid={`card-candidate-${c.id}`}>
              <div className="flex items-center justify-between"><span className="rounded bg-tarmac px-2 py-1 font-mono text-sm font-bold text-plate">{c.code}</span><SampleTag /></div>
              <p className="mt-3 text-sm font-semibold">{c.area}</p>
              <p className="text-xs text-muted-foreground">{c.experience} · {c.vehicle}{c.own_vehicle ? ' (own)' : ''}</p>
              <div className="mt-3 flex flex-wrap gap-1">{c.skills.map((s) => <span key={s} className="rounded bg-muted px-1.5 py-0.5 text-[11px]">{s}</span>)}</div>
              <p className="mt-2 text-[11px] text-muted-foreground">{c.languages.join(', ')}</p>
              <div className="mt-3 flex items-center justify-between border-t border-dashed pt-3">
                <span className={cn('text-xs font-medium', c.available ? 'text-signal' : 'text-muted-foreground')}>{c.available ? 'Available now' : 'Not available'}</span>
                <Button size="sm" variant="outline" onClick={() => toast({ title: 'Invites open after live launch', description: 'Inviting candidates needs verified accounts and consent. Disabled in the pilot.' })} data-testid={`button-invite-${c.id}`}>
                  <Lock className="mr-1 h-3.5 w-3.5" />Invite
                </Button>
              </div>
            </article>
          ))}
        </div>
      )}
    </div>
  );
}

export function EmployerBilling() {
  const plans = [
    { name: 'Starter', price: '\u20B90', note: 'Pilot', items: ['2 live jobs', '40 applicant reviews / month'], current: true },
    { name: 'Hub', price: '\u20B93,499', note: 'per month + GST', items: ['10 live jobs', 'Candidate discovery', '3 team seats'] },
    { name: 'Fleet', price: '\u20B911,900', note: 'per month + GST', items: ['Unlimited jobs', 'Multi-city', 'Priority verification'] },
  ];
  return (
    <div>
      <PageHeader eyebrow={COMPANY} title="Billing" description="Payments are disabled in the pilot. Prices shown are indicative only." />
      <div className="mb-6 flex items-center gap-3 rounded-xl border border-dashed border-plate bg-plate/10 p-4 text-sm" role="status">
        <CreditCard className="h-5 w-5" />No payment provider is connected. Nothing can be charged and no payment will ever show as successful here.
      </div>
      <div className="grid gap-4 lg:grid-cols-[1fr_1fr_1fr]">
        {plans.map((p) => (
          <div key={p.name} className={cn('flex flex-col rounded-2xl border bg-card p-5', p.current && 'border-2 border-primary')}>
            <div className="flex items-center justify-between"><h2 className="text-xl font-bold">{p.name}</h2>{p.current && <StatusPill status="active" />}</div>
            <p className="mt-2 font-display text-3xl font-extrabold">{p.price}<span className="ml-1 text-xs font-normal text-muted-foreground">{p.note}</span></p>
            <ul className="mt-4 flex-1 space-y-1.5 text-sm">{p.items.map((i) => <li key={i} className="border-b border-dashed pb-1.5">{i}</li>)}</ul>
            <Button className="mt-5" variant={p.current ? 'outline' : 'default'} disabled data-testid={`button-plan-${p.name.toLowerCase()}`}>{p.current ? 'Current plan' : 'Payments disabled in pilot'}</Button>
          </div>
        ))}
      </div>
      <h2 className="mb-3 mt-8 text-lg font-bold">Invoices</h2>
      <EmptyState icon={CreditCard} title="No invoices" body="GST invoices will appear here once billing is live." />
    </div>
  );
}

const inviteSchema = z.object({ name: z.string().trim().min(2, 'Enter a display name').max(40), role: z.enum(['Recruiter', 'Viewer']) });
type InviteForm = z.infer<typeof inviteSchema>;

export function EmployerTeam() {
  const { state, actions } = usePilot();
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const form = useForm<InviteForm>({ resolver: zodResolver(inviteSchema), defaultValues: { name: '', role: 'Recruiter' } });
  const submit = (v: InviteForm) => {
    actions.inviteMember(v.name, v.role as TeamMember['role']);
    toast({ title: 'Invite recorded', description: 'No email is sent in the pilot.' });
    form.reset(); setOpen(false);
  };
  return (
    <div className="max-w-3xl">
      <PageHeader eyebrow={COMPANY} title="Team" description="Roles here are sample data and grant no real access."
        actions={<Button onClick={() => setOpen(true)} data-testid="button-invite-member"><UserPlus className="mr-1.5 h-4 w-4" />Invite</Button>} />
      {state.team.length === 0 ? <EmptyState icon={Users} title="No teammates" body="Invite a recruiter to help review applicants." /> : (
        <ul className="divide-y rounded-xl border bg-card">
          {state.team.map((m) => (
            <li key={m.id} className="flex items-center gap-3 p-4" data-testid={`row-member-${m.id}`}>
              <span className="flex h-9 w-9 items-center justify-center rounded-full bg-tarmac font-mono text-xs font-bold text-plate">{m.name.slice(0, 2).toUpperCase()}</span>
              <div className="flex-1"><p className="font-medium">{m.name}</p><p className="text-xs text-muted-foreground">{m.role}</p></div>
              <StatusPill status={m.status} />
              {m.role !== 'Owner' && <Button size="sm" variant="ghost" onClick={() => actions.removeMember(m.id)} aria-label={`Remove ${m.name}`} data-testid={`button-remove-${m.id}`}><Trash2 className="h-4 w-4" /></Button>}
            </li>
          ))}
        </ul>
      )}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Invite teammate</DialogTitle><DialogDescription>Pilot only. Use a display name, not a real email or phone.</DialogDescription></DialogHeader>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(submit)} className="space-y-4">
              <FormField control={form.control} name="name" render={({ field }) => (<FormItem><FormLabel>Display name</FormLabel><FormControl><Input {...field} data-testid="input-member-name" /></FormControl><FormMessage /></FormItem>)} />
              <FormField control={form.control} name="role" render={({ field }) => (
                <FormItem><FormLabel>Role</FormLabel><Select value={field.value} onValueChange={field.onChange}><FormControl><SelectTrigger data-testid="select-member-role"><SelectValue /></SelectTrigger></FormControl>
                  <SelectContent><SelectItem value="Recruiter">Recruiter</SelectItem><SelectItem value="Viewer">Viewer</SelectItem></SelectContent></Select></FormItem>)} />
              <DialogFooter><Button type="submit" data-testid="button-send-invite">Record invite</Button></DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
