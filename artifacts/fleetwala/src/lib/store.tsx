import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { makeEmptyState } from './fixtures';
import { uid } from './format';
import { DAILY_LIMIT, canApplyToday, countToday, isLiveJob } from './rules';
import type {
  AppStatus, EmployerStatus, Job, JobStatus, PilotState, Prefs, TeamMember, Ticket, TicketStatus, WorkerProfile,
} from './types';

export const STORAGE_KEY = 'fleetwala.store.v2';
export { DAILY_LIMIT };

function load(): { state: PilotState; error: boolean } {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return { state: makeEmptyState(), error: false };
    const parsed = JSON.parse(raw) as PilotState;
    if (parsed?.version !== 1 || !Array.isArray(parsed.jobs)) throw new Error('shape');
    return { state: parsed, error: false };
  } catch {
    return { state: makeEmptyState(), error: false };
  }
}

type Result = { ok: boolean; message: string };
export type JobInput = Omit<Job, 'id' | 'created_at' | 'status' | 'employer_id' | 'company'>;

interface Ctx {
  state: PilotState;
  loadError: boolean;
  online: boolean;
  usageToday: number;
  actions: {
    toggleSave: (id: string) => boolean;
    apply: (jobId: string) => Result;
    withdraw: (appId: string) => void;
    updateProfile: (p: Partial<WorkerProfile>) => void;
    setPrefs: (p: Partial<Prefs>) => void;
    markNotice: (id: string) => void;
    markAllNotices: () => void;
    sendMessage: (threadId: string, text: string) => void;
    saveJob: (input: JobInput, employerId: string, company: string, id?: string) => string;
    setJobStatus: (id: string, status: JobStatus, actor: string, note?: string) => void;
    deleteJob: (id: string) => void;
    setAppStatus: (appId: string, status: AppStatus) => void;
    setEmployerStatus: (id: string, status: EmployerStatus) => void;
    createTicket: (t: Pick<Ticket, 'subject' | 'body' | 'topic' | 'from'>) => void;
    setTicketStatus: (id: string, s: TicketStatus) => void;
    inviteMember: (name: string, role: TeamMember['role']) => void;
    removeMember: (id: string) => void;
    reset: () => void;
    dismissError: () => void;
  };
}

const PilotCtx = createContext<Ctx | null>(null);

