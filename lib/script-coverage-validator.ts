import type { Script } from './types'
import type { GeneratedShot } from './ai-storyboard-generator'

export interface CoverageResult {
  covered: boolean
  missingSentences: string[]
  coverageRatio: number
  totalSentences: number
}

export function splitScriptIntoSentences(script: Script): string[] {
  const allParts = [...script.parts]
    .sort((a, b) => a.order - b.order)
    .map((part) => part.content)
    .join(' ')

  const sentences = allParts
    .split(/([。！？；])/g)
    .reduce<string[]>((acc, current, index, parts) => {
      if (index % 2 === 0 && current.trim()) {
        const punctuation = parts[index + 1] ?? ''
        acc.push((current + punctuation).trim())
      }
      return acc
    }, [])
    .filter(Boolean)

  return sentences
}

function normalizeForCoverage(text: string): string {
  return text
    .replace(/\s+/g, '')
    .replace(/["""'']/g, '')
    .replace(/[—\-–]/g, '')
}

export function validateScriptCoverage(
  script: Script,
  shots: Array<Pick<GeneratedShot, 'scriptExcerpt'>>
): CoverageResult {
  const sentences = splitScriptIntoSentences(script)
  const concatenated = shots.map((shot) => shot.scriptExcerpt ?? '').join(' ')
  const normalizedConcat = normalizeForCoverage(concatenated)

  const countedSentences = sentences.filter(
    (sentence) => normalizeForCoverage(sentence).length >= 5
  )
  const missingSentences: string[] = []
  let coveredCount = 0

  for (const sentence of countedSentences) {
    const normalizedSentence = normalizeForCoverage(sentence)
    if (normalizedConcat.includes(normalizedSentence)) {
      coveredCount += 1
    } else {
      missingSentences.push(sentence)
    }
  }

  return {
    covered: missingSentences.length === 0,
    missingSentences,
    coverageRatio:
      countedSentences.length > 0 ? coveredCount / countedSentences.length : 1,
    totalSentences: countedSentences.length,
  }
}

export function buildRetryPrompt(
  originalPrompt: string,
  generatedShots: GeneratedShot[],
  missingSentences: string[]
): string {
  return [
    'Your previous storyboard missed required script sentences.',
    '',
    'CRITICAL: Regenerate the full storyboard. Every missing sentence below must appear verbatim inside some shot.script_excerpt.',
    '',
    'Missing sentences:',
    ...missingSentences.map((sentence, index) => `${index + 1}. ${sentence}`),
    '',
    `Previous shot count: ${generatedShots.length}`,
    '',
    'Keep the same output JSON schema. Return JSON only.',
    '',
    'Original instruction:',
    originalPrompt,
  ].join('\n')
}
