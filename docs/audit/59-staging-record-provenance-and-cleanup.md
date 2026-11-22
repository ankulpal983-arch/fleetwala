# 59. Antigravity Staging Record Provenance & Database Cleanup Audit

## 1. Provenance of Staging & Test Records

During earlier automated phase setup and staging tests (specifically Migration `013_test_fixtures_staging_only.sql` and synthetic test helpers), demo records were seeded into the remote Supabase database (`jigbzsaaowtyaqhreplg`):
- **Staging Employers**: Mock logistics entities (`Ghar-Tak Parcels Staging Pvt Ltd` and `Bengaluru Fast-Fleet Logistics`) intended to simulate multi-tenant employer portals.
- **Staging Jobs**: Synthetic listings created across Bengaluru hubs (`Express Parcel Delivery Partner`, `Hub Sorter - Whitefield Warehouse`, etc.).
- **Synthetic Worker**: A fixture worker record (`Ramesh Kumar`) mapped to a dummy UUID `33333333-3333-3333-3333-333333333333`.
- **Test Applications & Conversations**: Applications submitted during automated pipeline smoke tests to verify status transitions.

In pre-production, these mock records cluttered the employer job management dashboard, the candidate discovery directory, and the visitor public marketplace.

---

## 2. Inventory of Purged Staging Records

In Migration `025_fix_invitation_schema_and_remove_test_fixtures.sql`, all synthetic fixtures were identified by primary key and deleted in an atomic transaction:

| Entity Type | Record ID / Identifier | Name / Title | Action |
| :--- | :--- | :--- | :--- |
| **Employer** | `6e7c9a06-b7ba-4a76-bb3c-25e9b410639f` | Ghar-Tak Parcels Staging Pvt Ltd | Purged |
| **Employer** | `480c9331-a3fc-4a8b-b636-f91472965708` | Bengaluru Fast-Fleet Logistics | Purged |
| **Job** | `ad8adc97-e06f-45e7-a5b5-fdb7b517f4d1` | Express Parcel Delivery Partner | Purged |
| **Job** | `41552fab-d004-4c2e-84e9-10197df8afea` | Hub Sorter - Whitefield Warehouse | Purged |
| **Job** | `179be734-84bd-434e-9569-b96a5906cf52` | hiring in flipkart (under Ghar-Tak) | Purged |
| **Job** | `6157b3c8-018c-4187-ba4c-cb6ec40d91a2` | Express Delivery Partner - Electronic City | Purged |
| **Worker** | `800d0fd8-ff46-4482-927f-8ccb03b14ac0` | Ramesh Kumar (synthetic fixture) | Purged |
| **Application** | `1e25c9a6-2bf9-4b28-9be9-c12243d95111` | Application to Express Parcel Delivery | Purged |
| **Application** | `9bb44841-0d97-4dda-a86b-fc2b259e2048` | Application to Express Parcel Delivery | Purged |
| **Application** | `ea4fbf95-faa7-456d-b949-79d6b19a06f5` | Application to Staging Flipkart listing | Purged |
| **Application** | `2083c668-47cd-4073-ae6d-0237ce4e1290` | Application to Express Parcel Delivery | Purged |
| **Conversation**| `ef7261e2-379a-4f18-9372-7398a19247ae` | Chat on app 1e25c9a6 | Purged |
| **Conversation**| `153d2a7a-57d9-40a2-a1e7-1446697cf575` | Chat on app ea4fbf95 | Purged |
| **Membership**  | `1c307ec2-6534-4732-8161-b6db67a4cacc` | Ghar-Tak owner link (2222...)| Purged |
| **Membership**  | `beaf3887-a016-43da-8fcd-e4c9ce597d9f` | Ghar-Tak secondary link | Purged |
| **Membership**  | `ae450e47-0741-444a-b860-2cfc8d034920` | Bengaluru Fast-Fleet link (4444...)| Purged |
| **User Account**| `33333333-3333-3333-3333-333333333333` | Synthetic worker account | Purged |
| **User Account**| `22222222-2222-2222-2222-222222222222` | Synthetic employer account | Purged |
| **User Account**| `44444444-4444-4444-4444-444444444444` | Synthetic employer account | Purged |

---

## 3. Atomic Foreign-Key Safe Deletion Order

To prevent foreign key constraint violations during deletion, the statements were sequenced in dependency order inside a single PostgreSQL transaction:

```text
1. messages (referencing test conversations)
2. conversation_participants (referencing test conversations)
3. conversations (test conversation records)
4. candidate_invitations (referencing test employers/jobs/workers)
5. application_status_history (referencing test applications)
6. job_applications (test application records)
7. job_status_history (referencing test jobs)
8. saved_jobs, user_reports, job_entitlements (referencing test jobs)
9. jobs (test job records)
10. employer_verification_reviews, employer_memberships, contact_unlocks, support_tickets (referencing test employers)
11. employers (test employer records)
12. worker_preferences, worker_skills, worker_documents (referencing synthetic worker)
13. workers (synthetic worker record)
14. user_accounts (synthetic user records)
```

Each `DELETE` statement incorporated negative WHERE conditions explicitly forbidding the deletion of any genuine Flipkart or Ankul records:
```sql
AND employer_id NOT IN ('af42f70c-6b4f-48da-9cf4-d2707543602d')
AND job_id NOT IN ('3595cdb6-1298-4100-be01-b0d148d38b6e')
AND worker_id NOT IN ('761d0d18-99ed-42cd-b117-71a593be4747')
```

---

## 4. Post-Cleanup Verification Evidence

Direct read-only queries against Supabase production project `jigbzsaaowtyaqhreplg` verified the purge:

1. **Employers Query**:
   ```sql
   SELECT id, legal_name, verification_state FROM public.employers;
   ```
   **Output**: Exactly 1 row: `af42f70c-6b4f-48da-9cf4-d2707543602d` (`flipkart`). Zero staging employers.

2. **Jobs Query**:
   ```sql
   SELECT id, title, city, state FROM public.jobs;
   ```
   **Output**: Exactly 1 row: `3595cdb6-1298-4100-be01-b0d148d38b6e` (`delivery hiring for delhi ncr`). Zero staging jobs.

3. **Workers Query**:
   ```sql
   SELECT id, full_name, city, discoverable FROM public.workers;
   ```
   **Output**: 2 rows: Real worker `Ankul` (`761d0d18-...`, Delhi NCR, discoverable=true) and owner second account `Ankul pal` (`8b91c8eb-...`). Synthetic fixture `Ramesh Kumar` is 100% removed.

4. **Applications Query**:
   ```sql
   SELECT id, job_id, worker_id, status FROM public.job_applications;
   ```
   **Output**: Exactly 1 row: `6ed9e756-16af-4c98-be68-d693c8592c76` (`hired`). Zero test applications.
