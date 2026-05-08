import { NextResponse } from 'next/server'

import {
  fetchScriptByStoryboard,
  fetchShots,
} from '@/lib/storyboard-fetch'
import { validateScriptCoverage } from '@/lib/script-coverage-validator'

export async function POST(
  _request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const script = await fetchScriptByStoryboard(params.id)
    if (!script) {
      return NextResponse.json(
        { success: false, error: 'Script not found' },
        { status: 404 }
      )
    }

    const shots = await fetchShots(params.id)
    if (shots.length === 0) {
      return NextResponse.json({
        success: true,
        covered: true,
        forwardCovered: true,
        reverseCovered: true,
        forwardRatio: 1,
        reverseRatio: 1,
        missingSentences: [],
        hallucinatedShots: [],
        totalSentences: 0,
        totalShots: 0,
      })
    }

    const coverage = validateScriptCoverage(script, shots)

    return NextResponse.json({
      success: true,
      covered: coverage.covered,
      forwardCovered: coverage.forwardCovered,
      reverseCovered: coverage.reverseCovered,
      forwardRatio: coverage.forwardRatio,
      reverseRatio: coverage.reverseRatio,
      missingSentences: coverage.missingSentences,
      hallucinatedShots: coverage.hallucinatedShots,
      totalSentences: coverage.totalSentences,
      totalShots: coverage.totalShots,
    })
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        error:
          error instanceof Error ? error.message : 'Coverage validation failed',
      },
      { status: 500 }
    )
  }
}
