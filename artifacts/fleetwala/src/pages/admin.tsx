import { useState } from 'react';
import { Link } from 'wouter';
import { Check, FileClock, Gavel, LifeBuoy, Pause, ShieldOff, ShieldCheck, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { useToast } from '@/hooks/use-toast';
import { EmptyState, Monogram, PageHeader, Stat, StatusPill } from '@/components/common';
import { usePilot } from '@/lib/store';
import { ago, istDate, istStamp, salaryRange } from '@/lib/format';
import { cn } from '@/lib/utils';
import type { Job, TicketStatus } from '@/lib/types';

const ACTOR = 'Pilot admin';

function AdminNote() {
  return <p className="mb-5 rounded-lg border border-dashed px-3 py-2 text-xs text-muted-foreground">Admin view is a demo. There is no admin sign-in in the pilot and these actions only change sample data in this browser.</p>;
}

export function AdminOverview() {
  const { state } = usePilot();
  const pending = state.jobs.filter((j) => j.status === 'pending');
  return (
    <div>
      <PageHeader eyebrow="Trust & safety" title="Admin overview" />
      <AdminNote />
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat label="Awaiting review" value={pending.length} hint="Jobs" testId="stat-pending" />
        <Stat label="Unverified employers" value={state.employers.filter((e) => e.status === 'unverified').length} />
        <Stat label="Open tickets" value={state.tickets.filter((t) => t.status !== 'resolved').length} />
        <Stat label="Audit events" value={state.audit.length} />
      </div>
      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        <section className="rounded-2xl border bg-card p-5">
          <div className="flex items-center justify-between"><h2 className="font-bold">Review queue</h2><Link href="/admin/jobs" className="text-sm text-primary underline">Open</Link></div>
          <ul className="mt-3 divide-y text-sm">{pending.slice(0, 5).map((j) => <li key={j.id} className="flex justify-between py-2"><span>{j.title}<span className="block text-xs text-muted-foreground">{j.company}</span></span>{j.moderation_note && <span className="text-xs text-chart-4">Flagged</span>}</li>)}
            {pending.length === 0 && <li className="py-2 text-muted-foreground">Queue is clear.</li>}</ul>
        </section>
        <section className="rounded-2xl border bg-card p-5">
          <div className="flex items-center justify-between"><h2 className="font-bold">Recent activity</h2><Link href="/admin/audit" className="text-sm text-primary underline">Audit log</Link></div>
          <ul className="mt-3 space-y-2 font-mono text-xs">{state.audit.slice(0, 6).map((a) => <li key={a.id} className="flex gap-3"><span className="text-muted-foreground">{istStamp(a.at)}</span><span className="font-bold">{a.action}</span><span className="truncate">{a.target}</span></li>)}</ul>
        </section>
      </div>
    </div>
  );
}

export function AdminJobs() {
  const { state, actions } = usePilot();
  const { toast } = useToast();
  const [view, setView] = useState<'pending' | 'approved' | 'paused' | 'closed'>('pending');
  const [rejecting, setRejecting] = useState<Job | null>(null);
  const [note, setNote] = useState('');
  const list = state.jobs.filter((j) => j.status === view);
  const empStatus = (id: string) => state.employers.find((e) => e.id === id)?.status ?? 'unverified';

  return (
    <div>
      <PageHeader eyebrow="Trust & safety" title="Job moderation" description="Approve only listings with clear pay, no fees and a verified employer." />
      <AdminNote />
      <div className="mb-4 flex gap-1">
        {(['pending', 'approved', 'paused', 'closed'] as const).map((s) => (
          <button key={s} onClick={() => setView(s)} className={cn('rounded-full border px-3 py-1 text-sm capitalize', view === s ? 'border-foreground bg-foreground text-background' : 'bg-card')} data-testid={`filter-moderation-${s}`}>
            {s} <span className="font-mono text-xs opacity-60">{state.jobs.filter((j) => j.status === s).length}</span>
          </button>
        ))}
      </div>
      {list.length === 0 ? <EmptyState icon={Gavel} title="Nothing here" body="No jobs in this state." /> : (
        <div className="space-y-3">
          {list.map((j) => (
            <article key={j.id} className="rise flex flex-col gap-4 rounded-xl border bg-card p-4 md:flex-row md:items-center" data-testid={`card-moderation-${j.id}`}>
              <Monogram name={j.company} size="sm" />
              <div className="flex-1">
                <p className="font-semibold">{j.title} <span className="font-normal text-muted-foreground">· {j.company}</span></p>
                <p className="text-xs text-muted-foreground">{j.area}, {j.city} · {salaryRange(j)} · closes {istDate(j.expires_at)} · employer <StatusPill status={empStatus(j.employer_id)} /></p>
                <p className="mt-1 line-clamp-2 text-sm text-foreground/80">{j.description}</p>
                {j.moderation_note && <p className="mt-1 text-xs font-semibold text-chart-4">{j.moderation_note}</p>}
              </div>
              <div className="flex gap-2">
                {j.status === 'pending' && <>
                  <Button size="sm" variant="outline" onClick={() => { setRejecting(j); setNote(''); }} data-testid={`button-reject-${j.id}`}><X className="mr-1 h-4 w-4" />Send back</Button>
                  <Button size="sm" disabled={empStatus(j.employer_id) === 'suspended'} onClick={() => { actions.setJobStatus(j.id, 'approved', ACTOR, ''); toast({ title: 'Approved', description: `${j.title} is now visible to workers.` }); }} data-testid={`button-approve-${j.id}`}><Check className="mr-1 h-4 w-4" />Approve</Button>
                </>}
                {j.status === 'approved' && <Button size="sm" variant="outline" onClick={() => actions.setJobStatus(j.id, 'paused', ACTOR, 'Paused by moderation')} data-testid={`button-admin-pause-${j.id}`}><Pause className="mr-1 h-4 w-4" />Pause</Button>}
                {j.status === 'paused' && <Button size="sm" variant="outline" onClick={() => actions.setJobStatus(j.id, 'closed', ACTOR)} data-testid={`button-admin-close-${j.id}`}>Close</Button>}
              </div>
            </article>
          ))}
        </div>
      )}
      <Dialog open={!!rejecting} onOpenChange={(o) => !o && setRejecting(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>Send back to draft</DialogTitle><DialogDescription>The employer sees this note on their job.</DialogDescription></DialogHeader>
          <Label htmlFor="mod-note">Reason</Label>
          <Textarea id="mod-note" value={note} onChange={(e) => setNote(e.target.value)} placeholder="e.g. Remove the joining deposit requirement" data-testid="input-moderation-note" />
          <DialogFooter><Button disabled={note.trim().length < 5} onClick={() => { if (rejecting) { actions.setJobStatus(rejecting.id, 'draft', ACTOR, note.trim()); toast({ title: 'Sent back to employer' }); } setRejecting(null); }} data-testid="button-confirm-reject">Send back</Button></DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

export function AdminEmployers() {
  const { state, actions } = usePilot();
  const { toast } = useToast();
  return (
    <div>
      <PageHeader eyebrow="Trust & safety" title="Employers" description="Verification here is a pilot simulation; real checks (GST, KYC) are not connected." />
      <AdminNote />
      <div className="overflow-hidden rounded-xl border bg-card">
        <Table>
          <TableHeader><TableRow><TableHead>Employer</TableHead><TableHead className="hidden md:table-cell">City</TableHead><TableHead className="hidden md:table-cell">Jobs</TableHead><TableHead>Status</TableHead><TableHead className="text-right">Actions</TableHead></TableRow></TableHeader>
          <TableBody>
            {state.employers.map((e) => (
              <TableRow key={e.id} data-testid={`row-employer-${e.id}`}>
                <TableCell><div className="flex items-center gap-3"><Monogram name={e.name} size="sm" /><div><p className="font-semibold">{e.name}</p><p className="text-xs text-muted-foreground">{e.kind} · joined {ago(e.joined)}</p></div></div></TableCell>
                <TableCell className="hidden md:table-cell">{e.city}</TableCell>
                <TableCell className="hidden font-mono md:table-cell">{state.jobs.filter((j) => j.employer_id === e.id).length}</TableCell>
                <TableCell><StatusPill status={e.status} testId={`status-employer-${e.id}`} /></TableCell>
                <TableCell><div className="flex justify-end gap-1">
                  {e.status !== 'verified' && <Button size="sm" variant="outline" onClick={() => { actions.setEmployerStatus(e.id, 'verified'); toast({ title: 'Marked verified (pilot)' }); }} data-testid={`button-verify-${e.id}`}><ShieldCheck className="mr-1 h-4 w-4" />Verify</Button>}
                  {e.status !== 'suspended' && <Button size="sm" variant="ghost" onClick={() => { actions.setEmployerStatus(e.id, 'suspended'); toast({ title: 'Suspended', description: e.name }); }} data-testid={`button-suspend-${e.id}`}><ShieldOff className="mr-1 h-4 w-4" />Suspend</Button>}
                </div></TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}

export function AdminAudit() {
  const { state } = usePilot();
  const [q, setQ] = useState('');
  const list = state.audit.filter((a) => `${a.actor} ${a.action} ${a.target}`.toLowerCase().includes(q.toLowerCase()));
  return (
    <div>
      <PageHeader eyebrow="Trust & safety" title="Audit log" description="Append-only record of pilot actions in this browser."
        actions={<Input type="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Filter" className="w-56" aria-label="Filter audit log" data-testid="input-audit-filter" />} />
      {list.length === 0 ? <EmptyState icon={FileClock} title="No matching events" body="Try a different filter." /> : (
        <div className="overflow-hidden rounded-xl border bg-tarmac font-mono text-xs text-sidebar-foreground">
          {list.map((a) => (
            <div key={a.id} className="grid grid-cols-[120px_1fr] gap-2 border-b border-sidebar-border px-4 py-2.5 md:grid-cols-[150px_140px_160px_1fr]" data-testid={`row-audit-${a.id}`}>
              <span className="text-sidebar-foreground/50">{istStamp(a.at)}</span>
              <span className="hidden md:block">{a.actor}</span>
              <span className="font-bold text-plate">{a.action}</span>
              <span className="col-span-2 truncate md:col-span-1">{a.target}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export function AdminSupport() {
  const { state, actions } = usePilot();
  return (
    <div>
      <PageHeader eyebrow="Trust & safety" title="Support queue" description="Safety reports first." />
      <AdminNote />
      {state.tickets.length === 0 ? <EmptyState icon={LifeBuoy} title="Inbox zero" body="No support requests." /> : (
        <div className="space-y-3">
          {[...state.tickets].sort((a, b) => Number(b.topic === 'Safety') - Number(a.topic === 'Safety')).map((t) => (
            <article key={t.id} className={cn('rounded-xl border bg-card p-4', t.topic === 'Safety' && t.status !== 'resolved' && 'border-l-4 border-l-chart-4')} data-testid={`card-ticket-${t.id}`}>
              <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                <div><p className="font-semibold">{t.subject}</p><p className="text-xs text-muted-foreground">{t.topic} · from {t.from} · {ago(t.created_at)}</p><p className="mt-2 text-sm">{t.body}</p></div>
                <Select value={t.status} onValueChange={(v) => actions.setTicketStatus(t.id, v as TicketStatus)}>
                  <SelectTrigger className="w-40" data-testid={`select-ticket-status-${t.id}`}><SelectValue /></SelectTrigger>
                  <SelectContent><SelectItem value="open">Open</SelectItem><SelectItem value="in_progress">In progress</SelectItem><SelectItem value="resolved">Resolved</SelectItem></SelectContent>
                </Select>
              </div>
            </article>
          ))}
        </div>
      )}
    </div>
  );
}
