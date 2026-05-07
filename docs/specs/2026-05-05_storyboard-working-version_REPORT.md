# Cycle 22 Report: Storyboard Working Version

> Date: 2026-05-05
> Repo: soon-storyboard-youtube
> Mode: Full Execution

## Section A - File Changes

Repo: `https://github.com/tsangtakyun/soon-storyboard-youtube`

Implementation commit: `41db904` (`Add working storyboard shot editor`)

Vercel deployment URL: `https://soon-storyboard-youtube-git-main-tsangtakyun-4639s-projects.vercel.app`

| File | Action | Lines | Notes |
|---|---|---:|---|
| `app/storyboard/[scriptId]/page.tsx` | Rewritten | 35 | Server page now passes data into client editor |
| `app/storyboard/[scriptId]/StoryboardClient.tsx` | Created | 274 | Working storyboard UI + state orchestration |
| `components/ShotCard.tsx` | Created | 237 | Per-shot edit controls |
| `components/ShotList.tsx` | Created | 86 | Per-part shot grouping |
| `lib/default-shot-generator.ts` | Created | 96 | Rule-based Layer 2 seed generator |
| `lib/storyboard-actions.ts` | Created | 85 | Shot list/create/update mapping helpers |
| `lib/layer-2-reader.ts` | Modified | 53 | Added visual/footage source readers with mapping fields |
| `lib/storyboard-fetch.ts` | Modified | 115 | Added `fetchScriptByStoryboard`, exported shot mapper |
| `lib/types.ts` | Modified | 114 | Added update/draft types and Layer 2 defaults |
| `app/api/storyboards/[id]/seed/route.ts` | Created | 66 | Seed default shots |
| `app/api/storyboards/[id]/shots/route.ts` | Created | 54 | GET/POST shot list |
| `app/api/shots/[shotId]/route.ts` | Created | 58 | PATCH/DELETE shot |
| `app/api/shots/[shotId]/reorder/route.ts` | Created | 65 | Move shot up/down within same part |
| `package.json` / `package-lock.json` | Modified | 23 / 650 | Added `use-debounce` |

New endpoints:
- `POST /api/storyboards/:id/seed`
- `GET /api/storyboards/:id/shots`
- `POST /api/storyboards/:id/shots`
- `PATCH /api/shots/:shotId`
- `DELETE /api/shots/:shotId`
- `POST /api/shots/:shotId/reorder`

## Section B - Deviations

The UI uses a two-column layout: script preview on the left, storyboard editor on the right. This matches the intended workflow better than a single vertical stack because the editor can reference script context while adjusting shots.

Auto-save debounce is 1,000 ms for description and notes. Dropdowns and duration save immediately.

Reorder is scoped within the same script part role. This avoids a confusing grouped UI where pressing up/down would jump a shot into another part.

Local end-to-end testing against Supabase was not run because no local `.env.local` exists in this repo. Build verification passed, and production debug previously confirmed the deployed storyboard project can read `scripts`, 10 visual modes, and 6 footage sources.

## Section C - Review

### C.1 Default Shot Generator Quality

The rule generator creates the intended 11-shot default for the Fern 6-part structure: hook 1, setup 2, detail 3, complication 2, depth 2, resolution 1. Unsupported roles are skipped so custom/host-only parts do not create broken shots.

Visual mode selection reads `layer_2_visual_modes.default_part_pairings`; footage source selection reads `default_source_priority` and excludes `synthetic_host`.

### C.2 Auto-Save Reliability

Text fields use optimistic update plus debounced save. Selects and duration fields update optimistically and save immediately. Failed saves show an inline error on the shot card. Multi-tab collision handling remains out of scope.

### C.3 Synthetic Host UI Handling

The dropdown displays all footage sources, including `主持 AI 重建 (Coming soon)`, but disables `synthetic_host`. The PATCH endpoint also rejects `synthetic_host`, so the server and UI agree.

### C.4 Layer 2 Integration Failure

The page depends on Layer 2 options for dropdowns and seed. If Layer 2 mirror is unavailable, the server page/seed endpoint surfaces an error instead of silently creating bad data. A future polish pass can add static fallback options.

## Section D - Dependencies / Env

Added dependency:
- `use-debounce@^10.0.6`

No new environment variables.

Existing required env:
- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`

## Section E - Verification

### E.1 Build

Passed:

```powershell
& 'C:\Program Files\nodejs\node.exe' node_modules\next\dist\bin\next build
```

Build routes include all new APIs and `/storyboard/[scriptId]`.

### E.2 Local End-to-End Smoke

Not fully executed locally because this repo has no local `.env.local`. Production manual verification is required after Vercel redeploy.

Recommended smoke:
1. Generate a script in `script-generator-youtube`.
2. Click `Continue -> Storyboard`.
3. In storyboard, click `用 Layer 2 default 生成初始 shots`.
4. Confirm shots appear grouped by part.
5. Edit description and notes, wait 1 second, refresh to confirm persistence.
6. Change visual mode / footage source / duration, refresh to confirm persistence.
7. Add one shot, delete one shot, move one shot up/down.

### E.3 Manual Verification For Tommy

1. Redeploy `soon-storyboard-youtube`.
2. Open a storyboard URL from script-generator handoff.
3. Confirm the page is no longer placeholder.
4. Seed default shots.
5. Confirm `synthetic_host` is visible but disabled.
6. Refresh page and confirm edits persist.

## Section F - Next

### F.1 Next Spec Candidates

Recommended: Cycle 23 Drive Doc export + JSON save/load.

Alternatives:
- AI shot suggestion if default mapping feels too generic after manual use
- UI polish + production tracking

### F.2 Codebase Observation

The repo now has a clear split: server page fetches, client component orchestrates, route handlers write. This is a good base for adding export and production status next.

### F.3 Cross-Repo Type Duplication

Types remain duplicated between script generator and storyboard repo. This is acceptable for now, but a shared package may become worthwhile once shot schema and script schema stabilize.

## Section G - SOON Core IP Boundary

This cycle is production tooling only. It does not call fal.ai, does not generate media, and keeps synthetic host disabled.

Layer 2 mirror access remains server-side through the service role key.
