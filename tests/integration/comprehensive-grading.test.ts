import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { getSubmissionVerdict } from '~/types/database'
import {
  createTestUser,
  deleteTestUser,
  createTestContest,
  deleteTestContest,
  submitCommunicationSolution,
  submitRegularSolution,
  waitForGradingComplete,
  readSubmissionFile,
  getSampleSubmission,
  safeCleanup
} from '../utils/grading-test-helpers'
import { SAMPLE_SUBMISSIONS } from '../fixtures/sample-submissions/test-solutions'

/**
 * Comprehensive Grading Test
 *
 * Tests all 12 sample solutions across 3 problems:
 * - 5 Prisoners solutions (communication problem)
 * - 4 Ping solutions (regular problem)
 * - 3 Addition solutions (regular problem)
 *
 * Validates complete grading pipeline coverage for:
 * - Different problem types (communication vs regular)
 * - Multiple programming languages (C++, Python)
 * - All verdict types (AC, PS, WA, RTE, CE)
 * - Score ranges (0-100 points)
 * - Compile errors and runtime errors
 */

const TEST_USER = 'admin'
const TEST_CONTEST_ID = `comprehensive-${Date.now()}`

describe('Comprehensive Grading Test', () => {
  beforeAll(async () => {

    // Create test user
    await createTestUser(TEST_USER, 'admin')

    // Create test contest with all 3 problems
    await createTestContest({
      contestId: TEST_CONTEST_ID,
      name: 'Comprehensive Testing',
      problems: ['prisoners', 'ping', 'addition'],
      startTime: new Date(Date.now() - 1000),
      endTime: new Date(Date.now() + 7200000), // 2 hours for all submissions
      users: { [TEST_USER]: '1' }
    })
  }, 30000)

  afterAll(async () => {

    await safeCleanup(
      () => deleteTestContest(TEST_CONTEST_ID),
      `delete contest ${TEST_CONTEST_ID}`
    )

    await safeCleanup(
      () => deleteTestUser(TEST_USER),
      `delete user ${TEST_USER}`
    )

  })

  it('verifies all 12 sample solutions get expected scores', async () => {

    const results: Array<{
      solution: string
      expected: number
      actual: number
      verdict: string
      status: 'PASS' | 'FAIL'
    }> = []

    for (const [index, submission] of SAMPLE_SUBMISSIONS.entries()) {
      const solutionName = `${submission.problemName}-${submission.expectedScore}pts`

      try {
        let result

        // Handle different problem types
        if (submission.problemName === 'prisoners') {
          // Communication problem - dual file submission
          const swapperCode = readSubmissionFile(submission, 'secondary')
          const prisonerCode = readSubmissionFile(submission, 'main')

          result = await submitCommunicationSolution(
            TEST_USER,
            TEST_CONTEST_ID,
            'prisoners',
            {
              swapper: swapperCode,
              prisoner: prisonerCode
            }
          )
        } else {
          // Regular problem - single file submission
          const code = readSubmissionFile(submission, 'main')

          result = await submitRegularSolution(
            TEST_USER,
            TEST_CONTEST_ID,
            submission.problemName,
            code,
            submission.language
          )
        }


        // Wait for grading to complete
        const gradedSubmission = await waitForGradingComplete(result.subId, 120000)

        const actualVerdict = getSubmissionVerdict(gradedSubmission)

        // Record result
        const testResult = {
          solution: solutionName,
          expected: submission.expectedScore,
          actual: gradedSubmission.totalScore,
          verdict: actualVerdict,
          status: (
            Math.abs(gradedSubmission.totalScore - submission.expectedScore) < 0.01 &&
            actualVerdict === submission.expectedVerdict
          ) ? 'PASS' : 'FAIL'
        }

        results.push(testResult)

        // Assertions
        expect(gradedSubmission.totalScore).toBeCloseTo(submission.expectedScore, 2)
        expect(gradedSubmission.subtaskScores).toEqual(submission.expectedSubtasks)
        expect(actualVerdict).toBe(submission.expectedVerdict)


      } catch (error) {
        results.push({
          solution: solutionName,
          expected: submission.expectedScore,
          actual: -1,
          verdict: 'ERROR',
          status: 'FAIL'
        })
        throw error // Re-throw to fail the test
      }
    }

    // Summary report
    const passed = results.filter(r => r.status === 'PASS').length
    const failed = results.filter(r => r.status === 'FAIL').length


    results.forEach(r => {
      const icon = r.status === 'PASS' ? '✅' : '❌'
    })


    if (failed === 0) {
    }

    // Overall test should pass only if all individual tests passed
    expect(failed).toBe(0)

  }, 600000) // 10 minute timeout for all 12 submissions
})