import type { ReactNode } from 'react';
import { Link, useLocation } from 'wouter';
import {
  Bell, Bookmark, Building2, ChevronDown, ClipboardList, CreditCard, FileClock, Gavel, LayoutDashboard, LifeBuoy,
  ListChecks, LogIn, MessageSquare, Search, Settings, ShieldCheck, UserRound, Users, UsersRound, WifiOff, Briefcase,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Button } from '@/components/ui/button';
import { usePilot } from '@/lib/store';
import { liveMode, useSession } from '@/lib/supabase';
import { cn } from '@/lib/utils';

export type Workspace = 'worker' | 'employer' | 'admin';
type NavItem = { href: string; label: string; icon: LucideIcon; short?: string };

const NAV: Record<Workspace, NavItem[]> = {
  worker: [
    { href: '/', label: 'Find jobs', icon: Search, short: 'Jobs' },
    { href: '/saved', label: 'Saved', icon: Bookmark },
    { href: '/applications', label: 'Applications', icon: ClipboardList, short: 'Applied' },
    { href: '/messages', label: 'Messages', icon: MessageSquare, short: 'Chat' },
    { href: '/profile', label: 'Profile', icon: UserRound },
    { href: '/notifications', label: 'Notifications', icon: Bell },
    { href: '/settings', label: 'Settings', icon: Settings },
    { href: '/support', label: 'Help & safety', icon: LifeBuoy },
  ],
  employer: [
    { href: '/employer', label: 'Overview', icon: LayoutDashboard },
    { href: '/employer/jobs', label: 'Jobs', icon: Briefcase },
    { href: '/employer/applicants', label: 'Applicants', icon: ListChecks },
    { href: '/employer/candidates', label: 'Candidates', icon: UsersRound },
    { href: '/employer/billing', label: 'Billing', icon: CreditCard },
    { href: '/employer/team', label: 'Team', icon: Users },
  ],
  admin: [
    { href: '/admin', label: 'Overview', icon: LayoutDashboard },
    { href: '/admin/jobs', label: 'Job moderation', icon: Gavel },
    { href: '/admin/employers', label: 'Employers', icon: Building2 },
    { href: '/admin/audit', label: 'Audit log', icon: FileClock },
    { href: '/admin/support', label: 'Support queue', icon: LifeBuoy },
  ],
};

const LABEL: Record<Workspace, string> = { worker: 'Worker', employer: 'Employer', admin: 'Admin' };

export function workspaceFor(path: string): Workspace {
  if (path.startsWith('/employer')) return 'employer';
  if (path.startsWith('/admin')) return 'admin';
  return 'worker';
}

function isActive(href: string, loc: string) {
  if (href === '/' ) return loc === '/' || loc.startsWith('/jobs');
  if (href === '/employer' || href === '/admin') return loc === href;
  return loc.startsWith(href);
}

export function Wordmark({ dark }: { dark?: boolean }) {
  return (
    <Link href="/welcome" className="flex items-center gap-2" data-testid="link-home-logo">
      <span className="flex h-8 overflow-hidden rounded-[5px] border-2 border-foreground/85 bg-plate">
        <span className="w-1.5 bg-primary" />
        <span className="flex items-center px-1.5 font-mono text-[11px] font-bold text-accent-foreground">FW</span>
      </span>
      <span className={cn('font-display text-xl font-extrabold tracking-tight', dark && 'text-sidebar-foreground')}>
        Fleet<span className="text-primary">Wala</span>
      </span>
    </Link>
  );
}

export function PilotChip() {
  if (liveMode) {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-2.5 py-1 font-mono text-[10px] font-medium uppercase tracking-wider text-emerald-600 dark:text-emerald-400" data-testid="status-live" title="Connected to Supabase live database.">
        <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />Live Network
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full border border-plate/70 bg-plate/20 px-2.5 py-1 font-mono text-[10px] font-medium uppercase tracking-wider text-accent-foreground" data-testid="status-pilot" title="All data is sample data stored only in this browser.">
      <span className="h-1.5 w-1.5 rounded-full bg-chart-4" />Pilot preview · sample data
    </span>
  );
}

