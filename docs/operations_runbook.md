# Operations and release runbook

## Staging setup

1. Approve a fresh disposable Supabase project. Keep production data out of it.
2. Save credentials only using project/provider secret management. Browser receives only project URL and publishable key.
3. Follow `supabase/migrations/README.md`; record each file applied and any error. SQL generation is not SQL execution.
4. Configure Phone Auth/SMS and email delivery with staged allowlists and spending safeguards. Confirm the provider's India regulatory requirements and current delivery behavior directly.
5. Configure authentication redirect allowlists for the actual preview and later the verified production domain; avoid open redirect parameters.
6. Provision approved organization memberships and the first admin through a trusted process. Enable and enforce privileged MFA before production.
7. Implement missing Supabase portal adapters before enabling live mode. Regenerate DB TypeScript types from the actual staged schema, do not guess column names.
8. Test all role and tenant boundaries with normal worker/employer/admin accounts and direct REST/RPC requests.

## Publishing is not launch approval

The preview can be published as a labeled demonstration. A production recruitment launch is **not approved**. Before launch, finish the gates in `release_readiness.md`, obtain the actual published URL from the publishing interface, set auth redirects against that verified domain, verify HTTPS, then smoke-test a fresh signed-out session and ordinary user sessions.

No canonical production URL has been invented or hardcoded. Do not use the development host as a production callback address.

## Payment integration gate

Do not select a gateway implicitly. After owner approval, build a trusted server-side order endpoint and a raw-body signed webhook handler using that gateway's current official contract. Verify signature, merchant, order, purpose, INR amount and currency. Handle event deduplication, transaction rollback/reconciliation, settled-only entitlements and unique employer-worker unlocks. Browser “success” is never authority. Keep production billing disabled until sandbox tests and business/legal approval pass.

## Monitoring and incident response

- Before live release, add request correlation, masked structured errors, auth abuse monitoring, worker-limit refusal metrics and audited privileged operations.
- Never log OTPs, tokens, phone/email, signed file URLs or secret values.
- Rate-limit OTP requests using Supabase project controls and provider safeguards; add server-side request limits to future trusted endpoints. A resend countdown is only UX.
- If unauthorized access is suspected: disable affected endpoint/feature, preserve masked evidence, revoke affected sessions/permissions, rotate exposed server secrets through the provider, investigate impact, follow owner-approved notification procedures.
- If a payment handler fails: leave entitlements denied and reconcile server-to-server; never manually trust a browser receipt.

## Backup, migration and rollback

Supabase owns the external database backup/restore mechanism. Confirm its actual project plan, enabled recovery capability and restore process before promising a recovery window. Verify a restore into an approved separate environment before production release.

Versioned SQL files should be applied once in order. Do not run destructive “down” scripts on live worker/payment/audit data. A code checkpoint rollback does not undo external Supabase migrations. Prefer forward corrective migrations after owner-approved backups and staged verification.

## Privacy and support

- Discoverability defaults off; revoke future discovery immediately on opt-out. Prior applications/conversations need an approved separate policy.
- Export/deletion require reauthentication, identity verification, scoped export and a legally reviewed retention decision. Do not silently erase billing/audit records.
- No automatic irreversible retention job is enabled.
- No invented legal approval or support email. Owner must supply actual support, grievance and incident contacts.
- Review document necessity and content/type/size checking before accepting uploads. Signed links must expire and never be logged.
