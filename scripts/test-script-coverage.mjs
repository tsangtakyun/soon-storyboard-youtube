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
  return text.replace(/\s+/g, '').replace(/["""'']/g, '').replace(/[—\-–]/g, '')
}

function validate(content, excerpts) {
  const sentences = split(content).filter((sentence) => normalize(sentence).length >= 5)
  const concat = normalize(excerpts.join(' '))
  const missing = sentences.filter((sentence) => !concat.includes(normalize(sentence)))
  return { missing, ratio: (sentences.length - missing.length) / sentences.length }
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
assert.equal(
  validate(script, ['第一句有內容。第二句都有內容！最後一句收尾？']).missing[0],
  '但係，呢句係 pivot，必須保留。'
)
assert.equal(validate(script, ['第一句有內容。第二句都有內容！最後一句收尾？']).ratio, 0.75)

console.log('script coverage tests passed')
