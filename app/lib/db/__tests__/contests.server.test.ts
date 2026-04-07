import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import {
  getContestStatus,
  listContests,
  listContestsWithStatus,
  getContest,
  getContestWithStatus,
  createContest,
  updateContest,
  deleteContest
} from '../contests.server'
import type { Contest } from '~/types/database'

// Mock dependencies
vi.mock('../dynamodb-client.server', () => ({
  docClient: {
    send: vi.fn()
  },
  TableNames: {
    contests: 'test-contests'
  },
  GetCommand: class MockGetCommand { constructor(input: any) { Object.assign(this, input) } },
  PutCommand: class MockPutCommand { constructor(input: any) { Object.assign(this, input) } },
  UpdateCommand: class MockUpdateCommand { constructor(input: any) { Object.assign(this, input) } },
  DeleteCommand: class MockDeleteCommand { constructor(input: any) { Object.assign(this, input) } },
  ScanCommand: class MockScanCommand { constructor(input: any) { Object.assign(this, input) } }
}))

vi.mock('../../scheduler.server', () => ({
  scheduleContestEnd: vi.fn(),
  cancelContestEndSchedule: vi.fn()
}))

vi.mock('~/types/database', async (importOriginal) => {
  const actual = await importOriginal<typeof import('~/types/database')>()
  return {
    ...actual,
    DEFAULT_CONTEST: {
      contestId: '',
      name: 'Default Contest',
      startTime: '2025-01-01 10:00:00',
      endTime: '2025-01-01 15:00:00',
      duration: 180,
      mode: 'centralized',
      problems: [],
      users: {},
      scores: {}
    },
    parseDateTime: vi.fn(),
    isDateTimeNotSet: vi.fn()
  }
})

