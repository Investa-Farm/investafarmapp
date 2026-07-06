# Contributing to Investa Farm

This document describes the git branching and pull-request workflow used on this project.

## Branch structure

- **`main`** — production. This branch is deployed. It should always be stable and deployable.
- **`staging`** — integration/testing branch. All feature work lands here first and is verified before it goes to production.
- **feature branches** — short-lived branches for individual features/fixes, created from `staging`.

## Workflow

1. **Create a feature branch from `staging`**

   ```bash
   git checkout staging
   git pull origin staging
   git checkout -b feature/<short-description>
   ```

2. **Work on your feature branch** and commit your changes with clear, descriptive messages.

3. **Open a pull request into `staging`**

   - Push your feature branch and open a PR targeting `staging` (not `main`).
   - Test and review the change in `staging` (this is where QA / manual verification happens).
   - Once verified, merge the PR into `staging`.

4. **Promote `staging` to `main`**

   - When `staging` has been tested and is ready for release, open a PR from `staging` into `main`.
   - This PR should be reviewed/approved before merging.
   - Merging this PR ships the change to production.

```
feature/xyz  ──PR──▶  staging  ──PR──▶  main
                (test here)          (production)
```

## Branch protection

For this workflow to be enforced, `main` should be configured (in your GitHub repository settings) with branch protection rules, for example:

- Require a pull request before merging (no direct pushes to `main`).
- Require the PR to come from `staging` (or at minimum, require PR review + passing checks).
- Optionally require status checks (typecheck/build) to pass before merging.

> **Note:** Branch protection rules must be configured directly in your GitHub repository's settings (Settings → Branches → Branch protection rules). This is a GitHub-side setting and cannot be configured from within this workspace.

## Before opening a PR

Run the following locally to make sure your change is healthy:

```bash
pnpm run typecheck   # full typecheck across all packages
pnpm run build       # typecheck + build all packages
```

If your change touches the database schema, push it in your dev environment with:

```bash
pnpm --filter @workspace/db run push
```

If your change touches the API contract (`lib/api-spec/src/openapi.yaml`), regenerate the client hooks/schemas with:

```bash
pnpm --filter @workspace/api-spec run codegen
```

(Verify the Orval Zod config still uses `mode: "single"` targeting `generated/api.ts` before running this — see `replit.md` → Gotchas.)
