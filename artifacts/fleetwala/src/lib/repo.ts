/**
 * FleetWala Staging Repository Layer
 * Bridges UI components to Supabase PostgreSQL database & RLS-guarded RPCs when authenticated,
 * with honest fallback to the local pilot store when unauthenticated or exploring the sample pilot.
 */

import { getSupabase, supabaseConfigured } from './supabase';
import type { AppStatus, Application, Candidate, Employer, Job, JobStatus, Notice, Thread, WorkerProfile } from './types';
import type { JobInput } from './store';

export interface RepositoryResult<T = void> {
  ok: boolean;
  data?: T;
  error?: string;
}

/** Application status mapping between UI labels and PostgreSQL application_state enum */
export function toDbAppStatus(status: AppStatus): string {
  if (status === 'viewed') return 'reviewing';
  return status;
}

export function fromDbAppStatus(status?: string | null): AppStatus {
  if (!status) return 'applied';
  if (status === 'reviewing') return 'viewed';
  return status as AppStatus;
}

/** Job state mapping between UI status and PostgreSQL job_state enum */
export function toDbJobState(status: JobStatus): string {
  if (status === 'pending') return 'pending_review';
  if (status === 'approved') return 'published';
  return status;
}

export function fromDbJobState(state?: string | null): JobStatus {
  if (!state) return 'draft';
  if (state === 'pending_review') return 'pending';
  if (state === 'published') return 'approved';
  if (state === 'rejected') return 'draft';
  return state as JobStatus;
}

/** Experience band mapping between UI labels and PostgreSQL check constraint values */
export function toDbExperience(exp?: string): string | null {
  if (!exp) return null;
  const lower = exp.toLowerCase();
  if (lower.includes('fresh')) return 'fresher';
  if (lower.includes('0–1') || lower.includes('0-1')) return 'fresher';
  if (lower.includes('1–3') || lower.includes('1-3')) return '1-3';
  if (lower.includes('3+') || lower.includes('3-5')) return '3-5';
  if (lower.includes('5')) return '5+';
  return 'fresher';
}

export function fromDbExperience(band?: string | null): string {
  if (!band) return 'Fresher';
  if (band === 'fresher') return 'Fresher';
  if (band === '1-3') return '1–3 years';
  if (band === '3-5' || band === '5+') return '3+ years';
  return 'Fresher';
}

/** Vehicle type mapping between UI labels and PostgreSQL check constraint values */
export function toDbVehicle(v?: string): string | null {
  if (!v) return null;
  const lower = v.toLowerCase();
  if (lower.includes('two') || lower.includes('motorcycle')) return 'motorcycle';
  if (lower.includes('scooter')) return 'scooter';
  if (lower.includes('e-bike') || lower.includes('ev')) return 'ev';
  if (lower.includes('bicycle')) return 'bicycle';
  if (lower.includes('three')) return 'motorcycle';
  if (lower.includes('none')) return 'none';
  return 'none';
}

export function fromDbVehicle(v?: string | null): string {
  if (!v) return 'Two-wheeler';
  if (v === 'motorcycle' || v === 'scooter') return 'Two-wheeler';
  if (v === 'ev') return 'E-bike';
  if (v === 'bicycle') return 'Bicycle';
  if (v === 'none' || v === 'walking') return 'None needed';
  return 'Two-wheeler';
}

/** Check if live repository operations can be performed */
export function isLiveReady(): boolean {
  return supabaseConfigured && Boolean(getSupabase());
}

/** Fetch live published jobs from Supabase or returns null if pilot mode */
export async function getLiveJobs(): Promise<Job[] | null> {
  const c = getSupabase();
  if (!c) return null;

  const { data, error } = await c
    .from('jobs')
    .select('*')
    .eq('state', 'published')
    .order('created_at', { ascending: false });

  if (error || !data) {
    console.warn('[Repo] getLiveJobs error:', error?.message);
    return null;
  }

  return data.map((j) => ({
    id: j.id,
    employer_id: j.employer_id,
    title: j.title,
    company: 'Verified Logistics Partner',
    city: j.city,
    area: j.area || 'Central',
    category: j.category as any,
    min_salary: j.salary_min_inr || 18000,
    max_salary: j.salary_max_inr || 24000,
    shift: 'Morning & General',
    vehicle: j.requires_driving_licence ? 'Two-wheeler with licence' : 'Any vehicle',
    fuel_allowance: true,
    licence_required: j.requires_driving_licence || false,
    experience: '1-3 years',
    description: j.description,
    openings: 5,
    status: (j.state === 'published' ? 'approved' : j.state) as JobStatus,
    expires_at: j.expires_at || new Date(Date.now() + 30 * 86400000).toISOString(),
    created_at: j.created_at,
    moderation_note: j.review_note,
  }));
}

