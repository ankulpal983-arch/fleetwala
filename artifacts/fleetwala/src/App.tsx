import { type ReactNode, useEffect } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Route, Switch, useLocation, Router as WouterRouter, Redirect } from 'wouter';
import { ErrorBoundary } from '@/components/error-boundary';
import { Toaster } from '@/components/ui/toaster';
import { TooltipProvider } from '@/components/ui/tooltip';
import NotFound from '@/pages/not-found';
import { Shell } from '@/components/shell';
import { PilotProvider } from '@/lib/store';
import { AuthProvider, useAuth } from '@/lib/auth-context';
import { gate } from '@/lib/supabase';

import { ProtectedAdminRoute, ProtectedEmployerRoute, ProtectedWorkerRoute } from '@/components/route-guards';
import { FindJobs, JobDetail, SavedJobs } from '@/pages/worker-jobs';
import { Applications, Messages, Notifications, Profile, SettingsPage, Support } from '@/pages/worker-more';
import { EmployerApplicants, EmployerBilling, EmployerCandidates, EmployerJobs, EmployerOverview, EmployerTeam, EmployerMessages } from '@/pages/employer';
import { AdminAudit, AdminEmployers, AdminJobs, AdminOverview, AdminSupport } from '@/pages/admin';
import { Legal, LiveSetup, Welcome } from '@/pages/public';
import { PrivacyPage, TermsPage, SupportPage, HelpPage } from '@/pages/legal';
import { LoginPage } from '@/pages/auth/login';
import { SignupPage } from '@/pages/auth/signup';
import { VerifyEmailPage } from '@/pages/auth/verify-email';
import { ForgotPasswordPage } from '@/pages/auth/forgot-password';
import { ResetPasswordPage } from '@/pages/auth/reset-password';
import { AuthCallbackPage } from '@/pages/auth/callback';
import { WorkerOnboardingPage } from '@/pages/onboarding/worker-onboarding';
import { EmployerOnboardingPage } from '@/pages/onboarding/employer-onboarding';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      refetchOnWindowFocus: false,
      staleTime: 30000,
    },
  },
});

function isPublic(loc: string) {
  return (
    loc === '/welcome' ||
    loc === '/login' ||
    loc === '/signup' ||
    loc === '/verify-email' ||
    loc === '/forgot-password' ||
    loc === '/reset-password' ||
    loc === '/auth/callback' ||
    loc === '/onboarding/worker' ||
    loc === '/onboarding/employer' ||
    loc === '/privacy' ||
    loc === '/terms' ||
    loc === '/support' ||
    loc === '/contact' ||
    loc === '/help' ||
    loc === '/faq' ||
    loc.startsWith('/legal')
  );
}

function RootIndexRoute() {
  const { session, roleStatus } = useAuth();
  if (session && roleStatus.isAdmin) {
    return <Redirect to="/admin" />;
  }
  if (session && (roleStatus.isEmployer || roleStatus.employerOrg)) {
    return <Redirect to="/employer" />;
  }
  return <FindJobs />;
}

