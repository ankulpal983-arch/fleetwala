import { useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'wouter';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Bell, CheckCheck, ClipboardList, EyeOff, Eye, Lock, MessageSquare, RotateCcw, Send, ShieldAlert, Check } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { useToast } from '@/hooks/use-toast';
import { EmptyState, Meter, Monogram, PageHeader, SampleTag, StatusPill } from '@/components/common';
import { CITIES, CITY_NAMES, EXPERIENCE, VEHICLES } from '@/lib/fixtures';
import { profileProgress, STORAGE_KEY, usePilot } from '@/lib/store';
import { ago, istStamp } from '@/lib/format';
import { cn } from '@/lib/utils';
import type { AppStatus, Application, Notice, Thread } from '@/lib/types';
import { liveMode, useSession } from '@/lib/supabase';
import {
  getLiveWorkerProfile, saveLiveWorkerProfile, getLiveApplications,
  getLiveNotifications, markLiveNotificationRead, getLiveConversations,
  sendLiveMessage
} from '@/lib/repo';

const FLOW: AppStatus[] = ['applied', 'viewed', 'shortlisted', 'hired'];

export function Applications() {
  const { state, actions } = usePilot();
  const { session } = useSession();
  const { toast } = useToast();
  const [tab, setTab] = useState<'active' | 'closed'>('active');
  const [liveApps, setLiveApps] = useState<Application[] | null>(null);

  useEffect(() => {
    if (liveMode && session) {
      getLiveApplications().then(setLiveApps);
    }
  }, [session]);

  const appsSource: Application[] = liveMode && session ? (liveApps ?? []) : state.applications.filter((a) => a.candidate_id === 'me');
  const list = appsSource
    .filter((a) => (tab === 'active' ? ['applied', 'viewed', 'shortlisted'].includes(a.status) : ['hired', 'rejected', 'withdrawn'].includes(a.status)))
    .sort((a, b) => +new Date(b.created_at) - +new Date(a.created_at));

  return (
    <div className="mx-auto max-w-4xl">
      <PageHeader eyebrow="Worker" title="Applications" description="Every step, timestamped in IST. Employers only see what you chose to share." />
      <Tabs value={tab} onValueChange={(v) => setTab(v as 'active' | 'closed')} className="mb-5">
        <TabsList><TabsTrigger value="active" data-testid="tab-active">In progress</TabsTrigger><TabsTrigger value="closed" data-testid="tab-closed">Closed</TabsTrigger></TabsList>
      </Tabs>
      {list.length === 0 ? (
        <EmptyState icon={ClipboardList} title={tab === 'active' ? 'No active applications' : 'Nothing closed yet'} body="Apply to a job and its progress shows up here." action={<Link href="/" className="font-semibold text-primary underline">Find jobs</Link>} />
      ) : (
        <div className="space-y-4">
          {list.map((a, i) => {
            const job = state.jobs.find((j) => j.id === a.job_id);
            if (!job) return null;
            const reached = (a.history || []).map((h: { status: AppStatus; at: string }) => h.status);
            const ended = ['rejected', 'withdrawn'].includes(a.status);
            return (
              <article key={a.id} className="rise rounded-xl border bg-card p-4 md:p-5" style={{ animationDelay: `${i * 50}ms` }} data-testid={`card-application-${a.id}`}>
                <div className="flex items-start gap-3">
                  <Monogram name={job.company} size="sm" />
                  <div className="min-w-0 flex-1">
                    <Link href={`/jobs/${job.id}`} className="font-display text-lg font-bold hover:underline">{job.title}</Link>
                    <p className="text-sm text-muted-foreground">{job.company} · {job.area} <SampleTag className="ml-1" /></p>
                  </div>
                  <StatusPill status={a.status} testId={`status-application-${a.id}`} />
                </div>
                <ol className="mt-5 grid grid-cols-4 gap-1" aria-label="Application timeline">
                  {FLOW.map((s) => {
                    const h = (a.history || []).find((x: { status: AppStatus; at: string }) => x.status === s);
                    const done = reached.includes(s);
                    return (
                      <li key={s} className="relative">
                        <div className={cn('h-1.5 rounded-full', done ? 'bg-primary' : 'bg-muted')} />
                        <p className={cn('mt-2 text-xs font-semibold capitalize', !done && 'text-muted-foreground')}>{s}</p>
                        <p className="font-mono text-[10px] text-muted-foreground">{h ? istStamp(h.at) : '—'}</p>
                      </li>
                    );
                  })}
                </ol>
                {ended && (
                  <p className="mt-3 rounded-md bg-muted px-3 py-2 text-xs">
                    {a.status === 'withdrawn' ? 'You withdrew' : 'Not selected this time'} · {istStamp(a.history[a.history.length - 1].at)} IST
                  </p>
                )}
                {!ended && a.status !== 'hired' && (
                  <div className="mt-4 flex justify-end">
                    <AlertDialog>
                      <AlertDialogTrigger asChild><Button variant="ghost" size="sm" data-testid={`button-withdraw-${a.id}`}>Withdraw</Button></AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader><AlertDialogTitle>Withdraw this application?</AlertDialogTitle>
                          <AlertDialogDescription>{job.company} will see it as withdrawn. You can apply again later while the job is open.</AlertDialogDescription></AlertDialogHeader>
                        <AlertDialogFooter><AlertDialogCancel>Keep it</AlertDialogCancel>
                          <AlertDialogAction onClick={() => { actions.withdraw(a.id); toast({ title: 'Application withdrawn' }); }} data-testid="button-confirm-withdraw">Withdraw</AlertDialogAction></AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  </div>
                )}
              </article>
            );
          })}
        </div>
      )}
    </div>
  );
}

