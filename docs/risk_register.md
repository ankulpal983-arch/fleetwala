# Risk register

| Risk | Severity | Mitigation / gate |
| --- | --- | --- |
| Missing original PRD | High | Upload PDF; original comparisons stay UNVERIFIED |
| Pilot mistaken for real recruitment | Critical | Persistent sample-data labeling; no real contacts, payments or live-mode bypass |
| Live authorization not verified | Critical | Do not enable live portal; ordinary-user RLS/direct REST negative tests required |
| Concurrent cap overshoot | High | Transactional draft SQL; staging parallel request tests required |
| Employer sees worker identity prematurely | Critical | Anonymous projections; deny direct worker-profile reads; payload tests required |
| Supabase migration failure/order error | High | Disposable staging, numbered files, apply evidence; never claim executed |
| India SMS operational noncompliance | High | Owner-selected provider and documented India DLT approval |
| Billing abuse/forged success | Critical | Billing disabled; implement only after gateway approval and signed webhook tests |
| Unreviewed privileged role grants | Critical | Owner-provisioned admin; no metadata or client role switch grants |
| Sensitive uploaded documents | Critical | Real upload unavailable; private bucket/RLS drafts not a content scanner |
| Retention/legal assumptions | High | No destructive cleanup; policies pending qualified owner/legal approval |
| Browser-local pilot data lost | Medium | Do not enter real data; local state isn't durable business storage |
| Next.js architecture mismatch | Medium | Explicitly documented Vite selection; migration needs a separate architecture decision |
| Incomplete accessibility/network checks | Medium | Basic responsive visual review only; keyboard/assistive/network QA pending |

Risk ownership is with the product owner for external approvals and the implementation team for incomplete engineering and verification.
