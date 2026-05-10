# Cycle 25-C: Storyboard Drive Doc Export Report

> Date: 2026-05-10
> Repo: soon-storyboard-youtube
> Commit: ca15bf8
> Deployment URL: https://soon-storyboard-youtube-git-main-tsangtakyun-4639s-projects.vercel.app/

## Section A: Changes

Implemented Google Drive Doc export for storyboards.

File changes:
- `lib/google-oauth.ts` (71 lines): Google OAuth config, return URL state, refresh-token access-token exchange.
- `app/api/auth/google/route.ts` (36 lines): OAuth start route.
- `app/api/auth/google/callback/route.ts` (62 lines): OAuth callback and HTTP-only refresh-token cookie.
- `lib/drive-doc-builder.ts` (259 lines): grouped-card Google Docs batchUpdate request builder.
- `lib/drive-export.ts` (151 lines): fetch storyboard data, create Google Doc, apply batch update.
- `app/api/storyboards/[id]/export-drive/route.ts` (40 lines): Drive export endpoint.
- `app/storyboard/[scriptId]/StoryboardClient.tsx` (698 lines): added Drive export button and latest-doc link.
- `.env.local.example` (7 lines): added Google OAuth env vars.

## Section B: Discovery / Decisions

Critical OAuth discovery: Cycle 11 in `script-generator-youtube` does not use User OAuth. It uses either:
- Google service account credentials (`GOOGLE_SERVICE_ACCOUNT_KEY`, or split `GOOGLE_CLIENT_EMAIL` + `GOOGLE_PRIVATE_KEY`), or
- Apps Script upload fallback (`GOOGLE_APPS_SCRIPT_UPLOAD_URL` + secret).

Decision: Cycle 25-C intentionally uses User OAuth instead, because this storyboard export needs Docs owned by Tommy's Drive account. This diverges from Cycle 11 but matches the Cycle 25-C product requirement.

Token storage:
- Refresh token is stored in an HTTP-only cookie named `google_refresh_token`.
- Access tokens are generated per export via refresh-token exchange.
- Cookie is `secure` on HTTPS and `sameSite=lax`.

Google Docs batchUpdate approach:
- Insert the full document body once at index 1.
- Apply paragraph styles using precomputed ranges.
- Apply bold label styles for `Script excerpt:` and `Visual instruction:`.
- This avoids fragile repeated insert index shifting.

## Section C: Evaluation

C.1 OAuth flow: first unauthenticated export returns 401 + `needsAuth`, the UI redirects to `/api/auth/google`, callback stores the refresh token, then returns to the storyboard URL.

C.2 Doc format: grouped card structure uses title, subtitle metadata, per-part headings, and per-shot headings with the 5 requested core fields: script excerpt, visual instruction, visual mode, footage source, duration.

C.3 OAuth client config: storyboard should use its own OAuth redirect URI for `soon-storyboard-youtube`; sharing the Cycle 11 service-account pattern would not satisfy user-owned Docs.

C.4 Error handling: missing OAuth env returns 503, unauthenticated export returns 401, Docs API failures return server errors with the Google response text.

## Section D: Dependencies / Env

No new dependency. Implementation uses `fetch` against Google OAuth and Docs APIs.

New env vars:
- `GOOGLE_CLIENT_ID`
- `GOOGLE_CLIENT_SECRET`
- `GOOGLE_REDIRECT_URI`

Required scopes:
- `https://www.googleapis.com/auth/documents`
- `https://www.googleapis.com/auth/drive.file`

## Section E: Verification

Build passed:

```bash
node .\node_modules\next\dist\bin\next build
```

Note: `npm run build` could not be used in this Windows shell because `next build` returned `Access is denied`; the direct Node invocation succeeded.

Manual OAuth setup for Tommy:
1. Enable Google Docs API and Google Drive API in Google Cloud.
2. Create a Web OAuth client.
3. Add redirect URI: `https://soon-storyboard-youtube.vercel.app/api/auth/google/callback`.
4. Set Vercel env vars: `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `GOOGLE_REDIRECT_URI`.

Manual export test:
1. Open an existing storyboard.
2. Click `Export Drive Doc`.
3. First time should redirect to Google consent.
4. After consent, click `Export Drive Doc` again if needed.
5. Confirm a new Google Doc opens with grouped parts and shot cards.

## Section F: Next Candidates

Cycle 25-C.1: store exported Drive doc ID to allow "open existing exported doc".

Other candidates:
- 25-B.3: outline to script to storyboard reference propagation.
- Adobe Bridge discussion.

Convention contribution: cross-repo Drive export patterns should document whether ownership requires User OAuth or service account.

Workflow impact: Renee, camera, and editing collaborators can now review a human-readable storyboard snapshot outside the web UI.

## Section G: IP Boundary

Drive Docs contain script excerpts and visual instructions. They should be shared only with founder-approved collaborators.

Service role remains server-side. OAuth refresh token is HTTP-only cookie scoped to the storyboard deployment.
