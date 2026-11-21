# Release readiness — NOT READY for production

## Delivered category

**Runnable pilot plus unexecuted Supabase foundation.** This is not the complete production SaaS requested by the TXT. This distinction must remain visible in the handoff.

## Release gates

- [ ] Original PRD PDF reconciled.
- [ ] Owner accepts React + Vite rather than Next.js or approves the required migration.
- [ ] Disposable staging project approved; all numbered SQL executed successfully.
- [ ] Live portal reads/writes connected to Supabase; pilot state never mixed with live data.
- [ ] Actual phone OTP delivery, wrong/expired codes, resend controls and logout verified.
- [ ] Secure employer onboarding and server-provisioned admins; privileged MFA enforced.
- [ ] Worker and employer isolation tested with ordinary JWT contexts, including direct REST/RPC.
- [ ] Live-only job eligibility rechecked atomically at application time.
- [ ] Applications 1–20 pass, 21 fails, concurrency cannot exceed 20, IST midnight tested.
- [ ] Locked candidates and page hydration contain no PII; opt-out immediately removes discovery.
- [ ] Private uploads validated by content, ownership and expiring access.
- [ ] Authorized text-chat read/write and notification isolation verified.
- [ ] Payment provider approved, trusted handlers implemented and sandbox abuse tests passed.
- [ ] Production billing explicitly authorized; no implicit permission from pilot screens.
- [ ] Keyboard, assistive-tech, offline, slow-network and mobile QA completed.
- [ ] Legal/support/retention/dispute decisions approved.
- [ ] Deployment environment, domain, HTTPS, redirects, monitoring and restore drill verified.

## Phase verdicts

| Phase | Honest verdict |
| --- | --- |
| 0 Repository/PRD | Partial: repository scaffold examined, TXT read, PDF missing |
| 1 Foundation | Pilot implementation; commands/evidence recorded in QA report |
| 2 Authentication | Adapter only; live identity/session verification BLOCKED |
| 3 Supabase/RLS | DRAFT SQL; migrations and policies NOT TESTED |
| 4 Worker | PILOT; live flow NOT DELIVERED |
| 5 Employer | PILOT; live tenancy NOT TESTED |
| 6 Admin/trust | PILOT; real protected control plane NOT DELIVERED |
| 7 Payments | Safely disabled; gateway integration NOT DELIVERED |
| 8 Chat/notifications | PILOT; real participant isolation NOT TESTED |
| 9 QA/security | Limited checks only; full test matrix outstanding |
| 10 Release operations | Runbooks created; production NOT READY |
| 11 Independent audit | NOT PERFORMED; no fabricated independent certification |

Only actual executed commands, screenshots and observed outcomes belong in `qa_results.md`. Specialist code delivery does not turn untested phases into PASS.