export function Messages() {
  const { state, actions } = usePilot();
  const { session } = useSession();
  const [liveThreads, setLiveThreads] = useState<Thread[] | null>(null);
  const [activeId, setActiveId] = useState('');
  const [text, setText] = useState('');
  const endRef = useRef<HTMLDivElement>(null);

  const refreshThreads = () => {
    if (liveMode && session) {
      getLiveConversations().then((threads) => {
        setLiveThreads(threads);
        if (threads && threads.length > 0 && !activeId) {
          setActiveId(threads[0].id);
        }
      });
    }
  };

  useEffect(() => {
    refreshThreads();
  }, [session]);

  const threadsSource = (liveMode && session) ? (liveThreads ?? []) : state.threads;
  const currentActiveId = activeId || (threadsSource[0]?.id ?? '');
  const thread = threadsSource.find((t) => t.id === currentActiveId);
  const count = thread?.messages.length ?? 0;
  useEffect(() => { endRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' }); }, [count]);

  const send = async (e: React.FormEvent) => {
    e.preventDefault();
    const t = text.trim();
    if (!t || !thread) return;

    if (liveMode && session) {
      const res = await sendLiveMessage(thread.id, t.slice(0, 600));
      if (res.ok) {
        setText('');
        refreshThreads();
      }
      return;
    }

    actions.sendMessage(thread.id, t.slice(0, 600));
    setText('');
  };

  return (
    <div>
      <PageHeader eyebrow="Worker" title="Messages" description="Text-only chat opens after an employer shortlists you. Phone numbers stay hidden." />
      {threadsSource.length === 0 ? (
        <EmptyState icon={MessageSquare} title="No conversations" body="When an employer shortlists you, a chat appears here." />
      ) : (
        <div className="grid overflow-hidden rounded-2xl border bg-card md:h-[560px] md:grid-cols-[280px_1fr]">
          <ul className="border-b md:border-b-0 md:border-r">
            {threadsSource.map((t) => {
              const last = t.messages[t.messages.length - 1];
              return (
                <li key={t.id}>
                  <button onClick={() => setActiveId(t.id)} className={cn('flex w-full gap-3 p-4 text-left transition-colors', t.id === currentActiveId ? 'bg-plate/20' : 'hover:bg-muted')} data-testid={`button-thread-${t.id}`}>
                    <Monogram name={t.participant} size="sm" />
                    <span className="min-w-0"><span className="block truncate text-sm font-semibold">{t.participant}</span>
                      <span className="block truncate text-xs text-muted-foreground">{last?.text || 'Conversation opened'}</span></span>
                  </button>
                </li>
              );
            })}
          </ul>
          {thread && (
            <div className="flex min-h-[420px] flex-col">
              <div className="border-b px-4 py-3">
                <p className="font-semibold">{thread.participant}</p>
                <p className="flex items-center gap-1.5 text-xs text-muted-foreground">{!(liveMode && session) && <SampleTag />}{thread.role} · phone numbers stay hidden</p>
              </div>
              <div className="flex-1 space-y-3 overflow-y-auto p-4" aria-live="polite">
                {thread.messages.map((m) => (
                  <div key={m.id} className={cn('flex', m.from === 'me' && 'justify-end')}>
                    <div className={cn('max-w-[78%] rounded-2xl px-3.5 py-2 text-sm', m.from === 'me' ? 'rounded-br-sm bg-primary text-primary-foreground' : 'rounded-bl-sm bg-muted')}>
                      {m.text}<span className={cn('mt-1 block font-mono text-[10px]', m.from === 'me' ? 'text-primary-foreground/60' : 'text-muted-foreground')}>{istStamp(m.at)}</span>
                    </div>
                  </div>
                ))}
                <div ref={endRef} />
              </div>
              <form onSubmit={send} className="flex gap-2 border-t p-3">
                <Input value={text} onChange={(e) => setText(e.target.value)} placeholder="Type a message (text only)" aria-label="Message" maxLength={600} data-testid="input-message" />
                <Button type="submit" disabled={!text.trim()} aria-label="Send" data-testid="button-send"><Send className="h-4 w-4" /></Button>
              </form>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export function Notifications() {
  const { state, actions } = usePilot();
  const { session } = useSession();
  const [liveNotices, setLiveNotices] = useState<Notice[] | null>(null);

  const refreshNotices = () => {
    if (liveMode && session) {
      getLiveNotifications().then(setLiveNotices);
    }
  };

  useEffect(() => {
    refreshNotices();
  }, [session]);

  const noticesSource = (liveMode && session) ? (liveNotices ?? []) : state.notifications;
  const unread = noticesSource.filter((n) => !n.read).length;

  const handleMarkRead = async (id: string) => {
    if (liveMode && session) {
      await markLiveNotificationRead(id);
      refreshNotices();
      return;
    }
    actions.markNotice(id);
  };

  const handleMarkAll = async () => {
    if (liveMode && session) {
      const unreadList = noticesSource.filter((n) => !n.read);
      await Promise.all(unreadList.map((n) => markLiveNotificationRead(n.id)));
      refreshNotices();
      return;
    }
    actions.markAllNotices();
  };

  return (
    <div className="mx-auto max-w-3xl">
      <PageHeader eyebrow="Worker" title="Notifications" description={`${unread} unread`}
        actions={<Button variant="outline" size="sm" onClick={handleMarkAll} disabled={unread === 0} data-testid="button-mark-all"><CheckCheck className="mr-1.5 h-4 w-4" />Mark all read</Button>} />
      {noticesSource.length === 0 ? (
        <EmptyState icon={Bell} title="All quiet" body="Updates on your applications, reviews, and new messages will land here." />
      ) : (
        <ul className="divide-y overflow-hidden rounded-xl border bg-card">
          {noticesSource.map((n) => (
            <li key={n.id} className={cn('flex items-start gap-3 p-4', !n.read && 'bg-plate/10')} data-testid={`row-notification-${n.id}`}>
              <span className={cn('mt-1.5 h-2 w-2 shrink-0 rounded-full', n.read ? 'bg-muted' : 'bg-chart-4')} />
              <div className="flex-1">
                <p className="font-semibold">{n.title}</p>
                <p className="text-sm text-muted-foreground">{n.body}</p>
                <p className="mt-1 font-mono text-[10px] text-muted-foreground">{ago(n.at)}</p>
              </div>
              <div className="flex flex-col items-end gap-1">
                {n.href && <Link href={n.href} onClick={() => handleMarkRead(n.id)} className="text-sm font-medium text-primary underline">Open</Link>}
                {!n.read && <button onClick={() => handleMarkRead(n.id)} className="text-xs text-muted-foreground hover:underline" data-testid={`button-read-${n.id}`}>Mark read</button>}
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

const profileSchema = z.object({
  first_name: z.string().trim().min(2, 'At least 2 letters').max(30).regex(/^[A-Za-z\s.'-]+$/, 'First name only, letters'),
  city: z.string().min(1, 'Choose a city'),
  area: z.string().min(1, 'Choose an area'),
  experience: z.string().min(1, 'Choose experience'),
  vehicle: z.string().min(1, 'Choose vehicle'),
  own_vehicle: z.boolean(),
  available: z.boolean(),
  discoverable: z.boolean(),
});
type ProfileForm = z.infer<typeof profileSchema>;

export function Profile() {
  const { state, actions } = usePilot();
  const { session } = useSession();
  const { toast } = useToast();
  const form = useForm<ProfileForm>({ resolver: zodResolver(profileSchema), defaultValues: state.profile });
  const city = form.watch('city');
  const live = form.watch();
  const prog = profileProgress(live);
  const areas = useMemo(() => CITIES[city] ?? [], [city]);

  useEffect(() => {
    if (liveMode && session) {
      getLiveWorkerProfile().then((p) => {
        if (p) {
          form.reset({
            first_name: p.first_name || '',
            city: p.city || 'Bengaluru',
            area: p.area || '',
            experience: p.experience || '1–3 years',
            vehicle: p.vehicle || 'Two-wheeler',
            own_vehicle: p.own_vehicle ?? false,
            available: p.available ?? true,
            discoverable: p.discoverable ?? false,
          });
        }
      });
    }
  }, [session]);

  const onSubmit = async (v: ProfileForm) => {
    if (liveMode && session) {
      const res = await saveLiveWorkerProfile(v);
      if (res.ok) {
        actions.updateProfile(v);
        form.reset(v);
        toast({ title: 'Profile saved to cloud', description: 'Your profile has been saved securely to Supabase.' });
      } else {
        toast({ title: 'Failed to save profile', description: res.error, variant: 'destructive' });
      }
      return;
    }
    actions.updateProfile(v);
    form.reset(v);
    toast({ title: 'Profile saved', description: 'Stored on this device as pilot data.' });
  };

  return (
    <div className="mx-auto max-w-5xl">
      <PageHeader eyebrow="Worker" title="Your profile" description="Only your first name, area, experience and vehicle are ever shown. No phone, photo or ID is collected in the pilot." />
      <div className="grid gap-6 lg:grid-cols-[1fr_300px]">
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-5 rounded-2xl border bg-card p-5 md:p-6">
            <FormField control={form.control} name="first_name" render={({ field }) => (
              <FormItem><FormLabel>First name</FormLabel><FormControl><Input {...field} data-testid="input-first-name" /></FormControl><FormMessage /></FormItem>)} />
            <div className="grid gap-4 sm:grid-cols-2">
              <FormField control={form.control} name="city" render={({ field }) => (
                <FormItem><FormLabel>City</FormLabel>
                  <Select value={field.value} onValueChange={(v) => { field.onChange(v); form.setValue('area', ''); }}>
                    <FormControl><SelectTrigger data-testid="select-profile-city"><SelectValue placeholder="Choose" /></SelectTrigger></FormControl>
                    <SelectContent>{CITY_NAMES.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent>
                  </Select><FormMessage /></FormItem>)} />
              <FormField control={form.control} name="area" render={({ field }) => (
                <FormItem><FormLabel>Area</FormLabel>
                  <Select value={field.value} onValueChange={field.onChange}>
                    <FormControl><SelectTrigger data-testid="select-profile-area"><SelectValue placeholder="Choose" /></SelectTrigger></FormControl>
                    <SelectContent>{areas.map((a) => <SelectItem key={a} value={a}>{a}</SelectItem>)}</SelectContent>
                  </Select><FormMessage /></FormItem>)} />
              <FormField control={form.control} name="experience" render={({ field }) => (
                <FormItem><FormLabel>Experience</FormLabel>
                  <Select value={field.value} onValueChange={field.onChange}>
                    <FormControl><SelectTrigger data-testid="select-profile-experience"><SelectValue placeholder="Choose" /></SelectTrigger></FormControl>
                    <SelectContent>{EXPERIENCE.map((a) => <SelectItem key={a} value={a}>{a}</SelectItem>)}</SelectContent>
                  </Select><FormMessage /></FormItem>)} />
              <FormField control={form.control} name="vehicle" render={({ field }) => (
                <FormItem><FormLabel>Vehicle you can ride</FormLabel>
                  <Select value={field.value} onValueChange={field.onChange}>
                    <FormControl><SelectTrigger data-testid="select-profile-vehicle"><SelectValue placeholder="Choose" /></SelectTrigger></FormControl>
                    <SelectContent>{VEHICLES.map((a) => <SelectItem key={a} value={a}>{a}</SelectItem>)}</SelectContent>
                  </Select><FormMessage /></FormItem>)} />
            </div>
            {(['own_vehicle', 'available'] as const).map((name) => (
              <FormField key={name} control={form.control} name={name} render={({ field }) => (
                <FormItem className="flex items-center justify-between gap-4 rounded-lg border p-3">
                  <div><FormLabel>{name === 'own_vehicle' ? 'I own this vehicle' : 'Available to start this week'}</FormLabel></div>
                  <FormControl><Switch checked={field.value} onCheckedChange={field.onChange} data-testid={`switch-${name}`} /></FormControl>
                </FormItem>)} />
            ))}
            <FormField control={form.control} name="discoverable" render={({ field }) => (
              <FormItem className={cn('flex items-center justify-between gap-4 rounded-lg border-2 p-4', field.value ? 'border-signal/40 bg-signal/5' : 'border-dashed')}>
                <div>
                  <FormLabel className="flex items-center gap-2">{field.value ? <Eye className="h-4 w-4" /> : <EyeOff className="h-4 w-4" />}Let verified employers find me</FormLabel>
                  <FormDescription>Off by default. When on, employers see an anonymous card (code, area, experience, vehicle), never your name or number.</FormDescription>
                </div>
                <FormControl><Switch checked={field.value} onCheckedChange={field.onChange} data-testid="switch-discoverable" /></FormControl>
              </FormItem>)} />
            <div className="flex justify-end gap-2">
              <Button type="button" variant="ghost" onClick={() => form.reset(state.profile)} disabled={!form.formState.isDirty}>Discard</Button>
              <Button type="submit" disabled={!form.formState.isDirty} data-testid="button-save-profile">Save profile</Button>
            </div>
          </form>
        </Form>
        <aside className="space-y-4">
          <div className="rounded-2xl bg-tarmac p-5 text-sidebar-foreground">
            <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-sidebar-foreground/60">Profile strength</p>
            <p className="font-display text-5xl font-extrabold text-plate" data-testid="text-profile-progress">{prog.pct}%</p>
            <div className="mt-2"><Meter value={prog.pct} max={100} tone="plate" /></div>
            <ul className="mt-4 space-y-1.5 text-sm">
              {prog.checks.map((c) => (
                <li key={c.label} className={cn('flex items-center gap-2', !c.done && 'text-sidebar-foreground/50')}>
                  <Check className={cn('h-4 w-4', c.done ? 'text-plate' : 'opacity-30')} />{c.label}
                </li>
              ))}
            </ul>
          </div>
          <div className="rounded-2xl border bg-card p-5 text-sm">
            <p className="flex items-center gap-2 font-semibold"><Lock className="h-4 w-4" />What employers see</p>
            <p className="mt-2 text-muted-foreground">{live.first_name || 'First name'} · {live.area || 'Area'} · {live.experience || 'Experience'} · {live.vehicle || 'Vehicle'}</p>
          </div>
        </aside>
      </div>
    </div>
  );
}

export function SettingsPage() {
  const { state, actions } = usePilot();
  const { toast } = useToast();
  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <PageHeader eyebrow="Worker" title="Settings" />
      <section className="divide-y rounded-2xl border bg-card">
        <Row title="New job alerts" body="Shown in Notifications. No SMS is sent in the pilot.">
          <Switch checked={state.prefs.jobAlerts} onCheckedChange={(v) => actions.setPrefs({ jobAlerts: v })} data-testid="switch-job-alerts" />
        </Row>
        <Row title="Application status updates" body="Know when an employer views or shortlists you.">
          <Switch checked={state.prefs.statusUpdates} onCheckedChange={(v) => actions.setPrefs({ statusUpdates: v })} data-testid="switch-status-updates" />
        </Row>
        <Row title="Language" body="Hindi interface is planned; selection is saved for later.">
          <Select value={state.prefs.language} onValueChange={(v) => actions.setPrefs({ language: v as 'en' | 'hi' })}>
            <SelectTrigger className="w-36" data-testid="select-language"><SelectValue /></SelectTrigger>
            <SelectContent><SelectItem value="en">English</SelectItem><SelectItem value="hi">Hindi (soon)</SelectItem></SelectContent>
          </Select>
        </Row>
      </section>
      <section className="rounded-2xl border bg-card p-5">
        <h2 className="text-lg font-bold">Pilot data on this device</h2>
        <p className="mt-1 text-sm text-muted-foreground">Everything you see is sample data saved in this browser under <code className="font-mono text-xs">{STORAGE_KEY}</code>. Nothing is sent to a server.</p>
        <AlertDialog>
          <AlertDialogTrigger asChild><Button variant="outline" className="mt-4" data-testid="button-reset-pilot"><RotateCcw className="mr-1.5 h-4 w-4" />Reset pilot data</Button></AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogHeader><AlertDialogTitle>Reset all pilot data?</AlertDialogTitle>
              <AlertDialogDescription>Saved jobs, applications, profile edits, messages and admin actions go back to the original sample set.</AlertDialogDescription></AlertDialogHeader>
            <AlertDialogFooter><AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction onClick={() => { actions.reset(); toast({ title: 'Pilot data reset' }); }} data-testid="button-confirm-reset">Reset</AlertDialogAction></AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </section>
      <section className="flex flex-wrap gap-4 text-sm">
        <Link href="/legal/terms" className="underline">Terms (draft)</Link>
        <Link href="/legal/privacy" className="underline">Privacy notice (draft)</Link>
        <Link href="/login" className="underline">Account sign-in</Link>
      </section>
    </div>
  );
}

function Row({ title, body, children }: { title: string; body: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-4 p-4">
      <div><p className="font-semibold">{title}</p><p className="text-sm text-muted-foreground">{body}</p></div>{children}
    </div>
  );
}

const ticketSchema = z.object({
  topic: z.string().min(1, 'Choose a topic'),
  subject: z.string().trim().min(5, 'A few more words please').max(80),
  body: z.string().trim().min(10, 'Tell us a little more').max(800),
});
type TicketForm = z.infer<typeof ticketSchema>;

export function Support() {
  const { state, actions } = usePilot();
  const { toast } = useToast();
  const form = useForm<TicketForm>({ resolver: zodResolver(ticketSchema), defaultValues: { topic: '', subject: '', body: '' } });
  const mine = state.tickets.filter((t) => t.from === 'worker');
  const onSubmit = (v: TicketForm) => {
    actions.createTicket({ ...v, from: 'worker' });
    form.reset();
    toast({ title: 'Request logged', description: 'Visible in the admin support queue (pilot).' });
  };
  return (
    <div className="mx-auto max-w-5xl">
      <PageHeader eyebrow="Worker" title="Help & safety" description="Answers to common questions, and a way to flag anything that feels wrong." />
      <div className="mb-6 flex items-start gap-3 rounded-2xl border-2 border-chart-4/40 bg-chart-4/5 p-5">
        <ShieldAlert className="mt-0.5 h-5 w-5 shrink-0 text-chart-4" />
        <div><p className="font-bold">Nobody should ask you for money to get a job.</p>
          <p className="text-sm text-muted-foreground">Deposits, training fees or "registration charges" are red flags. Report it below and stop talking to that recruiter.</p></div>
      </div>
      <div className="grid gap-6 lg:grid-cols-2">
        <Accordion type="single" collapsible className="rounded-2xl border bg-card px-5">
          {[
            ['Who can see my phone number?', 'No one. Employers never see your number on FleetWala. Chat stays inside the app.'],
            ['Why is there a 20 applications a day limit?', 'It keeps applications thoughtful and helps employers respond. In the pilot it is a demo counter by IST date.'],
            ['How is the 15 km radius worked out?', 'For now we match by city and area. Distances are approximate and not calculated from GPS.'],
            ['Are these real jobs?', 'Not yet. The pilot shows sample listings so you can try the flow. Real jobs come after verification goes live.'],
          ].map(([q, a], i) => (
            <AccordionItem key={q} value={`q${i}`}><AccordionTrigger className="text-left">{q}</AccordionTrigger><AccordionContent className="text-muted-foreground">{a}</AccordionContent></AccordionItem>
          ))}
        </Accordion>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4 rounded-2xl border bg-card p-5">
            <h2 className="text-lg font-bold">Contact support</h2>
            <FormField control={form.control} name="topic" render={({ field }) => (
              <FormItem><FormLabel>Topic</FormLabel>
                <Select value={field.value} onValueChange={field.onChange}>
                  <FormControl><SelectTrigger data-testid="select-ticket-topic"><SelectValue placeholder="Choose a topic" /></SelectTrigger></FormControl>
                  <SelectContent>{['Safety', 'Application', 'Profile', 'Other'].map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}</SelectContent>
                </Select><FormMessage /></FormItem>)} />
            <FormField control={form.control} name="subject" render={({ field }) => (
              <FormItem><FormLabel>Subject</FormLabel><FormControl><Input {...field} data-testid="input-ticket-subject" /></FormControl><FormMessage /></FormItem>)} />
            <FormField control={form.control} name="body" render={({ field }) => (
              <FormItem><FormLabel>What happened?</FormLabel><FormControl><Textarea rows={4} {...field} data-testid="input-ticket-body" /></FormControl>
                <FormDescription>Do not include phone numbers or ID numbers.</FormDescription><FormMessage /></FormItem>)} />
            <Button type="submit" className="w-full" data-testid="button-submit-ticket">Send to support</Button>
          </form>
        </Form>
      </div>
      {mine.length > 0 && (
        <div className="mt-6">
          <h2 className="mb-3 text-lg font-bold">Your requests</h2>
          <ul className="divide-y rounded-xl border bg-card">
            {mine.map((t) => (
              <li key={t.id} className="flex items-center justify-between gap-3 p-4"><div><p className="font-medium">{t.subject}</p><p className="text-xs text-muted-foreground">{t.topic} · {ago(t.created_at)}</p></div><StatusPill status={t.status} /></li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
