# FleetWala — India Regulatory Compliance, DPDP Act 2023, IT Act Sec 79 Intermediary & Owner Action Checklist

**Document ID:** FW-AUDIT-042  
**Target Jurisdiction:** India (Bengaluru, Karnataka)  
**Applicable Statutes:**  
- Digital Personal Data Protection (DPDP) Act, 2023  
- Information Technology Act, 2000 (Section 79 Intermediary Protection)  
- Information Technology (Intermediary Guidelines and Digital Media Ethics Code) Rules, 2021  
**Audit Date:** November 22, 2026  
**Branch:** `real-preproduction-conversion`  

---

## 1. Regulatory Framework & India Logistics Context

Operating a digital workforce marketplace in India requires strict adherence to privacy, data localization, intermediary safe harbor, and labor protections. Blue-collar gig workers (delivery partners, warehouse sorters) are disproportionately vulnerable to scam recruitment fees, unauthorized phone number harvesting, and biometric identity misuse.

FleetWala is built from the ground up with the following statutory pillars:

### 1.1 Digital Personal Data Protection (DPDP) Act, 2023 Compliance
- **Data Minimization:** Only collecting data strictly required for logistics hiring (vehicle category, commercial driving license eligibility, city, preferred delivery hubs).
- **Prohibition of Mandatory Biometric/Aadhaar Collection:** FleetWala **never mandates or stores raw 12-digit Aadhaar numbers**. Identity verification relies on voluntary phone OTP verification and employer-managed offline document inspection upon reporting for duty.
- **Phone Number Privacy by Default:** Worker phone numbers are masked in all public feeds and candidate discovery tables (`+91 98XXX XXXXX`). Direct phone contacts are only revealed when a verified employer explicitly unlocks a candidate.
- **Worker Free to Apply Guarantee:** In adherence to fair hiring principles, workers **never pay a single rupee** to apply for any job listed on FleetWala. Any employer demanding recruitment deposits or onboarding fees is subject to immediate account termination and police reporting.
- **Daily Application Cap:** To prevent candidate fatigue, spam applications, and coordinated bot harvesting, workers are capped at **20 job applications per IST calendar day** enforced via PostgreSQL database triggers.
- **Right to Erasure & Access:** Workers can request complete account deletion directly from `/worker/settings` or via `/support`.

### 1.2 Information Technology Act, 2000 (Section 79 Intermediary Protection)
- FleetWala operates strictly as an **Intermediary** under Section 79 of the IT Act, 2000.
- FleetWala does not initiate job listings, alter job compensation terms, or select job candidates directly.
- The platform observes mandatory due diligence under the IT (Intermediary Guidelines and Digital Media Ethics Code) Rules, 2021, including prominent Terms of Service, Privacy Policy, and an active Grievance Redressal mechanism.

### 1.3 Grievance Redressal Architecture (IT Rules 2021)
- **Accessible Channel:** Publicly accessible route at `/support` and `/contact`.
- **Statutory Timelines:**
  - Acknowledgement of grievance receipt within **24 hours**.
  - Disposal / resolution of grievance within **15 calendar days**.
- **Backend Persistence:** Grievance submissions are inserted directly into `public.support_tickets` in PostgreSQL with audit timestamps.

---

## 2. Dedicated Legal & Support Routes Summary

| Route Path | Statutory Focus | User-Facing Features & Copy |
|:---|:---|:---|
| `/privacy` | DPDP Act 2023 | Full breakdown of data categories collected, phone masking safeguards, zero Aadhaar policy, Supabase cloud processing disclosure, and account deletion procedure. |
| `/terms` | Sec 79 IT Act 2000 | Intermediary disclaimer, 100% free worker apply policy, anti-scam recruitment fee warning, employer verification criteria, and Bengaluru legal jurisdiction. |
| `/support` / `/contact` | IT Rules 2021 | Grievance submission form connected to `support_tickets` table, IT Rules response SLA notice, and Grievance Officer designation. |
| `/help` / `/faq` | Logistics Education | Worker onboarding guide, shift timings, vehicle checklist, scam reporting instructions, and employer hiring rules. |

---

## 3. Comprehensive Owner Action Required (`[OWNER ACTION REQUIRED]`) Inventory

To prepare FleetWala for live public production and legal incorporation, the application templates contain clearly marked placeholders. These placeholders allow local testing to run completely without crashing, while providing the owner with an unambiguous roadmap for commercial launch:

| Item # | Placeholder Identifier | Current Code Location | Required Production Action | Blocking for Local Dev? |
|:---|:---|:---|:---|:---|
| **OA-01** | `[OWNER ACTION REQUIRED: Registered Legal Entity Name]` | `src/pages/legal.tsx` (Privacy & Terms) | Replace with your registered Ministry of Corporate Affairs (MCA) Private Limited company name. | **NO** (Runs cleanly in local pre-prod) |
| **OA-02** | `[OWNER ACTION REQUIRED: Corporate Identification Number (CIN)]` | `src/pages/legal.tsx` (Terms of Service) | Insert the 21-digit alphanumeric CIN issued by the Registrar of Companies (ROC). | **NO** |
| **OA-03** | `[OWNER ACTION REQUIRED: Official Registered Office Address]` | `src/pages/legal.tsx` (Terms & Support) | Update with the company's official registered postal address in Bengaluru / Karnataka. | **NO** |
| **OA-04** | `[OWNER ACTION REQUIRED: Grievance Officer Name & Contact]` | `src/pages/legal.tsx` (Support & Privacy) | Designate an Indian resident employee as Grievance Officer and set up `grievance@fleetwala.com`. | **NO** |
| **OA-05** | `[OWNER ACTION REQUIRED: Official Support Email]` | `src/pages/legal.tsx`, `worker-more.tsx` | Configure domain email `support@fleetwala.com` in Google Workspace or Zoho Mail. | **NO** |
| **OA-06** | `[OWNER ACTION REQUIRED: Payment Gateway Merchant Credentials]` | `artifacts/api-server/.env.local`, `docs/deployment/07-payments-future-activation-plan.md` | Complete Razorpay / Cashfree merchant KYC and insert live API Keys for ₹99/job and ₹10/contact unlocks. | **NO** (Honest local gating preserved) |
| **OA-07** | `[OWNER ACTION REQUIRED: Custom Domain SMTP Integration]` | Supabase Project `jigbzsaaowtyaqhreplg` Auth Settings | Configure custom SMTP credentials (Resend, SendGrid, or AWS SES) to lift the 3-email/hour default rate limit. | **NO** (Google OAuth & local users work) |

---

## 4. Verification & Audit Sign-Off

- **Headless Chrome Verification:** Routes `/privacy`, `/terms`, `/support`, and `/help` load without runtime errors or unhandled rejections (Status: 200 OK, confirmed in `browser-smoke-test.cjs`).
- **Data Minimization Proof:** Profile and application forms do not contain any Aadhaar or biometric input fields.
- **Anti-Scam Transparency:** Prominent warnings on `/welcome`, `/terms`, and `/jobs` explicitly state that FleetWala never charges workers recruitment fees.
