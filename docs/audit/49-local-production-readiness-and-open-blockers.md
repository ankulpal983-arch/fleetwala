# 49. Local Production Readiness Scorecard and Owner Action Checklist

## 1. Readiness Scorecard
| Dimension | Target Standard | Current Status | Assessment |
| :--- | :--- | :--- | :--- |
| **Local Hosting Environment** | Windows localhost:3000 & 5000 | Online & Stable | **READY** |
| **Cloud Deployment Policy** | Strict prohibition on cloud deploy | No cloud infrastructure created | **COMPLIANT** |
| **Admin Authorization** | `ankulpalwork@gmail.com` provisioned | Active in `admin_principals` | **VERIFIED** |
| **Role-Based Account Isolation** | No workspace switcher leaks | Context-aware navigation & guards | **ENFORCED** |
| **Employer Job Posting & Review** | Form validation & `submit_job` RPC | Multi-step Zod + state machine | **VERIFIED** |
| **Candidate Invitations** | Real DB persistence & notifications | Migration 023 RPCs integrated | **VERIFIED** |
| **Worker Application Daily Cap** | 20 applications / IST calendar day | Asia/Kolkata date enforcement | **VERIFIED** |
| **Worker Pricing Model** | 100% Free for workers | ₹0 fee enforced across all endpoints | **VERIFIED** |
| **RLS Security Policies** | Zero anonymous table leakages | 77/77 Unit & Security Tests Pass | **HARDENED** |
| **Type Integrity** | Clean compilation | 0 TypeScript errors across monorepo | **PASSED** |

---

## 2. Non-Negotiable Gate Check Verification
1. **Zero Mock or Demo Data**:
   - Removed all instances of "Saved as pilot sample data", "Candidate Preview", "Demo-only limit", and "Invites open after live launch".
   - The platform exclusively consumes live PostgreSQL data from `jigbzsaaowtyaqhreplg`.
2. **Account Integrity**:
   - No existing user accounts or worker profiles were deleted or overwritten.
   - Remote Supabase database was preserved without dropping tables.
3. **Branch Hygiene**:
   - All work is strictly isolated on branch `real-preproduction-conversion`.
   - `main` remains untouched.

---

## 3. Owner Action Checklist (Manual Verification Steps in Google Chrome)

### Test Account Setup (Google Chrome)
Open `http://localhost:3000` in Google Chrome. You can test the three distinct roles using separate browser profiles or incognito tabs:

### Role 1: Administrator (`ankulpalwork@gmail.com`)
1. Navigate to: `http://localhost:3000/login`
2. Sign in with **`ankulpalwork@gmail.com`** (via Google OAuth or email).
3. Confirm direct redirection to the Admin Command Center: `http://localhost:3000/admin`.
4. Inspect the topbar: Topbar shows your name, role badge "Admin", and options for My Dashboard, Audit Trail, and Sign Out.
5. Review pending Employer Verifications at `http://localhost:3000/admin/employers`.
6. Review pending Job Approvals at `http://localhost:3000/admin/jobs`.

### Role 2: Employer Account
1. Open a new Incognito window or separate profile and navigate to: `http://localhost:3000/login`.
2. Sign in or register as an Employer.
3. If new, register your logistics organization name (e.g., "Speedy Logistics Hub").
4. Navigate to Manage Jobs: `http://localhost:3000/employer/jobs`.
5. Click **"Post Opening"**:
   - Complete the 4 organized sections: Role & Location, Requirements & Shifts, Compensation & Timeline, Role Description.
   - Note the live description character counter.
   - Click "Save Draft", then click "Submit for Review".
   - Confirm status changes to `pending_review`.
6. Navigate to Candidate Search: `http://localhost:3000/employer/candidates`.
   - Search available logistics candidates.
   - Click **"Invite"** on a candidate card, select your job, enter a custom message, and click Send.
   - Confirm invitation is created in real time.

### Role 3: Worker Account
1. Open a second Incognito window or another browser and navigate to: `http://localhost:3000/`.
2. Sign in or register as a Worker.
3. Browse published logistics jobs on the home page: `http://localhost:3000/`.
4. Click **"Apply Now"** on an active job:
   - Confirm the application is accepted with 0 fees.
   - Confirm daily application counter reflects "1 of 20 used today".
5. Navigate to My Applications: `http://localhost:3000/applications`.
6. Click the **"Hiring Invitations"** tab:
   - View pending invitations sent from employers.
   - Click **"Accept"** or **"Decline"**.
7. Test Geolocation:
   - On the Jobs page, click **"Use Current Location"**.
   - Test granting browser location to order logistics warehouses by proximity.
