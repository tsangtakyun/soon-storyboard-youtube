# Cycle 21 Implementation Report: Storyboard Repo Skeleton

> Date: 2026-05-05
> Repo: soon-storyboard-youtube
> Mode: Full Execution

## Section A - File Changes

Repo URL: pending Tommy GitHub creation (`https://github.com/tsangtakyun/soon-storyboard-youtube`)

Local commit hash: `70fb6c6` (`Initialize SOON YouTube storyboard skeleton`)

Vercel deployment URL: pending Tommy Vercel connection.

Created files:

| File | Lines | Purpose |
|---|---:|---|
| `.env.local.example` | 3 | Supabase env placeholders |
| `.gitignore` | 7 | Exclude build output, deps, local env |
| `README.md` | 21 | Setup notes |
| `package.json` | 23 | Next.js app scripts and dependencies |
| `package-lock.json` | 635 | Locked dependency tree |
| `app/layout.tsx` | 13 | Root layout |
| `app/page.tsx` | 26 | Handoff landing placeholder |
| `app/storyboard/[scriptId]/page.tsx` | 92 | Server-side storyboard handoff page |
| `app/globals.css` | 24 | Minimal dark internal-tool styling |
| `lib/types.ts` | 100 | Script / storyboard / Layer 2 types |
| `lib/supabase-server.ts` | 14 | Server-side service-role Supabase client |
| `lib/supabase-client.ts` | 12 | Frontend anon Supabase client placeholder |
| `lib/layer-2-reader.ts` | 40 | Reads Layer 2 visual/footage mirror |
| `lib/storyboard-fetch.ts` | 103 | Script/storyboard fetch + create helpers |
| `supabase/migrations/*.sql` | 83 | Mirrored schema files |

Total tracked lines after skeleton commit: 1,313.

## Section B - Deviations

GitHub repo and Vercel deployment were not created from Codex because no authenticated GitHub/Vercel CLI flow is available in this local session. The repo is fully initialized locally and ready to push once Tommy creates the GitHub repository.

The first UI is intentionally minimal. It renders the received script and a storyboard placeholder; no shot editing, AI suggestion, or production workflow was added.

Cross-repo types are duplicated locally as planned. This keeps the first cycle simple; shared package extraction can wait until the contracts stabilize.

Service role key handling follows the spec: server-side only, referenced by env var name, not committed.

## Section C - Review

### C.1 Cross-Repo Handoff Reliability

The handoff page is a server component and fetches by script ID using the service role key. This avoids anon RLS exposure and matches the Cycle 20 IP storage policy.

### C.2 Schema Future-Proofing

The mirrored migrations include generation placeholders (`generation_url`, `generation_status`, `generation_metadata`, `stock_keyword`) without implementing generation. This keeps Cycle 21 pure plumbing while avoiding an immediate future migration for Cycle 23+.

### C.3 Build Completion

Foundation readiness: about 70%. Repo boots, builds, reads Supabase server-side, creates storyboard rows, and can render script parts. Remaining work is UI interaction and AI shot suggestion.

## Section D - Dependencies / Env

Dependencies:
- `next@14.2.0`
- `react@18`
- `react-dom@18`
- `@supabase/supabase-js@^2.105.3`

Dev dependencies:
- TypeScript, ESLint, Next ESLint config, React/Node types

Env vars:
- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`

NPM reported 2 vulnerabilities after install because the spec requested `next@14.2.0`. No fix was applied in this cycle.

## Section E - Verification

### E.1 Build

`npm run build` equivalent direct command passed:

```powershell
& 'C:\Program Files\nodejs\node.exe' node_modules\next\dist\bin\next build
```

Routes:
- `/`
- `/storyboard/[scriptId]`

### E.2 Local End-to-End Smoke

Not fully executed against Supabase because the new `scripts/storyboards/storyboard_shots` migrations must be applied and the new Vercel repo/env vars must be configured first.

### E.3 RLS Verification

Manual verification required after applying migrations:
- anon select should fail / return no rows
- service role select should work

### E.4 Manual Steps For Tommy

1. Create private GitHub repo `soon-storyboard-youtube`.
2. From `C:\Users\user\Desktop\SOON\soon-storyboard-youtube`, run:
   ```powershell
   git remote add origin https://github.com/tsangtakyun/soon-storyboard-youtube.git
   git push -u origin main
   ```
3. Connect Vercel to the repo and enable deployment protection.
4. Set Vercel env vars listed in Section D.
5. Apply the 3 Supabase migrations from the script-generator repo.
6. Open `/storyboard/<scriptId>` after the script-generator handoff saves a script.

## Section F - Next

### F.1 Recommended Next Spec

Cycle 22: Storyboard Shot List UI.

### F.2 Codebase Observation

The server-side-only model is the right default for current RLS posture. If the storyboard tool later needs rich client interactions, use server actions or route handlers rather than exposing service role or relaxing anon reads.

### F.3 Convention v1.1

Cross-repo Supabase shared tables should always define:
- owner repo
- writer repo
- reader repo
- RLS posture
- source-of-truth type contract

## Section G - SOON IP Boundary

This skeleton stores production tooling metadata only. It does not touch dashboard generation, fal.ai, LoRA, Renee likeness, or synthetic host execution.

Service role key remains env-only. No credential is committed.
