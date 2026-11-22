/**
 * FleetWala Staging Repository Layer
 * Bridges UI components to Supabase PostgreSQL database & RLS-guarded RPCs when authenticated,
 * with honest fallback to the local pilot store when unauthenticated or exploring the sample pilot.
 */

import { getSupabase, supabaseConfigured } from './supabase';
import type { AppStatus, Application, Candidate, Job, JobStatus, WorkerProfile } from './types';
import type { JobInput } from './store';

export interface RepositoryResult<T = void> {
  ok: boolean;
  data?: T;
  error?: string;
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
export async function getLiveEmployerJobs(): Promise<Job[] | null> {
  const c = getSupabase();
  if (!c) return null;

  const { data, error } = await c
    .from('jobs')
    .select('*')
    .order('created_at', { ascending: false });

  if (error || !data) {
    return null;
  }

  return data.map((j) => ({
    id: j.id,
    employer_id: j.employer_id,
    title: j.title,
    company: 'Ghar-Tak Parcels',
    city: j.city,
    area: j.area || 'Central',
    category: j.category as any,
    min_salary: j.salary_min_inr || 18000,
    max_salary: j.salary_max_inr || 24000,
    shift: 'Day 9–6',
    vehicle: j.requires_driving_licence ? 'Two-wheeler' : 'None needed',
    fuel_allowance: true,
    licence_required: j.requires_driving_licence || false,
    experience: '1–3 years',
    description: j.description,
    openings: 1,
    status: (j.state === 'published' ? 'approved' : j.state) as JobStatus,
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

/** Upsert worker profile to Supabase */
export async function saveLiveWorkerProfile(profile: Partial<WorkerProfile>): Promise<RepositoryResult> {
  const c = getSupabase();
  if (!c) return { ok: false, error: 'Database not connected.' };

  const { data: { user } } = await c.auth.getUser();
  if (!user) return { ok: false, error: 'User not authenticated.' };

  const payload = {
    user_id: user.id,
    full_name: profile.first_name,
    city: profile.city,
    address_line: profile.area,
    experience_band: toDbExperience(profile.experience),
    vehicle_type: toDbVehicle(profile.vehicle),
    has_own_vehicle: profile.own_vehicle ?? false,
    discoverable: profile.discoverable ?? false,
    availability: profile.available ? 'immediate' : 'unavailable',
  };

  const { error } = await c.from('workers').upsert(payload, { onConflict: 'user_id' });
  if (error) return { ok: false, error: error.message };
  return { ok: true };
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