/** Fetch employer jobs from Supabase */
export async function getLiveEmployerJobs(employerId?: string): Promise<Job[] | null> {
  const c = getSupabase();
  if (!c) return null;

  let query = c
    .from('jobs')
    .select('*, employers(legal_name)')
    .order('created_at', { ascending: false });

  if (employerId) {
    query = query.eq('employer_id', employerId);
  }

  const { data, error } = await query;

  if (error || !data) {
    return null;
  }

  return data.map((j: any) => ({
    id: j.id,
    employer_id: j.employer_id,
    title: j.title,
    company: j.employers?.legal_name || 'My Organization',
    city: j.city,
    area: j.area || 'Central',
    category: j.category as any,
    min_salary: j.salary_min_inr || 18000,
    max_salary: j.salary_max_inr || 24000,
    shift: 'General',
    vehicle: j.requires_driving_licence ? 'Two-wheeler' : 'None needed',
    fuel_allowance: true,
    licence_required: j.requires_driving_licence || false,
    experience: '1–3 years',
    description: j.description,
    openings: 1,
    status: fromDbJobState(j.state),
    expires_at: j.expires_at || new Date(Date.now() + 30 * 86400000).toISOString(),
    created_at: j.created_at,
    moderation_note: j.review_note,
  }));
}

/** Apply to job using atomic backend RPC (enforces 20/day IST limit & row lock) */
export async function applyToLiveJob(jobId: string): Promise<RepositoryResult<{ applicationId: string; wasExisting: boolean }>> {
  const c = getSupabase();
  if (!c) return { ok: false, error: 'Database not connected. Operating in pilot mode.' };

  const { data, error } = await c.rpc('apply_to_job', { p_job_id: jobId });
  if (error) {
    return { ok: false, error: error.message };
  }

  const result = Array.isArray(data) ? data[0] : data;
  return {
    ok: true,
    data: {
      applicationId: result?.application_id,
      wasExisting: result?.was_existing,
    },
  };
}

/** Fetch worker profile from Supabase */
export async function getLiveWorkerProfile(): Promise<WorkerProfile | null> {
  const c = getSupabase();
  if (!c) return null;

  const { data: { user } } = await c.auth.getUser();
  if (!user) return null;

  const { data, error } = await c
    .from('workers')
    .select('*')
    .eq('user_id', user.id)
    .single();

  if (error || !data) return null;

  return {
    first_name: data.full_name ? data.full_name.split(' ')[0] : '',
    city: data.city || '',
    area: data.address_line || '',
    experience: fromDbExperience(data.experience_band),
    vehicle: fromDbVehicle(data.vehicle_type),
    own_vehicle: data.has_own_vehicle || false,
    available: data.availability !== 'unavailable',
    discoverable: data.discoverable || false,
  };
}

