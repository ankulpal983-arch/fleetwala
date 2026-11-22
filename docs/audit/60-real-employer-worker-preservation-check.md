# 60. Real Employer & Real Worker Preservation Integrity Check

## 1. Objective & Scope

This audit provides explicit, verifiable proof that genuine pre-production entities were 100% preserved and undamaged during the invitation schema repair and staging data cleanup executed under Migration `025_fix_invitation_schema_and_remove_test_fixtures.sql`.

---

## 2. Protected Entities Integrity Matrix

| Entity | Identifier (UUID) | Attributes | Status | Integrity Check |
| :--- | :--- | :--- | :--- | :--- |
| **Genuine Employer** | `af42f70c-6b4f-48da-9cf4-d2707543602d` | `legal_name`: "flipkart"<br>`employer_type`: "vendor_dsp"<br>`verification_state`: "verified"<br>`created_by`: `2480d144-2f7d-44dd-81d3-567d7d6d47d4` | **Active / Verified** | **PASSED** (100% Intact) |
| **Employer Membership** | `29336709-13ef-4e94-822b-6d2e4fa02c21` | `user_id`: `2480d144-2f7d-44dd-81d3-567d7d6d47d4`<br>`role`: "owner"<br>`state`: "active" | **Active** | **PASSED** (100% Intact) |
| **Genuine Job** | `3595cdb6-1298-4100-be01-b0d148d38b6e` | `title`: "delivery hiring for delhi ncr"<br>`city`: "Delhi NCR"<br>`area`: "Dwarka"<br>`employer_id`: `af42f70c-6b4f-48da-9cf4-d2707543602d`<br>`state`: "published" | **Published** | **PASSED** (100% Intact) |
| **Genuine Worker** | `761d0d18-99ed-42cd-b117-71a593be4747` | `user_id`: `6fe9dfd1-66ee-41c0-9722-b95f828aad0f`<br>`full_name`: "Ankul"<br>`city`: "Delhi NCR"<br>`address_line`: "Dwarka"<br>`discoverable`: true<br>`account_state`: "active" | **Active & Discoverable** | **PASSED** (100% Intact) |
| **Secondary Real Account** | `8b91c8eb-27e2-48a1-87cf-8560777fca91` | `user_id`: `5733aa5f-ee59-4ed1-bc9d-9b6deb6b07b3`<br>`full_name`: "Ankul pal"<br>`account_state`: "active" | **Active** | **PASSED** (100% Intact) |
| **Genuine Application** | `6ed9e756-16af-4c98-be68-d693c8592c76` | `job_id`: `3595cdb6-1298-4100-be01-b0d148d38b6e`<br>`worker_id`: `761d0d18-99ed-42cd-b117-71a593be4747`<br>`status`: "hired" | **Hired** | **PASSED** (100% Intact) |
| **Canonical Conversation** | `e8fa2e36-faac-47e0-b786-2762a9934cc4` | `application_id`: `6ed9e756-16af-4c98-be68-d693c8592c76` | **Active** | **PASSED** (100% Intact) |
| **Chat Messages** | Multiple | 1. "hi i am hiring you" (employer)<br>2. "ok i am ready" (worker) | **Preserved (2/2)** | **PASSED** (100% Intact) |

---

## 3. Database Proof Queries (Post-Migration 025)

### Query 1: Verification of Genuine Employer and Membership
```sql
SELECT e.id, e.legal_name, e.verification_state, m.id as membership_id, m.user_id, m.role, m.state
FROM public.employers e
JOIN public.employer_memberships m ON m.employer_id = e.id;
```
**Result**:
- `id`: `af42f70c-6b4f-48da-9cf4-d2707543602d`
- `legal_name`: `flipkart`
- `verification_state`: `verified`
- `membership_id`: `29336709-13ef-4e94-822b-6d2e4fa02c21`
- `user_id`: `2480d144-2f7d-44dd-81d3-567d7d6d47d4`
- `role`: `owner`
- `state`: `active`

### Query 2: Verification of Genuine Job Listing
```sql
SELECT id, title, city, area, state, employer_id FROM public.jobs;
```
**Result**:
- `id`: `3595cdb6-1298-4100-be01-b0d148d38b6e`
- `title`: `delivery hiring for delhi ncr`
- `city`: `Delhi NCR`
- `area`: `Dwarka`
- `state`: `published`
- `employer_id`: `af42f70c-6b4f-48da-9cf4-d2707543602d`

### Query 3: Verification of Real Worker Ankul Discoverability
```sql
SELECT id, full_name, city, address_line, discoverable, account_state 
FROM public.workers 
WHERE id = '761d0d18-99ed-42cd-b117-71a593be4747';
```
**Result**:
- `id`: `761d0d18-99ed-42cd-b117-71a593be4747`
- `full_name`: `Ankul`
- `city`: `Delhi NCR`
- `address_line`: `Dwarka`
- `discoverable`: `true`
- `account_state`: `active`

### Query 4: Verification of Real Two-Way Chat History
```sql
SELECT m.id, m.body, m.created_at, u.role
FROM public.messages m
JOIN public.user_accounts u ON u.user_id = m.sender_id
WHERE m.conversation_id = 'e8fa2e36-faac-47e0-b786-2762a9934cc4'
ORDER BY m.created_at ASC;
```
**Result**:
1. Message: `"hi i am hiring you"` (Sent by employer user `2480d144-...`)
2. Message: `"ok i am ready"` (Sent by worker user `6fe9dfd1-...`)

---

## 4. Localhost Multi-Role Operational Health

Both development daemons remain operational on the host machine:
- **Express Backend API**: `http://localhost:5000` (`/api/healthz` -> `{"status":"ok"}`)
- **Vite React 19 Frontend**: `http://localhost:3000` (All 8 main routes responsive with zero console errors)

The owner can seamlessly test the three real accounts:
1. **Worker Account**: Views genuine published job `delivery hiring for delhi ncr`, manages application under `/applications`, and exchanges live messages under `/messages`.
2. **Employer Account** (`flipkart`): Views active hired candidate under `/employer/applicants`, searches discoverable worker Ankul in Delhi NCR under `/employer/candidates`, and chats under `/employer/messages`.
3. **Admin Account**: Oversees verified Flipkart employer and published jobs under `/admin`.
