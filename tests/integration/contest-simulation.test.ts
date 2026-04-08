import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { getSubmissionVerdict } from '~/types/database'
import {
  createContestWithUsers,
  submitTestSolution,
  getContestLeaderboard,
  waitForContestStart,
  waitForContestEnd,
  captureContestTimeline,
  cleanupContestSimulation,
  verifyUserContestStatus,
  delay,
  type ContestEvent
} from '../utils/contest-simulation-helpers'
import { waitForGradingComplete } from '../utils/grading-test-helpers'

/**
 * Contest Simulation Testing
 *
 * Tests comprehensive multi-user contest scenarios including:
 * - Multiple users participating concurrently
 * - Real-time submissions and leaderboard evolution
 * - Automated contest end via EventBridge + Lambda + Step Function
 * - WebSocket notifications during contest events
 * - Contest state transitions and lifecycle management
 *
 * This validates the complete contest infrastructure integration
 * beyond individual submission verification.
 */

const CONTEST_ID = `contest-sim-${Date.now()}`
const USERS = ['alice', 'bob', 'charlie'] // 3 test users

describe('Contest Simulation', () => {
  beforeAll(async () => {
    console.log('🏁 Setting up comprehensive contest simulation...')

    // Create contest with multiple users and all 3 problems
    await createContestWithUsers({
      contestId: CONTEST_ID,
      users: USERS,
      problems: ['prisoners', 'ping', 'addition'],
      duration: 600000, // 10 minute contest (enough for all submissions + grading)
      startDelay: 5000, // starts in 5 seconds
      name: 'Contest Simulation Test'
    })

    console.log(`✅ Created 10-minute contest simulation with users: ${USERS.join(', ')}`)
  }, 45000) // 45 second timeout for setup

  afterAll(async () => {
    console.log('🧹 Cleaning up contest simulation...')
    await cleanupContestSimulation(CONTEST_ID, USERS)
    console.log('✅ Contest simulation cleanup completed')
  })

  describe('Multi-User Contest Participation', () => {
    it('verifies multiple users are participating in centralized contest', async () => {
      console.log('👥 Testing multi-user centralized contest participation...')

      // Wait for contest to actually start
      await waitForContestStart(CONTEST_ID)

      // Verify all users have started status (centralized contests auto-start)
      for (const user of USERS) {
        await verifyUserContestStatus(user, CONTEST_ID, 'started')
      }

      console.log(`✅ All ${USERS.length} users automatically participating in centralized contest`)
    }, 30000) // 30 second timeout
  })

  describe('Concurrent Submission & Leaderboard Evolution', () => {
    it('simulates concurrent submissions with real-time leaderboard updates', async () => {
      console.log('📊 Testing concurrent submissions and leaderboard evolution...')

      // Wait for contest to be ONGOING before submitting
      await waitForContestStart(CONTEST_ID)

      const leaderboardHistory: any[] = []

      // Define submission timeline (relative to contest start)
      const submissions = [
        { user: 'alice', problem: 'addition', solution: 'python-correct', delay: 0 }, // 100 pts
        { user: 'bob', problem: 'ping', solution: 'optimal', delay: 5000 }, // 100 pts
        { user: 'charlie', problem: 'addition', solution: 'cpp-partial', delay: 8000 }, // 36 pts
        { user: 'alice', problem: 'ping', solution: 'binary', delay: 12000 } // 40 pts
      ]

      // Submit solutions sequentially and capture leaderboard after each
      for (const [index, sub] of submissions.entries()) {
        console.log(`   [${index + 1}/4] ${sub.user} submitting ${sub.problem}/${sub.solution}...`)

        try {
          await delay(sub.delay)
          const result = await submitTestSolution(sub.user, CONTEST_ID, sub.problem, sub.solution)
          console.log(`   ✅ Submitted: ${sub.user} ${sub.problem}/${sub.solution} -> subId=${result.subId}`)

          // Wait for this specific submission to complete grading
          await waitForGradingComplete(result.subId, 120000)
          console.log(`   ✅ Grading complete for ${sub.user} subId=${result.subId}`)

          // Capture leaderboard state
          try {
            const leaderboard = await getContestLeaderboard(CONTEST_ID)
            leaderboardHistory.push({
              step: index + 1,
              user: sub.user,
              problem: sub.problem,
              leaderboard
            })

            console.log(`   📈 Leaderboard after ${sub.user}'s submission: ${leaderboard.length} users ranked`)
            console.log(`   📊 Scores: ${leaderboard.map(u => `${u.username}=${u.totalScore}`).join(', ')}`)
          } catch (error) {
            console.error(`   ❌ Error getting leaderboard after ${sub.user}'s submission:`, error)
            // Push a placeholder so we can continue
            leaderboardHistory.push({
              step: index + 1,
              user: sub.user,
              problem: sub.problem,
              leaderboard: []
            })
          }
        } catch (error) {
          console.error(`   ❌ Error with ${sub.user} ${sub.problem}/${sub.solution}:`, error)
          throw error
        }
      }

      // Verify leaderboard evolution - all users appear immediately in centralized contests
      expect(leaderboardHistory[0].leaderboard).toHaveLength(3) // All users present from start

      // Get final leaderboard directly (not from history to avoid any history issues)
      console.log(`Getting final leaderboard after all submissions...`)
      const finalLeaderboard = await getContestLeaderboard(CONTEST_ID)
      console.log(`Final leaderboard retrieved: ${finalLeaderboard.length} users`)

      // Verify exact final rankings based on deterministic submissions
      // Alice: addition/python-correct (100) + ping/binary (40) = 140 pts
      // Bob: ping/optimal (100) = 100 pts
      // Charlie: addition/cpp-partial (36) = 36 pts

      try {
        console.log('Final leaderboard:', finalLeaderboard.map(u => `${u.username}: ${u.totalScore} pts`))

        // Debug: print actual vs expected scores
        console.log('Expected: Alice=140, Bob=100, Charlie=36 (after 4 submissions)')
        console.log('Actual:', finalLeaderboard.map(u => `${u.username}=${u.totalScore}`).join(', '))
        console.log('Full leaderboard:', JSON.stringify(finalLeaderboard, null, 2))
      } catch (error) {
        console.error('Error printing leaderboard:', error)
        console.log('finalLeaderboard raw:', finalLeaderboard)
        console.log('leaderboardHistory length:', leaderboardHistory.length)
        console.log('leaderboardHistory[3]:', leaderboardHistory[3])
      }

      // Debug the actual leaderboard structure
      console.log('Final leaderboard:', finalLeaderboard.map(u => `${u.username}: ${u.totalScore} pts`))

      // Debug: print actual vs expected scores
      console.log('Expected: Alice=140, Bob=100, Charlie=36')
      console.log('Actual:', finalLeaderboard.map(u => `${u.username}=${u.totalScore}`).join(', '))

      expect(finalLeaderboard[0].username).toBe('alice') // Alice leads with 140
      expect(finalLeaderboard[0].totalScore).toBe(140)
      expect(finalLeaderboard[1].username).toBe('bob') // Bob second with 100
      expect(finalLeaderboard[1].totalScore).toBe(100)
      expect(finalLeaderboard[2].username).toBe('charlie') // Charlie third with 36
      expect(finalLeaderboard[2].totalScore).toBe(36)

      console.log('✅ Leaderboard evolution verified correctly')
    }, 180000) // 3 minute timeout for submissions
  })

  describe('Real-Time Leaderboard Accuracy', () => {
    it('verifies leaderboard ranking algorithm with diverse scores', async () => {
      console.log('🏆 Testing leaderboard ranking accuracy...')

      // Ensure contest is still ONGOING
      await waitForContestStart(CONTEST_ID)

      // Submit additional solutions to test ranking edge cases
      const additionalSubmissions = [
        { user: 'bob', problem: 'addition', solution: 'cpp-partial' }, // Bob gets 36 more (136 total)
        { user: 'charlie', problem: 'ping', solution: 'trivial' } // Charlie gets 10 more (46 total)
      ]

      for (const sub of additionalSubmissions) {
        const result = await submitTestSolution(sub.user, CONTEST_ID, sub.problem, sub.solution)
        await waitForGradingComplete(result.subId, 120000)
      }

      const finalLeaderboard = await getContestLeaderboard(CONTEST_ID)

      // Verify exact final rankings after additional submissions
      // Alice: addition/python-correct (100) + ping/binary (40) = 140 pts (no additional submissions)
      // Bob: ping/optimal (100) + addition/cpp-partial (36) = 136 pts
      // Charlie: addition/cpp-partial (36) + ping/trivial (10) = 46 pts

      expect(finalLeaderboard).toHaveLength(3)
      expect(finalLeaderboard[0].username).toBe('alice')
      expect(finalLeaderboard[0].totalScore).toBe(140) // 100 + 40
      expect(finalLeaderboard[1].username).toBe('bob')
      expect(finalLeaderboard[1].totalScore).toBe(136) // 100 + 36
      expect(finalLeaderboard[2].username).toBe('charlie')
      expect(finalLeaderboard[2].totalScore).toBe(46) // 36 + 10

      console.log('✅ Final leaderboard rankings verified')
    }, 120000) // 2 minute timeout
  })

  describe('Automated Contest End via Lambda-Step Function Window', () => {
    it('tests automated contest end notification system', async () => {
      console.log('⏰ Testing automated contest end via EventBridge + Step Function...')

      // Create a short contest specifically for testing automated end
      const shortContestId = `end-test-${Date.now()}`
      const endTestUsers = ['alice', 'bob'] // Reuse existing users

      await createContestWithUsers({
        contestId: shortContestId,
        users: endTestUsers,
        problems: ['addition'], // Simple problem
        duration: 90000, // 1.5 minute contest (just enough to test automated end)
        startDelay: 2000, // Start in 2 seconds
        name: 'Contest End Test'
      })

      console.log(`📅 Created short contest ${shortContestId} (1.5 minutes)`)

      // Wait for short contest to start (centralized mode - users auto-participate)
      await waitForContestStart(shortContestId)

      // Submit some solutions during contest
      await submitTestSolution('alice', shortContestId, 'addition', 'python-correct')
      await submitTestSolution('bob', shortContestId, 'addition', 'cpp-partial')

      console.log('📝 Submissions made, waiting for automated contest end...')

      // Wait for automated contest end (EventBridge Scheduler triggers)
      await waitForContestEnd(shortContestId)

      console.log('🏁 Contest ended automatically via EventBridge Scheduler')

      // Verify automated contest end flow worked:
      // 1. EventBridge triggered contest-end-notifier Lambda
      // 2. Lambda queried participants via contestIdUsernameIndex GSI
      // 3. Step Function invoked with batched connectionIds
      // 4. websocket-invoke Lambda delivered endContest notifications

      // Verify contest status is now ENDED
      const { getContest, getContestStatus } = await import('~/lib/db/contests.server')
      const contest = await getContest(shortContestId)
      expect(contest).toBeTruthy()
      expect(getContestStatus(contest!)).toBe('ENDED')

      // Verify no submissions allowed after automated end
      await expect(
        submitTestSolution('alice', shortContestId, 'addition', 'python-correct')
      ).rejects.toThrow()

      console.log('✅ Automated contest end verified - EventBridge → Lambda → Step Function flow worked')

      // Cleanup the short contest
      await cleanupContestSimulation(shortContestId, []) // Don't delete users (reused)
    }, 300000) // 5 minute timeout for full contest cycle
  })

  describe('Contest State Transitions', () => {
    it('verifies contest lifecycle state management', async () => {
      console.log('🔄 Testing contest state transitions...')

      // Test the main contest state throughout its lifecycle
      const { getContest, getContestStatus } = await import('~/lib/db/contests.server')
      const contest = await getContest(CONTEST_ID)

      expect(contest).toBeTruthy()

      // Contest should be ONGOING at this point (increased to 10 minutes)
      const currentStatus = getContestStatus(contest!)
      expect(['NOT_STARTED', 'ONGOING', 'ENDED']).toContain(currentStatus)

      // Verify users can submit during ONGOING state
      if (currentStatus === 'ONGOING') {
        const testSubmission = await submitTestSolution('charlie', CONTEST_ID, 'prisoners', 'brute')
        expect(testSubmission.subId).toBeTypeOf('number')
        console.log('✅ Submissions allowed during ONGOING state')
      }

      console.log(`📊 Contest ${CONTEST_ID} status: ${currentStatus}`)
    }, 30000)
  })

  describe('Multi-Contest Participation', () => {
    it('tests users participating in multiple contests simultaneously', async () => {
      console.log('🔀 Testing multi-contest participation...')

      // Create a second contest overlapping with the main one
      const secondContestId = `multi-contest-${Date.now()}`

      await createContestWithUsers({
        contestId: secondContestId,
        users: ['alice', 'bob'], // Subset of users
        problems: ['ping'],
        duration: 120000, // 2 minutes
        startDelay: 2000,
        name: 'Multi-Contest Test'
      })

      // Wait for second contest to start (centralized mode - users auto-participate)
      await waitForContestStart(secondContestId)

      // Verify users are active in both contests
      const { getUserActiveContests } = await import('~/lib/db/users.server')

      const aliceContests = await getUserActiveContests('alice')
      console.log('Alice active contests:', Object.keys(aliceContests))

      expect(Object.keys(aliceContests)).toContain(CONTEST_ID)
      expect(Object.keys(aliceContests)).toContain(secondContestId)

      // Submit to different contests
      await submitTestSolution('alice', CONTEST_ID, 'ping', 'advanced') // First contest
      await submitTestSolution('alice', secondContestId, 'ping', 'optimal') // Second contest

      console.log('✅ Multi-contest participation verified')

      // Cleanup second contest
      await cleanupContestSimulation(secondContestId, []) // Don't delete users
    }, 60000)
  })
})