/** Upsert worker profile to Supabase via secure RPC with direct table fallback */
export async function saveLiveWorkerProfile(profile: Partial<WorkerProfile>): Promise<RepositoryResult> {
  const c = getSupabase();
  if (!c) return { ok: false, error: 'Database not connected.' };

  const { data: { user } } = await c.auth.getUser();
  if (!user) return { ok: false, error: 'User not authenticated.' };

  const fullName = (profile.first_name || user.user_metadata?.full_name || 'Worker').trim();
  const expBand = toDbExperience(profile.experience);
  const vehType = toDbVehicle(profile.vehicle);

  // 1. Try atomic secure save_worker_profile RPC
  try {
    const { error: rpcError } = await c.rpc('save_worker_profile', {
      p_full_name: fullName,
      p_city: profile.city || 'Bengaluru',
      p_address_line: profile.area || '',
      p_experience_band: expBand,
      p_vehicle_type: vehType,
      p_has_own_vehicle: profile.own_vehicle ?? false,
      p_discoverable: profile.discoverable ?? false,
      p_availability: profile.available ? 'immediate' : 'unavailable',
    });

    if (!rpcError) {
      return { ok: true };
    }
    console.warn('[Repo] save_worker_profile RPC returned error, attempting direct upsert:', rpcError.message);
  } catch (err) {
    console.warn('[Repo] save_worker_profile RPC failed:', err);
  }

  // 2. Direct table upsert fallback with RLS ownership
  const payload = {
    user_id: user.id,
    full_name: fullName,
    city: profile.city,
    address_line: profile.area,
    experience_band: expBand,
    vehicle_type: vehType,
    has_own_vehicle: profile.own_vehicle ?? false,
    discoverable: profile.discoverable ?? false,
    availability: profile.available ? 'immediate' : 'unavailable',
    account_state: 'active' as const,
  };

  const { error } = await c.from('workers').upsert(payload, { onConflict: 'user_id' });
  if (error) return { ok: false, error: error.message };
  return { ok: true };
}

/** Fetch active worker's real job applications from Supabase */
export async function getLiveApplications(): Promise<Application[] | null> {
  const c = getSupabase();
  if (!c) return null;

  const { data, error } = await c
    .from('job_applications')
    .select(`
      id,
      job_id,
      created_at,
      status_history:application_status_history(old_status, new_status, changed_at),
      job:jobs(id, title, city, area, employer_id, employers(legal_name))
    `)
    .order('created_at', { ascending: false });

  if (error || !data) {
    console.warn('[Repo] getLiveApplications error:', error?.message);
    return null;
  }

  return data.map((item: any) => {
    const history = (item.status_history || []).sort(
      (a: any, b: any) => new Date(a.changed_at).getTime() - new Date(b.changed_at).getTime()
    );
    const latestStatus: AppStatus = history.length > 0 ? (history[history.length - 1].new_status as AppStatus) : 'applied';
    const company = item.job?.employers?.legal_name || 'Verified Logistics Partner';

    return {
      id: item.id,
      job_id: item.job_id,
      candidate_id: 'me',
      status: latestStatus,
      created_at: item.created_at,
      history: history.map((h: any) => ({
        status: h.new_status as AppStatus,
        at: h.changed_at,
      })),
      company,
    } as Application;
  });
}

/** Fetch list of saved job IDs for the active worker */
export async function getLiveSavedJobs(): Promise<string[] | null> {
  const c = getSupabase();
  if (!c) return null;

  const { data, error } = await c
    .from('saved_jobs')
    .select('job_id');

  if (error || !data) return null;
  return data.map((r: { job_id: string }) => r.job_id);
}

/** Toggle save/unsave for a job in Supabase */
export async function toggleLiveSavedJob(jobId: string, currentSaved: boolean): Promise<boolean> {
  const c = getSupabase();
  if (!c) return !currentSaved;

  if (currentSaved) {
    const { error } = await c.from('saved_jobs').delete().eq('job_id', jobId);
    return error ? currentSaved : false;
  } else {
    const { data: workerId } = await c.rpc('current_worker_id');
    if (!workerId) return currentSaved;
    const { error } = await c.from('saved_jobs').insert({ worker_id: workerId, job_id: jobId });
    return error ? currentSaved : true;
  }
}

/** Fetch candidate discovery preview via secure RPC (exposes zero PII) */
export async function discoverLiveCandidates(city?: string, category?: string): Promise<Candidate[] | null> {
  const c = getSupabase();
  if (!c) return null;

  const { data, error } = await c.rpc('discover_workers', {
    p_city: city && city !== 'all' ? city : null,
    p_category: category || null,
    p_experience: null,
    p_limit: 20,
    p_offset: 0,
  });

  if (error || !data) {
    console.warn('[Repo] discoverLiveCandidates error:', error?.message);
    return null;
  }

  return data.map((item: any) => ({
    id: item.candidate_handle,
    code: `FW-${item.candidate_handle.slice(0, 6).toUpperCase()}`,
    city: item.city || 'Bengaluru',
    area: 'Local Area (Verified)',
    experience: fromDbExperience(item.experience_band),
    vehicle: fromDbVehicle(item.vehicle_type),
    own_vehicle: true,
    available: true,
    languages: ['Hindi', 'English'],
    skills: ['Local navigation', 'Smartphone literate', 'Delivery'],
  }));
}

