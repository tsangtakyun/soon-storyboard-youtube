# Cycle 24.1 Report: Bidirectional Script Fidelity + UI Patch

> Date: 2026-05-05  
> Target: soon-storyboard-youtube  
> Mode: Full Execution  
> Status: Implemented

## Section A: File Changes

| File | Action | Line count | Notes |
|---|---:|---:|---|
| `lib/script-coverage-validator.ts` | Modified | 193 | Forward + reverse fidelity validation |
| `lib/ai-storyboard-generator.ts` | Modified | 296 | No-hallucination prompt + retry with both issue types |
| `app/api/storyboards/[id]/generate-ai/route.ts` | Modified | 98 | 422 now includes forward + reverse coverage data |
| `app/api/storyboards/[id]/validate-coverage/route.ts` | Created | 57 | Read-only validation endpoint for existing storyboards |
| `app/storyboard/[scriptId]/StoryboardClient.tsx` | Modified | 445 | Expand script preview + coverage badge + validation fetch |
| `components/ShotCard.tsx` | Modified | 300 | Per-shot hallucination warning banner |
| `components/ShotList.tsx` | Modified | 101 | Pass per-shot validation state |
| `lib/storyboard-fetch.ts` | Modified | 185 | Added standalone `fetchShots` |
| `scripts/test-script-coverage.mjs` | Modified | 79 | Forward + reverse + hallucination tests |
| API / helper mojibake cleanup | Modified | n/a | Cleaned touched user-facing strings |

Implementation commit hash: `db04a12`

Deployment URL: `https://soon-storyboard-youtube.vercel.app`

## Section B: Implementation Notes

No intentional deviation from the spec.

`findLongestPrefixMatch` final algorithm:
- Normalize excerpt and original script by removing whitespace, quote marks, and dash variants.
- Try the longest normalized prefix first, shrinking down to 5 characters.
- When a prefix exists in original script, map the normalized split back to the original excerpt by recorded character index.
- If no prefix matches, treat the whole excerpt as hallucinated.

UI design:
- Coverage badge uses green border/text when both directions pass.
- Coverage issue badge uses amber border/text and displays missing + hallucinated counts.
- Per-shot hallucination warning uses red border/background with a collapsible detail section.
- Script preview uses `⋯` plus `展開全文` / `收起`, so truncation is explicit.

## Section C: Review

### C.1 Reverse Coverage Strictness

Reverse validation is intentionally strict: every `script_excerpt` must be a verbatim substring of the original script after light normalization. This catches the observed `第三是地點的選擇` hallucination pattern.

### C.2 Retry Effectiveness

The retry prompt now lists both issue classes:
- Forward missing sentences.
- Reverse hallucinated shot content.

The retry tells Claude not to complete narrative patterns, not to add bridge sentences, and not to rewrite. If retry still fails, the API returns 422 and does not save bad shots.

### C.3 Hallucination Detection Precision

False positive risk exists when a user manually edits `script_excerpt` into a paraphrase. That is acceptable because `script_excerpt` is source text, not an editorial note. Visual interpretation belongs in `visual_instruction`.

### C.4 UI Prevention

Founder verification is now easier:
- Source script can be expanded per part.
- Coverage badge surfaces validation status without needing raw DB checks.
- Hallucinated shots are highlighted inline with matched / unmatched detail.

## Section D: Dependency / Env

No new npm dependency.

No new env var.

## Section E: Verification

### E.1 Build

`next build` passed.

### E.2 Sentence Splitter Unit Test

`node scripts/test-script-coverage.mjs` passed.

### E.3 Coverage Validator Unit Test

The test covers:
- Sentence splitting with Chinese punctuation.
- Full forward coverage.
- Missing pivot sentence detection.
- Reverse hallucination detection.

### E.4 `findLongestPrefixMatch` Unit Test

The test covers fabricated suffix detection and confirms unmatched content is surfaced.

### E.5 Mock End-to-End

Synthetic hallucination scenario passed: extra content inside a shot excerpt is detected as reverse coverage failure.

### E.6 Manual Verification for Tommy

1. Wait for Vercel deploy of `soon-storyboard-youtube`.
2. Open the Test 1 storyboard or create a fresh one.
3. If existing shots are present, check the coverage badge.
4. If badge says hallucinated, open the red warning on that shot.
5. Re-run Test 1 on an empty storyboard.
6. Confirm `第三是地點的選擇` does not appear unless it exists in the original script.
7. Confirm coverage badge shows `Coverage 100%`.
8. Use `展開全文` in the left script preview to compare source text directly.

## Section F: Next Candidates

1. Test 2: 20 min Trojan Horse actual run.
2. Cycle 25: Layer 2 v1.3 add `custom_motion_design`.
3. Drive Doc export.
4. Auto-fix hallucinated shots flow.

Convention v1.1 contribution:
- LLM-generated structured artifacts need bidirectional validation.
- UI must surface validation status instead of hiding it behind logs or DB checks.

Cycle 24 oversight:
- Forward coverage alone proves the script is included somewhere.
- It does not prove the storyboard contains only source script.
- Future specs should define both inclusion and exclusion constraints.

## Section G: SOON Core IP Boundary

This patch is production reliability only.

The validator remains a generic utility. It does not encode SOON-specific creative IP, voice signature, or production strategy.