function Router() {
  const [loc] = useLocation();
  useEffect(() => {
    const titles: Record<string, string> = {
      '/': 'Find local jobs', '/worker': 'Worker dashboard', '/saved': 'Saved jobs', '/applications': 'My applications',

      '/messages': 'Messages', '/notifications': 'Notifications', '/profile': 'My profile',
      '/settings': 'Privacy and settings', '/support': 'Help, grievance and safety',
      '/contact': 'Contact support', '/help': 'Help center', '/faq': 'Frequently asked questions',
      '/employer': 'Hiring overview', '/employer/jobs': 'Manage jobs',
      '/employer/applicants': 'Applicants', '/employer/candidates': 'Candidate discovery',
      '/employer/billing': 'Billing policy', '/employer/team': 'Employer team',
      '/employer/messages': 'Employer messages',
      '/admin': 'Trust overview', '/admin/jobs': 'Job moderation',
      '/admin/employers': 'Employer verification', '/admin/audit': 'Audit log',
      '/admin/support': 'Support queue', '/welcome': 'Local logistics hiring',
      '/login': 'Sign in', '/signup': 'Create account', '/verify-email': 'Verify your email',
      '/forgot-password': 'Reset password', '/reset-password': 'Set new password',
      '/auth/callback': 'Signing in', '/onboarding/worker': 'Worker setup',
      '/onboarding/employer': 'Employer setup', '/terms': 'Terms of service',
      '/privacy': 'Privacy policy', '/legal/terms': 'Terms of service',
      '/legal/privacy': 'Privacy policy',
    };
    const title = `${titles[loc] ?? (loc.startsWith('/jobs/') ? 'Job details' : 'Page not found')} · FleetWala`;
    document.title = title;
    document.querySelector('meta[property="og:title"]')?.setAttribute('content', title);
    document.querySelector('meta[name="description"]')?.setAttribute(
      'content', `${titles[loc] ?? 'Local logistics hiring'} on FleetWala. India's verified logistics hiring network.`,
    );
  }, [loc]);

  if (isPublic(loc)) {
    return (
      <RoutedErrorBoundary>
        <Switch>
          <Route path="/welcome" component={Welcome} />
          <Route path="/login" component={LoginPage} />
          <Route path="/signup" component={SignupPage} />
          <Route path="/verify-email" component={VerifyEmailPage} />
          <Route path="/forgot-password" component={ForgotPasswordPage} />
          <Route path="/reset-password" component={ResetPasswordPage} />
          <Route path="/auth/callback" component={AuthCallbackPage} />
          <Route path="/onboarding/worker" component={WorkerOnboardingPage} />
          <Route path="/onboarding/employer" component={EmployerOnboardingPage} />
          <Route path="/privacy" component={PrivacyPage} />
          <Route path="/terms" component={TermsPage} />
          <Route path="/support" component={SupportPage} />
          <Route path="/contact" component={SupportPage} />
          <Route path="/help" component={HelpPage} />
          <Route path="/faq" component={HelpPage} />
          <Route path="/legal/:doc" component={Legal} />
          <Route component={NotFound} />
        </Switch>
      </RoutedErrorBoundary>
    );
  }

  // Fail closed: live mode requested but live data or config is not ready.
  if (gate.blocked) return <LiveSetup />;

  return (
    <Shell>
      <RoutedErrorBoundary>
        <Switch>
          <Route path="/" component={RootIndexRoute} />
          <Route path="/worker">
            <ProtectedWorkerRoute><FindJobs /></ProtectedWorkerRoute>
          </Route>
          <Route path="/jobs/:id" component={JobDetail} />

          {/* Protected Worker Routes */}
          <Route path="/saved">
            <ProtectedWorkerRoute><SavedJobs /></ProtectedWorkerRoute>
          </Route>
          <Route path="/applications">
            <ProtectedWorkerRoute><Applications /></ProtectedWorkerRoute>
          </Route>
          <Route path="/messages">
            <ProtectedWorkerRoute><Messages /></ProtectedWorkerRoute>
          </Route>
          <Route path="/notifications">
            <ProtectedWorkerRoute><Notifications /></ProtectedWorkerRoute>
          </Route>
          <Route path="/profile">
            <ProtectedWorkerRoute><Profile /></ProtectedWorkerRoute>
          </Route>
          <Route path="/settings">
            <ProtectedWorkerRoute><SettingsPage /></ProtectedWorkerRoute>
          </Route>

          {/* Protected Employer Routes */}
          <Route path="/employer">
            <ProtectedEmployerRoute><EmployerOverview /></ProtectedEmployerRoute>
          </Route>
          <Route path="/employer/jobs">
            <ProtectedEmployerRoute><EmployerJobs /></ProtectedEmployerRoute>
          </Route>
          <Route path="/employer/applicants">
            <ProtectedEmployerRoute><EmployerApplicants /></ProtectedEmployerRoute>
          </Route>
          <Route path="/employer/candidates">
            <ProtectedEmployerRoute><EmployerCandidates /></ProtectedEmployerRoute>
          </Route>
          <Route path="/employer/billing">
            <ProtectedEmployerRoute><EmployerBilling /></ProtectedEmployerRoute>
          </Route>
          <Route path="/employer/team">
            <ProtectedEmployerRoute><EmployerTeam /></ProtectedEmployerRoute>
          </Route>
          <Route path="/employer/messages">
            <ProtectedEmployerRoute><EmployerMessages /></ProtectedEmployerRoute>
          </Route>

          {/* Protected Admin Routes */}
          <Route path="/admin">
            <ProtectedAdminRoute><AdminOverview /></ProtectedAdminRoute>
          </Route>
          <Route path="/admin/jobs">
            <ProtectedAdminRoute><AdminJobs /></ProtectedAdminRoute>
          </Route>
          <Route path="/admin/employers">
            <ProtectedAdminRoute><AdminEmployers /></ProtectedAdminRoute>
          </Route>
          <Route path="/admin/audit">
            <ProtectedAdminRoute><AdminAudit /></ProtectedAdminRoute>
          </Route>
          <Route path="/admin/support">
            <ProtectedAdminRoute><AdminSupport /></ProtectedAdminRoute>
          </Route>

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
            <AuthProvider>
              <Router />
              <Toaster />
            </AuthProvider>
          </WouterRouter>
        </PilotProvider>
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