/** Submit a job draft for moderation */
export async function submitLiveJobDraft(jobId: string): Promise<RepositoryResult> {
  const c = getSupabase();
  if (!c) return { ok: false, error: 'Database not connected.' };

  const { error } = await c.rpc('submit_job', { p_job_id: jobId });
  if (error) return { ok: false, error: error.message };
  return { ok: true };
}

/** Create a new job draft in Supabase */
export async function createLiveJobDraft(job: JobInput, employerId: string): Promise<RepositoryResult<{ jobId: string }>> {
  const c = getSupabase();
  if (!c) return { ok: false, error: 'Database not connected.' };

  const { data: { user } } = await c.auth.getUser();
  if (!user) return { ok: false, error: 'User not authenticated.' };

  const { data, error } = await c.from('jobs').insert({
    employer_id: employerId,
    created_by: user.id,
    title: job.title.trim(),
    category: job.category,
    description: job.description.trim(),
    city: job.city,
    area: job.area,
    salary_min_inr: job.min_salary,
    salary_max_inr: job.max_salary,
    requires_driving_licence: job.licence_required,
    expires_at: job.expires_at,
    state: 'draft',
  }).select('id').single();

  if (error || !data) return { ok: false, error: error?.message || 'Failed to create job draft.' };
  return { ok: true, data: { jobId: data.id } };
}

/** Review job by Administrator */
export async function reviewLiveJob(jobId: string, approve: boolean, reason: string): Promise<RepositoryResult> {
  const c = getSupabase();
  if (!c) return { ok: false, error: 'Database not connected.' };

  const { error } = await c.rpc('review_job', {
    p_job_id: jobId,
    p_approve: approve,
    p_reason: reason,
  });

  if (error) return { ok: false, error: error.message };
  return { ok: true };
}

/** Check if current user is an allowlisted Administrator */
export async function checkIsLiveAdmin(): Promise<boolean> {
  const c = getSupabase();
  if (!c) return false;

  const { data, error } = await c.rpc('is_admin');
  if (error) return false;
  return Boolean(data);
}

/** Register a new employer organization via secure RPC (cannot self-verify) */
export async function registerLiveEmployer(
  legalName: string,
  employerType: 'company' | 'vendor_dsp' | 'recruitment_agency'
): Promise<RepositoryResult<{ employerId: string }>> {
  const c = getSupabase();
  if (!c) return { ok: false, error: 'Database not connected.' };

  const { data, error } = await c.rpc('register_employer', {
    p_legal_name: legalName.trim(),
    p_employer_type: employerType,
  });

  if (error) return { ok: false, error: error.message };
  return { ok: true, data: { employerId: data } };
}

/** Fetch active employer organization for the current user */
export async function getLiveEmployerOrg(): Promise<{ id: string; legal_name: string; employer_type: string; verification_state: string } | null> {
  const c = getSupabase();
  if (!c) return null;

  const { data: { user } } = await c.auth.getUser();
  if (!user) return null;

  const { data: memberships, error } = await c
    .from('employer_memberships')
    .select('employer_id, role, state')
    .eq('user_id', user.id)
    .eq('state', 'active')
    .limit(1);

  if (error || !memberships || memberships.length === 0) return null;

  const { data: employer } = await c
    .from('employers')
    .select('id, legal_name, employer_type, verification_state')
    .eq('id', memberships[0].employer_id)
    .single();

  return employer ?? null;
}

export interface UserRoleStatus {
  role: 'admin' | 'employer' | 'worker';
  onboarded: boolean;
  isAdmin: boolean;
  isEmployer: boolean;
  isWorker: boolean;
  workerProfile?: WorkerProfile | null;
  employerOrg?: { id: string; legal_name: string; employer_type: string; verification_state: string } | null;
}

