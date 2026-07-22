# Contributing to Investa Farm

Thank you for helping build Investa Farm. This guide covers how to set up the project, our workflow conventions, and what to know before submitting code.

## Table of Contents

- [Getting Started](#getting-started)
- [Project Structure](#project-structure)
- [Development Workflow](#development-workflow)
- [Coding Conventions](#coding-conventions)
- [Submitting Changes](#submitting-changes)
- [Environment Variables](#environment-variables)

---

## Getting Started

### Prerequisites

- Node.js 24+
- pnpm 9+
- A PostgreSQL database (we use [Neon](https://neon.tech) for both dev and production)

### Setup

```bash
# 1. Clone the repo
git clone https://github.com/Investa-Farm/investafarmapp.git
cd investafarmapp

# 2. Install dependencies
pnpm install

# 3. Set environment variables (copy from a teammate or request access)
#    Required: DATABASE_URL (Neon connection string)
#    See: Environment Variables section below

# 4. Push the DB schema to your database
pnpm --filter @workspace/db run push

# 5. Start both servers
pnpm --filter @workspace/api-server run dev   # API on PORT from env
pnpm --filter @workspace/investa-farm run dev  # Frontend on PORT from env
```

---

## Project Structure

```
investafarmapp/
├── artifacts/
│   ├── investa-farm/          # React + Vite frontend (SPA)
│   │   └── src/
│   │       ├── pages/         # Route-level components (farmer/, market/, admin/, etc.)
│   │       ├── components/    # Shared UI components
│   │       └── lib/           # Auth helpers, currency, etc.
│   ├── api-server/            # Express 5 backend
│   │   └── src/
│   │       ├── routes/        # One file per domain (loans, farms, auth, kyc, etc.)
│   │       └── lib/           # Core logic (security, push, roi, stellar, etc.)
│   └── mockup-sandbox/        # Design-only preview tool — never deployed
├── lib/
│   ├── db/                    # Drizzle ORM schema (one file per table in src/schema/)
│   ├── api-spec/              # OpenAPI spec (openapi.yaml) — source of truth for API
│   ├── api-client-react/      # Auto-generated React Query hooks (from Orval)
│   └── api-zod/               # Auto-generated Zod schemas (from Orval)
├── start.sh                   # Production entry point (used by Render)
├── README.md                  # Project overview
└── ROADMAP.md                 # Planned features and known gaps
```

---

## Development Workflow

### Branch naming

| Type | Pattern | Example |
|------|---------|---------|
| Feature | `feat/<short-description>` | `feat/loan-repayment-schedule` |
| Bug fix | `fix/<short-description>` | `fix/farmer-dashboard-crash` |
| Chore / docs | `chore/<short-description>` | `chore/update-readme` |

### Before every PR

Run the full typecheck + build to make sure Render's pipeline won't reject it:

```bash
pnpm run typecheck   # Full TypeScript check across all packages
pnpm run build       # Build all artifacts (mirrors Render's exact build command)
```

Both must pass with zero errors before opening a PR.

### Regenerating API types

If you change `lib/api-spec/openapi.yaml`:

```bash
pnpm --filter @workspace/api-spec run codegen
```

This regenerates `lib/api-client-react/` and `lib/api-zod/`. Commit the generated files alongside your spec change.

### DB schema changes

Edit the relevant file in `lib/db/src/schema/`, then:

```bash
pnpm --filter @workspace/db run push   # Push to your dev database
```

**Important:** schema changes to production must also be pushed against the production `DATABASE_URL`. Coordinate with the team before pushing breaking changes.

---

## Coding Conventions

- **TypeScript everywhere** — no `any` unless absolutely necessary; prefer typed interfaces
- **Fetch calls** — always check `r.ok` before calling `r.json()`. Return a safe default (`[]`, `null`, etc.) on failure rather than letting an error object propagate as data
- **Route handlers** — wrap async DB queries in `try/catch`; return proper JSON error bodies (never let Express serialize an HTML error page)
- **Farmer/investor split** — farmer pages live in `src/pages/farmer/`; investor pages in `src/pages/market/`; admin in `src/pages/admin/`
- **Tailwind v4** — use CSS variable tokens from `src/index.css`; avoid hardcoded colours
- **Shadcn components** — prefer existing components from `src/components/ui/` before creating new ones
- **No secrets in code** — use Replit secrets / Render env vars. Never commit `.env` files, key material, or credentials

---

## Submitting Changes

1. Create a branch from `main`
2. Make your changes and ensure `pnpm run typecheck` passes
3. Open a PR against `main` with a clear description of what changed and why
4. Link any related bug from `BUGS.md` or issue tracker
5. Request review from at least one other team member
6. Merge only after approval

---

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `DATABASE_URL` | Yes | Neon PostgreSQL connection string |
| `VAPID_PUBLIC_KEY` | Production only | Web push public key (generate with `web-push generate-vapid-keys`) |
| `VAPID_PRIVATE_KEY` | Production only | Web push private key |
| `GROQ_API_KEY` | Optional | AI loan scoring via Groq |
| `ADMIN_EMAIL` | Optional | Seed admin account email |
| `ADMIN_PASSWORD` | Optional | Seed admin account password |

In development, `VAPID_PUBLIC_KEY`/`VAPID_PRIVATE_KEY` are auto-generated and cached locally in `.vapid-keys.json` (gitignored). Never commit this file.
