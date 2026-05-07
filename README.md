# SOON Storyboard YouTube

Skeleton repo for the SOON YouTube storyboard tool.

## Current Scope

- Receive script handoff from `script-generator-youtube`.
- Fetch saved script by `scriptId`.
- Create an empty storyboard root if one does not exist.
- Render script parts and placeholder storyboard state.
- Read Layer 2 visual modes and footage sources.

## Out of Scope For Cycle 21

- Interactive shot editing
- AI shot suggestion
- Drag and drop ordering
- Footage generation
- Dashboard / fal.ai / LoRA integration

## Environment

```bash
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=
```

`SUPABASE_SERVICE_ROLE_KEY` is server-side only. Do not expose it to the browser.
