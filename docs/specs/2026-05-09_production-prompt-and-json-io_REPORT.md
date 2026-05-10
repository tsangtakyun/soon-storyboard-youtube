# Cycle 25-B Report: Production Prompt Button + JSON I/O

> Date: 2026-05-10
> Repo: `soon-storyboard-youtube`
> Commit: 6e69aef

## Section A

Files changed:

| File | Lines |
|---|---:|
| `app/page.tsx` | 104 |
| `app/storyboard/[scriptId]/StoryboardClient.tsx` | 579 |
| `components/ShotCard.tsx` | 446 |
| `lib/layer-2-reader.ts` | 65 |
| `lib/storyboard-actions.ts` | 113 |
| `lib/storyboard-fetch.ts` | 216 |
| `lib/types.ts` | 153 |
| `lib/production-prompt-generator.ts` | 92 |
| `lib/storyboard-export.ts` | 116 |
| `lib/storyboard-import.ts` | 87 |
| `app/api/shots/[shotId]/generate-prompt/route.ts` | 42 |
| `app/api/storyboards/[id]/export-json/route.ts` | 25 |
| `app/api/storyboards/import-json/route.ts` | 19 |
| `supabase/migrations/2026-05-09_storyboard_shots_production_prompt.sql` | 9 |

New endpoints:

| Method | Path |
|---|---|
| `POST` | `/api/shots/[shotId]/generate-prompt` |
| `POST` | `/api/storyboards/[id]/export-json` |
| `POST` | `/api/storyboards/import-json` |

## Section B

Deviation: none material. The UI uses inline local styles consistent with the existing placeholder implementation. JSON import always creates a new script + storyboard.

Prompt templates are read from Layer 2 mirror, so future wording changes can ship through sync rather than UI code.

## Section C

C.1: Production prompt generation is footage-source specific and stores prompt, generation timestamp, and source at generation.

C.2: Stale warning appears when shot footage source differs from `productionPromptForSource`.

C.3: JSON export includes script, storyboard metadata, shots, and production prompts. Import creates new UUIDs and preserves shot metadata.

C.4: `synthetic_host` prompt generation stays disabled.

## Section D

No new dependency. Existing `ANTHROPIC_API_KEY` is used for production prompt generation. No new env var.

## Section E

Build verification: `node node_modules/next/dist/bin/next build` passed.

Unit verification: `node scripts/test-script-coverage.mjs` passed.

Manual steps for Tommy:

1. Apply `2026-05-09_storyboard_shots_production_prompt.sql` in Supabase SQL Editor.
2. Apply Layer 2 v1.4 migration in the shared Supabase project and run Layer 2 sync.
3. Redeploy `soon-storyboard-youtube`.
4. Open a storyboard, choose any shot, and click its Production Prompt button.
5. Edit the generated prompt and confirm refresh keeps the saved text.
6. Export JSON, then import it from the landing page and confirm a new storyboard opens.

## Section F

Next candidates: Cycle 25-C Drive Doc Export, long-form Test 2 trial, prompt template editor, or bulk prompt generation.

Observation: JSON import/export gives Tommy a backup path before destructive per-part regeneration.

## Section G

This cycle adds production workflow metadata but no new LoRA or synthetic-host exposure. Layer 2 prompt templates remain medium IP risk because they encode SOON production preferences.
