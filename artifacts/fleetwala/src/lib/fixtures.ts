import type { Application, AppStatus, Job, PilotState } from './types';

export const CITIES: Record<string, string[]> = {
  Bengaluru: ['Koramangala', 'HSR Layout', 'Whitefield', 'Yeshwanthpur', 'Electronic City', 'Hebbal'],
  Mumbai: ['Andheri East', 'Bhiwandi', 'Powai', 'Kurla', 'Thane West', 'Vashi'],
  'Delhi NCR': ['Okhla', 'Gurugram Sec 18', 'Noida Sec 63', 'Dwarka', 'Kundli', 'Saket'],
  Hyderabad: ['Gachibowli', 'Kukatpally', 'Shamshabad', 'Madhapur', 'Uppal'],
  Pune: ['Hinjawadi', 'Chakan', 'Kharadi', 'Wakad', 'Hadapsar'],
  Chennai: ['Guindy', 'Sriperumbudur', 'Velachery', 'Ambattur', 'T Nagar'],
};
export const CITY_NAMES = Object.keys(CITIES);
export const CATEGORIES = ['Delivery', 'Pickup-Drop', 'Warehouse', 'Hub'] as const;
export const VEHICLES = ['Two-wheeler', 'Bicycle', 'E-bike', 'Three-wheeler', 'None needed'];
export const EXPERIENCE = ['Fresher', '0–1 year', '1–3 years', '3+ years'];
export const SHIFTS = ['Morning 6–2', 'Day 9–6', 'Evening 2–10', 'Night 10–6', 'Flexible slots'];

const H = 3600000;
const now = () => Date.now();
const hAgo = (h: number) => new Date(now() - h * H).toISOString();
const dIn = (d: number) => new Date(now() + d * 24 * H).toISOString();

export const PILOT_EMPLOYER_ID = 'emp-ghartak';

type Seed = Omit<Job, 'id' | 'created_at' | 'expires_at'> & { age: number; ttl: number };
const J = (s: Seed, i: number): Job => {
  const { age, ttl, ...rest } = s;
  return { ...rest, id: `job-${101 + i}`, created_at: hAgo(age), expires_at: dIn(ttl) };
};