export function Shell({ children }: { children: ReactNode }) {
  const [loc, navigate] = useLocation();
  const ws = workspaceFor(loc);
  const { state, online, loadError, actions } = usePilot();
  const { session } = useSession();
  const unread = state.notifications.filter((n) => !n.read).length;
  const nav = NAV[ws];
  const dark = ws !== 'worker';

  return (
    <div className="min-h-[100dvh] bg-background">
      <header className="sticky top-0 z-40 border-b bg-background/90 backdrop-blur">
        <div className="mx-auto flex h-14 max-w-[1400px] items-center gap-3 px-4">
          <Wordmark />
          <div className="hidden sm:block"><PilotChip /></div>
          <div className="ml-auto flex items-center gap-1.5">
            {!online && (
              <span className="inline-flex items-center gap-1 rounded-full bg-destructive/10 px-2 py-1 text-xs font-medium text-destructive" data-testid="status-offline">
                <WifiOff className="h-3.5 w-3.5" />Offline
              </span>
            )}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="sm" className="gap-1.5" data-testid="button-workspace-switcher">
                  <ShieldCheck className="h-4 w-4 text-primary" />{LABEL[ws]}<ChevronDown className="h-3.5 w-3.5 opacity-60" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-72">
                <DropdownMenuLabel className="text-xs font-normal text-muted-foreground">
                  {session ? (
                    <span>
                      <strong className="text-foreground">Signed in:</strong> {session.user?.email}<br />
                      <strong className="text-foreground">Account Role:</strong> {String(session.user?.user_metadata?.role ?? 'Worker')}<br />
                      <span className="text-[10px] text-muted-foreground mt-1 block">
                        Server-side RLS controls live access. View switcher only toggles navigation.
                      </span>
                    </span>
                  ) : (
                    <span>Pre-Production view switcher. Sign in to access your verified account.</span>
                  )}
                </DropdownMenuLabel>
                <DropdownMenuSeparator />
                {(['worker', 'employer', 'admin'] as Workspace[]).map((w) => (
                  <DropdownMenuItem key={w} onSelect={() => navigate(w === 'worker' ? '/' : `/${w}`)} data-testid={`menu-workspace-${w}`}>
                    <span className={cn('mr-2 h-2 w-2 rounded-full', w === ws ? 'bg-plate' : 'bg-muted')} />
                    {LABEL[w]} workspace {session && session.user?.user_metadata?.role !== w ? '(view only)' : ''}
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
            {ws === 'worker' && (
              <Link href="/notifications" aria-label={`Notifications, ${unread} unread`} className="relative rounded-full p-2 hover:bg-muted" data-testid="link-notifications">
                <Bell className="h-5 w-5" />
                {unread > 0 && <span className="absolute right-1 top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-chart-4 px-1 text-[10px] font-bold text-white">{unread}</span>}
              </Link>
            )}
            {!session ? (
              <Link href="/login" className="hidden items-center gap-1 rounded-md px-2 py-1.5 text-sm font-medium hover:bg-muted md:inline-flex" data-testid="link-login">
                <LogIn className="h-4 w-4" />Sign in
              </Link>
            ) : (
              <Link href="/login" className="hidden items-center gap-1 rounded-md px-2 py-1.5 text-xs font-medium hover:bg-muted md:inline-flex" data-testid="link-account">
                <UserRound className="h-3.5 w-3.5" />Account
              </Link>
            )}
          </div>
        </div>
        <div className="border-t border-dashed px-4 py-1 text-center sm:hidden"><PilotChip /></div>
        {session && (
          <div className="border-t bg-plate/15 px-4 py-1.5 text-center text-xs" data-testid="status-signed-in-pilot">
            Signed in as <span className="font-semibold">{session.user?.email}</span> ({String(session.user?.user_metadata?.role ?? 'Worker')}). Staging integration active.
          </div>
        )}
        {loadError && (
          <div role="alert" className="flex items-center justify-center gap-3 border-t bg-destructive/10 px-4 py-2 text-xs">
            Saved pilot data could not be read. Fresh sample data is loaded.
            <button className="font-semibold underline" onClick={actions.reset} data-testid="button-reset-corrupt">Reset storage</button>
            <button className="underline" onClick={actions.dismissError}>Dismiss</button>
          </div>
        )}
      </header>

      <div className="mx-auto flex max-w-[1400px]">
        <aside className={cn('sticky top-14 hidden h-[calc(100dvh-3.5rem)] w-60 shrink-0 flex-col md:flex', dark ? 'tarmac-grid bg-sidebar text-sidebar-foreground' : 'border-r')}>
          <p className={cn('px-5 pb-2 pt-6 font-mono text-[10px] uppercase tracking-[0.2em]', dark ? 'text-sidebar-foreground/50' : 'text-muted-foreground')}>
            {LABEL[ws]} workspace
          </p>
          <nav className="flex flex-col gap-0.5 px-3" aria-label={`${LABEL[ws]} navigation`}>
            {nav.map((n) => {
              const active = isActive(n.href, loc);
              return (
                <Link key={n.href} href={n.href} data-testid={`nav-${n.href.replace(/\//g, '-') || 'home'}`}
                  className={cn('group flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors',
                    dark ? (active ? 'bg-sidebar-primary text-sidebar-primary-foreground' : 'text-sidebar-foreground/75 hover:bg-sidebar-accent hover:text-sidebar-foreground')
                      : (active ? 'bg-foreground text-background' : 'text-foreground/75 hover:bg-muted'))}>
                  <n.icon className="h-4 w-4" />{n.label}
                  {n.href === '/notifications' && unread > 0 && <span className="ml-auto rounded-full bg-chart-4 px-1.5 text-[10px] font-bold text-white">{unread}</span>}
                </Link>
              );
            })}
          </nav>
          <div className="mt-auto px-5 pb-5">
            <div className={cn('mb-3 overflow-hidden', dark ? 'opacity-60' : 'opacity-80')}><div className="road-dash" /></div>
            <div className={cn('flex flex-wrap gap-x-3 gap-y-1 text-[11px]', dark ? 'text-sidebar-foreground/55' : 'text-muted-foreground')}>
              <Link href="/legal/terms" className="hover:underline">Terms (draft)</Link>
              <Link href="/legal/privacy" className="hover:underline">Privacy (draft)</Link>
              <Link href="/welcome" className="hover:underline">About</Link>
            </div>
          </div>
        </aside>

        <div className="min-w-0 flex-1">
          {ws !== 'worker' && (
            <nav className="scrollbar-none flex gap-1 overflow-x-auto border-b bg-sidebar px-3 py-2 md:hidden" aria-label="Section navigation">
              {nav.map((n) => (
                <Link key={n.href} href={n.href} className={cn('shrink-0 rounded-md px-3 py-1.5 text-xs font-medium', isActive(n.href, loc) ? 'bg-sidebar-primary text-sidebar-primary-foreground' : 'text-sidebar-foreground/75')}>
                  {n.label}
                </Link>
              ))}
            </nav>
          )}
          <main className={cn('px-4 py-6 md:px-8 md:py-8', ws === 'worker' && 'pb-28 md:pb-8')}>{children}</main>
        </div>
      </div>

      {ws === 'worker' && (
        <nav className="fixed inset-x-0 bottom-0 z-40 grid grid-cols-5 border-t bg-card/95 pb-[env(safe-area-inset-bottom)] backdrop-blur md:hidden" aria-label="Worker navigation">
          {nav.slice(0, 5).map((n) => {
            const active = isActive(n.href, loc);
            return (
              <Link key={n.href} href={n.href} className={cn('flex flex-col items-center gap-0.5 py-2 text-[11px] font-medium', active ? 'text-primary' : 'text-muted-foreground')} data-testid={`tab-${n.label.toLowerCase().replace(/\s/g, '-')}`}>
                <span className={cn('rounded-full px-3 py-1 transition-colors', active && 'bg-plate/50')}><n.icon className="h-5 w-5" /></span>
                {n.short ?? n.label}
              </Link>
            );
          })}
        </nav>
      )}
    </div>
  );
}