/** Resolves trusted database role and onboarding status without trusting frontend role */
export async function resolveUserRoleStatus(): Promise<UserRoleStatus> {
  const c = getSupabase();
  if (!c) {
    return { role: 'worker', onboarded: false, isAdmin: false, isEmployer: false, isWorker: true };
  }

  const { data: { user } } = await c.auth.getUser();
  if (!user) {
    return { role: 'worker', onboarded: false, isAdmin: false, isEmployer: false, isWorker: true };
  }

  // 1. Check if user is allowlisted admin
  const { data: isAdminData } = await c.rpc('is_admin');
  if (Boolean(isAdminData)) {
    return { role: 'admin', onboarded: true, isAdmin: true, isEmployer: false, isWorker: false };
  }

  // 2. Check if user has an active employer membership
  const employerOrg = await getLiveEmployerOrg();
  if (employerOrg) {
    return {
      role: 'employer',
      onboarded: true,
      isAdmin: false,
      isEmployer: true,
      isWorker: false,
      employerOrg,
    };
  }

  // 3. Check if user metadata requested employer onboarding
  const metaRole = (user.user_metadata?.role as 'worker' | 'employer') || 'worker';
  if (metaRole === 'employer') {
    return {
      role: 'employer',
      onboarded: false,
      isAdmin: false,
      isEmployer: true,
      isWorker: false,
      employerOrg: null,
    };
  }

  // 4. Worker role
  const workerProfile = await getLiveWorkerProfile();
  const workerOnboarded = Boolean(workerProfile && workerProfile.first_name);

  return {
    role: 'worker',
    onboarded: workerOnboarded,
    isAdmin: false,
    isEmployer: false,
    isWorker: true,
    workerProfile,
  };
}

export interface LiveApplicant extends Application {
  job_title: string;
  candidate_code: string;
  worker_summary: string;
}

/** Fetch live applicants for jobs owned by the current employer */
export async function getLiveEmployerApplicants(employerId?: string): Promise<LiveApplicant[] | null> {
  const c = getSupabase();
  if (!c) return null;

  let query = c
    .from('job_applications')
    .select(`
      id,
      job_id,
      created_at,
      status_history:application_status_history(old_status, new_status, changed_at),
      job:jobs!inner(id, title, city, area, employer_id, employers(legal_name)),
      worker:workers(id, city, experience_band, vehicle_type, has_own_vehicle)
    `)
    .order('created_at', { ascending: false });

  if (employerId) {
    query = query.eq('job.employer_id', employerId);
  }

  const { data, error } = await query;
  if (error || !data) {
    console.warn('[Repo] getLiveEmployerApplicants error:', error?.message);
    return null;
  }

  return data.map((item: any) => {
    const history = (item.status_history || []).sort(
      (a: any, b: any) => new Date(a.changed_at).getTime() - new Date(b.changed_at).getTime()
    );
    const latestDbStatus = history.length > 0 ? history[history.length - 1].new_status : 'applied';
    const uiStatus = fromDbAppStatus(latestDbStatus);
    const worker = item.worker;
    const candidateCode = worker?.id ? `FW-${worker.id.slice(0, 6).toUpperCase()}` : 'FW-CANDIDATE';
    const workerSummary = worker
      ? `${worker.city || 'Local'} · ${fromDbExperience(worker.experience_band)} · ${fromDbVehicle(worker.vehicle_type)}`
      : 'Verified candidate';

    return {
      id: item.id,
      job_id: item.job_id,
      candidate_id: worker?.id || 'candidate',
      status: uiStatus,
      created_at: item.created_at,
      history: history.map((h: any) => ({
        status: fromDbAppStatus(h.new_status),
        at: h.changed_at,
      })),
      company: item.job?.employers?.legal_name || 'My Organization',
      job_title: item.job?.title || 'Logistics Role',
      candidate_code: candidateCode,
      worker_summary: workerSummary,
    };
  });
}

