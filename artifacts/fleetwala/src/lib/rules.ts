/** Pure pilot rules. No browser or env access so they run under node:test. */
import type { AppStatus, Application, Job, WorkerProfile } from './types';

export const DAILY_LIMIT = 20;
export const DEFAULT_RADIUS_KM = 15;

/** YYYY-MM-DD in Asia/Kolkata. */
export function istDay(d: Date | string): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Kolkata', year: 'numeric', month: '2-digit', day: '2-digit',
  }).format(new Date(d));
}

/** Applications by a candidate created on the same IST calendar day as `now`. */
export function countToday(apps: Pick<Application, 'candidate_id' | 'created_at'>[], candidateId: string, now: Date = new Date()): number {
  const day = istDay(now);
  return apps.filter((a) => a.candidate_id === candidateId && istDay(a.created_at) === day).length;
}

export function canApplyToday(used: number, limit = DAILY_LIMIT): boolean {
  return used < limit;
}

/** A job is live for workers only if approved and not expired. */
export function isLiveJob(j: Pick<Job, 'status' | 'expires_at'>, now: Date = new Date()): boolean {
  return j.status === 'approved' && new Date(j.expires_at).getTime() > now.getTime();
}

export function liveJobs<T extends Pick<Job, 'status' | 'expires_at'>>(jobs: T[], now: Date = new Date()): T[] {
  return jobs.filter((j) => isLiveJob(j, now));
}

/** New worker profiles are never discoverable unless the worker opts in. */
export function defaultProfile(overrides: Partial<WorkerProfile> = {}): WorkerProfile {
  return {
    first_name: '', city: '', area: '', experience: '', vehicle: '',
    own_vehicle: false, available: true, ...overrides, discoverable: overrides.discoverable === true,
  };
}

export const INDIAN_MOBILE = /^[6-9]\d{9}$/;
/** Returns +91XXXXXXXXXX or null. Accepts spaces, dashes, leading 0, 91 or +91. */
export function normalizeIndianPhone(input: string): string | null {
  const d = input.replace(/\D/g, '');
  let local = d;
  if (d.length === 12 && d.startsWith('91')) local = d.slice(2);
  else if (d.length === 11 && d.startsWith('0')) local = d.slice(1);
  return INDIAN_MOBILE.test(local) ? `+91${local}` : null;
}

/** Live portal data is wired to Supabase PostgreSQL, Auth & RPCs */
export const LIVE_PORTAL_WIRED = true;
export function liveGate(opts: { enableFlag: boolean; supabaseConfigured: boolean; wired?: boolean }) {
  const requested = opts.enableFlag && opts.supabaseConfigured;
  const wired = opts.wired ?? LIVE_PORTAL_WIRED;
  return { requested, showLiveData: requested && wired, blocked: requested && !wired };
}

/** Allowed state transitions for applications */
export function isValidAppStatusTransition(current: AppStatus, next: AppStatus): boolean {
  if (current === next) return true;
  if (current === 'withdrawn' || current === 'rejected' || current === 'hired') return false;
  const allowed: Record<AppStatus, AppStatus[]> = {
    applied: ['viewed', 'shortlisted', 'rejected', 'withdrawn'],
    viewed: ['shortlisted', 'rejected', 'withdrawn'],
    shortlisted: ['hired', 'rejected', 'withdrawn'],
    hired: [],
    rejected: [],
    withdrawn: [],
  };
  return allowed[current]?.includes(next) ?? false;
}

/** Detect prohibited worker deposits or fee demands */
export function hasProhibitedFee(text: string): boolean {
  return /(deposit|registration fee|pay to join|security amount|joining fee)/i.test(text);
}

/** Validate salary bounds */
export function isValidSalaryRange(min: number, max: number): boolean {
  return min > 0 && max >= min;
}

/** Candidate preview projection: strictly non-identifying */
export function anonymizedCandidateProjection(worker: WorkerProfile): Pick<WorkerProfile, 'first_name' | 'city' | 'area' | 'experience' | 'vehicle' | 'own_vehicle' | 'available'> {
  return {
    first_name: worker.first_name,
    city: worker.city,
    area: worker.area,
    experience: worker.experience,
    vehicle: worker.vehicle,
    own_vehicle: worker.own_vehicle,
    available: worker.available,
  };
}

/** Business PRD pricing baseline (Migration 008) */
export const PRD_PRICING = {
  JOB_POSTING_INR: 99,
  CANDIDATE_UNLOCK_INR: 10,
} as const;

/** Valid client self-registration roles (Admin is strictly invite/provisioning-only) */
export const ALLOWED_REGISTRATION_ROLES = ['worker', 'employer'] as const;
export function isAllowedRegistrationRole(role: string): boolean {
  return (ALLOWED_REGISTRATION_ROLES as readonly string[]).includes(role);
}

/** Supported Indian city hub reference coordinates for approximate on-device matching only. */
export const CITY_CENTROIDS: Record<string, { lat: number; lng: number }> = {
  Bengaluru: { lat: 12.9716, lng: 77.5946 },
  Mumbai: { lat: 19.076, lng: 72.8777 },
  'Delhi NCR': { lat: 28.6139, lng: 77.209 },
  Hyderabad: { lat: 17.385, lng: 78.4867 },
  Pune: { lat: 18.5204, lng: 73.8567 },
  Chennai: { lat: 13.0827, lng: 80.2707 },
};

export function isValidCoordinate(lat: number, lng: number): boolean {
  return (
    Number.isFinite(lat) &&
    Number.isFinite(lng) &&
    lat >= -90 &&
    lat <= 90 &&
    lng >= -180 &&
    lng <= 180 &&
    !(lat === 0 && lng === 0)
  );
}

export function haversineKm(a: { lat: number; lng: number }, b: { lat: number; lng: number }): number {
  if (!isValidCoordinate(a.lat, a.lng) || !isValidCoordinate(b.lat, b.lng)) return Number.POSITIVE_INFINITY;
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const R = 6371;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const sinLat = Math.sin(dLat / 2);
  const sinLng = Math.sin(dLng / 2);
  const h =
    sinLat * sinLat +
    Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * sinLng * sinLng;
  return 2 * R * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h));
}

export function findNearestSupportedCity(
  lat: number,
  lng: number,
  maxKm = DEFAULT_RADIUS_KM
): { city: string; distanceKm: number; withinRadius: boolean } | null {
  if (!isValidCoordinate(lat, lng)) return null;
  let best: { city: string; distanceKm: number } | null = null;
  for (const [city, center] of Object.entries(CITY_CENTROIDS)) {
    const distanceKm = haversineKm({ lat, lng }, center);
    if (!best || distanceKm < best.distanceKm) {
      best = { city, distanceKm };
    }
  }
  if (!best) return null;
  return {
    city: best.city,
    distanceKm: Math.round(best.distanceKm),
    withinRadius: best.distanceKm <= maxKm,
  };
}

export function normalizeIndianPincode(input: string): string | null {
  const digits = input.replace(/\D/g, '');
  return /^[1-9]\d{5}$/.test(digits) ? digits : null;
}

