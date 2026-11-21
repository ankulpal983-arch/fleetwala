import { Link } from 'wouter';
import { Bookmark, BookmarkCheck, Clock, Fuel, IdCard, MapPin, Bike } from 'lucide-react';
import { Monogram, SampleTag, StatusPill } from '@/components/common';
import { cn } from '@/lib/utils';
import { ago, daysLeft, salaryRange } from '@/lib/format';
import type { AppStatus, Job } from '@/lib/types';

export function JobCard({ job, saved, onToggleSave, appStatus, index = 0 }: {
  job: Job; saved: boolean; onToggleSave: () => void; appStatus?: AppStatus; index?: number;
}) {
  const left = daysLeft(job.expires_at);
  return (
    <article
      className="rise group relative flex flex-col rounded-xl border bg-card p-4 shadow-sm transition-[transform,box-shadow] duration-200 hover:-translate-y-0.5 hover:shadow-md"
      style={{ animationDelay: `${Math.min(index, 8) * 45}ms` }}
      data-testid={`card-job-${job.id}`}
    >
      <div className="flex items-start gap-3">
        <Monogram name={job.company} />
        <div className="min-w-0 flex-1">
          <Link href={`/jobs/${job.id}`} className="block font-display text-lg font-bold leading-tight after:absolute after:inset-0 after:content-['']" data-testid={`link-job-${job.id}`}>
            {job.title}
          </Link>
          <p className="mt-0.5 flex flex-wrap items-center gap-1.5 text-sm text-muted-foreground">
            {job.company} <SampleTag />
          </p>
        </div>
        <button
          type="button"
          onClick={onToggleSave}
          aria-pressed={saved}
          aria-label={saved ? 'Remove from saved' : 'Save job'}
          className={cn('relative z-10 rounded-full p-2 transition-colors hover:bg-muted', saved ? 'text-primary' : 'text-muted-foreground')}
          data-testid={`button-save-${job.id}`}
        >
          {saved ? <BookmarkCheck className="h-5 w-5 fill-plate" /> : <Bookmark className="h-5 w-5" />}
        </button>
      </div>

      <div className="mt-4 flex items-baseline justify-between gap-2">
        <p className="font-display text-xl font-extrabold tracking-tight" data-testid={`text-salary-${job.id}`}>
          {salaryRange(job)}<span className="ml-1 text-xs font-medium text-muted-foreground">/month</span>
        </p>
        {appStatus && <StatusPill status={appStatus} />}
      </div>
      <p className="mt-1 flex items-center gap-1 text-sm"><MapPin className="h-3.5 w-3.5 text-muted-foreground" />{job.area}, {job.city}</p>

      <div className="mt-3 flex flex-wrap gap-1.5 text-xs">
        <Chip><Clock className="h-3 w-3" />{job.shift}</Chip>
        <Chip><Bike className="h-3 w-3" />{job.vehicle}</Chip>
        {job.fuel_allowance && <Chip tone="signal"><Fuel className="h-3 w-3" />Fuel allowance</Chip>}
        {job.licence_required ? <Chip><IdCard className="h-3 w-3" />Licence needed</Chip> : <Chip tone="signal">No licence needed</Chip>}
      </div>

      <div className="mt-4 flex items-center justify-between border-t border-dashed pt-3 font-mono text-[11px] text-muted-foreground">
        <span>{job.category} · posted {ago(job.created_at)}</span>
        <span className={cn(left <= 4 && 'font-bold text-chart-4')}>{left > 0 ? `${left}d left` : 'Expired'}</span>
      </div>
    </article>
  );
}

function Chip({ children, tone }: { children: React.ReactNode; tone?: 'signal' }) {
  return (
    <span className={cn('inline-flex items-center gap-1 rounded-md px-2 py-1', tone === 'signal' ? 'bg-signal/10 text-signal' : 'bg-muted text-foreground/80')}>
      {children}
    </span>
  );
}