const seeds: Seed[] = [
  { employer_id: PILOT_EMPLOYER_ID, title: 'Parcel delivery partner', company: 'Ghar-Tak Parcels', city: 'Bengaluru', area: 'Koramangala', category: 'Delivery', min_salary: 19500, max_salary: 26800, shift: 'Day 9–6', vehicle: 'Two-wheeler', fuel_allowance: true, licence_required: true, experience: 'Fresher', openings: 12, description: 'Deliver 35–45 small parcels a day across Koramangala and nearby blocks. Route planned by the hub lead each morning. Weekly payout, fuel card for petrol, helmet and rain jacket provided on day one.', status: 'approved', age: 5, ttl: 18 },
  { employer_id: 'emp-tiffin', title: 'Lunch dabba runner', company: 'Tiffinbox Kitchens', city: 'Bengaluru', area: 'HSR Layout', category: 'Pickup-Drop', min_salary: 14200, max_salary: 17900, shift: 'Morning 6–2', vehicle: 'Bicycle', fuel_allowance: false, licence_required: false, experience: 'Fresher', openings: 6, description: 'Pick up packed lunch boxes from three cloud kitchens and drop at offices before 1 pm. Short loops, no heavy loads. Cycle can be provided for the first month.', status: 'approved', age: 26, ttl: 9 },
  { employer_id: 'emp-dakshin', title: 'Cold-room picker', company: 'Dakshin Cold Chain', city: 'Bengaluru', area: 'Yeshwanthpur', category: 'Warehouse', min_salary: 17800, max_salary: 21400, shift: 'Night 10–6', vehicle: 'None needed', fuel_allowance: false, licence_required: false, experience: '0–1 year', openings: 8, description: 'Pick and pack dairy and frozen orders inside a 2–4 °C cold room. Thermal jacket, gloves and night meal provided. Night shift allowance included in the range shown.', status: 'approved', age: 50, ttl: 14 },
  { employer_id: 'emp-swiftline', title: 'Hub sorter, first-mile', company: 'Swiftline Hubs', city: 'Bengaluru', area: 'Hebbal', category: 'Hub', min_salary: 16500, max_salary: 19800, shift: 'Evening 2–10', vehicle: 'None needed', fuel_allowance: false, licence_required: false, experience: 'Fresher', openings: 15, description: 'Scan, sort and bag e-commerce shipments by pincode. Training on the handheld scanner given in the first two days. PF and ESI from month one.', status: 'approved', age: 72, ttl: 21 },
  { employer_id: PILOT_EMPLOYER_ID, title: 'EV delivery rider', company: 'Ghar-Tak Parcels', city: 'Bengaluru', area: 'Electronic City', category: 'Delivery', min_salary: 21000, max_salary: 28500, shift: 'Flexible slots', vehicle: 'E-bike', fuel_allowance: false, licence_required: true, experience: '0–1 year', openings: 10, description: 'Company e-bike on rent-to-own. Charging at the hub is free. Pick your 8-hour slot each week. Incentives on top for on-time deliveries.', status: 'approved', age: 12, ttl: 25 },
  { employer_id: 'emp-mandi', title: 'Vegetable crate loader', company: 'Mandi Movers', city: 'Bengaluru', area: 'Yeshwanthpur', category: 'Warehouse', min_salary: 15600, max_salary: 18200, shift: 'Morning 6–2', vehicle: 'None needed', fuel_allowance: false, licence_required: false, experience: 'Fresher', openings: 20, description: 'Load and unload vegetable crates at the APMC yard for B2B grocery orders. Breakfast and tea provided. Daily attendance bonus.', status: 'approved', age: 30, ttl: 4 },
  { employer_id: 'emp-kesari', title: 'Medicine delivery rider', company: 'Kesari Quick', city: 'Mumbai', area: 'Andheri East', category: 'Delivery', min_salary: 20500, max_salary: 25600, shift: 'Day 9–6', vehicle: 'Two-wheeler', fuel_allowance: true, licence_required: true, experience: '1–3 years', openings: 7, description: 'Deliver pharmacy orders within a 4 km zone. Insulated bag provided. Careful handling and OTP-based handover at the door.', status: 'approved', age: 8, ttl: 12 },
  { employer_id: 'emp-dakshin', title: 'Forklift-assisted stacker', company: 'Dakshin Cold Chain', city: 'Mumbai', area: 'Bhiwandi', category: 'Warehouse', min_salary: 22400, max_salary: 27100, shift: 'Day 9–6', vehicle: 'None needed', fuel_allowance: false, licence_required: true, experience: '1–3 years', openings: 4, description: 'Operate reach trucks and stack pallets in racked storage. Forklift licence or training certificate needed.', status: 'approved', age: 40, ttl: 16 },
  { employer_id: 'emp-swiftline', title: 'Returns pickup associate', company: 'Swiftline Hubs', city: 'Delhi NCR', area: 'Okhla', category: 'Pickup-Drop', min_salary: 18300, max_salary: 23900, shift: 'Day 9–6', vehicle: 'Two-wheeler', fuel_allowance: true, licence_required: true, experience: 'Fresher', openings: 9, description: 'Collect customer returns, check items against the app checklist, and drop at the Okhla hub by evening.', status: 'approved', age: 20, ttl: 10 },
  { employer_id: 'emp-tiffin', title: 'Kitchen-to-store dispatcher', company: 'Tiffinbox Kitchens', city: 'Hyderabad', area: 'Gachibowli', category: 'Hub', min_salary: 15900, max_salary: 18700, shift: 'Evening 2–10', vehicle: 'None needed', fuel_allowance: false, licence_required: false, experience: 'Fresher', openings: 5, description: 'Stage outgoing orders, label bags and hand over to riders in sequence. Telugu or Hindi helpful.', status: 'approved', age: 60, ttl: 19 },
  { employer_id: 'emp-mandi', title: 'Three-wheeler goods driver', company: 'Mandi Movers', city: 'Pune', area: 'Chakan', category: 'Pickup-Drop', min_salary: 24600, max_salary: 31200, shift: 'Morning 6–2', vehicle: 'Three-wheeler', fuel_allowance: true, licence_required: true, experience: '3+ years', openings: 3, description: 'Drive company cargo three-wheeler between Chakan warehouses and city kirana stores. Transport licence needed.', status: 'approved', age: 90, ttl: 7 },
  { employer_id: 'emp-kesari', title: 'Quick-commerce picker', company: 'Kesari Quick', city: 'Chennai', area: 'Velachery', category: 'Warehouse', min_salary: 16100, max_salary: 19300, shift: 'Flexible slots', vehicle: 'None needed', fuel_allowance: false, licence_required: false, experience: 'Fresher', openings: 11, description: 'Pick grocery orders in under 2 minutes inside a dark store. Tamil or English helpful.', status: 'approved', age: 15, ttl: 22 },
  { employer_id: PILOT_EMPLOYER_ID, title: 'Bulk parcel van helper', company: 'Ghar-Tak Parcels', city: 'Bengaluru', area: 'Whitefield', category: 'Pickup-Drop', min_salary: 15800, max_salary: 18400, shift: 'Day 9–6', vehicle: 'None needed', fuel_allowance: false, licence_required: false, experience: 'Fresher', openings: 4, description: 'Ride along in the company van and help load bulk parcels for apartment drops.', status: 'draft', age: 3, ttl: 30 },
  { employer_id: PILOT_EMPLOYER_ID, title: 'Night hub supervisor', company: 'Ghar-Tak Parcels', city: 'Bengaluru', area: 'Hebbal', category: 'Hub', min_salary: 27500, max_salary: 33800, shift: 'Night 10–6', vehicle: 'None needed', fuel_allowance: false, licence_required: false, experience: '3+ years', openings: 1, description: 'Lead a team of 14 sorters on the night shift. Shift handover reports and attendance in the hub app.', status: 'pending', age: 6, ttl: 28 },
  { employer_id: PILOT_EMPLOYER_ID, title: 'Weekend delivery rider', company: 'Ghar-Tak Parcels', city: 'Bengaluru', area: 'HSR Layout', category: 'Delivery', min_salary: 9800, max_salary: 12600, shift: 'Flexible slots', vehicle: 'Two-wheeler', fuel_allowance: true, licence_required: true, experience: 'Fresher', openings: 5, description: 'Saturday and Sunday only. Good for students and part-timers.', status: 'paused', age: 140, ttl: 6 },
  { employer_id: PILOT_EMPLOYER_ID, title: 'Festive season packer', company: 'Ghar-Tak Parcels', city: 'Bengaluru', area: 'Koramangala', category: 'Warehouse', min_salary: 14800, max_salary: 16900, shift: 'Day 9–6', vehicle: 'None needed', fuel_allowance: false, licence_required: false, experience: 'Fresher', openings: 0, description: 'Diwali season packing role. Closed after filling all positions.', status: 'closed', age: 400, ttl: -3 },
  { employer_id: 'emp-railyard', title: 'Container yard tally clerk', company: 'Railyard Express', city: 'Chennai', area: 'Sriperumbudur', category: 'Hub', min_salary: 19200, max_salary: 22600, shift: 'Day 9–6', vehicle: 'None needed', fuel_allowance: false, licence_required: false, experience: '1–3 years', openings: 2, description: 'Record container movements on a tablet and match against manifests.', status: 'pending', age: 9, ttl: 20 },
  { employer_id: 'emp-railyard', title: 'Cash-on-delivery rider', company: 'Railyard Express', city: 'Delhi NCR', area: 'Noida Sec 63', category: 'Delivery', min_salary: 18900, max_salary: 22700, shift: 'Day 9–6', vehicle: 'Two-wheeler', fuel_allowance: true, licence_required: true, experience: 'Fresher', openings: 6, description: 'Deliver COD parcels. Deposit required before joining.', status: 'pending', age: 2, ttl: 15, moderation_note: 'Flag: mentions a joining deposit.' },
];

