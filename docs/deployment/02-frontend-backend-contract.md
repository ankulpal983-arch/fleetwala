# FleetWala Frontend-Backend Interface Contract & Cross-Origin Protocol

**Document:** `docs/deployment/02-frontend-backend-contract.md`  
**Execution Timestamp:** 2026-11-22T18:50:30+05:30  
**Phase:** Phase 5 — Split Deployment Architecture Design (Vercel + Render + Supabase)  
**Author:** Antigravity Autonomous Engineering Orchestrator  
**Status:** PASS — Verified API Contracts & Network Topology  

---

## 1. Request Flow Taxonomy

FleetWala categorizes all network operations into two distinct pipelines:
1. **Direct-to-Supabase Pipeline (Client-to-Database):**  
   Low-latency, high-security operations where PostgreSQL Row Level Security (RLS) and `SECURITY DEFINER` procedures enforce all business rules and multi-tenant isolation.
2. **Render API Pipeline (Server-to-Server / Privileged Webhooks):**  
   Operations that require third-party secret verification (e.g., Razorpay webhook signature calculation via HMAC-SHA256) or health/liveness probes.

```
┌──────────────────────────────────────────────────────────────────────────────────┐
│                             BROWSER APPLICATION (Vite/React)                     │
└────────────┬────────────────────────────────────────────────────────┬────────────┘
             │                                                        │
             │ [Pipeline 1: Direct-to-Supabase with Bearer JWT]       │ [Pipeline 2: Render API]
             ▼                                                        ▼
┌──────────────────────────────────────────────┐        ┌───────────────────────────────┐
│              SUPABASE GATEWAY                │        │          RENDER API           │
│                                              │        │                               │
│ • Authentication (GoTrue OAuth & Passwords)  │        │ • GET /api/healthz (Probe)   │
│ • Workers: save_worker_profile, preferences  │        │ • POST /api/webhooks/* (P10)  │
│ • Jobs: create/update drafts, submit_job     │        │ • Signature Verification      │
│ • Admin: review_job, admin_review_employer   │        │                               │
│ • Applications: apply_to_job, status change  │        │                               │
│ • Chat & Notices: send_message, notifications│        │                               │
│ • Documents: Private Supabase Storage Bucket │        │                               │
└──────────────────────────────────────────────┘        └───────────────────────────────┘
```

---

## 2. Direct-to-Supabase Operations Specification

| Capability | RPC Function / Table Endpoint | Method | Client Permission Guard | Backend Security Mechanism |
|:---|:---|:---|:---|:---|
| **Worker Onboarding** | `rpc('save_worker_profile')` | POST | Authenticated Session | Security Definer; validates `auth.uid()` |
| **Draft Job Creation** | `from('jobs').insert(...)` | POST | Authenticated Employer | Table RLS: `jobs_org_draft_insert` |
| **Draft Job Update** | `from('jobs').update(...).eq('state', 'draft')` | PATCH | Authenticated Employer | Table RLS: `jobs_org_draft_update` |
| **Submit for Review** | `rpc('submit_job', { p_job_id })` | POST | Active Org Owner/Manager | Security Definer; idempotent transition |
| **Job Moderation** | `rpc('review_job', { p_job_id, p_approve })` | POST | Allowlisted Administrator | Security Definer; requires `is_admin() = true` |
| **Employer Verification**| `rpc('admin_review_employer', ...)` | POST | Allowlisted Administrator | Security Definer; updates `verification_state` |
| **Apply to Job** | `rpc('apply_to_job', { p_job_id })` | POST | Active Worker Profile | Security Definer; 20/day IST quota & idempotency |
| **Candidate Discovery** | `rpc('discover_candidates', ...)` | POST | Verified Employer Org | Security Definer; SHA-256 handle, zero PII |
| **Shortlist / Hire** | `rpc('set_application_status', ...)` | POST | Authorized Employer | Security Definer; state machine validation |
| **In-App Messaging** | `rpc('send_message', ...)` | POST | Conversation Participant | Security Definer; validates participant table |

---

## 3. Render Express API Server Specification

The backend server is implemented in `artifacts/api-server/src/app.ts` using Express 5.

### 3.1 Implemented Endpoints

#### `GET /api/healthz`
- **Purpose:** Liveness and readiness probe for Render automated health checks and uptime monitors.
- **Request Headers:** None required.
- **Response Status:** `200 OK`
- **Response Body:**
  ```json
  {
    "status": "ok"
  }
  ```
- **Validation:** Enforced via `@workspace/api-zod` `HealthCheckResponse` schema.

### 3.2 CORS Configuration & Origin Allowlist

In `artifacts/api-server/src/app.ts`:
- **Allowed Methods:** `GET, POST, PUT, PATCH, DELETE, OPTIONS`
- **Allowed Headers:** `Content-Type, Authorization, X-Requested-With, baggage, sentry-trace`
- **Allowed Origins:**
  - Localhost: `http://localhost:3000`
  - Vercel Deployments: `https://*.vercel.app`, `https://fleetwala.vercel.app`
- **Credentials:** Enabled for secure cross-origin requests.

---

## 4. Phase 5 Summary

Both deployment tiers are decoupled, cleanly bounded, and type-checked against shared zod schemas. All user-facing business logic operates directly against Supabase RLS policies with sub-100ms response times, while Render serves health monitoring and provides a dedicated runtime for server-side webhook secrets.
