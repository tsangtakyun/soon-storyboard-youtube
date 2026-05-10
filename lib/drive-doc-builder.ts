import type { Script, Storyboard, StoryboardShot } from './types'

type Style = 'TITLE' | 'SUBTITLE' | 'HEADING_2' | 'HEADING_3' | 'NORMAL'

export interface LabelLookup {
  visualModeLabels: Map<string, string>
  footageSourceLabels: Map<string, { label: string; emoji?: string }>
}

interface TextRange {
  startIndex: number
  endIndex: number
  style: Style
}

interface BoldRange {
  startIndex: number
  endIndex: number
}

export interface GoogleDocsRequest {
  insertText?: {
    location: { index: number }
    text: string
  }
  updateParagraphStyle?: {
    range: { startIndex: number; endIndex: number }
    paragraphStyle: { namedStyleType: string }
    fields: string
  }
  updateTextStyle?: {
    range: { startIndex: number; endIndex: number }
    textStyle: {
      bold?: boolean
      foregroundColor?: {
        color: { rgbColor: { red: number; green: number; blue: number } }
      }
    }
    fields: string
  }
}

const PART_ORDER = ['hook', 'setup', 'detail', 'complication', 'depth', 'resolution']

const PART_LABELS: Record<string, string> = {
  hook: '1. Hook',
  setup: '2. Setup',
  detail: '3. Detail',
  complication: '4. Complication',
  depth: '5. Depth',
  resolution: '6. Resolution',
}

export function buildDocRequests({
  script,
  storyboard,
  shots,
  labels,
}: {
  script: Script
  storyboard: Storyboard
  shots: StoryboardShot[]
  labels: LabelLookup
}): GoogleDocsRequest[] {
  const state = createDocState()
  const sortedShots = [...shots].sort((a, b) => a.displayOrder - b.displayOrder)
  const liveCount = sortedShots.filter((shot) =>
    ['live_shoot', 'live_test'].includes(shot.footageSourceSlug)
  ).length
  const liveRatio =
    sortedShots.length > 0 ? Math.round((liveCount / sortedShots.length) * 100) : 0

  addLine(state, script.title ?? script.topic, 'TITLE')
  addLine(
    state,
    `${sortedShots.length} shots - ${script.targetMinutes} min - ${liveRatio}% live shoot`,
    'SUBTITLE'
  )
  if (storyboard.subjectReference) {
    addLine(state, `Subject reference: ${storyboard.subjectReference}`, 'NORMAL')
  }
  addLine(state, '', 'NORMAL')

  const groups = groupShotsByPart(sortedShots)
  let cumulativeSeconds = 0

  for (const [partRole, partShots] of groups) {
    const partDuration = partShots.reduce(
      (sum, shot) => sum + Math.round(Number(shot.durationSeconds ?? 0)),
      0
    )
    const partStart = formatTime(cumulativeSeconds)
    const partEnd = formatTime(cumulativeSeconds + partDuration)
    const partLabel = PART_LABELS[partRole] ?? partRole

    addLine(
      state,
      `${partLabel} (${partShots.length} shots - ${partStart}-${partEnd})`,
      'HEADING_2'
    )

    for (const shot of partShots) {
      const duration = Math.round(Number(shot.durationSeconds ?? 0))
      const shotStart = formatTime(cumulativeSeconds)
      const shotEnd = formatTime(cumulativeSeconds + duration)
      const visualModeLabel =
        labels.visualModeLabels.get(shot.visualModeSlug) ?? shot.visualModeSlug
      const footageSource =
        labels.footageSourceLabels.get(shot.footageSourceSlug) ?? {
          label: shot.footageSourceSlug,
          emoji: '',
        }

      addLine(
        state,
        `Shot ${shot.displayOrder + 1} - ${duration}s - ${shotStart}-${shotEnd}`,
        'HEADING_3'
      )
      addBoldLabel(state, 'Script excerpt:')
      addLine(state, shot.scriptExcerpt ?? shot.description ?? '', 'NORMAL')
      addLine(state, '', 'NORMAL')
      addBoldLabel(state, 'Visual instruction:')
      addLine(state, shot.visualInstruction ?? '', 'NORMAL')
      addLine(state, '', 'NORMAL')
      addLine(
        state,
        `Visual mode: ${visualModeLabel} | Footage source: ${
          footageSource.emoji ?? ''
        } ${footageSource.label}`,
        'NORMAL'
      )
      addLine(state, '------------------------------', 'NORMAL')
      addLine(state, '', 'NORMAL')

      cumulativeSeconds += duration
    }
  }

  if (sortedShots.length === 0) {
    addLine(state, 'No storyboard shots yet.', 'HEADING_2')
  }

  return buildRequests(state.text, state.textRanges, state.boldRanges)
}

function createDocState() {
  return {
    text: '',
    textRanges: [] as TextRange[],
    boldRanges: [] as BoldRange[],
  }
}

function addLine(
  state: ReturnType<typeof createDocState>,
  text: string,
  style: Style
) {
  const startIndex = 1 + state.text.length
  const line = `${text}\n`
  state.text += line
  state.textRanges.push({
    startIndex,
    endIndex: startIndex + line.length,
    style,
  })
}

function addBoldLabel(state: ReturnType<typeof createDocState>, text: string) {
  const startIndex = 1 + state.text.length
  const line = `${text}\n`
  state.text += line
  state.boldRanges.push({
    startIndex,
    endIndex: startIndex + text.length,
  })
}

function buildRequests(
  text: string,
  textRanges: TextRange[],
  boldRanges: BoldRange[]
): GoogleDocsRequest[] {
  const requests: GoogleDocsRequest[] = [
    {
      insertText: {
        location: { index: 1 },
        text,
      },
    },
  ]

  for (const range of textRanges) {
    if (range.style === 'NORMAL') continue
    requests.push({
      updateParagraphStyle: {
        range: {
          startIndex: range.startIndex,
          endIndex: range.endIndex,
        },
        paragraphStyle: { namedStyleType: namedStyleFor(range.style) },
        fields: 'namedStyleType',
      },
    })
  }

  for (const range of boldRanges) {
    requests.push({
      updateTextStyle: {
        range,
        textStyle: { bold: true },
        fields: 'bold',
      },
    })
  }

  return requests
}

function namedStyleFor(style: Style): string {
  switch (style) {
    case 'TITLE':
      return 'TITLE'
    case 'SUBTITLE':
      return 'SUBTITLE'
    case 'HEADING_2':
      return 'HEADING_2'
    case 'HEADING_3':
      return 'HEADING_3'
    default:
      return 'NORMAL_TEXT'
  }
}

function groupShotsByPart(shots: StoryboardShot[]): Map<string, StoryboardShot[]> {
  const groups = new Map<string, StoryboardShot[]>()

  for (const role of PART_ORDER) {
    const partShots = shots.filter((shot) => shot.scriptPartRole === role)
    if (partShots.length > 0) groups.set(role, partShots)
  }

  for (const shot of shots) {
    if (groups.has(shot.scriptPartRole)) continue
    groups.set(shot.scriptPartRole, [
      ...(groups.get(shot.scriptPartRole) ?? []),
      shot,
    ])
  }

  return groups
}

function formatTime(totalSeconds: number): string {
  const rounded = Math.max(0, Math.round(totalSeconds))
  const minutes = Math.floor(rounded / 60)
  const seconds = rounded % 60
  return `${minutes}:${seconds.toString().padStart(2, '0')}`
}