const app = (id: string, job_id: string, candidate_id: string, path: AppStatus[], startH: number): Application => {
  const history = path.map((status, i) => ({ status, at: hAgo(startH - i * 9) }));
  return { id, job_id, candidate_id, status: path[path.length - 1], created_at: history[0].at, history };
};

export function makeEmptyState(): PilotState {
  return {
    version: 1,
    jobs: [],
    applications: [],
    saved: [],
    profile: {
      first_name: '',
      city: 'Bengaluru',
      area: '',
      experience: 'Fresher',
      vehicle: 'Two-wheeler',
      own_vehicle: false,
      available: true,
      discoverable: false,
    },
    candidates: [],
    employers: [],
    tickets: [],
    notifications: [],
    threads: [],
    audit: [],
    team: [],
    prefs: { jobAlerts: true, statusUpdates: true, language: 'en' },
  };
}

export function makeSeed(): PilotState {
  return {
    version: 1,
    jobs: seeds.map(J),
    applications: [
      app('app-1', 'job-103', 'me', ['applied', 'viewed', 'shortlisted'], 46),
      app('app-2', 'job-104', 'me', ['applied', 'viewed'], 30),
      app('app-3', 'job-106', 'me', ['applied', 'viewed', 'rejected'], 70),
      app('app-4', 'job-101', 'cand-1', ['applied'], 4),
      app('app-5', 'job-101', 'cand-2', ['applied', 'viewed'], 22),
      app('app-6', 'job-101', 'cand-3', ['applied', 'viewed', 'shortlisted'], 40),
      app('app-7', 'job-105', 'cand-4', ['applied'], 7),
      app('app-8', 'job-105', 'cand-5', ['applied', 'viewed', 'shortlisted', 'hired'], 80),
      app('app-9', 'job-101', 'cand-6', ['applied', 'rejected'], 60),
      app('app-10', 'job-105', 'cand-7', ['applied', 'viewed'], 15),
    ],
    saved: ['job-105', 'job-107'],
    profile: {
      first_name: 'Ravi',
      city: 'Bengaluru',
      area: 'Koramangala',
      experience: '0–1 year',
      vehicle: 'Two-wheeler',
      own_vehicle: true,
      available: true,
      discoverable: false,
    },
    candidates: [
      { id: 'cand-1', code: 'FW-4K21', city: 'Bengaluru', area: 'Koramangala', experience: 'Fresher', vehicle: 'Two-wheeler', own_vehicle: true, available: true, languages: ['Kannada', 'Hindi'], skills: ['Route apps', 'Cash handling'] },
      { id: 'cand-2', code: 'FW-8P03', city: 'Bengaluru', area: 'HSR Layout', experience: '1–3 years', vehicle: 'Two-wheeler', own_vehicle: true, available: true, languages: ['Tamil', 'English'], skills: ['Food delivery', 'Night routes'] },
      { id: 'cand-3', code: 'FW-2M77', city: 'Bengaluru', area: 'Electronic City', experience: '0–1 year', vehicle: 'E-bike', own_vehicle: false, available: true, languages: ['Hindi', 'Bengali'], skills: ['E-bike', 'Parcel scanning'] },
      { id: 'cand-4', code: 'FW-6T19', city: 'Bengaluru', area: 'Whitefield', experience: '3+ years', vehicle: 'Two-wheeler', own_vehicle: true, available: false, languages: ['Telugu', 'Kannada'], skills: ['Team lead', 'COD reconciliation'] },
      { id: 'cand-5', code: 'FW-9C40', city: 'Bengaluru', area: 'Hebbal', experience: '1–3 years', vehicle: 'E-bike', own_vehicle: true, available: true, languages: ['Kannada'], skills: ['Hub sorting', 'E-bike'] },
      { id: 'cand-6', code: 'FW-1R58', city: 'Bengaluru', area: 'Yeshwanthpur', experience: 'Fresher', vehicle: 'Bicycle', own_vehicle: true, available: true, languages: ['Hindi', 'Odia'], skills: ['Loading'] },
      { id: 'cand-7', code: 'FW-5D62', city: 'Bengaluru', area: 'Koramangala', experience: '0–1 year', vehicle: 'Two-wheeler', own_vehicle: false, available: true, languages: ['Malayalam', 'English'], skills: ['Pharmacy delivery'] },
      { id: 'cand-8', code: 'FW-3H85', city: 'Bengaluru', area: 'HSR Layout', experience: '1–3 years', vehicle: 'Three-wheeler', own_vehicle: true, available: true, languages: ['Kannada', 'Tamil'], skills: ['Goods carrier', 'Transport licence'] },
    ],
    employers: [
      { id: PILOT_EMPLOYER_ID, name: 'Ghar-Tak Parcels', city: 'Bengaluru', kind: 'Last-mile courier', status: 'verified', joined: hAgo(24 * 120) },
      { id: 'emp-tiffin', name: 'Tiffinbox Kitchens', city: 'Bengaluru', kind: 'Cloud kitchen', status: 'verified', joined: hAgo(24 * 95) },
      { id: 'emp-dakshin', name: 'Dakshin Cold Chain', city: 'Bengaluru', kind: 'Cold storage', status: 'verified', joined: hAgo(24 * 200) },
      { id: 'emp-swiftline', name: 'Swiftline Hubs', city: 'Delhi NCR', kind: 'Sort centre operator', status: 'verified', joined: hAgo(24 * 60) },
      { id: 'emp-mandi', name: 'Mandi Movers', city: 'Pune', kind: 'B2B produce logistics', status: 'unverified', joined: hAgo(24 * 14) },
      { id: 'emp-kesari', name: 'Kesari Quick', city: 'Mumbai', kind: 'Quick commerce', status: 'verified', joined: hAgo(24 * 40) },
      { id: 'emp-railyard', name: 'Railyard Express', city: 'Chennai', kind: 'Freight forwarder', status: 'unverified', joined: hAgo(24 * 3) },
    ],
    audit: [
      { id: 'au-1', at: hAgo(3), actor: 'Pilot admin', action: 'employer.verify', target: 'Kesari Quick' },
      { id: 'au-2', at: hAgo(11), actor: 'Pilot admin', action: 'job.approve', target: 'Parcel delivery partner' },
      { id: 'au-3', at: hAgo(29), actor: 'Ghar-Tak Parcels', action: 'job.submit', target: 'Night hub supervisor' },
    ],
    tickets: [
      { id: 'tk-1', subject: 'Employer asked for a joining deposit', body: 'A recruiter on a call asked for 2,000 rupees before joining. Is that allowed?', from: 'worker', topic: 'Safety', status: 'open', created_at: hAgo(5) },
      { id: 'tk-2', subject: 'GST invoice for pilot plan', body: 'Need to know when invoices will be available.', from: 'employer', topic: 'Billing', status: 'in_progress', created_at: hAgo(52) },
      { id: 'tk-3', subject: 'Cannot change my city', body: 'Moved from Pune to Bengaluru, profile still shows Pune.', from: 'worker', topic: 'Profile', status: 'resolved', created_at: hAgo(120) },
    ],
    threads: [
      {
        id: 'th-1',
        participant: 'Hub lead, Dakshin Cold Chain',
        role: 'Sample shortlisted conversation',
        job_id: 'job-103',
        messages: [
          { id: 'm1', from: 'them', text: 'Namaste Ravi, you are shortlisted for the cold-room picker role. Can you come for a 20-minute walk-through on Thursday?', at: hAgo(20) },
          { id: 'm2', from: 'me', text: 'Yes, Thursday works. What time should I come?', at: hAgo(19) },
          { id: 'm3', from: 'them', text: 'Any time between 7 and 9 pm. Ask for the night shift lead at gate 2.', at: hAgo(18) },
        ],
      },
    ],
    notifications: [
      { id: 'n-1', title: 'Shortlisted: Cold-room picker', body: 'Dakshin Cold Chain shortlisted your application.', at: hAgo(20), read: false, href: '/applications' },
      { id: 'n-2', title: 'New message', body: 'Hub lead, Dakshin Cold Chain sent you a message.', at: hAgo(18), read: false, href: '/messages' },
      { id: 'n-3', title: '4 new jobs near Koramangala', body: 'Delivery and hub roles posted in the last 24 hours.', at: hAgo(30), read: true, href: '/' },
      { id: 'n-4', title: 'Application viewed', body: 'Swiftline Hubs opened your application for Hub sorter.', at: hAgo(26), read: true, href: '/applications' },
    ],
    team: [
      { id: 'tm-1', name: 'Pilot owner', role: 'Owner', status: 'active' },
      { id: 'tm-2', name: 'Hub recruiter (sample)', role: 'Recruiter', status: 'active' },
    ],
    prefs: { jobAlerts: true, statusUpdates: true, language: 'en' },
  };
}
