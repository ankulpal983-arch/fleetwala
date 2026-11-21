import { type ReactNode, useEffect } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Route, Switch, useLocation, Router as WouterRouter } from 'wouter';
import { ErrorBoundary } from '@/components/error-boundary';
import { Toaster } from '@/components/ui/toaster';
import { TooltipProvider } from '@/components/ui/tooltip';
import NotFound from '@/pages/not-found';
import { Shell } from '@/components/shell';
import { PilotProvider } from '@/lib/store';
import { gate } from '@/lib/supabase';
import { FindJobs, JobDetail, SavedJobs } from '@/pages/worker-jobs';
import { Applications, Messages, Notifications, Profile, SettingsPage, Support } from '@/pages/worker-more';
import { EmployerApplicants, EmployerBilling, EmployerCandidates, EmployerJobs, EmployerOverview, EmployerTeam } from '@/pages/employer';
import { AdminAudit, AdminEmployers, AdminJobs, AdminOverview, AdminSupport } from '@/pages/admin';
import { Legal, LiveSetup, Login, Welcome } from '@/pages/public';

const queryClient = new QueryClient();

function isPublic(loc: string) {
  return loc === '/welcome' || loc === '/login' || loc.startsWith('/legal');
}

function Router() {
  const [loc] = useLocation();
  useEffect(() => {
    const titles: Record<string, string> = {
      '/': 'Find local jobs', '/saved': 'Saved jobs', '/applications': 'My applications',
      '/messages': 'Messages', '/notifications': 'Notifications', '/profile': 'My profile',
      '/settings': 'Privacy and settings', '/support': 'Help and safety',
      '/employer': 'Hiring overview', '/employer/jobs': 'Manage jobs',
      '/employer/applicants': 'Applicants', '/employer/candidates': 'Anonymous candidates',
      '/employer/billing': 'Billing disabled', '/employer/team': 'Employer team',
      '/admin': 'Trust overview', '/admin/jobs': 'Job moderation',
      '/admin/employers': 'Employer verification', '/admin/audit': 'Audit log',
      '/admin/support': 'Support queue', '/welcome': 'Local logistics hiring',
      '/login': 'Sign in', '/legal/terms': 'Draft terms', '/legal/privacy': 'Draft privacy policy',
    };
    const title = `${titles[loc] ?? (loc.startsWith('/jobs/') ? 'Job details' : 'Page not found')} · FleetWala pilot`;
    document.title = title;
    document.querySelector('meta[property="og:title"]')?.setAttribute('content', title);
    document.querySelector('meta[name="description"]')?.setAttribute(
      'content', `${titles[loc] ?? 'Local logistics hiring'} in the FleetWala sample-data pilot. No live recruitment or payments.`,
    );
  }, [loc]);
  if (isPublic(loc)) {
    return (
      <RoutedErrorBoundary>
        <Switch>
          <Route path="/welcome" component={Welcome} />
          <Route path="/login" component={Login} />
          <Route path="/legal/:doc" component={Legal} />
          <Route component={NotFound} />
        </Switch>
      </RoutedErrorBoundary>
    );
  }
  // Fail closed: live mode requested but live data is not wired.
  if (gate.blocked || gate.showLiveData) return <LiveSetup />;
  return (
    <Shell>
      <RoutedErrorBoundary>
        <Switch>
          <Route path="/" component={FindJobs} />
          <Route path="/jobs/:id" component={JobDetail} />
          <Route path="/saved" component={SavedJobs} />
          <Route path="/applications" component={Applications} />
          <Route path="/messages" component={Messages} />
          <Route path="/notifications" component={Notifications} />
          <Route path="/profile" component={Profile} />
          <Route path="/settings" component={SettingsPage} />
          <Route path="/support" component={Support} />
          <Route path="/employer" component={EmployerOverview} />
          <Route path="/employer/jobs" component={EmployerJobs} />
          <Route path="/employer/applicants" component={EmployerApplicants} />
          <Route path="/employer/candidates" component={EmployerCandidates} />
          <Route path="/employer/billing" component={EmployerBilling} />
          <Route path="/employer/team" component={EmployerTeam} />
          <Route path="/admin" component={AdminOverview} />
          <Route path="/admin/jobs" component={AdminJobs} />
          <Route path="/admin/employers" component={AdminEmployers} />
          <Route path="/admin/audit" component={AdminAudit} />
          <Route path="/admin/support" component={AdminSupport} />
          <Route component={NotFound} />
        </Switch>
      </RoutedErrorBoundary>
    </Shell>
  );
}

function RoutedErrorBoundary({ children }: { children: ReactNode }) {
  const [location] = useLocation();
  return <ErrorBoundary resetKey={location}>{children}</ErrorBoundary>;
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <PilotProvider>
          <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, '')}>
            <Router />
          </WouterRouter>
          <Toaster />
        </PilotProvider>
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
