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

/**
 * Grading Verification Test
 *
 * Tests that sample solutions get expected scores from the real grading pipeline.
 * This validates:
 * - Sample solution metadata accuracy
 * - AWS Step Function grading integration
 * - Communication problem handling
 * - Subtask scoring calculation
 *
 * Uses real AWS infrastructure but isolated test data.
 */

const TEST_USER = 'admin'
const TEST_CONTEST_ID = `testing-${Date.now()}`

describe('Grading Verification', () => {
  beforeAll(async () => {
    console.log('🧪 Setting up grading verification test...')

    // Create test user
    await createTestUser(TEST_USER, 'admin')
    console.log(`✅ Created test user: ${TEST_USER}`)

    // Create test contest with prisoners and ping problems
    await createTestContest({
      contestId: TEST_CONTEST_ID,
      name: 'Testing',
      problems: ['prisoners', 'ping'],
      startTime: new Date(Date.now() - 1000), // started 1 second ago
      endTime: new Date(Date.now() + 3600000), // ends in 1 hour
      users: { [TEST_USER]: '1' } // user already started
    })
    console.log(`✅ Created test contest: ${TEST_CONTEST_ID}`)
  }, 30000) // 30 second timeout for setup

  afterAll(async () => {
    console.log('🧹 Cleaning up grading verification test...')

    // Cleanup in reverse order, with error handling
    await safeCleanup(
      () => deleteTestContest(TEST_CONTEST_ID),
      `delete contest ${TEST_CONTEST_ID}`
    )

    await safeCleanup(
      () => deleteTestUser(TEST_USER),
      `delete user ${TEST_USER}`
    )

    console.log('✅ Cleanup completed')
  })

  describe('Single Submission Verification', () => {
    it('verifies prisoners solution gets expected subtask scores [0, 98.01, 0, 100]', async () => {
      console.log('🔬 Testing prisoners solution with expected score 28.42...')

      // Get sample submission metadata
      const submission = getSampleSubmission('prisoners', 28.42)
      expect(submission.expectedSubtasks).toEqual([0, 98.01, 0, 100])
      expect(submission.expectedVerdict).toBe('PS')

      // Read solution files
      const swapperCode = readSubmissionFile(submission, 'secondary')
      const prisonerCode = readSubmissionFile(submission, 'main')

      expect(swapperCode).toContain('#include "swapper.h"')
      expect(prisonerCode).toContain('#include "prisoner.h"')
      console.log('✅ Solution files loaded successfully')

      // Submit communication solution
      const result = await submitCommunicationSolution(
        TEST_USER,
        TEST_CONTEST_ID,
        'prisoners',
        {
          swapper: swapperCode,
          prisoner: prisonerCode
        }
      )

      expect(result.subId).toBeTypeOf('number')
      expect(result.username).toBe(TEST_USER)
      expect(result.problemName).toBe('prisoners')
      expect(result.contestId).toBe(TEST_CONTEST_ID)
      console.log(`✅ Submission created with ID: ${result.subId}`)

      // Wait for grading to complete (real Step Function execution)
      console.log('⏳ Waiting for grading to complete...')
      const gradedSubmission = await waitForGradingComplete(result.subId, 120000) // 2 minute timeout

      // Verify grading completion
      expect(gradedSubmission.gradingCompleteTime).toBeTruthy()
      expect(gradedSubmission.gradingCompleteTime).not.toBe('')
      console.log(`✅ Grading completed at: ${gradedSubmission.gradingCompleteTime}`)

      // Core verification: scores match expected metadata exactly
      expect(gradedSubmission.totalScore).toBeCloseTo(submission.expectedScore, 2)
      expect(gradedSubmission.subtaskScores).toEqual(submission.expectedSubtasks)

      // Verify verdict
      const verdict = getSubmissionVerdict(gradedSubmission)
      expect(verdict).toBe('PS') // Partial Score

      // Verify submission record completeness
      expect(gradedSubmission.score).toBeInstanceOf(Array)
      expect(gradedSubmission.verdicts).toBeInstanceOf(Array)
      expect(gradedSubmission.times).toBeInstanceOf(Array)
      expect(gradedSubmission.memories).toBeInstanceOf(Array)
      expect(gradedSubmission.status).toBeInstanceOf(Array)

      console.log(`✅ Verification successful:`)
      console.log(`   Expected: [${submission.expectedSubtasks?.join(', ')}] = ${submission.expectedScore} (${submission.expectedVerdict})`)
      console.log(`   Actual:   [${gradedSubmission.subtaskScores.join(', ')}] = ${gradedSubmission.totalScore} (${verdict})`)
      console.log(`   Max time: ${gradedSubmission.maxTime}ms`)
      console.log(`   Max memory: ${gradedSubmission.maxMemory}KB`)
    }, 180000) // 3 minute test timeout for grading

    it('verifies prisoners random solution gets expected subtask scores [16, 15.21, 15.21, 0]', async () => {
      console.log('🔬 Testing prisoners random solution with expected score 15.42...')

      // Get the second sample submission metadata
      const submission = getSampleSubmission('prisoners', 15.42)
      expect(submission.expectedSubtasks).toEqual([16, 15.21, 15.21, 0])
      expect(submission.expectedVerdict).toBe('WA')

      // Read solution files
      const swapperCode = readSubmissionFile(submission, 'secondary')
      const prisonerCode = readSubmissionFile(submission, 'main')

      expect(swapperCode).toContain('#include "swapper.h"')
      expect(prisonerCode).toContain('#include "prisoner.h"')
      console.log('✅ Random solution files loaded successfully')

      // Submit communication solution
      const result = await submitCommunicationSolution(
        TEST_USER,
        TEST_CONTEST_ID,
        'prisoners',
        {
          swapper: swapperCode,
          prisoner: prisonerCode
        }
      )

      console.log(`✅ Random submission created with ID: ${result.subId}`)

      // Wait for grading to complete
      console.log('⏳ Waiting for random solution grading to complete...')
      const gradedSubmission = await waitForGradingComplete(result.subId, 120000)

      console.log(`✅ Random solution grading completed at: ${gradedSubmission.gradingCompleteTime}`)

      // Core verification: scores match expected metadata exactly
      expect(gradedSubmission.totalScore).toBeCloseTo(submission.expectedScore, 2)
      expect(gradedSubmission.subtaskScores).toEqual(submission.expectedSubtasks)

      // Verify verdict
      const verdict = getSubmissionVerdict(gradedSubmission)
      expect(verdict).toBe('WA')

      console.log(`✅ Random solution verification successful:`)
      console.log(`   Expected: [${submission.expectedSubtasks?.join(', ')}] = ${submission.expectedScore} (${submission.expectedVerdict})`)
      console.log(`   Actual:   [${gradedSubmission.subtaskScores.join(', ')}] = ${gradedSubmission.totalScore} (${verdict})`)
    }, 180000) // 3 minute test timeout for grading

    it('verifies prisoners brute force solution gets expected subtask scores [25, 25, 25, 25]', async () => {
      console.log('🔬 Testing prisoners brute force solution with expected score 25.0...')

      // Get the brute force sample submission metadata
      const submission = getSampleSubmission('prisoners', 25.0)
      expect(submission.expectedSubtasks).toEqual([25, 25, 25, 25])
      expect(submission.expectedVerdict).toBe('WA')

      // Read solution files
      const swapperCode = readSubmissionFile(submission, 'secondary')
      const prisonerCode = readSubmissionFile(submission, 'main')

      expect(swapperCode).toContain('#include "swapper.h"')
      expect(prisonerCode).toContain('#include "prisoner.h"')
      console.log('✅ Brute force solution files loaded successfully')

      // Submit communication solution
      const result = await submitCommunicationSolution(
        TEST_USER,
        TEST_CONTEST_ID,
        'prisoners',
        {
          swapper: swapperCode,
          prisoner: prisonerCode
        }
      )

      console.log(`✅ Brute force submission created with ID: ${result.subId}`)

      // Wait for grading to complete
      console.log('⏳ Waiting for brute force solution grading to complete...')
      const gradedSubmission = await waitForGradingComplete(result.subId, 120000)

      console.log(`✅ Brute force solution grading completed at: ${gradedSubmission.gradingCompleteTime}`)

      // Core verification: scores match expected metadata exactly
      expect(gradedSubmission.totalScore).toBeCloseTo(submission.expectedScore, 2)
      expect(gradedSubmission.subtaskScores).toEqual(submission.expectedSubtasks)

      // Verify verdict
      const verdict = getSubmissionVerdict(gradedSubmission)
      expect(verdict).toBe('WA')

      console.log(`✅ Brute force solution verification successful:`)
      console.log(`   Expected: [${submission.expectedSubtasks?.join(', ')}] = ${submission.expectedScore} (${submission.expectedVerdict})`)
      console.log(`   Actual:   [${gradedSubmission.subtaskScores.join(', ')}] = ${gradedSubmission.totalScore} (${verdict})`)
    }, 180000) // 3 minute test timeout for grading

    it('verifies prisoners cycle solution gets expected subtask scores [100, 100, 0, 100]', async () => {
      console.log('🔬 Testing prisoners cycle solution with expected score 56.0...')

      // Get the cycle sample submission metadata
      const submission = getSampleSubmission('prisoners', 56.0)
      expect(submission.expectedSubtasks).toEqual([100, 100, 0, 100])
      expect(submission.expectedVerdict).toBe('RTE')

      // Read solution files
      const swapperCode = readSubmissionFile(submission, 'secondary')
      const prisonerCode = readSubmissionFile(submission, 'main')

      expect(swapperCode).toContain('#include "swapper.h"')
      expect(prisonerCode).toContain('#include "prisoner.h"')
      console.log('✅ Cycle solution files loaded successfully')

      // Submit communication solution
      const result = await submitCommunicationSolution(
        TEST_USER,
        TEST_CONTEST_ID,
        'prisoners',
        {
          swapper: swapperCode,
          prisoner: prisonerCode
        }
      )

      console.log(`✅ Cycle submission created with ID: ${result.subId}`)

      // Wait for grading to complete
      console.log('⏳ Waiting for cycle solution grading to complete...')
      const gradedSubmission = await waitForGradingComplete(result.subId, 120000)

      console.log(`✅ Cycle solution grading completed at: ${gradedSubmission.gradingCompleteTime}`)

      // Core verification: scores match expected metadata exactly
      expect(gradedSubmission.totalScore).toBeCloseTo(submission.expectedScore, 2)
      expect(gradedSubmission.subtaskScores).toEqual(submission.expectedSubtasks)

      // Verify verdict
      const verdict = getSubmissionVerdict(gradedSubmission)
      expect(verdict).toBe('RTE')

      console.log(`✅ Cycle solution verification successful:`)
      console.log(`   Expected: [${submission.expectedSubtasks?.join(', ')}] = ${submission.expectedScore} (${submission.expectedVerdict})`)
      console.log(`   Actual:   [${gradedSubmission.subtaskScores.join(', ')}] = ${gradedSubmission.totalScore} (${verdict})`)
    }, 180000) // 3 minute test timeout for grading

    it('verifies prisoners optimal solution gets expected subtask scores [100, 100, 100, 100] (AC)', async () => {
      console.log('🔬 Testing prisoners optimal solution with expected score 100.0...')

      // Get the optimal sample submission metadata
      const submission = getSampleSubmission('prisoners', 100.0)
      expect(submission.expectedSubtasks).toEqual([100, 100, 100, 100])
      expect(submission.expectedVerdict).toBe('AC')

      // Read solution files
      const swapperCode = readSubmissionFile(submission, 'secondary')
      const prisonerCode = readSubmissionFile(submission, 'main')

      expect(swapperCode).toContain('#include "swapper.h"')
      expect(prisonerCode).toContain('#include "prisoner.h"')
      console.log('✅ Optimal solution files loaded successfully')

      // Submit communication solution
      const result = await submitCommunicationSolution(
        TEST_USER,
        TEST_CONTEST_ID,
        'prisoners',
        {
          swapper: swapperCode,
          prisoner: prisonerCode
        }
      )

      console.log(`✅ Optimal submission created with ID: ${result.subId}`)

      // Wait for grading to complete
      console.log('⏳ Waiting for optimal solution grading to complete...')
      const gradedSubmission = await waitForGradingComplete(result.subId, 120000)

      console.log(`✅ Optimal solution grading completed at: ${gradedSubmission.gradingCompleteTime}`)

      // Core verification: scores match expected metadata exactly
      expect(gradedSubmission.totalScore).toBeCloseTo(submission.expectedScore, 2)
      expect(gradedSubmission.subtaskScores).toEqual(submission.expectedSubtasks)

      // Verify verdict
      const verdict = getSubmissionVerdict(gradedSubmission)
      expect(verdict).toBe('AC') // Accepted

      console.log(`✅ Optimal solution verification successful:`)
      console.log(`   Expected: [${submission.expectedSubtasks?.join(', ')}] = ${submission.expectedScore} (${submission.expectedVerdict})`)
      console.log(`   Actual:   [${gradedSubmission.subtaskScores.join(', ')}] = ${gradedSubmission.totalScore} (${verdict})`)
    }, 180000) // 3 minute test timeout for grading

    it('verifies ping advanced solution gets expected subtask scores [100, 100, 96.67]', async () => {
      console.log('🔬 Testing ping advanced solution with expected score 98.0...')

      // Get the advanced sample submission metadata
      const submission = getSampleSubmission('ping', 98.0)
      expect(submission.expectedSubtasks).toEqual([100, 100, 96.67])
      expect(submission.expectedVerdict).toBe('PS')

      // Read solution file
      const solutionCode = readSubmissionFile(submission, 'main')
      expect(solutionCode).toContain('#include')
      console.log('✅ Advanced solution file loaded successfully')

      // Submit regular solution
      const result = await submitRegularSolution(
        TEST_USER,
        TEST_CONTEST_ID,
        'ping',
        solutionCode,
        'cpp'
      )

      console.log(`✅ Advanced ping submission created with ID: ${result.subId}`)

      // Wait for grading to complete
      console.log('⏳ Waiting for advanced ping solution grading to complete...')
      const gradedSubmission = await waitForGradingComplete(result.subId, 120000)

      console.log(`✅ Advanced ping solution grading completed at: ${gradedSubmission.gradingCompleteTime}`)

      // Core verification: scores match expected metadata exactly
      expect(gradedSubmission.totalScore).toBeCloseTo(submission.expectedScore, 2)
      expect(gradedSubmission.subtaskScores).toEqual(submission.expectedSubtasks)

      // Verify verdict
      const verdict = getSubmissionVerdict(gradedSubmission)
      expect(verdict).toBe('PS')

      console.log(`✅ Advanced ping solution verification successful:`)
      console.log(`   Expected: [${submission.expectedSubtasks?.join(', ')}] = ${submission.expectedScore} (${submission.expectedVerdict})`)
      console.log(`   Actual:   [${gradedSubmission.subtaskScores.join(', ')}] = ${gradedSubmission.totalScore} (${verdict})`)
    }, 180000) // 3 minute test timeout for grading
  })
})