/** Transition application status via atomic backend RPC */
export async function setLiveApplicationStatus(applicationId: string, status: AppStatus): Promise<RepositoryResult> {
  const c = getSupabase();
  if (!c) return { ok: false, error: 'Database not connected.' };

  const dbStatus = toDbAppStatus(status);
  const { error } = await c.rpc('set_application_status', {
    p_application_id: applicationId,
    p_status: dbStatus as any,
  });

  if (error) return { ok: false, error: error.message };
  return { ok: true };
}

/** Fetch jobs for Admin moderation queue */
export async function getLiveAdminJobs(): Promise<Job[] | null> {
  const c = getSupabase();
  if (!c) return null;

  const { data, error } = await c
    .from('jobs')
    .select('*, employers(id, legal_name, verification_state)')
    .order('created_at', { ascending: false });

  if (error || !data) {
    console.warn('[Repo] getLiveAdminJobs error:', error?.message);
    return null;
  }

  return data.map((j: any) => ({
    id: j.id,
    employer_id: j.employer_id,
    title: j.title,
    company: j.employers?.legal_name || 'Verified Logistics Partner',
    city: j.city,
    area: j.area || 'Central',
    category: j.category as any,
    min_salary: j.salary_min_inr || 18000,
    max_salary: j.salary_max_inr || 24000,
    shift: 'General',
    vehicle: j.requires_driving_licence ? 'Two-wheeler with licence' : 'None',
    fuel_allowance: true,
    licence_required: j.requires_driving_licence || false,
    experience: '1-3 years',
    description: j.description,
    openings: 1,
    status: fromDbJobState(j.state),
    expires_at: j.expires_at || new Date(Date.now() + 30 * 86400000).toISOString(),
    created_at: j.created_at,
    moderation_note: j.review_note,
  }));
}

/** Fetch all employers for Admin review */
export async function getLiveAdminEmployers(): Promise<Employer[] | null> {
  const c = getSupabase();
  if (!c) return null;

  const { data, error } = await c
    .from('employers')
    .select('id, legal_name, employer_type, verification_state, created_at')
    .order('created_at', { ascending: false });

  if (error || !data) {
    console.warn('[Repo] getLiveAdminEmployers error:', error?.message);
    return null;
  }

  return data.map((e: any) => ({
    id: e.id,
    name: e.legal_name,
    city: 'India',
    kind: e.employer_type === 'vendor_dsp' ? 'DSP Partner' : e.employer_type === 'recruitment_agency' ? 'Agency' : 'Enterprise',
    status: (e.verification_state === 'pending' ? 'unverified' : e.verification_state) as any,
    joined: e.created_at,
  }));
}

/** Admin review employer verification state */
export async function adminReviewLiveEmployer(
  employerId: string,
  decision: 'verified' | 'rejected' | 'suspended',
  reason: string
): Promise<RepositoryResult> {
  const c = getSupabase();
  if (!c) return { ok: false, error: 'Database not connected.' };

  const { error } = await c.rpc('admin_review_employer', {
    p_employer_id: employerId,
    p_decision: decision,
    p_reason: reason,
  });

  if (error) return { ok: false, error: error.message };
  return { ok: true };
}

/** Fetch user notifications */
export async function getLiveNotifications(): Promise<Notice[] | null> {
  const c = getSupabase();
  if (!c) return null;

  const { data: { user } } = await c.auth.getUser();
  if (!user) return null;

  const { data, error } = await c
    .from('notifications')
    .select('*')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false });

  if (error || !data) return null;

  return data.map((n: any) => {
    let title = 'FleetWala Notification';
    let body = 'You have a new update.';
    let href = undefined;

    if (n.kind === 'application_received') {
      title = 'New Application Received';
      body = `A worker applied to your job listing: ${n.payload?.job_title || ''}.`;
      href = '/employer/applicants';
    } else if (n.kind === 'application_status_update') {
      title = `Application ${n.payload?.new_status ? n.payload.new_status.toUpperCase() : 'Updated'}`;
      body = `Your application for ${n.payload?.job_title || 'logistics role'} at ${n.payload?.company || 'FleetWala'} was updated to ${n.payload?.new_status}.`;
      href = '/applications';
    } else if (n.kind === 'job_moderation_update') {
      title = `Job Posting ${n.payload?.state ? n.payload.state.toUpperCase() : 'Moderated'}`;
      body = `Your job listing "${n.payload?.job_title}" is now ${n.payload?.state}.${n.payload?.reason ? ` Note: ${n.payload.reason}` : ''}`;
      href = '/employer/jobs';
    } else if (n.kind === 'employer_verification_update') {
      title = `Employer Verification: ${n.payload?.decision ? n.payload.decision.toUpperCase() : 'Updated'}`;
      body = `Your organization verification has been marked ${n.payload?.decision}.${n.payload?.reason ? ` Note: ${n.payload.reason}` : ''}`;
      href = '/employer';
    } else if (n.kind === 'new_message') {
      title = 'New Message';
      body = `You received a message: "${n.payload?.preview || '...'}"`;
      href = '/messages';
    }

    return {
      id: n.id,
      title,
      body,
      at: n.created_at,
      read: Boolean(n.read_at),
      href,
    };
  });
}

