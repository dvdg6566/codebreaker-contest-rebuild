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
    console.log('🧪 Setting up comprehensive grading test...')

    // Create test user
    await createTestUser(TEST_USER, 'admin')
    console.log(`✅ Created test user: ${TEST_USER}`)

    // Create test contest with all 3 problems
    await createTestContest({
      contestId: TEST_CONTEST_ID,
      name: 'Comprehensive Testing',
      problems: ['prisoners', 'ping', 'addition'],
      startTime: new Date(Date.now() - 1000),
      endTime: new Date(Date.now() + 7200000), // 2 hours for all submissions
      users: { [TEST_USER]: '1' }
    })
    console.log(`✅ Created comprehensive test contest: ${TEST_CONTEST_ID}`)
  }, 30000)

  afterAll(async () => {
    console.log('🧹 Cleaning up comprehensive test...')

    await safeCleanup(
      () => deleteTestContest(TEST_CONTEST_ID),
      `delete contest ${TEST_CONTEST_ID}`
    )

    await safeCleanup(
      () => deleteTestUser(TEST_USER),
      `delete user ${TEST_USER}`
    )

    console.log('✅ Comprehensive cleanup completed')
  })

  it('verifies all 12 sample solutions get expected scores', async () => {
    console.log('🔬 Testing all 12 sample solutions across 3 problems...')
    console.log(`📊 Solutions: ${SAMPLE_SUBMISSIONS.length} total`)

    const results: Array<{
      solution: string
      expected: number
      actual: number
      verdict: string
      status: 'PASS' | 'FAIL'
    }> = []

    for (const [index, submission] of SAMPLE_SUBMISSIONS.entries()) {
      const solutionName = `${submission.problemName}-${submission.expectedScore}pts`
      console.log(`\n[${index + 1}/12] 🧪 Testing ${solutionName}...`)

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

        console.log(`   📝 Submission created with ID: ${result.subId}`)

        // Wait for grading to complete
        console.log(`   ⏳ Waiting for grading...`)
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

        console.log(`   ✅ ${solutionName}: ${gradedSubmission.totalScore}pts (${actualVerdict}) - PASS`)

      } catch (error) {
        console.error(`   ❌ ${solutionName}: ERROR - ${error.message}`)
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

    console.log('\n📊 COMPREHENSIVE TEST RESULTS:')
    console.log('='.repeat(50))

    results.forEach(r => {
      const icon = r.status === 'PASS' ? '✅' : '❌'
      console.log(`${icon} ${r.solution.padEnd(20)} ${r.actual}pts (${r.verdict})`)
    })

    console.log(`\n🎯 Summary: ${passed}/${results.length} tests passed`)

    if (failed === 0) {
      console.log('🎉 ALL TESTS PASSED! Grading system fully validated!')
    }

    // Overall test should pass only if all individual tests passed
    expect(failed).toBe(0)

  }, 600000) // 10 minute timeout for all 12 submissions
})