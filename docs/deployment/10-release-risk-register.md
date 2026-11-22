# FleetWala Pre-Production Release Risk Register

**Document:** `docs/deployment/10-release-risk-register.md`  
**Execution Timestamp:** 2026-11-22T18:57:00+05:30  
**Repository:** `https://github.com/ankulpal983-arch/fleetwala`  
**Development Branch:** `real-preproduction-conversion`  
**Author:** Antigravity Autonomous Engineering Orchestrator  

---

## 1. Risk Register Matrix

| Risk ID | Severity | Category | Risk Description | Current Mitigation | Owner Action Required | Exit Criteria |
|:---|:---|:---|:---|:---|:---|:---|
| **RSK-01** | **P1** | Authentication | Default Supabase Auth email rate limits (~3–4 confirmation emails/hour) for new email/password signups. | `formatAuthError` provides actionable user guidance. Google OAuth is fully operational and bypasses email rate limits. | Configure Custom SMTP (Resend / SendGrid / Brevo) in Supabase Dashboard. | Custom SMTP verified on custom domain. |
| **RSK-02** | **P1** | Monetization | Customer billing is disabled (`PILOT_PREVIEW_PAYMENTS_DISABLED = true`), preventing live ₹99/₹10 collections. | Fail-closed gate prevents accidental unbilled candidate contact reveals. Complete architecture spec ready in Doc 07. | Select payment provider (Razorpay or Cashfree) and authorize sandbox API keys. | Test payment order and webhook signature verified in staging. |
| **RSK-03** | **P1** | Deployment | Live cloud deployments on Vercel and Render require one-time owner account linking. | All configuration files (`vercel.json`, `render.yaml`) and build commands prepared and tested locally. | Connect GitHub repo on Vercel and Render dashboards following Doc 09 runbook. | Live HTTPS Preview URLs assigned and responding with HTTP 200. |
| **RSK-04** | **P2** | Infrastructure | Render Free Tier Web Service enters sleep mode after 15 minutes of inactivity (cold start delay ~40s). | Direct-to-Supabase user requests are unaffected by Render cold starts. Express is only used for health/webhooks. | Upgrade to Render Starter ($7/mo) when commercial traffic begins. | Zero cold start latency on API server. |
| **RSK-05** | **P2** | Authentication | Mobile Phone OTP via SMS is deferred. | Blue-collar workers can sign in via Google OAuth or Email. Form validation and stubs preserved. | Provide MSG91 / Twilio SMS gateway credentials when mobile OTP is desired. | End-to-end SMS OTP delivery verified. |
| **RSK-06** | **P2** | Domain / DNS | Custom production domain (`fleetwala.in` / `fleetwala.com`) not yet mapped to Vercel/Render. | Vercel and Render provide valid HTTPS subdomains (`*.vercel.app`, `*.onrender.com`). | Purchase domain and configure DNS CNAME records. | SSL certificates issued and active on custom domain. |

---

## 2. Risk Mitigation Status

All code-level and database-level security and workflow risks (including the P0 Submit for Review defect, multi-tenant RLS isolation, draft editing duplication, and search path vulnerabilities) have been **100% ELIMINATED** in the codebase and remote database.

The remaining open items in the risk register are platform account connection and provider configuration tasks that require owner account authority.
