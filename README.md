# FleetWala (India Logistics Hiring Marketplace)

FleetWala is an India-first logistics hiring marketplace connecting delivery riders, warehouse workers, and hub staff with verified employers.

---

## Quick Start & Local Preview

### Prerequisites
- Node.js 20+ (tested on Node v22.22.2)
- pnpm 9+ or 10+ (`corepack enable` or `npm install -g pnpm`)

### 1. Working Directory
All project files live in the nested monorepo directory:
```bash
cd Fleet-Wala-Builder
```

### 2. Install Dependencies
```bash
pnpm install
```

### 3. Run Development Server
```bash
pnpm --filter @workspace/fleetwala run dev
```
Open **[http://localhost:3000](http://localhost:3000)** in your browser.

---

## Common Commands

| Command | Action |
| :--- | :--- |
| `pnpm --filter @workspace/fleetwala run dev` | Start Vite dev server on port 3000 |
| `pnpm --filter @workspace/fleetwala run test` | Run automated unit & business rules tests |
| `pnpm --filter @workspace/fleetwala run typecheck` | Run TypeScript typecheck (0 errors) |
| `pnpm --filter @workspace/fleetwala run build` | Compile production bundle to `dist/public` |

---

## Project Structure

```
├── artifacts/
│   ├── fleetwala/          # Responsive React 19 + Vite 7 Web Application
│   │   ├── src/
│   │   │   ├── components/ # Reusable UI components (Radix + Tailwind v4)
│   │   │   ├── pages/      # Worker, Employer, Admin, and Public views
│   │   │   ├── lib/        # Rules, Supabase client, fixtures, and store
│   │   │   └── App.tsx     # Router & route definitions
│   │   └── package.json
│   └── api-server/         # Express 5 API scaffold
├── supabase/
│   └── migrations/         # 15 modular PostgreSQL SQL migrations
├── docs/
│   ├── audit/              # Comprehensive audit reports (00 to 08)
│   └── sql-execution-order.md # Staging SQL execution guide
├── package.json            # Monorepo root config
├── pnpm-workspace.yaml     # Workspace definition
└── .env.example            # Environment variables placeholder
```

---

## Authentication & Database

- **Authentication:** Exclusively **Supabase Auth**.
  - Workers sign in with Indian Mobile Phone OTP (`+91`).
  - Employers sign in with Work Email Magic Link.
  - Admins are provisioned via server-side allowlist (`admin_principals`).
- **Database:** Supabase PostgreSQL with Row Level Security (RLS) on all 27 tables.
- **Detailed Audit Documentation:** See [docs/audit/00-executive-summary.md](docs/audit/00-executive-summary.md).
