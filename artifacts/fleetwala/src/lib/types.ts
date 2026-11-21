export type JobCategory = 'Delivery' | 'Pickup-Drop' | 'Warehouse' | 'Hub';
export type JobStatus = 'draft' | 'pending' | 'approved' | 'paused' | 'closed';
export type AppStatus = 'applied' | 'viewed' | 'shortlisted' | 'hired' | 'rejected' | 'withdrawn';

export interface Job {
  id: string;
  employer_id: string;
  title: string;
  company: string;
  city: string;
  area: string;
  category: JobCategory;
  min_salary: number;
  max_salary: number;
  shift: string;
  vehicle: string;
  fuel_allowance: boolean;
  licence_required: boolean;
  experience: string;
  description: string;
  openings: number;
  status: JobStatus;
  expires_at: string;
  created_at: string;
  moderation_note?: string;
}

export interface Application {
  id: string;
  job_id: string;
  candidate_id: string;
  status: AppStatus;
  created_at: string;
  history: { status: AppStatus; at: string }[];
}

export interface WorkerProfile {
  first_name: string;
  city: string;
  area: string;
  experience: string;
  vehicle: string;
  own_vehicle: boolean;
  available: boolean;
  discoverable: boolean;
}

export interface Candidate {
  id: string;
  code: string;
  city: string;
  area: string;
  experience: string;
  vehicle: string;
  own_vehicle: boolean;
  available: boolean;
  languages: string[];
  skills: string[];
}

export type EmployerStatus = 'unverified' | 'verified' | 'suspended';
export interface Employer {
  id: string;
  name: string;
  city: string;
  kind: string;
  status: EmployerStatus;
  joined: string;
}

export interface AuditEntry {
  id: string;
  at: string;
  actor: string;
  action: string;
  target: string;
}

export type TicketStatus = 'open' | 'in_progress' | 'resolved';
export interface Ticket {
  id: string;
  subject: string;
  body: string;
  from: 'worker' | 'employer';
  topic: string;
  status: TicketStatus;
  created_at: string;
}

export interface Message {
  id: string;
  from: 'me' | 'them';
  text: string;
  at: string;
}
export interface Thread {
  id: string;
  participant: string;
  role: string;
  job_id: string;
  messages: Message[];
}

export interface Notice {
  id: string;
  title: string;
  body: string;
  at: string;
  read: boolean;
  href?: string;
}

export interface TeamMember {
  id: string;
  name: string;
  role: 'Owner' | 'Recruiter' | 'Viewer';
  status: 'active' | 'invited';
}

export interface Prefs {
  jobAlerts: boolean;
  statusUpdates: boolean;
  language: 'en' | 'hi';
}

export interface PilotState {
  version: 1;
  jobs: Job[];
  applications: Application[];
  saved: string[];
  profile: WorkerProfile;
  candidates: Candidate[];
  employers: Employer[];
  audit: AuditEntry[];
  tickets: Ticket[];
  threads: Thread[];
  notifications: Notice[];
  team: TeamMember[];
  prefs: Prefs;
}
