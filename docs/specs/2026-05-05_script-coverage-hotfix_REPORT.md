# Cycle 24 Report: AI Storyboard Script Coverage Hotfix

> Date: 2026-05-05  
> Target: soon-storyboard-youtube  
> Mode: Full Execution  
> Status: Implemented

## Section A: File Changes

| File | Action | Line count | Notes |
|---|---:|---:|---|
| `lib/script-coverage-validator.ts` | Created | 80 | Sentence split, coverage validation, retry prompt builder |
| `lib/ai-storyboard-generator.ts` | Modified | 256 | Full coverage prompt, retry once, `ScriptCoverageError` |
| `app/api/storyboards/[id]/generate-ai/route.ts` | Modified | 95 | Returns 422 with missing sentence details |
| `app/storyboard/[scriptId]/StoryboardClient.tsx` | Modified | 327 | Displays detailed coverage failure message |
| `scripts/test-script-coverage.mjs` | Created | 38 | Lightweight unit-style coverage tests |

Total touched implementation lines: 796

Commit hash: pending at report creation; final commit hash reported after commit.

Deployment URL: `https://soon-storyboard-youtube.vercel.app`

## Section B: Implementation Notes

No intentional deviation from the spec.

Sentence splitting final logic:
- Script parts are sorted by `order`.
- Part content is joined into one script body.
- Sentence boundaries are `。！？；`.
- Boundary punctuation is preserved in each sentence.
- Fragments shorter than 5 normalized characters are skipped to avoid punctuation artifacts.

Normalization edge cases:
- Whitespace is removed before comparison.
- Straight / curly quote marks are removed.
- Dash variants `—`, `-`, `–` are normalized away.
- Wording is not semantically matched. If the LLM rewrites a sentence instead of copying original script text, coverage fails.

Retry behavior:
- First call generates storyboard.
- Validator checks every sentence against concatenated `script_excerpt`.
- If any sentence is missing, a retry prompt explicitly lists missing sentences.
- If retry still misses sentences, API returns 422 and does not insert bad shots.

## Section C: Review

### C.1 Sentence Splitting Reliability

The splitter is tuned for Cantonese written narration using Chinese punctuation. It should catch the observed failure mode: transitional and pivot sentences such as `但係...` and `我們就需要問...` being skipped.

Known limitation: if a generated script uses line breaks without Chinese punctuation, those chunks may be treated as one long sentence.

### C.2 Coverage Validation Strictness

The validator is intentionally strict. It checks textual coverage, not semantic equivalence. This reduces false positives where the storyboard “sort of means the same thing” but no longer maps 1:1 to Renee's actual read.

False negative risk: minor punctuation or wording edits by the LLM can fail coverage. This is acceptable because `script_excerpt` is required to be original script text.

### C.3 Retry Cost / Latency Impact

Normal success path: 1 Anthropic storyboard call.

Failure path: 1 extra Anthropic call with explicit missing sentence list. Latency can roughly double on retry, but this is safer than silently saving incomplete storyboard data.

### C.4 LLM Rewrite Edge Case

If the LLM rewrites original wording, coverage fails. This is correct for this tool: `script_excerpt` is not a summary field; it is the source-of-truth narration slice.

## Section D: Dependency / Env

No new npm dependency.

No new env var.

Existing required env remains `ANTHROPIC_API_KEY` for AI storyboard generation.

## Section E: Verification

### E.1 Build

`next build` passed.

### E.2 Sentence Splitter Unit Test

`node scripts/test-script-coverage.mjs` passed.

### E.3 Coverage Validator Unit Test

The test covers:
- Full sentence splitting with `。！？`.
- Full coverage returns no missing sentences.
- Missing pivot sentence returns `covered=false`.
- Coverage ratio reports expected partial coverage.

### E.4 Mock End-to-End

Synthetic missing scenario passed: missing sentence is surfaced as missing instead of being silently accepted.

### E.5 Manual Verification for Tommy

1. Redeploy `soon-storyboard-youtube`.
2. Open a new storyboard with no existing shots.
3. Click `AI 生成 storyboard`.
4. After generation, inspect hook pivot sentences like `但係...我們就需要問...`.
5. Confirm every original script sentence appears in some `讀稿` / `script_excerpt` field.
6. If generation fails with coverage error, read the missing sentence list. That means the defensive validator is working.

## Section F: Next Candidates

1. Real Test 2: run 20 min Trojan Horse + Explainer through AI storyboard.
2. Cycle 25: Layer 2 v1.3 add `custom_motion_design` footage source.
3. Drive Doc export for storyboard.

Future validator enhancement:
- Add order validation, not only coverage.
- Add sub-sentence coverage for very long compound sentences.
- Persist coverage ratio on storyboard metadata if repeated debugging is needed.

Convention v1.1 contribution:
- Codify defensive validation pattern for all LLM-generated structured artifacts.

## Section G: SOON Core IP Boundary

This hotfix is production reliability logic only.

The validator is a generic utility: split script, compare coverage, retry or fail visibly. It does not expose SOON creative IP, voice signature, or production strategy.
