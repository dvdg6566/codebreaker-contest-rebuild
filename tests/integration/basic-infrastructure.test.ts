import { describe, it, expect } from 'vitest'
import { SAMPLE_SUBMISSIONS } from '../fixtures/sample-submissions/test-solutions'
import { readSubmissionFile, getSampleSubmission } from '../utils/grading-test-helpers'

/**
 * Basic Infrastructure Test
 *
 * Validates that test utilities and sample submissions are properly set up
 * before running the full grading verification test.
 */

describe('Basic Infrastructure', () => {
  it('can load sample submission metadata', () => {
    expect(SAMPLE_SUBMISSIONS).toHaveLength(2)

    const prisonersSubmission = SAMPLE_SUBMISSIONS.find(s => s.expectedScore === 28.42)
    expect(prisonersSubmission).toBeDefined()
    expect(prisonersSubmission!.problemName).toBe('prisoners')
    expect(prisonersSubmission!.expectedSubtasks).toEqual([0, 0, 28.42, 0])
  })

  it('can read sample submission files', () => {
    const submission = getSampleSubmission('prisoners', 28.42)

    const swapperCode = readSubmissionFile(submission, 'secondary')
    const prisonerCode = readSubmissionFile(submission, 'main')

    expect(swapperCode).toContain('#include "swapper.h"')
    expect(prisonerCode).toContain('#include "prisoner.h"')
    expect(swapperCode.length).toBeGreaterThan(100)
    expect(prisonerCode.length).toBeGreaterThan(100)
  })

  it('has proper environment variables', () => {
    expect(process.env.JUDGE_NAME).toBe('codebreakercontest07')
    expect(process.env.AWS_REGION).toBe('ap-southeast-1')
    expect(process.env.AWS_ACCOUNT_ID).toBe('354145626860')
  })
})