describe('contests.server', () => {
  // Mock implementations
  let mockDocClient: any
  let mockParseDateTime: any
  let mockIsDateTimeNotSet: any
  let mockScheduleContestEnd: any
  let mockCancelContestEndSchedule: any

  const mockContest: Contest = {
    contestId: 'test-contest',
    name: 'Test Contest',
    startTime: '2025-01-01 10:00:00',
    endTime: '2025-01-01 15:00:00',
    duration: 180,
    mode: 'centralized',
    problems: ['problem1', 'problem2'],
    users: { alice: '0', bob: '1' },
    scores: {}
  }

  beforeEach(async () => {
    vi.clearAllMocks()

    // Set up mock implementations
    const dynamoModule = await import('../dynamodb-client.server')
    const schedulerModule = await import('../../scheduler.server')
    const typesModule = await import('~/types/database')

    mockDocClient = vi.mocked(dynamoModule.docClient)
    mockParseDateTime = vi.mocked(typesModule.parseDateTime)
    mockIsDateTimeNotSet = vi.mocked(typesModule.isDateTimeNotSet)
    mockScheduleContestEnd = vi.mocked(schedulerModule.scheduleContestEnd)
    mockCancelContestEndSchedule = vi.mocked(schedulerModule.cancelContestEndSchedule)

    // Default implementations - mimic the real function behavior
    mockParseDateTime.mockImplementation((dateStr: string) => {
      if (dateStr.startsWith('9999')) {
        return new Date('9999-12-31T23:59:59Z')
      }
      const isoStr = dateStr.replace(' ', 'T') + 'Z'
      return new Date(isoStr)
    })
    mockIsDateTimeNotSet.mockImplementation((dateStr: string) => dateStr.startsWith('9999'))

    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
    vi.resetModules()
  })

  describe('getContestStatus', () => {
    it('returns NOT_STARTED when current time is before start time', () => {
      vi.setSystemTime(new Date('2025-01-01T09:00:00Z')) // Before start

      const result = getContestStatus(mockContest)

      expect(result).toBe('NOT_STARTED')
      expect(mockParseDateTime).toHaveBeenCalledWith('2025-01-01 10:00:00')
      expect(mockParseDateTime).toHaveBeenCalledWith('2025-01-01 15:00:00')
    })

    it('returns ONGOING when current time is between start and end', () => {
      vi.setSystemTime(new Date('2025-01-01T12:00:00Z')) // During contest

      const result = getContestStatus(mockContest)

      expect(result).toBe('ONGOING')
    })

    it('returns ENDED when current time is after end time', () => {
      vi.setSystemTime(new Date('2025-01-01T16:00:00Z')) // After end
      mockIsDateTimeNotSet.mockReturnValue(false)

      const result = getContestStatus(mockContest)

      expect(result).toBe('ENDED')
      expect(mockIsDateTimeNotSet).toHaveBeenCalledWith('2025-01-01 15:00:00')
    })

    it('returns ONGOING when end time is not set', () => {
      vi.setSystemTime(new Date('2025-01-01T16:00:00Z')) // After normal end time
      mockIsDateTimeNotSet.mockReturnValue(true) // But end time is unset

      const result = getContestStatus(mockContest)

      expect(result).toBe('ONGOING')
    })

    it('handles exact boundary times correctly', () => {
      // Exactly at start time
      vi.setSystemTime(new Date('2025-01-01T10:00:00Z'))
      expect(getContestStatus(mockContest)).toBe('ONGOING')

      // Exactly at end time
      vi.setSystemTime(new Date('2025-01-01T15:00:00Z'))
      mockIsDateTimeNotSet.mockReturnValue(false)
      expect(getContestStatus(mockContest)).toBe('ENDED')
    })
  })

  describe('listContests', () => {
    it('returns all contests from database', async () => {
      const mockContests = [mockContest, { ...mockContest, contestId: 'contest-2' }]
      mockDocClient.send.mockResolvedValue({ Items: mockContests })

      const result = await listContests()

      expect(result).toEqual(mockContests)
      expect(mockDocClient.send).toHaveBeenCalledWith(
        expect.objectContaining({
          TableName: 'test-contests'
        })
      )
    })

    it('returns empty array when no contests exist', async () => {
      mockDocClient.send.mockResolvedValue({ Items: [] })

      const result = await listContests()

      expect(result).toEqual([])
    })

    it('handles undefined Items in response', async () => {
      mockDocClient.send.mockResolvedValue({})

      const result = await listContests()

      expect(result).toEqual([])
    })
  })

  describe('listContestsWithStatus', () => {
    it('returns contests with computed status', async () => {
      vi.setSystemTime(new Date('2025-01-01T12:00:00Z')) // During contest
      const mockContests = [mockContest, { ...mockContest, contestId: 'contest-2' }]
      mockDocClient.send.mockResolvedValue({ Items: mockContests })

      const result = await listContestsWithStatus()

      expect(result).toEqual([
        { ...mockContest, status: 'ONGOING' },
        { ...mockContest, contestId: 'contest-2', status: 'ONGOING' }
      ])
    })

    it('computes different statuses for different contests', async () => {
      vi.setSystemTime(new Date('2025-01-01T12:00:00Z'))
      const futureContest = {
        ...mockContest,
        contestId: 'future-contest',
        startTime: '2025-01-02 10:00:00'
      }
      const pastContest = {
        ...mockContest,
        contestId: 'past-contest',
        endTime: '2025-01-01 11:00:00'
      }

      mockDocClient.send.mockResolvedValue({
        Items: [mockContest, futureContest, pastContest]
      })

      const result = await listContestsWithStatus()

      expect(result).toEqual([
        { ...mockContest, status: 'ONGOING' },
        { ...futureContest, status: 'NOT_STARTED' },
        { ...pastContest, status: 'ENDED' }
      ])
    })
  })

  describe('getContest', () => {
    it('returns contest when found', async () => {
      mockDocClient.send.mockResolvedValue({ Item: mockContest })

      const result = await getContest('test-contest')

      expect(result).toEqual(mockContest)
      expect(mockDocClient.send).toHaveBeenCalledWith(
        expect.objectContaining({
          TableName: 'test-contests',
          Key: { contestId: 'test-contest' }
        })
      )
    })

    it('returns null when contest not found', async () => {
      mockDocClient.send.mockResolvedValue({})

      const result = await getContest('nonexistent')

      expect(result).toBe(null)
    })
  })

  describe('getContestWithStatus', () => {
    it('returns contest with computed status when found', async () => {
      vi.setSystemTime(new Date('2025-01-01T12:00:00Z'))
      mockDocClient.send.mockResolvedValue({ Item: mockContest })

      const result = await getContestWithStatus('test-contest')

      expect(result).toEqual({
        ...mockContest,
        status: 'ONGOING'
      })
    })

    it('returns null when contest not found', async () => {
      mockDocClient.send.mockResolvedValue({})

      const result = await getContestWithStatus('nonexistent')

      expect(result).toBe(null)
    })
  })

  describe('createContest', () => {
    it('creates contest with default values', async () => {
      const DEFAULT_CONTEST = {
        contestId: '',
        name: 'Default Contest',
        startTime: '2025-01-01 10:00:00',
        endTime: '2025-01-01 15:00:00',
        duration: 180,
        mode: 'centralized',
        problems: [],
        users: {},
        scores: {}
      }

      mockDocClient.send.mockResolvedValue({})

      const result = await createContest('new-contest')

      expect(result).toEqual({
        ...DEFAULT_CONTEST,
        contestId: 'new-contest'
      })
      expect(mockDocClient.send).toHaveBeenCalledWith(
        expect.objectContaining({
          TableName: 'test-contests',
          Item: expect.objectContaining({
            contestId: 'new-contest'
          })
        })
      )
    })

    it('creates contest with provided data', async () => {
      const customData = {
        name: 'Custom Contest',
        duration: 240
      }
      mockDocClient.send.mockResolvedValue({})

      const result = await createContest('custom-contest', customData)

      expect(result.name).toBe('Custom Contest')
      expect(result.duration).toBe(240)
      expect(result.contestId).toBe('custom-contest')
    })

    it('schedules contest end when contest has end time', async () => {
      mockDocClient.send.mockResolvedValue({})
      mockIsDateTimeNotSet.mockReturnValue(false)

      await createContest('timed-contest')

      expect(mockScheduleContestEnd).toHaveBeenCalled()
    })

    it('does not schedule when end time is not set', async () => {
      mockDocClient.send.mockResolvedValue({})
      mockIsDateTimeNotSet.mockReturnValue(true)

      await createContest('untimed-contest')

      expect(mockScheduleContestEnd).not.toHaveBeenCalled()
    })
  })

  describe('error handling', () => {
    it('handles DynamoDB errors in getContest', async () => {
      mockDocClient.send.mockRejectedValue(new Error('DynamoDB error'))

      await expect(getContest('error-contest')).rejects.toThrow('DynamoDB error')
    })

    it('handles DynamoDB errors in listContests', async () => {
      mockDocClient.send.mockRejectedValue(new Error('Scan failed'))

      await expect(listContests()).rejects.toThrow('Scan failed')
    })

    it('handles scheduler errors in createContest', async () => {
      mockDocClient.send.mockResolvedValue({})
      mockIsDateTimeNotSet.mockReturnValue(false)
      mockScheduleContestEnd.mockRejectedValue(new Error('Scheduler unavailable'))

      // Should still create contest even if scheduling fails
      await expect(createContest('schedule-error')).rejects.toThrow('Scheduler unavailable')
      expect(mockDocClient.send).toHaveBeenCalled()
    })
  })
})