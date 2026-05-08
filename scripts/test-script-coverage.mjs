import assert from 'node:assert/strict'

const sentenceSplitRegex = /([。！？；])/g

function split(content) {
  return content
    .split(sentenceSplitRegex)
    .reduce((acc, current, index, parts) => {
      if (index % 2 === 0 && current.trim()) {
        const punctuation = parts[index + 1] ?? ''
        acc.push((current + punctuation).trim())
      }
      return acc
    }, [])
    .filter(Boolean)
}

function normalize(text) {
  return text.replace(/\s+/g, '').replace(/["“”'‘’]/g, '').replace(/[—\-–]/g, '')
}

function findLongestPrefixMatch(excerpt, originalScript) {
  const normalizedScript = normalize(originalScript)
  const normalizedExcerpt = normalize(excerpt)

  for (let length = normalizedExcerpt.length; length >= 5; length -= 1) {
    const prefix = normalizedExcerpt.slice(0, length)
    if (normalizedScript.includes(prefix)) {
      return {
        matchedPortion: excerpt.slice(0, length),
        unmatchedPortion: excerpt.slice(length),
      }
    }
  }

  return { matchedPortion: '', unmatchedPortion: excerpt }
}

function validate(content, excerpts) {
  const sentences = split(content).filter((sentence) => normalize(sentence).length >= 5)
  const concat = normalize(excerpts.join(' '))
  const script = normalize(content)
  const missing = sentences.filter((sentence) => !concat.includes(normalize(sentence)))
  const hallucinatedShots = excerpts
    .map((excerpt, index) => ({ excerpt, index }))
    .filter(({ excerpt }) => excerpt && !script.includes(normalize(excerpt)))
    .map(({ excerpt, index }) => {
      const match = findLongestPrefixMatch(excerpt, content)
      return {
        shotIndex: index,
        scriptExcerpt: excerpt,
        ...match,
      }
    })

  return {
    missing,
    hallucinatedShots,
    forwardRatio: (sentences.length - missing.length) / sentences.length,
    reverseRatio:
      excerpts.length > 0
        ? (excerpts.length - hallucinatedShots.length) / excerpts.length
        : 1,
  }
}

const script =
  '第一句有內容。第二句都有內容！但係，呢句係 pivot，必須保留。最後一句收尾？'

assert.deepEqual(split(script), [
  '第一句有內容。',
  '第二句都有內容！',
  '但係，呢句係 pivot，必須保留。',
  '最後一句收尾？',
])

assert.equal(validate(script, [script]).missing.length, 0)
assert.equal(validate(script, [script]).hallucinatedShots.length, 0)

const missingCase = validate(script, [
  '第一句有內容。第二句都有內容！最後一句收尾？',
])
assert.equal(missingCase.missing[0], '但係，呢句係 pivot，必須保留。')
assert.equal(missingCase.forwardRatio, 0.75)

const hallucinationCase = validate(script, [
  '第一句有內容。第二句都有內容！第三句係 AI 自己加。',
])
assert.equal(hallucinationCase.hallucinatedShots.length, 1)
assert.equal(hallucinationCase.reverseRatio, 0)
assert.match(hallucinationCase.hallucinatedShots[0].unmatchedPortion, /第三句/)

console.log('script coverage tests passed')