/** Mark notification read */
export async function markLiveNotificationRead(notificationId: string): Promise<RepositoryResult> {
  const c = getSupabase();
  if (!c) return { ok: false, error: 'Database not connected.' };

  const { error } = await c.rpc('mark_notification_read', { p_notification_id: notificationId });
  if (error) return { ok: false, error: error.message };
  return { ok: true };
}

/** Fetch live chat conversations */
export async function getLiveConversations(): Promise<Thread[] | null> {
  const c = getSupabase();
  if (!c) return null;

  const { data: { user } } = await c.auth.getUser();
  if (!user) return null;

  const { data, error } = await c
    .from('conversations')
    .select(`
      id,
      created_at,
      application:job_applications!inner(
        id,
        status,
        job:jobs!inner(id, title, employer_id, employers(legal_name)),
        worker:workers(id, full_name, user_id)
      ),
      messages(id, sender_id, body, created_at)
    `)
    .order('created_at', { ascending: false });

  if (error || !data) {
    console.warn('[Repo] getLiveConversations error:', error?.message);
    return null;
  }

  return data.map((conv: any) => {
    const isWorkerUser = conv.application?.worker?.user_id === user.id;
    const participantName = isWorkerUser
      ? (conv.application?.job?.employers?.legal_name || 'Hiring Manager')
      : 'Shortlisted Candidate';
    const participantRole = isWorkerUser ? 'Employer' : 'Candidate';

    const sortedMessages = (conv.messages || []).sort(
      (a: any, b: any) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
    );

    return {
      id: conv.id,
      participant: participantName,
      role: participantRole,
      job_id: conv.application?.job?.id || '',
      messages: sortedMessages.map((m: any) => ({
        id: m.id,
        from: m.sender_id === user.id ? 'me' : 'them',
        text: m.body,
        at: m.created_at,
      })),
    };
  });
}

/** Send live message in chat */
export async function sendLiveMessage(conversationId: string, body: string): Promise<RepositoryResult<{ messageId: string }>> {
  const c = getSupabase();
  if (!c) return { ok: false, error: 'Database not connected.' };

  const { data, error } = await c.rpc('send_message', {
    p_conversation_id: conversationId,
    p_body: body.trim(),
  });

  if (error) return { ok: false, error: error.message };
  return { ok: true, data: { messageId: data } };
}

/** Bootstrap one-time Administrator seat */
export async function bootstrapLiveAdmin(): Promise<RepositoryResult<boolean>> {
  const c = getSupabase();
  if (!c) return { ok: false, error: 'Database not connected.' };

  const { data, error } = await c.rpc('bootstrap_admin');
  if (error) return { ok: false, error: error.message };
  return { ok: true, data: Boolean(data) };
}

/** Grant staging job waiver (admin only) */
export async function grantLiveStagingJobWaiver(jobId: string, reason: string): Promise<RepositoryResult> {
  const c = getSupabase();
  if (!c) return { ok: false, error: 'Database not connected.' };

  const { error } = await c.rpc('admin_grant_staging_job_waiver', {
    p_job_id: jobId,
    p_reason: reason,
  });

  if (error) return { ok: false, error: error.message };
  return { ok: true };
}
