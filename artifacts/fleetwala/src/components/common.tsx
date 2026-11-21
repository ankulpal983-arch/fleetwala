import type { ReactNode } from 'react';
import type { LucideIcon } from 'lucide-react';
import { RotateCcw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';
import { hashNum, initials } from '@/lib/format';
import type { AppStatus, JobStatus, TicketStatus, EmployerStatus } from '@/lib/types';

const STRIPS = ['bg-primary', 'bg-signal', 'bg-chart-4', 'bg-tarmac'];

export function Monogram({ name, size = 'md' }: { name: string; size?: 'sm' | 'md' | 'lg' }) {
  const strip = STRIPS[hashNum(name) % STRIPS.length];
  const dims = size === 'lg' ? 'h-16 w-[5.5rem] text-xl' : size === 'sm' ? 'h-9 w-12 text-xs' : 'h-12 w-16 text-base';
  return (
    <div aria-hidden className={cn('flex shrink-0 overflow-hidden rounded-md border-2 border-foreground/85 bg-plate shadow-sm', dims)}>
      <div className={cn('flex w-2.5 items-end justify-center pb-0.5', strip)} />
      <div className="flex flex-1 items-center justify-center font-mono font-bold tracking-wider text-accent-foreground">
        {initials(name)}
      </div>
    </div>
  );
}

export function SampleTag({ className }: { className?: string }) {
  return (
    <span className={cn('inline-flex items-center rounded border border-dashed border-muted-foreground/50 px-1.5 py-px font-mono text-[10px] uppercase tracking-wider text-muted-foreground', className)}>
      Sample
    </span>
  );
}

const TONES: Record<string, string> = {
  draft: 'bg-muted text-muted-foreground border-border',
  pending: 'bg-plate/25 text-accent-foreground border-plate/60',
  approved: 'bg-signal/12 text-signal border-signal/30',
  paused: 'bg-chart-4/12 text-chart-4 border-chart-4/30',
  closed: 'bg-foreground/8 text-foreground/70 border-foreground/15',
  applied: 'bg-primary/10 text-primary border-primary/25',
  viewed: 'bg-chart-5/15 text-foreground border-chart-5/40',
  shortlisted: 'bg-plate/30 text-accent-foreground border-plate/70',
  hired: 'bg-signal/15 text-signal border-signal/35',
  rejected: 'bg-destructive/10 text-destructive border-destructive/25',
  withdrawn: 'bg-muted text-muted-foreground border-border',
  open: 'bg-chart-4/12 text-chart-4 border-chart-4/30',
  in_progress: 'bg-plate/25 text-accent-foreground border-plate/60',
  resolved: 'bg-signal/12 text-signal border-signal/30',
  verified: 'bg-signal/12 text-signal border-signal/30',
  unverified: 'bg-plate/25 text-accent-foreground border-plate/60',
  suspended: 'bg-destructive/10 text-destructive border-destructive/25',
  active: 'bg-signal/12 text-signal border-signal/30',
  invited: 'bg-plate/25 text-accent-foreground border-plate/60',
};

export function StatusPill({ status, testId }: { status: JobStatus | AppStatus | TicketStatus | EmployerStatus | string; testId?: string }) {
  return (
    <span data-testid={testId} className={cn('inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] font-semibold capitalize', TONES[status] ?? TONES.draft)}>
      <span className="h-1.5 w-1.5 rounded-full bg-current opacity-70" />
      {status.replace('_', ' ')}
    </span>
  );
}

export function PageHeader({ eyebrow, title, description, actions }: { eyebrow?: string; title: string; description?: ReactNode; actions?: ReactNode }) {
  return (
    <div className="rise mb-6 flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
      <div>
        {eyebrow && <p className="mb-1 font-mono text-[11px] uppercase tracking-[0.18em] text-muted-foreground">{eyebrow}</p>}
        <h1 className="text-3xl font-extrabold leading-none md:text-4xl" data-testid="text-page-title">{title}</h1>
        {description && <p className="mt-2 max-w-2xl text-sm text-muted-foreground">{description}</p>}
      </div>
      {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
    </div>
  );
}

export function EmptyState({ icon: Icon, title, body, action }: { icon: LucideIcon; title: string; body: string; action?: ReactNode }) {
  return (
    <div className="rise flex flex-col items-center rounded-xl border border-dashed border-border bg-card/60 px-6 py-14 text-center" data-testid="state-empty">
      <div className="relative mb-4">
        <div className="flex h-14 w-14 items-center justify-center rounded-full bg-plate/30">
          <Icon className="h-6 w-6 text-foreground" />
        </div>
      </div>
      <h3 className="text-lg font-bold">{title}</h3>
      <p className="mt-1 max-w-sm text-sm text-muted-foreground">{body}</p>
      <div className="mt-5 w-24 overflow-hidden"><div className="road-dash road-dash-anim" /></div>
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}

export function ErrorState({ title, body, onRetry }: { title: string; body: string; onRetry: () => void }) {
  return (
    <div role="alert" className="flex flex-col items-start gap-3 rounded-xl border border-destructive/30 bg-destructive/5 p-5 sm:flex-row sm:items-center sm:justify-between">
      <div>
        <p className="font-semibold text-destructive">{title}</p>
        <p className="text-sm text-muted-foreground">{body}</p>
      </div>
      <Button variant="outline" size="sm" onClick={onRetry} data-testid="button-retry"><RotateCcw className="mr-1.5 h-4 w-4" />Retry</Button>
    </div>
  );
}

export function CardSkeleton() {
  return (
    <div className="rounded-xl border bg-card p-4">
      <div className="flex gap-3">
        <Skeleton className="h-12 w-16" />
        <div className="flex-1 space-y-2"><Skeleton className="h-4 w-2/3" /><Skeleton className="h-3 w-1/3" /></div>
      </div>
      <Skeleton className="mt-4 h-6 w-1/2" />
      <div className="mt-3 flex gap-2"><Skeleton className="h-5 w-16" /><Skeleton className="h-5 w-20" /><Skeleton className="h-5 w-14" /></div>
    </div>
  );
}

export function Meter({ value, max, tone = 'primary' }: { value: number; max: number; tone?: 'primary' | 'plate' | 'signal' }) {
  const pct = Math.min(100, Math.round((value / max) * 100));
  const bg = tone === 'plate' ? 'bg-plate' : tone === 'signal' ? 'bg-signal' : 'bg-primary';
  return (
    <div className="h-2 w-full overflow-hidden rounded-full bg-muted" role="progressbar" aria-valuenow={value} aria-valuemax={max} aria-valuemin={0}>
      <div className={cn('h-full origin-left rounded-full transition-transform duration-700', bg)} style={{ width: '100%', transform: `scaleX(${pct / 100})` }} />
    </div>
  );
}

export function Stat({ label, value, hint, testId }: { label: string; value: ReactNode; hint?: string; testId?: string }) {
  return (
    <div className="rounded-xl border bg-card p-4">
      <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-muted-foreground">{label}</p>
      <p className="mt-1 font-display text-3xl font-extrabold" data-testid={testId}>{value}</p>
      {hint && <p className="mt-0.5 text-xs text-muted-foreground">{hint}</p>}
    </div>
  );
}
