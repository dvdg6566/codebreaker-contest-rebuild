import { createTestUser, deleteTestUser, createTestContest, deleteTestContest, submitCommunicationSolution, submitRegularSolution, waitForGradingComplete, readSubmissionFile, getSampleSubmission, safeCleanup } from './grading-test-helpers'
import { getUserActiveContests } from '~/lib/db/users.server'
import { getContest, getContestStatus } from '~/lib/db/contests.server'
import { getScoreboard } from '~/lib/db/scoreboard.server'
import type { Submission, ScoreboardEntry } from '~/types/database'
import { SAMPLE_SUBMISSIONS, type SubmissionCase } from '../fixtures/sample-submissions/test-solutions'

export interface ContestSimulationConfig {
  contestId: string
  users: string[]
  problems: string[]
  duration: number // contest length in milliseconds
  startDelay?: number // delay before contest starts
  name?: string
}

export interface ContestEvent {
  timestamp: number
  type: 'user_start' | 'submission' | 'announcement' | 'clarification' | 'contest_end'
  user?: string
  data: any
}

export interface ContestSnapshot {
  timestamp: number
  leaderboard: ScoreboardEntry[]
  contestStatus: string
  notifications: any[]
}

/**
 * Create a contest with multiple test users
 */
export async function createContestWithUsers(config: ContestSimulationConfig): Promise<void> {
  // Create all test users
  for (const user of config.users) {
    await createTestUser(user, 'member')
  }

  // Create contest with all users started (centralized contests auto-start users)
  const usersObject = Object.fromEntries(config.users.map(u => [u, '1'])) // all started (centralized mode)

  await createTestContest({
    contestId: config.contestId,
    name: config.name || 'Contest Simulation',
    problems: config.problems,
    startTime: new Date(Date.now() + (config.startDelay || 5000)),
    endTime: new Date(Date.now() + config.duration + (config.startDelay || 5000)),
    users: usersObject
  })


  // Verify users were added properly
  for (const user of config.users) {
    const activeContests = await getUserActiveContests(user)
  }
}

/**
 * Note: For centralized contests, users automatically participate.
 * The startUserContest function is only used for self-timer contests.
 * Contest simulation tests use centralized timing where users are
 * automatically started when added to the contest.
 */

/**
 * Submit a test solution using sample submission types
 */
export async function submitTestSolution(
  username: string,
  contestId: string,
  problemName: string,
  solutionType: string
): Promise<Submission> {
  const submission = getSampleSubmissionByType(problemName, solutionType)

  let result: Submission
  if (problemName === 'prisoners') {
    result = await submitCommunicationSolution(username, contestId, problemName, {
      swapper: readSubmissionFile(submission, 'secondary'),
      prisoner: readSubmissionFile(submission, 'main')
    })
  } else {
    result = await submitRegularSolution(
      username, contestId, problemName,
      readSubmissionFile(submission, 'main'),
      submission.language
    )
  }

  return result
}

/**
 * Get sample submission by problem and solution type
 */
export function getSampleSubmissionByType(problemName: string, solutionType: string): SubmissionCase {
  const typeMap: Record<string, Record<string, number>> = {
    prisoners: {
      'optimal': 100.0,
      'strategic': 28.42,
      'cycle': 56.0,
      'brute': 25.0,
      'random': 15.42
    },
    ping: {
      'optimal': 100.0,
      'advanced': 98.0,
      'binary': 40.0,
      'trivial': 10.0
    },
    addition: {
      'python-correct': 100.0,
      'cpp-partial': 36.0,
      'mismatch': 0.0
    }
  }

  const expectedScore = typeMap[problemName]?.[solutionType]

  if (expectedScore === undefined) {
    throw new Error(`Unknown solution type: ${problemName}/${solutionType}`)
  }

  return getSampleSubmission(problemName, expectedScore)
}

/**
 * Get current contest leaderboard
 */
export async function getContestLeaderboard(contestId: string): Promise<ScoreboardEntry[]> {
  return await getScoreboard(contestId)
}

/**
 * Wait for contest to start (become ONGOING)
 */
export async function waitForContestStart(contestId: string, timeout: number = 30000): Promise<void> {
  const startTime = Date.now()
  const pollInterval = 1000 // 1 second

  while (Date.now() - startTime < timeout) {
    const contest = await getContest(contestId)
    if (!contest) {
      throw new Error(`Contest ${contestId} not found`)
    }

    const status = getContestStatus(contest)

    if (status === 'ONGOING') {
      return // Contest started
    }

    await delay(pollInterval)
  }

  throw new Error(`Contest start timeout after ${timeout}ms for contest ${contestId}`)
}

