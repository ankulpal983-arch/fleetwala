# Owner decision checklist

No item below is implicitly approved by a sample screen or SQL file.

| Topic | Conservative proposal | Owner input needed |
| --- | --- | --- |
| Launch surfaces | Build all three; do not launch unverified live paths | Confirm phased launch order |
| SMS | Supabase Phone Auth, no test bypass in production | Choose provider, approve India DLT setup and budget |
| Employer authentication | Email magic link; org activation after human verification | Approve login method and verification evidence |
| Admin | Trusted owner provisions allowlist; privileged MFA before launch | Name trusted admins privately and approve process |
| Categories/profile | Logistics only; no Aadhaar requirement; licence optional unless job requires | Confirm required profile fields and role taxonomy |
| Applications | Immutable worker/job pair; all successful applications including withdrawals count toward 20/IST day | Approve reapplication/withdrawal rules and transition matrix |
| Location | 15 km preference; manual city fallback explicitly approximate | Choose geocoding source, storage consent and retention |
| Language | English only initially, localization-ready | Approve Hindi scope and translation review |
| Billing | Disabled; ₹99/job, ₹10/unique org-worker pair remain proposals | Choose gateway, sandbox and exact entitlement timing |
| Contact access | No phone reveal on application; no reveal in preview | Approve ongoing authorization and revocation policy |
| Communications | Text-only, shortlisted participants; no public realtime broadcast | Confirm release timing and moderation/retention |
| Support/legal | Policy drafts only; no invented support address | Supply contacts, legal approval, retention/deletion and dispute rules |

## Proposed transition policy

Worker: `applied -> withdrawn`, `viewed -> withdrawn`, `shortlisted -> withdrawn` only.

Employer: `applied -> viewed/rejected`, `viewed -> shortlisted/rejected`, `shortlisted -> hired/rejected`. Terminal hired/rejected/withdrawn cannot be silently reopened. Exact database enforcement must be checked against the actual SQL and staging tests before approval.

These are engineering proposals pending owner approval. Do not infer legal retention periods or automatically destroy audit/payment records.
