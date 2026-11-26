/**
 * FleetWala Staging Repository Layer
 * Bridges UI components to Supabase PostgreSQL database & RLS-guarded RPCs when authenticated,
 * with honest fallback to the local pilot store when unauthenticated or exploring the sample pilot.
 */

import { getSupabase, supabaseConfigured } from './supabase';
import { istDay } from './rules';
import type { AppStatus, Application, AuditEntry, Candidate, Employer, Job, JobStatus, Notice, Thread, TicketStatus, WorkerProfile } from './types';
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

/** Fetch live published jobs from Supabase or returns empty array if no published jobs */
export async function getLiveJobs(): Promise<Job[]> {
  const c = getSupabase();
  if (!c) return [];

  // 1. Try public RPC first (works for visitors and authenticated users alike)
  try {
    const { data: rpcJobs, error: rpcErr } = await c.rpc('get_public_published_jobs');
    if (!rpcErr && rpcJobs && Array.isArray(rpcJobs)) {
      return rpcJobs.map((j: any) => ({
        id: j.id,
        employer_id: j.employer_id,
        title: j.title,
        company: j.company || 'Verified Logistics Partner',
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
        status: 'approved' as JobStatus,
        expires_at: j.expires_at || new Date(Date.now() + 30 * 86400000).toISOString(),
        created_at: j.created_at,
        moderation_note: undefined,
      }));
    }
  } catch (err) {
    console.warn('[Repo] get_public_published_jobs RPC fallback:', err);
  }

  // 2. Fallback to direct authenticated select
  const { data, error } = await c
    .from('jobs')
    .select('*, employers(legal_name)')
    .eq('state', 'published')
    .order('created_at', { ascending: false });

  if (error || !data) {
    return [];
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
  if (!c) return { ok: false, error: 'Database connection unavailable. Please try again later.' };

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

/** Atomically toggle worker discoverability without altering other profile columns */
export async function setLiveWorkerDiscoverability(discoverable: boolean): Promise<RepositoryResult<boolean>> {
  const c = getSupabase();
  if (!c) return { ok: false, error: 'Database not connected.' };

  const { data: { user } } = await c.auth.getUser();
  if (!user) return { ok: false, error: 'Please sign in first.' };

  const { data: rpcRes, error: rpcErr } = await c.rpc('set_worker_discoverability', {
    p_discoverable: discoverable,
  });

  if (!rpcErr) {
    return { ok: true, data: Boolean(rpcRes) };
  }

  // Fallback only when Migration 027 RPC is not yet registered; never overwrites other columns.
  if (rpcErr.code === 'PGRST202' || rpcErr.message?.includes('set_worker_discoverability')) {
    const { data: existing, error: fetchErr } = await c
      .from('workers')
      .select('id')
      .eq('user_id', user.id)
      .maybeSingle();

    if (fetchErr || !existing) {
      return { ok: false, error: 'Please save your worker profile before changing discoverability.' };
    }

    const { error: updErr } = await c
      .from('workers')
      .update({ discoverable, updated_at: new Date().toISOString() })
      .eq('user_id', user.id);

    if (updErr) return { ok: false, error: updErr.message };
    return { ok: true, data: discoverable };
  }

  return { ok: false, error: rpcErr.message };
}

/** Fetch active worker's real job applications from Supabase */
export async function getLiveApplications(): Promise<Application[] | null> {
  const c = getSupabase();
  if (!c) return null;

  // Prefer privacy-safe RPC returning job title & company even if paused/closed
  const { data: rpcRows, error: rpcErr } = await c.rpc('get_worker_applications');
  if (!rpcErr && Array.isArray(rpcRows)) {
    return rpcRows.map((item: any) => {
      const history = Array.isArray(item.status_history) ? item.status_history : [];
      const rawStatus = item.latest_status || (history.length > 0 ? history[history.length - 1].status : 'applied');
      return {
        id: item.application_id,
        job_id: item.job_id,
        candidate_id: 'me',
        status: fromDbAppStatus(rawStatus),
        created_at: item.created_at,
        history: history.map((h: any) => ({
          status: fromDbAppStatus(h.status),
          at: h.at,
        })),
        company: item.company_name || 'Verified Logistics Partner',
        job_title: item.job_title || 'Logistics Role',
        area: item.area || item.city || '',
        city: item.city || '',
      } as Application;
    });
  }

  const { data, error } = await c
    .from('job_applications')
    .select(`
      id,
      job_id,
      status,
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
    const latestRaw = history.length > 0 ? history[history.length - 1].new_status : (item.status || 'applied');
    const company = item.job?.employers?.legal_name || 'Verified Logistics Partner';

    return {
      id: item.id,
      job_id: item.job_id,
      candidate_id: 'me',
      status: fromDbAppStatus(latestRaw),
      created_at: item.created_at,
      history: history.length > 0
        ? history.map((h: any) => ({
            status: fromDbAppStatus(h.new_status),
            at: h.changed_at,
          }))
        : [{ status: fromDbAppStatus(latestRaw), at: item.created_at }],
      company,
      job_title: item.job?.title || 'Logistics Role',
      area: item.job?.area || item.job?.city || '',
      city: item.job?.city || '',
    } as Application;
  });
}

/** Count worker's applications submitted today (Asia/Kolkata) */
export async function getLiveWorkerDailyUsage(): Promise<number> {
  const apps = await getLiveApplications();
  if (!apps) return 0;
  const today = istDay(new Date());
  return apps.filter((a) => istDay(a.created_at) === today).length;
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
export async function discoverLiveCandidates(city?: string, area?: string, category?: string): Promise<Candidate[] | null> {
  const c = getSupabase();
  if (!c) return null;

  const { data, error } = await c.rpc('discover_workers', {
    p_city: city && city !== 'all' ? city : null,
    p_area: area && area !== 'all' ? area : null,
    p_category: category || null,
    p_experience: null,
    p_limit: 20,
    p_offset: 0,
  });

  if (error || !data) {
    console.warn('[Repo] discoverLiveCandidates error:', error?.message);
    return null;
  }

  return data.map((item: any) => {
    let displayArea = item.city || 'Verified Location';
    if (item.area && item.city && item.area !== item.city) {
      displayArea = `${item.area}, ${item.city}`;
    } else if (item.area) {
      displayArea = item.area;
    }

    return {
      id: item.candidate_handle,
      code: `FW-${item.candidate_handle.slice(0, 6).toUpperCase()}`,
      city: item.city || 'Delhi NCR',
      area: displayArea,
      experience: fromDbExperience(item.experience_band),
      vehicle: fromDbVehicle(item.vehicle_type),
      own_vehicle: item.has_own_vehicle ?? true,
      available: true,
      languages: ['Hindi', 'English'],
      skills: ['Local navigation', 'Smartphone literate', 'Delivery'],
    };
  });
}

/** Submit a job draft for moderation */
export async function submitLiveJobDraft(jobId: string): Promise<RepositoryResult> {
  const c = getSupabase();
  if (!c) return { ok: false, error: 'Database not connected.' };

  const { error } = await c.rpc('submit_job', { p_job_id: jobId });
  if (error) {
    console.error('[Repo] submitLiveJobDraft error:', error);
    return { ok: false, error: error.message };
  }
  return { ok: true };
}

/** Create a new job draft in Supabase */
export async function createLiveJobDraft(job: JobInput, employerId: string): Promise<RepositoryResult<{ jobId: string }>> {
  const c = getSupabase();
  if (!c) return { ok: false, error: 'Database not connected.' };

  const { data: { user } } = await c.auth.getUser();
  if (!user) return { ok: false, error: 'User not authenticated.' };

  // Explicit validation
  const title = job.title?.trim() ?? '';
  if (title.length < 3 || title.length > 150) {
    return { ok: false, error: 'Job title must be between 3 and 150 characters.' };
  }

  const description = job.description?.trim() ?? '';
  if (description.length < 10) {
    return { ok: false, error: 'Job description must be at least 10 characters.' };
  }

  const minSalary = Number(job.min_salary);
  const maxSalary = Number(job.max_salary);
  if (minSalary && maxSalary && minSalary > maxSalary) {
    return { ok: false, error: 'Maximum salary must be greater than or equal to minimum salary.' };
  }

  const { data, error } = await c.from('jobs').insert({
    employer_id: employerId,
    created_by: user.id,
    title,
    category: job.category,
    description,
    city: job.city,
    area: job.area,
    salary_min_inr: minSalary || 18000,
    salary_max_inr: maxSalary || 24000,
    requires_driving_licence: Boolean(job.licence_required),
    expires_at: job.expires_at || new Date(Date.now() + 21 * 86400000).toISOString(),
    state: 'draft',
  }).select('id').single();

  if (error || !data) {
    console.error('[Repo] createLiveJobDraft error:', error);
    return { ok: false, error: error?.message || 'Failed to create job draft.' };
  }
  return { ok: true, data: { jobId: data.id } };
}

/** Update an existing job draft in Supabase */
export async function updateLiveJobDraft(jobId: string, job: JobInput): Promise<RepositoryResult> {
  const c = getSupabase();
  if (!c) return { ok: false, error: 'Database not connected.' };

  const { data: { user } } = await c.auth.getUser();
  if (!user) return { ok: false, error: 'User not authenticated.' };

  const title = job.title?.trim() ?? '';
  if (title.length < 3 || title.length > 150) {
    return { ok: false, error: 'Job title must be between 3 and 150 characters.' };
  }

  const description = job.description?.trim() ?? '';
  if (description.length < 10) {
    return { ok: false, error: 'Job description must be at least 10 characters.' };
  }

  const minSalary = Number(job.min_salary);
  const maxSalary = Number(job.max_salary);
  if (minSalary && maxSalary && minSalary > maxSalary) {
    return { ok: false, error: 'Maximum salary must be greater than or equal to minimum salary.' };
  }

  const { error } = await c
    .from('jobs')
    .update({
      title,
      category: job.category,
      description,
      city: job.city,
      area: job.area,
      salary_min_inr: minSalary || 18000,
      salary_max_inr: maxSalary || 24000,
      requires_driving_licence: Boolean(job.licence_required),
      expires_at: job.expires_at || new Date(Date.now() + 21 * 86400000).toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq('id', jobId)
    .eq('state', 'draft');

  if (error) {
    console.error('[Repo] updateLiveJobDraft error:', error);
    return { ok: false, error: error.message };
  }
  return { ok: true };
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
export async function getLiveEmployerOrg(): Promise<{ id: string; legal_name: string; employer_type: string; verification_state: string; role?: string } | null> {
  const c = getSupabase();
  if (!c) return null;

  const { data: { user } } = await c.auth.getUser();
  if (!user) return null;

  // 1. Try server-side authorized resolver RPC first
  try {
    const { data: rpcOrg, error: rpcError } = await c.rpc('get_current_employer_org');
    if (!rpcError && rpcOrg && Array.isArray(rpcOrg) && rpcOrg.length > 0) {
      const org = rpcOrg[0];
      return {
        id: org.id,
        legal_name: org.legal_name,
        employer_type: org.employer_type,
        verification_state: org.verification_state,
        role: org.role,
      };
    }
  } catch (err) {
    console.warn('[Repo] get_current_employer_org RPC error:', err);
  }

  // 2. Client query fallback
  const { data: memberships, error } = await c
    .from('employer_memberships')
    .select('employer_id, role, state')
    .eq('user_id', user.id)
    .eq('state', 'active')
    .order('created_at', { ascending: true })
    .limit(1);

  if (error || !memberships || memberships.length === 0) {
    // 3. Fallback: check if user created an employer but membership row was missed
    const { data: createdOrg } = await c
      .from('employers')
      .select('id, legal_name, employer_type, verification_state')
      .eq('created_by', user.id)
      .order('created_at', { ascending: false })
      .limit(1);

    if (createdOrg && createdOrg.length > 0) {
      return {
        ...createdOrg[0],
        role: 'owner',
      };
    }
    return null;
  }

  const { data: employer } = await c
    .from('employers')
    .select('id, legal_name, employer_type, verification_state')
    .eq('id', memberships[0].employer_id)
    .single();

  if (!employer) return null;

  return {
    ...employer,
    role: memberships[0].role,
  };
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

  // Prefer Migration 027 anonymized SECURITY DEFINER RPC (preserves FW-XXXXXX handle even when discoverable = false)
  const { data: rpcRows, error: rpcErr } = await c.rpc('get_employer_applicants', {
    p_employer_id: employerId || null,
  });

  if (!rpcErr && Array.isArray(rpcRows)) {
    return rpcRows.map((item: any) => {
      const history = Array.isArray(item.status_history) ? item.status_history : [];
      const uiStatus = fromDbAppStatus(item.latest_status || 'applied');
      const workerSummary = `${item.worker_area || item.worker_city || 'Local'} · ${fromDbExperience(item.experience_band)} · ${fromDbVehicle(item.vehicle_type)}`;
      return {
        id: item.application_id,
        job_id: item.job_id,
        candidate_id: item.candidate_handle || 'candidate',
        status: uiStatus,
        created_at: item.created_at,
        history: history.map((h: any) => ({
          status: fromDbAppStatus(h.status),
          at: h.at,
        })),
        company: item.company_name || 'My Organization',
        job_title: item.job_title || 'Logistics Role',
        candidate_code: item.candidate_code || 'FW-CANDIDATE',
        worker_summary: workerSummary,
      };
    });
  }

  let query = c
    .from('job_applications')
    .select(`
      id,
      job_id,
      status,
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
    const latestDbStatus = history.length > 0 ? history[history.length - 1].new_status : (item.status || 'applied');
    const uiStatus = fromDbAppStatus(latestDbStatus);
    const worker = item.worker;
    const candidateCode = worker?.id ? `FW-${worker.id.slice(0, 6).toUpperCase()}` : 'FW-CANDIDATE';
    const workerSummary = worker
      ? `${worker.city || 'Local'} · ${fromDbExperience(worker.experience_band)} · ${fromDbVehicle(worker.vehicle_type)}`
      : 'Applied candidate (contact protected)';

    return {
      id: item.id,
      job_id: item.job_id,
      candidate_id: worker?.id || 'candidate',
      status: uiStatus,
      created_at: item.created_at,
      history: history.length > 0
        ? history.map((h: any) => ({
            status: fromDbAppStatus(h.new_status),
            at: h.changed_at,
          }))
        : [{ status: uiStatus, at: item.created_at }],
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
    employer_status: (j.employers?.verification_state === 'pending' ? 'unverified' : j.employers?.verification_state) || 'unverified',
  }));
}

/** Pause, reopen, or close a job as platform Admin via admin_set_job_state RPC */
export async function adminSetLiveJobState(
  jobId: string,
  state: 'paused' | 'closed' | 'published',
  reason: string
): Promise<RepositoryResult> {
  const c = getSupabase();
  if (!c) return { ok: false, error: 'Database not connected.' };

  const { error } = await c.rpc('admin_set_job_state', {
    p_job_id: jobId,
    p_state: state,
    p_reason: reason.trim() || 'Moderated by trust & safety',
  });
  if (error) return { ok: false, error: error.message };
  return { ok: true };
}

/** Fetch live audit log events for Admin console */
export async function getLiveAdminAuditLog(): Promise<AuditEntry[] | null> {
  const c = getSupabase();
  if (!c) return null;

  const { data, error } = await c
    .from('audit_log')
    .select('id, actor_id, action, entity_type, entity_id, details, created_at')
    .order('created_at', { ascending: false })
    .limit(100);

  if (error || !data) {
    console.warn('[Repo] getLiveAdminAuditLog error:', error?.message);
    return null;
  }

  return data.map((row: any) => ({
    id: String(row.id),
    at: row.created_at,
    actor: row.actor_id ? `uid:${String(row.actor_id).slice(0, 8)}` : 'system',
    action: row.action,
    target: `${row.entity_type}:${row.entity_id}`,
  }));
}

export interface LiveSupportTicket {
  id: string;
  opened_by: string;
  subject: string;
  body: string;
  status: TicketStatus | 'closed';
  topic: string;
  created_at: string;
}

/** Fetch support tickets for Admin queue */
export async function getLiveAdminSupportTickets(): Promise<LiveSupportTicket[] | null> {
  const c = getSupabase();
  if (!c) return null;

  const { data, error } = await c
    .from('support_tickets')
    .select('id, opened_by, subject, details, status, created_at')
    .order('created_at', { ascending: false })
    .limit(100);

  if (error || !data) {
    console.warn('[Repo] getLiveAdminSupportTickets error:', error?.message);
    return null;
  }

  return data.map((row: any) => {
    const m = /^\[([A-Z_]+)\]\s*(.*)$/.exec(row.subject || '');
    return {
      id: row.id,
      opened_by: row.opened_by,
      subject: m ? m[2] : (row.subject || 'Support ticket'),
      body: row.details || '',
      status: row.status,
      topic: m ? m[1].replace('_', ' ') : 'General',
      created_at: row.created_at,
    };
  });
}

/** Admin support ticket status transition via audited RPC */
export async function adminUpdateLiveSupportTicket(
  ticketId: string,
  status: TicketStatus,
  note?: string
): Promise<RepositoryResult> {
  const c = getSupabase();
  if (!c) return { ok: false, error: 'Database not connected.' };

  const { error } = await c.rpc('admin_update_support_ticket', {
    p_ticket_id: ticketId,
    p_status: status,
    p_note: note || null,
  });

  if (error) return { ok: false, error: error.message };
  return { ok: true };
}

/** Submit an authenticated support/grievance ticket without silent failure */
export async function submitLiveSupportTicket(
  subject: string,
  details: string,
  employerId?: string | null
): Promise<RepositoryResult> {
  const c = getSupabase();
  if (!c) return { ok: false, error: 'Support backend is not connected.' };

  const { data: { user } } = await c.auth.getUser();
  if (!user) {
    return { ok: false, error: 'Please sign in to submit a tracked support or grievance ticket.' };
  }

  const cleanSubj = subject.trim();
  const cleanDetails = details.trim();
  if (cleanSubj.length < 3) return { ok: false, error: 'Subject must be at least 3 characters.' };
  if (cleanDetails.length < 5) return { ok: false, error: 'Details must be at least 5 characters.' };

  const { error } = await c.from('support_tickets').insert({
    opened_by: user.id,
    employer_id: employerId ?? null,
    subject: cleanSubj,
    details: cleanDetails,
  });

  if (error) return { ok: false, error: error.message };
  return { ok: true };
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

    if (n.kind === 'application_received' || n.kind === 'new_application') {
      title = 'New Application Received';
      body = `A worker applied to your job listing: ${n.payload?.job_title || ''}.`;
      href = '/employer/applicants';
    } else if (n.kind === 'candidate_invited') {
      title = 'Hiring Invitation Received';
      body = `${n.payload?.company || 'A verified employer'} invited you to connect for ${n.payload?.job_title || 'a logistics role'}.`;
      href = '/applications';
    } else if (n.kind === 'invitation_accepted' || n.kind === 'invitation_declined') {
      const accepted = n.kind === 'invitation_accepted';
      title = accepted ? 'Invitation Accepted' : 'Invitation Declined';
      body = `A candidate ${accepted ? 'accepted' : 'declined'} your invitation for ${n.payload?.job_title || 'an opening'}.`;
      href = accepted ? '/employer/messages' : '/employer/applicants';
    } else if (n.kind === 'support_ticket_update') {
      title = 'Support Ticket Updated';
      body = `Ticket "${n.payload?.subject || ''}" is now ${n.payload?.status || 'updated'}.`;
      href = '/support';
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

  // Use hardened canonical RPC get_user_conversations() for both Worker and Employer
  const { data: rpcData, error: rpcErr } = await c.rpc('get_user_conversations');
  if (!rpcErr && Array.isArray(rpcData)) {
    return rpcData.map((row: any) => ({
      id: row.conversation_id,
      participant: row.participant_name,
      role: row.participant_role,
      job_id: row.job_id,
      job_title: row.job_title,
      messages: (row.messages_json || []).map((m: any) => ({
        id: m.id,
        from: m.from,
        text: m.text,
        at: m.at,
      })),
    }));
  }

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
      : (conv.application?.worker?.full_name || 'Shortlisted Candidate');
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

/** Update employer job state (pause, resume, close) in PostgreSQL */
export async function updateLiveEmployerJobState(
  jobId: string,
  action: 'pause' | 'resume' | 'close'
): Promise<RepositoryResult<{ newState: string }>> {
  const c = getSupabase();
  if (!c) return { ok: false, error: 'Database not connected.' };

  const { data, error } = await c.rpc('update_employer_job_state', {
    p_job_id: jobId,
    p_action: action,
  });

  if (error) {
    console.error('[Repo] updateLiveEmployerJobState error:', error);
    return { ok: false, error: error.message };
  }

  return { ok: true, data: { newState: data } };
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

export interface LiveCandidateInvitation {
  id: string;
  job_id: string | null;
  job_title: string;
  employer_name: string;
  message: string | null;
  status: 'pending' | 'accepted' | 'declined' | 'expired';
  created_at: string;
  expires_at: string;
}

export interface LiveEmployerInvitation {
  id: string;
  candidate_handle: string;
  job_id: string | null;
  job_title: string;
  message: string | null;
  status: 'pending' | 'accepted' | 'declined' | 'expired';
  created_at: string;
  responded_at: string | null;
}

/** Create a real application-linked invitation from employer */
export async function createLiveApplicationInvitation(
  applicationId: string,
  message?: string
): Promise<RepositoryResult<{ invitationId: string }>> {
  const c = getSupabase();
  if (!c) return { ok: false, error: 'Database not connected.' };

  const { data, error } = await c.rpc('create_application_invitation', {
    p_application_id: applicationId,
    p_message: message || null,
  });

  if (error) {
    console.error('[Repo] createLiveApplicationInvitation error:', error);
    return { ok: false, error: error.message };
  }

  return { ok: true, data: { invitationId: data } };
}

/** Create a real candidate invitation from verified employer */
export async function createLiveCandidateInvitation(
  candidateHandle: string,
  jobId: string | null,
  message?: string
): Promise<RepositoryResult<{ invitationId: string }>> {
  const c = getSupabase();
  if (!c) return { ok: false, error: 'Database not connected.' };

  const { data, error } = await c.rpc('create_candidate_invitation', {
    p_candidate_handle: candidateHandle,
    p_job_id: jobId,
    p_message: message || null,
  });

  if (error) {
    console.error('[Repo] createLiveCandidateInvitation error:', error);
    return { ok: false, error: error.message };
  }

  return { ok: true, data: { invitationId: data } };
}

/** Worker responds to a candidate invitation (accept/decline) */
export async function respondToLiveCandidateInvitation(
  invitationId: string,
  accept: boolean
): Promise<RepositoryResult> {
  const c = getSupabase();
  if (!c) return { ok: false, error: 'Database not connected.' };

  const { error } = await c.rpc('respond_to_candidate_invitation', {
    p_invitation_id: invitationId,
    p_accept: accept,
  });

  if (error) {
    console.error('[Repo] respondToLiveCandidateInvitation error:', error);
    return { ok: false, error: error.message };
  }

  return { ok: true };
}

/** Get candidate invitations received by the current worker */
export async function getLiveWorkerInvitations(): Promise<LiveCandidateInvitation[]> {
  const c = getSupabase();
  if (!c) return [];

  const { data, error } = await c.rpc('get_worker_candidate_invitations');
  if (error || !data) {
    console.warn('[Repo] getLiveWorkerInvitations error:', error?.message);
    return [];
  }

  return data;
}

/** Get candidate invitations sent by the current employer */
export async function getLiveEmployerInvitations(jobId?: string): Promise<LiveEmployerInvitation[]> {
  const c = getSupabase();
  if (!c) return [];

  const { data, error } = await c.rpc('get_employer_candidate_invitations', {
    p_job_id: jobId || null,
  });

  if (error || !data) {
    console.warn('[Repo] getLiveEmployerInvitations error:', error?.message);
    return [];
  }

  return data;
}

