import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import {
  createTestUser,
  deleteTestUser,
  createTestContest,
  deleteTestContest,
  safeCleanup
} from '../utils/grading-test-helpers'
import { getUser } from '~/lib/db/users.server'
import { getContest } from '~/lib/db/contests.server'

/**
 * Database Connectivity Test
 *
 * Validates that we can create and delete test users and contests
 * before running the full grading verification test.
 */

const TEST_USER = `db-test-user-${Date.now()}`
const TEST_CONTEST_ID = `db-test-contest-${Date.now()}`

describe('Database Connectivity', () => {
  afterAll(async () => {
    // Cleanup any remaining test data
    await safeCleanup(
      () => deleteTestContest(TEST_CONTEST_ID),
      `delete test contest ${TEST_CONTEST_ID}`
    )

    await safeCleanup(
      () => deleteTestUser(TEST_USER),
      `delete test user ${TEST_USER}`
    )
  })

  it('can create and delete a test user', async () => {
    // Create test user
    await createTestUser(TEST_USER, 'member')

    // Verify user exists
    const user = await getUser(TEST_USER)
    expect(user).toBeDefined()
    expect(user!.username).toBe(TEST_USER)
    expect(user!.role).toBe('member')
    expect(user!.fullname).toBe(`Test User ${TEST_USER}`)

    // Delete test user
    await deleteTestUser(TEST_USER)

    // Verify user is deleted
    const deletedUser = await getUser(TEST_USER)
    expect(deletedUser).toBeNull()
  }, 15000)

  it('can create and delete a test contest', async () => {
    // Create test contest
    await createTestContest({
      contestId: TEST_CONTEST_ID,
      name: 'Database Test Contest',
      problems: ['prisoners'],
      startTime: new Date(Date.now() - 1000),
      endTime: new Date(Date.now() + 3600000),
      users: { 'testuser': '1' }
    })

    // Verify contest exists
    const contest = await getContest(TEST_CONTEST_ID)
    expect(contest).toBeDefined()
    expect(contest!.contestId).toBe(TEST_CONTEST_ID)
    expect(contest!.name).toBe('Database Test Contest')
    expect(contest!.problems).toContain('prisoners')

    // Delete test contest
    await deleteTestContest(TEST_CONTEST_ID)

    // Verify contest is deleted
    const deletedContest = await getContest(TEST_CONTEST_ID)
    expect(deletedContest).toBeNull()
  }, 15000)
})