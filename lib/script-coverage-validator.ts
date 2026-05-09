import type { Script, ScriptPart } from './types'

export interface GeneratedShotLike {
  scriptExcerpt?: string
}

export interface HallucinatedShot {
  shotIndex: number
  scriptExcerpt: string
  matchedPortion?: string
  unmatchedPortion: string
}

export interface CoverageResult {
  covered: boolean
  forwardCovered: boolean
  reverseCovered: boolean
  missingSentences: string[]
  hallucinatedShots: HallucinatedShot[]
  forwardRatio: number
  reverseRatio: number
  totalSentences: number
  totalShots: number
}

export function getOriginalScriptText(script: Script): string {
  return [...script.parts]
    .sort((a, b) => a.order - b.order)
    .map((part) => part.content)
    .join(' ')
}

export function splitContentIntoSentences(content: string): string[] {
  return content
    .split(/([。！？；])/g)
    .reduce<string[]>((acc, current, index, parts) => {
      if (index % 2 === 0 && current.trim()) {
        const punctuation = parts[index + 1] ?? ''
        acc.push((current + punctuation).trim())
      }
      return acc
    }, [])
    .filter(Boolean)
}

export function splitScriptIntoSentences(script: Script): string[] {
  return splitContentIntoSentences(getOriginalScriptText(script))
}

function normalizeWithMap(text: string): {
  normalized: string
  originalEndByNormalizedIndex: number[]
} {
  let normalized = ''
  const originalEndByNormalizedIndex: number[] = []

  for (let index = 0; index < text.length; index += 1) {
    const char = text[index]
    if (/\s/.test(char)) continue
    if (/["“”'‘’]/.test(char)) continue
    if (/[—\-–]/.test(char)) continue
    normalized += char
    originalEndByNormalizedIndex.push(index + 1)
  }

  return { normalized, originalEndByNormalizedIndex }
}

function normalizeForCoverage(text: string): string {
  return normalizeWithMap(text).normalized
}

export function findLongestPrefixMatch(
  excerpt: string,
  originalText: string
): { matchedPortion: string; unmatchedPortion: string } {
  const { normalized: normalizedExcerpt, originalEndByNormalizedIndex } =
    normalizeWithMap(excerpt)
  const normalizedOriginal = normalizeForCoverage(originalText)

  for (let length = normalizedExcerpt.length; length >= 5; length -= 1) {
    const prefix = normalizedExcerpt.slice(0, length)
    if (normalizedOriginal.includes(prefix)) {
      const splitPoint = originalEndByNormalizedIndex[length - 1] ?? 0
      return {
        matchedPortion: excerpt.slice(0, splitPoint),
        unmatchedPortion: excerpt.slice(splitPoint),
      }
    }
  }

  return {
    matchedPortion: '',
    unmatchedPortion: excerpt,
  }
}

function validateCoverageAgainstText(
  originalText: string,
  shots: GeneratedShotLike[]
): CoverageResult {
  const sentences = splitContentIntoSentences(originalText)
  const normalizedOriginal = normalizeForCoverage(originalText)
  const concatenatedShots = shots
    .map((shot) => shot.scriptExcerpt ?? '')
    .join(' ')
  const normalizedConcat = normalizeForCoverage(concatenatedShots)

  const countedSentences = sentences.filter(
    (sentence) => normalizeForCoverage(sentence).length >= 5
  )
  const missingSentences: string[] = []
  let forwardCoveredCount = 0

  for (const sentence of countedSentences) {
    const normalizedSentence = normalizeForCoverage(sentence)
    if (normalizedConcat.includes(normalizedSentence)) {
      forwardCoveredCount += 1
    } else {
      missingSentences.push(sentence)
    }
  }

  const hallucinatedShots: HallucinatedShot[] = []
  let reverseCoveredCount = 0

  shots.forEach((shot, index) => {
    const excerpt = shot.scriptExcerpt ?? ''
    if (!excerpt.trim()) {
      reverseCoveredCount += 1
      return
    }

    const normalizedExcerpt = normalizeForCoverage(excerpt)
    if (normalizedOriginal.includes(normalizedExcerpt)) {
      reverseCoveredCount += 1
      return
    }

    const { matchedPortion, unmatchedPortion } = findLongestPrefixMatch(
      excerpt,
      originalText
    )

    hallucinatedShots.push({
      shotIndex: index,
      scriptExcerpt: excerpt,
      matchedPortion,
      unmatchedPortion,
    })
  })

  const totalSentences = countedSentences.length
  const totalShots = shots.length
  const forwardRatio =
    totalSentences > 0 ? forwardCoveredCount / totalSentences : 1
  const reverseRatio = totalShots > 0 ? reverseCoveredCount / totalShots : 1

  return {
    covered: missingSentences.length === 0 && hallucinatedShots.length === 0,
    forwardCovered: missingSentences.length === 0,
    reverseCovered: hallucinatedShots.length === 0,
    missingSentences,
    hallucinatedShots,
    forwardRatio,
    reverseRatio,
    totalSentences,
    totalShots,
  }
}

export function validateScriptCoverage(
  script: Script,
  shots: GeneratedShotLike[]
): CoverageResult {
  return validateCoverageAgainstText(getOriginalScriptText(script), shots)
}

export function validatePartCoverage(
  targetPart: ScriptPart,
  shots: GeneratedShotLike[]
): CoverageResult {
  return validateCoverageAgainstText(targetPart.content, shots)
}

export function buildRetryPrompt(
  originalPrompt: string,
  generatedShots: GeneratedShotLike[],
  missingSentences: string[],
  hallucinatedShots: HallucinatedShot[]
): string {
  const issueLines: string[] = []

  if (missingSentences.length > 0) {
    issueLines.push(
      '## Missing sentences (must be covered verbatim)',
      ...missingSentences.map(
        (sentence, index) => `${index + 1}. "${sentence}"`
      ),
      ''
    )
  }

  if (hallucinatedShots.length > 0) {
    issueLines.push(
      '## Hallucinated content (not present in the allowed source text)',
      ...hallucinatedShots.map(
        (shot, index) =>
          `${index + 1}. Shot ${shot.shotIndex + 1}: "${shot.unmatchedPortion}"`
      ),
      '',
      'Your previous script_excerpt contained text that does not exist in the allowed source text.',
      'Do not narratively complete patterns such as "first, second" by adding a "third" unless it literally exists in source.',
      ''
    )
  }

  return [
    'Your previous storyboard failed script fidelity validation.',
    '',
    ...issueLines,
    `Previous shot count: ${generatedShots.length}`,
    '',
    'Regenerate the storyboard and satisfy both requirements:',
    '1. Forward coverage: every source sentence appears in some shot.script_excerpt.',
    '2. Reverse coverage: every shot.script_excerpt is a verbatim substring from source.',
    '',
    'STRICT: script_excerpt is source text, not a summary field.',
    'Do not rewrite, paraphrase, add transition sentences, or narratively complete missing structure.',
    'Return JSON only using the same schema.',
    '',
    'Original instruction:',
    originalPrompt,
  ].join('\n')
}
