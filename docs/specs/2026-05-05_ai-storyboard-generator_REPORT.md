# Cycle 23 Report: AI Storyboard Generator

> Date: 2026-05-05
> Repo: soon-storyboard-youtube
> Mode: Full Execution

## Section A - File Changes

Commit hash: pending at report creation.

Vercel deployment URL: `https://soon-storyboard-youtube-git-main-tsangtakyun-4639s-projects.vercel.app`

| File | Action | Lines | Notes |
|---|---|---:|---|
| `lib/ai-storyboard-generator.ts` | Created | 138 | Anthropic prompt + parser + validation |
| `app/api/storyboards/[id]/generate-ai/route.ts` | Created | 75 | AI generation endpoint |
| `app/storyboard/[scriptId]/StoryboardClient.tsx` | Modified | 298 | AI button + fallback seed |
| `components/ShotCard.tsx` | Modified | 266 | Separate script excerpt + visual instruction UI |
| `lib/types.ts` | Modified | 134 | Added content type / visual instruction fields |
| `lib/storyboard-actions.ts` | Modified | 95 | PATCH maps new fields |
| `lib/storyboard-fetch.ts` | Modified | 185 | Reads new columns |
| `lib/default-shot-generator.ts` | Modified | 98 | Backward-compatible excerpt/instruction |
| `app/api/storyboards/[id]/seed/route.ts` | Modified | 69 | Inserts new fields for fallback seed |
| `supabase/migrations/2026-05-05_storyboard_shots_visual_instruction.sql` | Created | 7 | Adds columns |
| `.env.local.example` | Modified | 4 | Added `ANTHROPIC_API_KEY` |
| `package.json` / `package-lock.json` | Modified | 24 / 699 | Added Anthropic SDK |

New endpoint:

```text
POST /api/storyboards/:id/generate-ai
```

## Section B - Deviations

The AI generator validates returned slugs against live Layer 2 mirror data. If the model invents a content type, visual mode, or footage source, the endpoint fails instead of inserting bad rows.

The UI keeps the rule-based seed button as fallback next to AI generation. This is useful when `ANTHROPIC_API_KEY` is not configured or the call is too slow.

Existing `description` remains for backward compatibility and is filled from `script_excerpt` for AI-generated shots.

## Section C - Review

### C.1 Content Type Completeness

The prompt consumes the 12 content types from Supabase, so future content type changes only require sync data updates and no prompt hardcode changes.

### C.2 AI Prompt Quality

Prompt separates `script_excerpt` from `visual_instruction`, strongly tells the model not to copy narration as the visual instruction, and enforces `synthetic_host` exclusion.

### C.3 Token Cost / Latency

Expected input: Layer 2 taxonomy + full script, roughly 4k-12k tokens depending on script length. Output can be 30-80 shots for 5-10 minute scripts. Max output is set to 8000 tokens. Expected latency: 30-60 seconds for shorter scripts.

### C.4 Minimum Live Shoot Enforcement

The prompt explicitly says to reduce live shoot count and prefer stock / internet / AI generation / custom motion. Enforcement is measurable by counting `footage_source_slug === "live_shoot"` in generated rows.

## Section D - Dependencies / Env

Added dependency:
- `@anthropic-ai/sdk`

New env var:
- `ANTHROPIC_API_KEY`

Existing env remains:
- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`

## Section E - Verification

### E.1 Build

Passed:

```powershell
& 'C:\Program Files\nodejs\node.exe' node_modules\next\dist\bin\next build
```

### E.2 Mock AI Schema

The parser and endpoint code validate the required shape. A real Anthropic call was not executed locally because no local `.env.local` is present in this repo.

### E.3 Manual Verification

1. Apply `2026-05-05_storyboard_shots_visual_instruction.sql`.
2. Add `ANTHROPIC_API_KEY` to `soon-storyboard-youtube` Vercel env.
3. Redeploy `soon-storyboard-youtube`.
4. Open a storyboard with no shots.
5. Click `AI 生成 storyboard`.
6. Confirm generated shots have:
   - 讀稿原文
   - 鏡頭 instruction
   - content type
   - visual mode
   - footage source
7. Confirm `synthetic_host` remains disabled.

## Section F - Next

Recommended next: Drive Doc export + JSON save/load.

Other candidates:
- Regenerate / replace existing shots flow
- Production tracking statuses
- AI prompt tuning after real generations

## Section G - SOON IP Boundary

AI storyboard prompt includes SOON production taxonomy and content mapping. This is medium IP risk and should remain behind protected Vercel deployments and private repo access.

Synthetic host remains disabled and is not passed as an allowed generation output.
