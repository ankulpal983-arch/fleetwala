# Screen and journey inventory

The following is the intended implemented pilot surface. Consult the actual client router for exact routing; a screen existing is not evidence its live service is connected.

| Surface | Routes | Purpose |
| --- | --- | --- |
| Worker | `/` | Find pilot jobs; search, filters, sort, manual location |
| Worker | `/saved` | Saved sample jobs |
| Worker | `/applications` | Apply feedback and application status |
| Worker | `/profile` | Profile and preferences |
| Worker | `/messages`, `/notifications` | Sample authorized communications and updates |
| Shared | `/settings`, `/support` | Privacy, settings and help |
| Public | `/welcome`, `/login` | Introduction and Supabase sign-in setup |
| Employer | `/employer`, `/employer/jobs` | Recruitment overview and job drafts/submission |
| Employer | `/employer/applicants`, `/employer/candidates` | Application pipeline and anonymous previews |
| Employer | `/employer/billing`, `/employer/team` | Disabled billing and organization membership information |
| Admin | `/admin`, `/admin/jobs`, `/admin/employers` | Pilot trust overview, jobs and organization review |
| Admin | `/admin/audit`, `/admin/support` | Pilot audit/support handling |

## Review journeys

1. Worker: find a sample job, open detail, save, apply, inspect applications, edit preferences, keep discovery off unless explicitly opted in.
2. Employer: enter pilot employer workspace, create a draft, submit for review, inspect applicants without contact disclosure.
3. Admin: enter pilot admin workspace, inspect queued sample jobs and employer verification, perform sample moderation.
4. Real authentication: open login. Without external configuration, receive an honest setup message; no static OTP and no fake successful login.

GPS permission is optional. City matching must be labeled approximate and not pretend to be a calculated kilometer distance.
