# Cycle 25-A Report: Per-Part AI Storyboard Generation

> Date: 2026-05-09  
> Repo: soon-storyboard-youtube  
> Status: Implemented

## Section A: File Changes

| File | Action | Line count | Notes |
|---|---:|---:|---|
| `lib/types.ts` | Modified | 134 | Adds `custom_motion_design` footage source |
| `lib/script-coverage-validator.ts` | Modified | 206 | Adds `validatePartCoverage` |
| `lib/ai-storyboard-generator.ts` | Modified | 401 | Adds `generateAIStoryboardForPart` |
| `app/api/storyboards/[id]/generate-ai-part/route.ts` | Created | 119 | Per-part delete + regenerate endpoint |
| `app/storyboard/[scriptId]/StoryboardClient.tsx` | Modified | 486 | Per-part regenerate handler + state |
| `components/ShotList.tsx` | Modified | 124 | Per-part regenerate button |
| `lib/default-shot-generator.ts` | Modified | n/a | Clean strings; uses Layer 2 source priority |
| `app/api/storyboards/[id]/seed/route.ts` | Modified | n/a | Clean errors |

Implementation commit hash: `b83547d`

Vercel URL: `https://soon-storyboard-youtube.vercel.app`

## Section B: Notes / Deviations

Per-part regeneration follows the requested delete-then-generate behavior. The UI confirm dialog explicitly warns that the selected part's existing shots will be deleted and other parts stay unchanged.

The implementation also cleaned mojibake in touched files because corrupted prompt and UI strings were still present in the repo and could affect generation reliability.

## Section C: Review

### C.1 Layer 2 v1.3 Integration

The type layer now accepts `custom_motion_design`. The dropdown uses Layer 2 mirror data, so once Supabase is synced the new `🎨 自製動畫` option appears automatically.

### C.2 Per-Part Prompt Cross-Part Awareness

The per-part prompt includes the full script as context but marks one target part. It instructs the model to output shots only for the target part and to treat the target part as the only allowed source text.

### C.3 Validation Consistency

Full storyboard generation still uses `validateScriptCoverage`.

Per-part generation uses `validatePartCoverage`, which enforces the same bidirectional logic against only the target part content.

### C.4 Destructive UX

The browser confirm dialog warns:
- selected part shots will be deleted
- other parts are preserved
- generation takes about 10-30 seconds

If generation fails after delete, the part may be empty; the user can retry or manually add shots.

## Section D: Dependency / Env

No new dependency.

No new env var.

## Section E: Verification

### E.1 Build

`next build` passed.

### E.2 Coverage Tests

`node scripts/test-script-coverage.mjs` passed.

### E.3 Mock Per-Part Path

Build confirms new route:

`/api/storyboards/[id]/generate-ai-part`

The endpoint validates `scriptPartRole`, deletes that role's existing shots, generates new shots, inserts them, and returns mapped rows.

### E.4 Manual Verification for Tommy

1. Wait for Vercel deployment.
2. Open [Storyboard Production](https://soon-storyboard-youtube.vercel.app).
3. Open the Cycle 24.1 storyboard.
4. Click `重新生成呢個 part` on Hook.
5. Confirm only Hook shots are replaced.
6. Click `重新生成呢個 part` on Detail.
7. Confirm statistic / data-viz shots use `🎨 自製動畫` after Layer 2 sync.
8. Confirm coverage badge returns `Coverage 100%`.

## Section F: Next

1. Cycle 25-B: Image Prompt Button + JSON save/load.
2. Cycle 25-C: Drive Doc Export.
3. Long-form Test 2 real trial.

Type duplication remains a future shared-package candidate.

## Section G: SOON Core IP Boundary

Per-part prompt uses the same Layer 2 content type system as Cycle 23. No new SOON creative IP exposure.

`custom_motion_design` is a production tooling distinction, not voice signature or SOON Core hook IP.