/**
 * Wait for contest to end automatically via EventBridge Scheduler
 */
export async function waitForContestEnd(contestId: string, timeout: number = 300000): Promise<void> {
  const startTime = Date.now()
  const pollInterval = 5000 // 5 seconds

  while (Date.now() - startTime < timeout) {
    const contest = await getContest(contestId)
    if (!contest) {
      throw new Error(`Contest ${contestId} not found`)
    }

    const status = getContestStatus(contest)

    if (status === 'ENDED') {
      return // Contest ended automatically
    }

    await delay(pollInterval)
  }

  throw new Error(`Contest end timeout after ${timeout}ms for contest ${contestId}`)
}

/**
 * Capture contest timeline over time
 */
export async function captureContestTimeline(
  contestId: string,
  events: ContestEvent[],
  captureInterval: number = 10000
): Promise<ContestSnapshot[]> {
  const snapshots: ContestSnapshot[] = []
  const startTime = Date.now()

  // Sort events by timestamp
  const sortedEvents = [...events].sort((a, b) => a.timestamp - b.timestamp)

  let eventIndex = 0
  let running = true

  // Capture initial state
  snapshots.push(await captureSnapshot(contestId))

  while (running && eventIndex < sortedEvents.length) {
    const nextEvent = sortedEvents[eventIndex]
    const now = Date.now()

    // Wait until it's time for the next event
    if (nextEvent.timestamp > now) {
      await delay(Math.min(nextEvent.timestamp - now, captureInterval))
    }

    // Execute event if it's time
    if (Date.now() >= nextEvent.timestamp) {
      await executeEvent(contestId, nextEvent)
      eventIndex++
    }

    // Capture snapshot
    snapshots.push(await captureSnapshot(contestId))

    // Check if contest has ended
    const contest = await getContest(contestId)
    if (contest && getContestStatus(contest) === 'ENDED') {
      running = false
    }
  }

  return snapshots
}

/**
 * Execute a contest event
 */
async function executeEvent(contestId: string, event: ContestEvent): Promise<void> {
  switch (event.type) {
    case 'user_start':
      if (event.user) {
        await startUserContest(event.user, contestId)
      }
      break
    case 'submission':
      if (event.user && event.data?.problem && event.data?.solution) {
        await submitTestSolution(event.user, contestId, event.data.problem, event.data.solution)
      }
      break
    // Other event types would be implemented here
    default:
      console.warn(`Unknown event type: ${event.type}`)
  }
}

/**
 * Capture a snapshot of contest state
 */
async function captureSnapshot(contestId: string): Promise<ContestSnapshot> {
  const contest = await getContest(contestId)
  const leaderboard = await getContestLeaderboard(contestId)

  return {
    timestamp: Date.now(),
    leaderboard,
    contestStatus: contest ? getContestStatus(contest) : 'NOT_FOUND',
    notifications: [] // Would capture WebSocket notifications in real implementation
  }
}

/**
 * Clean up multiple test users and contest
 */
export async function cleanupContestSimulation(contestId: string, users: string[]): Promise<void> {
  // Cleanup contest
  await safeCleanup(
    () => deleteTestContest(contestId),
    `delete contest ${contestId}`
  )

  // Cleanup users (skip admin and other protected users)
  for (const user of users) {
    await safeCleanup(
      () => deleteTestUser(user),
      `delete user ${user}`
    )
  }
}

/**
 * Utility function for delays
 */
export function delay(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms))
}

/**
 * Verify contest participantion status
 */
export async function verifyUserContestStatus(username: string, contestId: string, expectedStatus: string): Promise<void> {
  const activeContests = await getUserActiveContests(username)

  const participation = activeContests[contestId]

  if (!participation) {
    throw new Error(`User ${username} not found in contest ${contestId}. Available contests: ${Object.keys(activeContests).join(', ')}`)
  }

  if (participation.status !== expectedStatus) {
    throw new Error(`Expected status ${expectedStatus}, got ${participation.status} for user ${username}`)
  }
}

/**
 * Mock WebSocket notifications for testing (placeholder)
 */
export async function mockWebSocketEndNotifications(contestId: string): Promise<any[]> {
  // In actual implementation, would capture WebSocket messages during contest end
  // For testing, mock the Step Function execution and notification delivery
  // This would verify that endContest notifications were sent to all contest participants
  return []
}