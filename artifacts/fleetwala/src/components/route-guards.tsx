import { type ReactNode } from 'react';
import { Link } from 'wouter';
import { ShieldOff, Building2, ArrowRight, Loader2, LogIn } from 'lucide-react';
import { useAuth } from '@/lib/auth-context';

export function AdminAccessDenied() {
  return (
    <div className="mx-auto max-w-lg py-16 text-center px-4" data-testid="view-admin-denied">
      <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-destructive/10 text-destructive">
        <ShieldOff className="h-7 w-7" />
      </div>
      <h1 className="text-2xl font-bold tracking-tight text-foreground" data-testid="heading-admin-denied">
        Administrator Access Denied
      </h1>
      <p className="mt-2 text-sm text-muted-foreground leading-relaxed">
        Your account is not an allowlisted administrator in <code>public.admin_principals</code>. Administrative privileges are enforced via PostgreSQL Row Level Security and cannot be granted via client-side navigation.
      </p>
      <div className="mt-6 flex justify-center gap-3">
        <Link href="/" className="inline-flex h-9 items-center justify-center rounded-md bg-primary px-4 text-xs font-semibold text-primary-foreground hover:bg-primary/90">
          Return to home
        </Link>
        <Link href="/login" className="inline-flex h-9 items-center justify-center gap-1.5 rounded-md border border-border px-4 text-xs font-semibold hover:bg-muted">
          <LogIn className="h-3.5 w-3.5" />Sign in as Admin
        </Link>
      </div>
    </div>
  );
}

export function EmployerAccessDenied() {
  return (
    <div className="mx-auto max-w-lg py-16 text-center px-4" data-testid="view-employer-denied">
      <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-primary/10 text-primary">
        <Building2 className="h-7 w-7" />
      </div>
      <h1 className="text-2xl font-bold tracking-tight text-foreground" data-testid="heading-employer-denied">
        Employer Workspace
      </h1>
      <p className="mt-2 text-sm text-muted-foreground leading-relaxed">
        To access hiring tools, manage jobs, and review candidate applications, sign in with your verified employer account or register a new company.
      </p>
      <div className="mt-6 flex flex-wrap justify-center gap-3">
        <Link href="/login" className="inline-flex h-9 items-center justify-center gap-1.5 rounded-md bg-primary px-4 text-xs font-semibold text-primary-foreground hover:bg-primary/90">
          <LogIn className="h-3.5 w-3.5" />Sign in
        </Link>
        <Link href="/onboarding/employer" className="inline-flex h-9 items-center justify-center gap-1.5 rounded-md border border-border px-4 text-xs font-semibold hover:bg-muted">
          Register company <ArrowRight className="h-3.5 w-3.5" />
        </Link>
      </div>
    </div>
  );
}

export function AuthLoadingScreen() {
  return (
    <div className="flex min-h-[50vh] items-center justify-center p-8">
      <div className="flex flex-col items-center gap-3 text-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
        <p className="text-sm text-muted-foreground">Verifying account credentials...</p>
      </div>
    </div>
  );
}

export function ProtectedAdminRoute({ children }: { children: ReactNode }) {
  const { ready, session, roleStatus } = useAuth();

  if (!ready) {
    return <AuthLoadingScreen />;
  }

  if (!session || !roleStatus.isAdmin) {
    return <AdminAccessDenied />;
  }

  return <>{children}</>;
}

export function ProtectedEmployerRoute({ children }: { children: ReactNode }) {
  const { ready, session, roleStatus } = useAuth();

  if (!ready) {
    return <AuthLoadingScreen />;
  }

  if (!session) {
    return <EmployerAccessDenied />;
  }

  // Admins can inspect employer workspace
  if (roleStatus.isAdmin) {
    return <>{children}</>;
  }

  if (roleStatus.isEmployer && !roleStatus.employerOrg) {
    return <EmployerAccessDenied />;
  }

  if (!roleStatus.isEmployer && !roleStatus.employerOrg) {
    return <EmployerAccessDenied />;
  }

  return <>{children}</>;
}

export function ProtectedWorkerRoute({ children }: { children: ReactNode }) {
  const { ready, session } = useAuth();

  if (!ready) {
    return <AuthLoadingScreen />;
  }

  if (!session) {
    return (
      <div className="mx-auto max-w-lg py-16 text-center px-4">
        <h1 className="text-2xl font-bold tracking-tight">Sign In Required</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Please sign in or create an account to view your saved jobs, applications, and profile.
        </p>
        <div className="mt-6 flex justify-center gap-3">
          <Link href="/login" className="inline-flex h-9 items-center justify-center rounded-md bg-primary px-4 text-xs font-semibold text-primary-foreground">
            Sign in
          </Link>
          <Link href="/signup" className="inline-flex h-9 items-center justify-center rounded-md border border-border px-4 text-xs font-semibold hover:bg-muted">
            Create account
          </Link>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}