export function PilotProvider({ children }: { children: ReactNode }) {
  const initial = useMemo(load, []);
  const [state, setState] = useState<PilotState>(initial.state);
  const [loadError, setLoadError] = useState(initial.error);
  const [online, setOnline] = useState(typeof navigator === 'undefined' ? true : navigator.onLine);
  const ref = useRef(state);
  ref.current = state;

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    } catch {
      /* storage full or blocked: pilot keeps working in memory */
    }
  }, [state]);

  useEffect(() => {
    const on = () => setOnline(true);
    const off = () => setOnline(false);
    window.addEventListener('online', on);
    window.addEventListener('offline', off);
    return () => {
      window.removeEventListener('online', on);
      window.removeEventListener('offline', off);
    };
  }, []);

  const usageToday = countToday(state.applications, 'me');

  const log = useCallback((actor: string, action: string, target: string) => {
    setState((s) => ({ ...s, audit: [{ id: uid('au'), at: new Date().toISOString(), actor, action, target }, ...s.audit] }));
  }, []);

  const actions = useMemo<Ctx['actions']>(() => ({
    toggleSave: (id) => {
      const has = ref.current.saved.includes(id);
      setState((s) => ({ ...s, saved: has ? s.saved.filter((x) => x !== id) : [id, ...s.saved] }));
      return !has;
    },
    apply: (jobId) => {
      const s = ref.current;
      const job = s.jobs.find((j) => j.id === jobId);
      if (!job || !isLiveJob(job)) return { ok: false, message: 'This job is not accepting applications right now.' };
      const existing = s.applications.find((a) => a.job_id === jobId && a.candidate_id === 'me' && a.status !== 'withdrawn');
      if (existing) return { ok: false, message: 'You have already applied to this job.' };
      if (!canApplyToday(countToday(s.applications, 'me'))) return { ok: false, message: `Daily limit of ${DAILY_LIMIT} reached (IST). Demo-only counter, resets at midnight IST.` };
      const at = new Date().toISOString();
      setState((p) => ({
        ...p,
        applications: [{ id: uid('app'), job_id: jobId, candidate_id: 'me', status: 'applied', created_at: at, history: [{ status: 'applied', at }] }, ...p.applications],
        notifications: [{ id: uid('n'), title: `Applied: ${job.title}`, body: `${job.company} will see your first name, area, experience and vehicle only.`, at, read: false, href: '/applications' }, ...p.notifications],
      }));
      return { ok: true, message: `Sent to ${job.company}. Track it under Applications.` };
    },
    withdraw: (appId) => {
      const at = new Date().toISOString();
      setState((s) => ({
        ...s,
        applications: s.applications.map((a) => (a.id === appId ? { ...a, status: 'withdrawn', history: [...a.history, { status: 'withdrawn', at }] } : a)),
      }));
    },
    updateProfile: (p) => setState((s) => ({ ...s, profile: { ...s.profile, ...p } })),
    setPrefs: (p) => setState((s) => ({ ...s, prefs: { ...s.prefs, ...p } })),
    markNotice: (id) => setState((s) => ({ ...s, notifications: s.notifications.map((n) => (n.id === id ? { ...n, read: true } : n)) })),
    markAllNotices: () => setState((s) => ({ ...s, notifications: s.notifications.map((n) => ({ ...n, read: true })) })),
    sendMessage: (threadId, text) =>
      setState((s) => ({
        ...s,
        threads: s.threads.map((t) => (t.id === threadId ? { ...t, messages: [...t.messages, { id: uid('m'), from: 'me', text, at: new Date().toISOString() }] } : t)),
      })),
    saveJob: (input, employerId, company, id) => {
      const newId = id ?? `job-${Date.now().toString(36)}`;
      setState((s) => {
        if (id) return { ...s, jobs: s.jobs.map((j) => (j.id === id ? { ...j, ...input } : j)) };
        const job: Job = { ...input, id: newId, employer_id: employerId, company, status: 'draft', created_at: new Date().toISOString() };
        return { ...s, jobs: [job, ...s.jobs] };
      });
      log(company, id ? 'job.edit' : 'job.create_draft', input.title);
      return newId;
    },
    setJobStatus: (id, status, actor, note) => {
      const job = ref.current.jobs.find((j) => j.id === id);
      setState((s) => ({ ...s, jobs: s.jobs.map((j) => (j.id === id ? { ...j, status, moderation_note: note ?? j.moderation_note } : j)) }));
      if (job) log(actor, `job.${status === 'pending' ? 'submit' : status}`, job.title);
    },
    deleteJob: (id) => {
      const job = ref.current.jobs.find((j) => j.id === id);
      setState((s) => ({ ...s, jobs: s.jobs.filter((j) => j.id !== id), saved: s.saved.filter((x) => x !== id) }));
      if (job) log(job.company, 'job.delete_draft', job.title);
    },
    setAppStatus: (appId, status) => {
      const at = new Date().toISOString();
      setState((s) => ({
        ...s,
        applications: s.applications.map((a) => (a.id === appId ? { ...a, status, history: [...a.history, { status, at }] } : a)),
      }));
    },
    setEmployerStatus: (id, status) => {
      const emp = ref.current.employers.find((e) => e.id === id);
      setState((s) => ({ ...s, employers: s.employers.map((e) => (e.id === id ? { ...e, status } : e)) }));
      if (emp) log('Pilot admin', `employer.${status === 'verified' ? 'verify' : status === 'suspended' ? 'suspend' : 'unverify'}`, emp.name);
    },
    createTicket: (t) =>
      setState((s) => ({ ...s, tickets: [{ ...t, id: uid('tk'), status: 'open', created_at: new Date().toISOString() }, ...s.tickets] })),
    setTicketStatus: (id, st) => {
      const tk = ref.current.tickets.find((t) => t.id === id);
      setState((s) => ({ ...s, tickets: s.tickets.map((t) => (t.id === id ? { ...t, status: st } : t)) }));
      if (tk) log('Pilot admin', `ticket.${st}`, tk.subject);
    },
    inviteMember: (name, role) => {
      setState((s) => ({ ...s, team: [...s.team, { id: uid('tm'), name, role, status: 'invited' }] }));
      log('Ghar-Tak Parcels', 'team.invite', name);
    },
    removeMember: (id) => setState((s) => ({ ...s, team: s.team.filter((m) => m.id !== id) })),
    reset: () => {
      setState(makeEmptyState());
      setLoadError(false);
    },
    dismissError: () => setLoadError(false),
  }), [log]);

  return (
    <PilotCtx.Provider value={{ state, loadError, online, usageToday, actions }}>{children}</PilotCtx.Provider>
  );
}

export function usePilot() {
  const c = useContext(PilotCtx);
  if (!c) throw new Error('usePilot outside PilotProvider');
  return c;
}

export function profileProgress(p: WorkerProfile) {
  const checks = [
    { label: 'First name', done: p.first_name.trim().length > 1 },
    { label: 'City', done: !!p.city },
    { label: 'Area', done: p.area.trim().length > 1 },
    { label: 'Experience', done: !!p.experience },
    { label: 'Vehicle', done: !!p.vehicle },
    { label: 'Availability set', done: p.available },
  ];
  const done = checks.filter((c) => c.done).length;
  return { pct: Math.round((done / checks.length) * 100), checks };
}
