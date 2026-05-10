# Cycle 25-B.1 Report: Subject Reference Field

> Date: 2026-05-10
> Repo: `soon-storyboard-youtube`
> Commit: TBD

## Section A

Files changed:

| File | Lines |
|---|---:|
| `supabase/migrations/2026-05-10_storyboards_subject_reference.sql` | 7 |
| `lib/types.ts` | 154 |
| `lib/storyboard-fetch.ts` | 219 |
| `lib/production-prompt-generator.ts` | 99 |
| `app/storyboard/[scriptId]/StoryboardClient.tsx` | 649 |
| `app/api/storyboards/[id]/route.ts` | 49 |
| `lib/storyboard-export.ts` | 118 |
| `lib/storyboard-import.ts` | 158 |

## Section B

No material deviation. Subject reference is stored at storyboard level, optional, and manually entered by user.

Other 4 templates remain unchanged in this cycle.

## Section C

C.1: Stock simplification is handled in Layer 2 sync data.

C.2: Internet prompt receives `subject_reference` through production prompt substitution.

C.3: Null handling is graceful: empty input saves as null and prompt substitution emits `（無）`.

C.4: Existing storyboards continue to render because `subject_reference` is nullable.

## Section D

No new dependency. Existing `use-debounce` is reused. No new env var.

## Section E

Build passed with `node node_modules/next/dist/bin/next build`.

Coverage tests passed with `node scripts/test-script-coverage.mjs`.

Manual steps:

1. Apply `2026-05-10_storyboards_subject_reference.sql`.
2. Open a storyboard.
3. Enter `Jian Zao Ipoh Curry Noodle, Singapore` in Subject reference.
4. Wait for "Reference saved".
5. Generate an Internet production prompt and confirm the output uses that reference as anchor.
6. Export JSON and re-import to confirm subject reference persists.

## Section F

Next candidates: Cycle 25-B.2 template editor + outline propagation, or Cycle 25-C Drive Doc Export.

## Section G

Subject reference is UX metadata only. It reduces search ambiguity without exposing new SOON IP.
