# Source reconciliation

## Sources and provenance

Available: `attached_assets/FleetWala_Replit_Full_End_to_End_Master_Prompt_1795281929778.txt`, version 2.0.

Missing: `FleetWala_Full_Product_Requirements_Document_PRD.pdf`, reportedly 14 pages, dated 12 November 2026.

**Original PRD reconciliation: UNVERIFIED.** Statements called “original PRD” in the TXT are second-hand requirements; this implementation cannot certify their agreement with the missing PDF.

## Recorded overrides

| Decision | Source | Treatment |
| --- | --- | --- |
| Supabase Auth, not Clerk | OWNER OVERRIDE in TXT | Supabase-only authentication adapter; no custom local authentication |
| Responsive browser app, not Expo | OWNER OVERRIDE in TXT | Web artifact |
| Three portals in scope | OWNER OVERRIDE in TXT | Worker, employer and admin pilot surfaces |
| React + Vite artifact | Explicit selected output in user's message | Followed; deviates from TXT's Next.js App Router requirement |
| No real billing without approval | OWNER OVERRIDE in TXT | Disabled |
| Pilot data must not be portrayed as production | TXT execution discipline | Explicit pilot labeling and live-mode gate |

## Repository audit scope

The initial repository contained a generic Express health API, unpopulated database/schema libraries, shared API code generation and a reusable component preview sandbox. There was no existing FleetWala application or supplied PDF in the uploaded assets. The shared scaffold and user TXT were preserved; a new FleetWala package was added. Targeted source/config inspection was performed; the TXT's request to read every dependency/generated file was not fulfilled. No destructive reset or database migration was run.

## Engineering proposals, not verified PRD policy

- Pilot workspace switching is a design exploration tool, never a real grant of access.
- One immutable worker/job application; withdrawal still counts against that day's cap.
- Manual city-based matching until a verified geocoding/distance source is approved.
- English baseline. Hindi remains an open decision.
- Organization membership and server-managed admin principals are engineering extensions.
- No real worker contact reveal path is activated in this build.

See the traceability and decision registers for coverage and unresolved acceptance criteria.
