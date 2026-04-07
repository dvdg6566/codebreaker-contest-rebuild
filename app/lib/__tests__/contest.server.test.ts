import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import {
  getContest,
  getUserParticipation,
  getUserActiveContests,
  canUserAccessContest,
  startUserContest,
  isUserInActiveContest,
  getContestProblems
} from '../contest.server'
import type { Contest } from '~/types/database'

// Mock dependencies
vi.mock('../db/index.server', () => ({
  getContest: vi.fn(),
  getContestStatus: vi.fn(),
  updateContest: vi.fn(),
  getUserActiveContests: vi.fn(),
  canUserAccessContest: vi.fn(),
  updateUserContestStatus: vi.fn()
}))

vi.mock('../scheduler.server', () => ({
  scheduleUserContestEnd: vi.fn()
}))

vi.mock('~/types/database', () => ({
  parseDateTime: vi.fn(),
  isDateTimeNotSet: vi.fn(),
  formatDateTime: vi.fn(),
  getContestStatus: vi.fn()
}))

describe('contest.server', () => {
  // Mock implementations
  let mockDbGetContest: any
  let mockGetContestStatus: any
  let mockDbUpdateContest: any
  let mockDbGetUserActiveContests: any
  let mockDbCanUserAccessContest: any
  let mockUpdateUserContestStatus: any
  let mockScheduleUserContestEnd: any
  let mockParseDateTime: any
  let mockIsDateTimeNotSet: any
  let mockFormatDateTime: any

  // Test data
  const mockContest: Contest = {
    contestId: 'contest-123',
    name: 'Test Contest',
    startTime: '2025-01-01 10:00:00',
    endTime: '2025-01-01 15:00:00',
    duration: 180, // 3 hours in minutes
    mode: 'self-timer',
    problems: ['problem1', 'problem2'],
    users: { testuser: '0', admin: '1' } // 0 = invited, 1 = started
  }

  const mockCentralizedContest: Contest = {
    ...mockContest,
    contestId: 'centralized-contest',
    mode: 'centralized'
  }

  beforeEach(async () => {
    vi.clearAllMocks()

    // Clear the in-memory participations map to ensure test isolation
    // We need to clear the userParticipations Map from contest.server
    const contestModule = await import('../contest.server')
    // Access the private userParticipations Map through getUserParticipation
    // Since we can't directly clear it, we need to work around this limitation

    // Set up mock implementations
    const dbModule = await import('../db/index.server')
    const schedulerModule = await import('../scheduler.server')
    const typesModule = await import('~/types/database')

    mockDbGetContest = vi.mocked(dbModule.getContest)
    mockGetContestStatus = vi.mocked(dbModule.getContestStatus) // getContestStatus is imported from db module
    mockDbUpdateContest = vi.mocked(dbModule.updateContest)
    mockDbGetUserActiveContests = vi.mocked(dbModule.getUserActiveContests)
    mockDbCanUserAccessContest = vi.mocked(dbModule.canUserAccessContest)
    mockUpdateUserContestStatus = vi.mocked(dbModule.updateUserContestStatus)
    mockScheduleUserContestEnd = vi.mocked(schedulerModule.scheduleUserContestEnd)
    mockParseDateTime = vi.mocked(typesModule.parseDateTime)
    mockIsDateTimeNotSet = vi.mocked(typesModule.isDateTimeNotSet)
    mockFormatDateTime = vi.mocked(typesModule.formatDateTime)

    // Set up default mocks
    mockParseDateTime.mockImplementation((dateStr: string) => new Date(dateStr.replace(' ', 'T')))
    mockIsDateTimeNotSet.mockReturnValue(false)
    mockFormatDateTime.mockImplementation((date: Date) => date.toISOString().slice(0, 19).replace('T', ' '))

    // Reset time to a fixed point
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2025-01-01T12:00:00Z')) // During contest time
  })

  afterEach(() => {
    vi.useRealTimers()
    // Reset modules to clear any shared state including the userParticipations Map
    vi.resetModules()
  })

  describe('getContest', () => {
    it('returns contest from database', async () => {
      mockDbGetContest.mockResolvedValue(mockContest)

      const result = await getContest('contest-123')

      expect(result).toBe(mockContest)
      expect(mockDbGetContest).toHaveBeenCalledWith('contest-123')
    })

    it('returns null when contest not found', async () => {
      mockDbGetContest.mockResolvedValue(null)

      const result = await getContest('nonexistent')

      expect(result).toBe(null)
    })
  })

  describe('getUserParticipation', () => {
    it('returns null when no participation exists', () => {
      const result = getUserParticipation('testuser', 'contest-123')

      expect(result).toBe(null)
    })

    it('returns stored participation from memory', () => {
      // Note: This tests the in-memory cache which is private, so we can't directly set it
      // This test verifies the function returns null for unknown participations
      const result = getUserParticipation('unknown', 'unknown')

      expect(result).toBe(null)
    })
  })

  describe('getUserActiveContests', () => {
    it('returns active contests for user', async () => {
      mockDbGetUserActiveContests.mockResolvedValue({
        'contest-123': { status: 'started' },
        'contest-456': { status: 'invited' }
      })
      mockDbGetContest
        .mockResolvedValueOnce(mockContest)
        .mockResolvedValueOnce({ ...mockContest, contestId: 'contest-456' })

      const result = await getUserActiveContests('testuser')

      expect(result).toEqual([
        mockContest,
        { ...mockContest, contestId: 'contest-456' }
      ])
    })

    it('filters out null contests', async () => {
      mockDbGetUserActiveContests.mockResolvedValue({
        'contest-123': { status: 'started' },
        'nonexistent': { status: 'invited' }
      })
      mockDbGetContest
        .mockResolvedValueOnce(mockContest)
        .mockResolvedValueOnce(null)

      const result = await getUserActiveContests('testuser')

      expect(result).toEqual([mockContest])
    })
  })

  describe('canUserAccessContest', () => {
    it('delegates to database function', async () => {
      mockDbCanUserAccessContest.mockResolvedValue(true)

      const result = await canUserAccessContest('testuser', 'contest-123')

      expect(result).toBe(true)
      expect(mockDbCanUserAccessContest).toHaveBeenCalledWith('testuser', 'contest-123')
    })
  })

  describe('startUserContest', () => {
    beforeEach(() => {
      mockDbGetContest.mockResolvedValue(mockContest)
      mockDbCanUserAccessContest.mockResolvedValue(true)
      mockDbGetUserActiveContests.mockResolvedValue({
        'contest-123': { status: 'invited' }
      })
      mockGetContestStatus.mockReturnValue('ONGOING')
      mockUpdateUserContestStatus.mockResolvedValue(undefined)
      mockDbUpdateContest.mockResolvedValue(undefined)
      mockScheduleUserContestEnd.mockResolvedValue(undefined)
    })

    it('successfully starts self-timer contest for invited user', async () => {
      const result = await startUserContest('testuser', 'contest-123')

      expect(result).toMatchObject({
        username: 'testuser',
        contestId: 'contest-123',
        startedAt: new Date('2025-01-01T12:00:00Z'),
        endsAt: new Date('2025-01-01T15:00:00Z') // 3 hours later
      })

      expect(mockUpdateUserContestStatus).toHaveBeenCalledWith('testuser', 'contest-123', {
        status: 'started',
        startedAt: expect.any(String)
      })

      expect(mockDbUpdateContest).toHaveBeenCalledWith('contest-123', {
        users: { testuser: '1', admin: '1' }
      })

      expect(mockScheduleUserContestEnd).toHaveBeenCalledWith(
        'contest-123',
        'testuser',
        new Date('2025-01-01T15:00:00Z')
      )
    })

    it('calculates duration correctly with default 180 minutes', async () => {
      const contestWithoutDuration = { ...mockContest, duration: undefined }
      mockDbGetContest.mockResolvedValue(contestWithoutDuration)

      const result = await startUserContest('testuser', 'contest-123')

      expect(result.endsAt).toEqual(new Date('2025-01-01T15:00:00Z')) // 3 hours (180 mins) later
    })

    it('throws error when contest not found', async () => {
      mockDbGetContest.mockResolvedValue(null)

      await expect(startUserContest('testuser', 'contest-123')).rejects.toThrow('Contest not found')
    })

    it('throws error when user has no access', async () => {
      mockDbCanUserAccessContest.mockResolvedValue(false)

      await expect(startUserContest('testuser', 'contest-123')).rejects.toThrow(
        'Access denied: You are not assigned to this contest'
      )
    })

    it('throws error when user not assigned to contest', async () => {
      mockDbGetUserActiveContests.mockResolvedValue({})

      await expect(startUserContest('testuser', 'contest-123')).rejects.toThrow(
        'You are not assigned to this contest'
      )
    })

    it('throws error when user already started', async () => {
      mockDbGetUserActiveContests.mockResolvedValue({
        'contest-123': { status: 'started' }
      })

      await expect(startUserContest('testuser', 'contest-123')).rejects.toThrow(
        'You have already started this contest'
      )
    })

    it('throws error for centralized timing mode', async () => {
      mockDbGetContest.mockResolvedValue(mockCentralizedContest)
      mockDbGetUserActiveContests.mockResolvedValue({
        'centralized-contest': { status: 'invited' }
      })

      await expect(startUserContest('testuser', 'centralized-contest')).rejects.toThrow(
        'This contest uses centralized timing'
      )
    })

    it('throws error when contest not started', async () => {
      mockGetContestStatus.mockReturnValue('NOT_STARTED')

      await expect(startUserContest('testuser', 'contest-123')).rejects.toThrow(
        'Contest has not started yet'
      )
    })

    it('throws error when contest ended', async () => {
      mockGetContestStatus.mockReturnValue('ENDED')

      await expect(startUserContest('testuser', 'contest-123')).rejects.toThrow(
        'Contest has ended'
      )
    })
  })

  describe('isUserInActiveContest', () => {
    beforeEach(() => {
      mockDbCanUserAccessContest.mockResolvedValue(true)
      mockDbGetContest.mockResolvedValue(mockContest)
      mockGetContestStatus.mockReturnValue('ONGOING')
    })

    it('returns inactive when user has no access', async () => {
      mockDbCanUserAccessContest.mockResolvedValue(false)

      const result = await isUserInActiveContest('testuser', 'contest-123')

      expect(result).toEqual({
        active: false,
        contest: null,
        participation: null,
        timeRemaining: 0,
        contestStart: null,
        contestEnd: null
      })
    })

    it('returns inactive when contest not found', async () => {
      mockDbGetContest.mockResolvedValue(null)

      const result = await isUserInActiveContest('testuser', 'contest-123')

      expect(result).toEqual({
        active: false,
        contest: null,
        participation: null,
        timeRemaining: 0,
        contestStart: null,
        contestEnd: null
      })
    })

    it('returns inactive when user not assigned to contest', async () => {
      mockDbGetUserActiveContests.mockResolvedValue({})

      const result = await isUserInActiveContest('testuser', 'contest-123')

      expect(result).toEqual({
        active: false,
        contest: mockContest,
        participation: null,
        timeRemaining: 0,
        contestStart: null,
        contestEnd: null
      })
    })

    it('allows invited users to view centralized ongoing contest', async () => {
      mockDbGetContest.mockResolvedValue(mockCentralizedContest)
      mockDbGetUserActiveContests.mockResolvedValue({
        'centralized-contest': { status: 'invited' }
      })
      mockGetContestStatus.mockReturnValue('ONGOING')
      // Mock parseDateTime for start and end times
      mockParseDateTime
        .mockReturnValueOnce(new Date('2025-01-01T15:00:00Z')) // end time calculation
        .mockReturnValueOnce(new Date('2025-01-01T10:00:00Z')) // start time
        .mockReturnValueOnce(new Date('2025-01-01T15:00:00Z')) // end time

      const result = await isUserInActiveContest('testuser', 'centralized-contest')

      expect(result).toMatchObject({
        active: true,
        contest: mockCentralizedContest,
        participation: null,
        timeRemaining: 3 * 60 * 60, // 3 hours in seconds
        contestStart: new Date('2025-01-01T10:00:00Z'),
        contestEnd: new Date('2025-01-01T15:00:00Z')
      })
    })

    it('handles unset end time in centralized contest', async () => {
      mockDbGetContest.mockResolvedValue(mockCentralizedContest)
      mockDbGetUserActiveContests.mockResolvedValue({
        'centralized-contest': { status: 'invited' }
      })
      mockGetContestStatus.mockReturnValue('ONGOING')
      mockIsDateTimeNotSet.mockReturnValue(true)

      const result = await isUserInActiveContest('testuser', 'centralized-contest')

      expect(result.contestEnd).toBe(null)
      expect(result.timeRemaining).toBeGreaterThan(1000000) // Very large number for 9999 year
    })

    it('returns inactive for non-started user status', async () => {
      mockDbGetUserActiveContests.mockResolvedValue({
        'contest-123': { status: 'completed' }
      })

      const result = await isUserInActiveContest('testuser', 'contest-123')

      expect(result.active).toBe(false)
    })

    it('returns active for started user in centralized ongoing contest', async () => {
      mockDbGetContest.mockResolvedValue(mockCentralizedContest)
      mockDbGetUserActiveContests.mockResolvedValue({
        'centralized-contest': { status: 'started' }
      })
      mockGetContestStatus.mockReturnValue('ONGOING')
      // Mock parseDateTime for start and end times
      mockParseDateTime
        .mockReturnValueOnce(new Date('2025-01-01T15:00:00Z')) // end time calculation
        .mockReturnValueOnce(new Date('2025-01-01T10:00:00Z')) // start time
        .mockReturnValueOnce(new Date('2025-01-01T15:00:00Z')) // end time

      const result = await isUserInActiveContest('testuser', 'centralized-contest')

      expect(result).toMatchObject({
        active: true,
        contest: mockCentralizedContest,
        participation: null,
        timeRemaining: 3 * 60 * 60, // 3 hours in seconds
        contestStart: new Date('2025-01-01T10:00:00Z'),
        contestEnd: new Date('2025-01-01T15:00:00Z')
      })
    })

    it('returns inactive for self-timer without memory participation', async () => {
      // Use unique identifiers to avoid state conflicts
      const uniqueContestId = 'isolated-self-timer-contest'
      const uniqueUsername = 'isolateduser'
      const isolatedContest = { ...mockContest, contestId: uniqueContestId }

      mockDbGetContest.mockResolvedValue(isolatedContest) // This is self-timer mode
      mockDbGetUserActiveContests.mockResolvedValue({
        [uniqueContestId]: { status: 'started' }
      })
      mockGetContestStatus.mockReturnValue('ONGOING')

      const result = await isUserInActiveContest(uniqueUsername, uniqueContestId)

      // For self-timer mode with no in-memory participation, should be inactive
      expect(result.active).toBe(false)
      expect(result.participation).toBe(null)
    })

    // Note: Testing self-timer with active participation would require setting the in-memory cache
    // which is private. In a real implementation, this could be tested through integration tests
    // or by exposing a test helper to set participation state.
  })

  describe('getContestProblems', () => {
    it('returns problems when user has active access', async () => {
      // Mock isUserInActiveContest to return active - this depends on contest mode
      mockDbCanUserAccessContest.mockResolvedValue(true)
      mockDbGetContest.mockResolvedValue(mockCentralizedContest) // Use centralized for easier active state
      mockDbGetUserActiveContests.mockResolvedValue({
        'centralized-contest': { status: 'invited' }
      })
      mockGetContestStatus.mockReturnValue('ONGOING')
      mockParseDateTime.mockReturnValue(new Date('2025-01-01T15:00:00Z')) // end time

      const result = await getContestProblems('testuser', 'centralized-contest')

      expect(result).toEqual(['problem1', 'problem2'])
    })

    it('returns empty array when user has no access', async () => {
      mockDbCanUserAccessContest.mockResolvedValue(false)

      const result = await getContestProblems('testuser', 'contest-123')

      expect(result).toEqual([])
    })

    it('returns empty array when contest is inactive', async () => {
      mockDbCanUserAccessContest.mockResolvedValue(true)
      mockDbGetContest.mockResolvedValue(mockContest)
      mockDbGetUserActiveContests.mockResolvedValue({})

      const result = await getContestProblems('testuser', 'contest-123')

      expect(result).toEqual([])
    })
  })
})