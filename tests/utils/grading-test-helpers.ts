import { readFileSync } from 'fs'
import { join } from 'path'
import type { Contest, User, Submission } from '~/types/database'
import { formatDateTime } from '~/types/database'
import { createUser, getUser, deleteUser, addUserToContest } from '~/lib/db/users.server'
import { createContest, deleteContest } from '~/lib/db/contests.server'
import { submitSolution } from '~/lib/submissions.server'
import { getSubmission } from '~/lib/db/submissions.server'
import { SAMPLE_SUBMISSIONS, type SubmissionCase } from '../fixtures/sample-submissions/test-solutions'

/**
 * Create a test user for grading verification
 */
export async function createTestUser(username: string, role: string = 'member'): Promise<void> {
  // Check if user already exists
  const existingUser = await getUser(username)
  if (existingUser) {
    return
  }

  await createUser(username, role as 'admin' | 'member', {
    email: `${username}@test.com`,
    fullname: `Test User ${username}`,
    school: 'Test School'
  })
}

/**
 * Delete a test user (skip for admin to avoid deleting real user)
 */
export async function deleteTestUser(username: string): Promise<void> {
  if (username === 'admin') {
    return
  }
  await deleteUser(username)
}

/**
 * Create a test contest for grading verification
 */
export async function createTestContest(config: {
  contestId: string
  name: string
  problems: string[]
  startTime: Date
  endTime: Date
  users: Record<string, string>
}): Promise<void> {
  // Create the contest
  await createContest(config.contestId, {
    name: config.name,
    description: 'Test contest for grading verification',
    startTime: formatDateTime(config.startTime),
    endTime: formatDateTime(config.endTime),
    problems: config.problems,
    users: config.users,
    mode: 'centralized',
    public: false,
    publicScoreboard: false
  })

  // Add each user to the contest with proper participation status
  for (const [username, status] of Object.entries(config.users)) {
    const participationStatus = status === '1' ? 'started' : 'invited'
    await addUserToContest(username, config.contestId, participationStatus)
  }
}

/**
 * Delete a test contest
 */
export async function deleteTestContest(contestId: string): Promise<void> {
  await deleteContest(contestId)
}

/**
 * Submit a communication problem solution (like prisoners)
 */
export async function submitCommunicationSolution(
  username: string,
  contestId: string,
  problemName: string,
  files: { swapper: string; prisoner: string }
): Promise<Submission> {
  return await submitSolution({
    username,
    problemName,
    language: 'cpp',
    codeA: files.swapper,
    codeB: files.prisoner,
    contestId
  })
}

/**
 * Submit a regular problem solution
 */
export async function submitRegularSolution(
  username: string,
  contestId: string,
  problemName: string,
  code: string,
  language: 'cpp' | 'py' | 'java' = 'cpp'
): Promise<Submission> {
  return await submitSolution({
    username,
    problemName,
    language,
    code,
    contestId
  })
}

/**
 * Wait for grading to complete by polling submission status
 */
export async function waitForGradingComplete(
  subId: number,
  timeout: number = 120000 // 2 minutes default
): Promise<Submission> {
  const startTime = Date.now()
  const pollInterval = 5000 // 5 seconds

  while (Date.now() - startTime < timeout) {
    const submission = await getSubmission(subId)

    if (!submission) {
      throw new Error(`Submission ${subId} not found`)
    }

    // Check if grading is complete
    if (submission.gradingCompleteTime && submission.gradingCompleteTime !== '') {
      return submission
    }

    // Check for compile error (also indicates completion)
    if (submission.compileErrorMessage) {
      return submission
    }

    // Wait before next poll
    await new Promise(resolve => setTimeout(resolve, pollInterval))
  }

  throw new Error(`Grading timeout after ${timeout}ms for submission ${subId}`)
}

/**
 * Read submission file from fixtures directory
 */
export function readSubmissionFile(submission: SubmissionCase, file: 'main' | 'secondary'): string {
  let filename: string

  if (typeof submission.filename === 'string') {
    filename = submission.filename
  } else {
    filename = file === 'main' ? submission.filename.main : submission.filename.secondary!
  }

  const path = join(
    process.cwd(),
    'tests/fixtures/sample-submissions',
    submission.problemName,
    submission.category,
    filename
  )

  return readFileSync(path, 'utf-8')
}

/**
 * Get a sample submission by expected score (for unique identification)
 */
export function getSampleSubmission(problemName: string, expectedScore: number): SubmissionCase {
  const submission = SAMPLE_SUBMISSIONS.find(s =>
    s.problemName === problemName && s.expectedScore === expectedScore
  )

  if (!submission) {
    throw new Error(`No sample submission found for ${problemName} with score ${expectedScore}`)
  }

  return submission
}

/**
 * Cleanup helper that catches and logs errors but doesn't throw
 */
export async function safeCleanup(cleanupFn: () => Promise<void>, description: string): Promise<void> {
  try {
    await cleanupFn()
  } catch (error) {
    console.warn(`Cleanup warning (${description}):`, error.message)
    // Don't throw - we want tests to complete even if cleanup partially fails
  }
}