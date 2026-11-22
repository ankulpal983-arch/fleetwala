# FleetWala Payment Gateway Architecture & Future Activation Plan

**Document:** `docs/deployment/07-payments-future-activation-plan.md`  
**Execution Timestamp:** 2026-11-22T18:55:20+05:30  
**Phase:** Phase 10 — Payment Gateway Work (Separate Owner Approval Required)  
**Author:** Antigravity Autonomous Engineering Orchestrator  
**Status:** SPECIFICATION READY / RUNTIME BILLING STRICTLY DISABLED  

---

## 1. Executive Summary & Gating Status

Live customer billing is currently **STRICTLY DISABLED**:
- Frontend Flag: `PILOT_PREVIEW_PAYMENTS_DISABLED = true`
- Database Configuration: `public.billing_settings.enabled = false`
- Payment Orders: Zero live transactions executed; zero real customer cards/UPI charged.

This document provides the complete, provider-agnostic implementation plan for activating payment processing once the owner selects a payment partner (Razorpay or Cashfree) and authorizes live sandbox keys.

---

## 2. PRD Baseline Pricing Model

| Commercial Product | Official PRD Price | Billing Model | Entitlement Trigger |
|:---|:---|:---|:---|
| **Job Listing Fee** | **₹99** per job | One-time charge per approved listing | Enables job to transition to `published` state upon admin approval |
| **Candidate Contact Unlock** | **₹10** per unique worker | One-time charge per employer-worker pair | Unlocks candidate phone number and direct contact details |
| **Worker Registration** | **₹0 (Free)** | Zero fees for blue-collar candidates | Workers are never charged to register, apply, or message employers |

---

## 3. Provider Evaluation: Razorpay vs. Cashfree

| Criterion | Razorpay (Option A) | Cashfree Payments (Option B) |
|:---|:---|:---|
| **UPI / QR Penetration** | Industry standard in India; instant QR & Intent | Excellent UPI & auto-collect support |
| **Webhook Reliability** | HMAC-SHA256 signature verification | HMAC-SHA256 timestamp signature verification |
| **SDK & Documentation** | Mature Node.js & React integrations | Comprehensive Node.js REST API |
| **Settlement Cycle** | T+2 standard (instant settlement optional) | T+1 / T+2 standard |
| **Recommendation** | **(Recommended)** Easiest developer onboarding & dashboard | Reliable alternative with lower domestic pricing |
| **Current Status** | **OWNER DECISION PENDING** | **OWNER DECISION PENDING** |

---

## 4. Architectural Payment Flow Specification

```
1. Employer clicks "Post Job" or "Unlock Contact"
         │
         ▼
2. Frontend requests Order Creation from Render Express API:
   POST /api/payments/create-order
   (Calculates ₹99 or ₹10, generates order_id via Razorpay/Cashfree SDK)
         │
         ▼
3. Express records order in PostgreSQL public.payment_orders (status = 'created')
         │
         ▼
4. Frontend opens Provider Checkout Modal (UPI, Cards, Netbanking)
         │
         ▼
5. Customer completes payment; Provider sends Webhook to Render API:
   POST /api/webhooks/razorpay
         │
         ▼
6. Render Express Backend validates HMAC-SHA256 signature:
   crypto.createHmac('sha256', secret).update(body).digest('hex') == signature
         │
         ▼
7. On verified payment:
   ├── Updates payment_orders.status = 'captured'
   ├── Calls PostgreSQL RPC grant_payment_entitlement()
   │    ├── For Job: inserts into public.job_entitlements
   │    └── For Unlock: inserts into public.candidate_contact_unlocks
   └── Emits audit log entry in public.audit_log
         │
         ▼
8. Real-time Supabase subscription notifies employer; UI unlocks immediately
```

---

## 5. Security & Zero-PII Guarantees

1. **No Client-Side Secrets:** Razorpay Key Secret / Cashfree Secret Key resides exclusively on Render backend in private environment variables.
2. **Idempotent Webhooks:** Webhook processing validates `order_id` in `payment_orders`. Duplicate webhook retries from payment providers return HTTP 200 without double-crediting entitlements.
3. **Fail-Closed Privacy:** If a payment fails, is canceled, or is pending reconciliation, candidate contact details remain strictly masked.
4. **No Predatory Fees:** The platform rejects listings that ask workers for application deposits or training fees.

---

## 6. Activation Runbook (When Owner Authorizes Payments)

When the project owner decides to activate payments:
1. Register Merchant Account on [Razorpay](https://razorpay.com) or [Cashfree](https://cashfree.com).
2. Generate Test API Keys (`Key ID` and `Key Secret`).
3. Add to Render Environment Variables:
   - `PAYMENT_PROVIDER=razorpay`
   - `RAZORPAY_KEY_ID=<key_id>`
   - `RAZORPAY_KEY_SECRET=<key_secret>`
4. Set Webhook URL in Provider Dashboard: `https://<render-service-url>/api/webhooks/razorpay`.
5. Execute one ₹1 test charge using sandbox UPI / card.
6. Toggle database setting: `UPDATE public.billing_settings SET enabled = true;`.

---

## 7. Phase 10 Exit Gate Sign-Off

- [x] Provider-agnostic specification completed.
- [x] Baseline PRD pricing (₹99 / ₹10) verified in tests.
- [x] Zero-PII leakage guarantees on failed/pending payments specified.
- [x] Live payments safely held disabled (`PILOT_PREVIEW_PAYMENTS_DISABLED = true`).
