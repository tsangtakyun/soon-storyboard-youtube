import { notFound } from 'next/navigation'

import { StoryboardClient } from './StoryboardClient'
import { fetchFootageSources, fetchVisualModes } from '@/lib/layer-2-reader'
import {
  createStoryboard,
  fetchScript,
  fetchStoryboardByScriptId,
} from '@/lib/storyboard-fetch'

export const dynamic = 'force-dynamic'

export default async function StoryboardPage({
  params,
}: {
  params: { scriptId: string }
}) {
  const script = await fetchScript(params.scriptId)
  if (!script) notFound()

  let storyboard = await fetchStoryboardByScriptId(params.scriptId)
  if (!storyboard) {
    await createStoryboard(params.scriptId)
    storyboard = await fetchStoryboardByScriptId(params.scriptId)
  }

  if (!storyboard) notFound()

  const [visualModes, footageSources] = await Promise.all([
    fetchVisualModes(),
    fetchFootageSources(),
  ])

  return (
    <StoryboardClient
      script={script}
      storyboard={storyboard}
      visualModes={visualModes}
      footageSources={footageSources}
    />
  )
}
