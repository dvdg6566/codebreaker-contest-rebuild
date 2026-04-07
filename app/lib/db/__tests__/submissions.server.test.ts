import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import {
  canUserSubmit,
  getBestSubmission,
  getSubmissionsByUserAndProblem,
  getLatestSubmissionTime,
  formatSubmissionForDisplay,
  updateScoresAfterGrading
} from '../submissions.server'
import type { Submission } from '~/types/database'

// Mock dependencies
vi.mock('../dynamodb-client.server', () => ({
  docClient: {
    send: vi.fn()
  },
  TableNames: {
    submissions: 'test-submissions'
  },
  QueryCommand: class MockQueryCommand { constructor(input: any) { Object.assign(this, input) } },
  GetCommand: class MockGetCommand { constructor(input: any) { Object.assign(this, input) } },
  PutCommand: class MockPutCommand { constructor(input: any) { Object.assign(this, input) } },
  UpdateCommand: class MockUpdateCommand { constructor(input: any) { Object.assign(this, input) } }
}))

vi.mock('../problems.server', () => ({
  getProblem: vi.fn()
}))

vi.mock('../users.server', () => ({
  getUserActiveContests: vi.fn(),
  updateUserContestScore: vi.fn()
}))

vi.mock('../contests.server', () => ({
  updateContestScore: vi.fn(),
  calculateProblemScore: vi.fn()
}))

vi.mock('~/types/database', () => ({
  getSubmissionVerdict: vi.fn()
}))

describe('submissions.server', () => {
  // Mock implementations
  let mockDocClient: any
  let mockGetProblem: any
  let mockGetUserActiveContests: any
  let mockUpdateUserContestScore: any
  let mockUpdateContestScore: any
  let mockCalculateProblemScore: any
  let mockGetSubmissionVerdict: any

  // Test data
  const mockSubmission: Submission = {
    subId: 'sub-123',
    username: 'testuser',
    problemName: 'test-problem',
    language: 'cpp',
    submissionTime: '2025-01-01 12:00:00',
    contestId: 'contest-123',
    totalScore: 85,
    status: [3, 2, 2, 2], // [testcaseCount, testcase1, testcase2, testcase3]
    gradingCompleteTime: '2025-01-01 12:05:00'
  }

  const mockProblem = {
    problemName: 'test-problem',
    title: 'Test Problem',
    subtaskScores: [30, 35, 35],
    maxScore: 100
  }

  beforeEach(async () => {
    vi.clearAllMocks()

    // Set up mock implementations
    const dynamoModule = await import('../dynamodb-client.server')
    const problemsModule = await import('../problems.server')
    const usersModule = await import('../users.server')
    const contestsModule = await import('../contests.server')
    const typesModule = await import('~/types/database')

    mockDocClient = vi.mocked(dynamoModule.docClient)
    mockGetProblem = vi.mocked(problemsModule.getProblem)
    mockGetUserActiveContests = vi.mocked(usersModule.getUserActiveContests)
    mockUpdateUserContestScore = vi.mocked(usersModule.updateUserContestScore)
    mockUpdateContestScore = vi.mocked(contestsModule.updateContestScore)
    mockCalculateProblemScore = vi.mocked(contestsModule.calculateProblemScore)
    mockGetSubmissionVerdict = vi.mocked(typesModule.getSubmissionVerdict)

    // Default implementations
    mockDocClient.send.mockResolvedValue({ Items: [] })
    mockGetProblem.mockResolvedValue(mockProblem)
    mockGetUserActiveContests.mockResolvedValue({})
    mockUpdateUserContestScore.mockResolvedValue(undefined)
    mockUpdateContestScore.mockResolvedValue(undefined)
    mockCalculateProblemScore.mockReturnValue(100)
    mockGetSubmissionVerdict.mockReturnValue('AC')

    vi.useFakeTimers()
    vi.setSystemTime(new Date('2025-01-01T12:10:00Z'))
  })

  afterEach(() => {
    vi.useRealTimers()
    vi.resetModules()
  })

  describe('canUserSubmit', () => {
    it('allows submission when user has never submitted', async () => {
      // Mock getLatestSubmissionTime to return null
      mockDocClient.send.mockResolvedValue({ Items: [] })

      const result = await canUserSubmit('testuser', 'test-problem', 60)

      expect(result).toEqual({
        allowed: true,
        waitSeconds: 0
      })
    })

    it('allows submission when enough time has passed', async () => {
      // Mock getLatestSubmissionTime to return old submission
      mockDocClient.send.mockResolvedValue({
        Items: [{ submissionTime: '2025-01-01 12:08:00' }] // 2 minutes ago
      })

      const result = await canUserSubmit('testuser', 'test-problem', 60) // 60 second delay

      expect(result).toEqual({
        allowed: true,
        waitSeconds: 0
      })
    })

    it('blocks submission when not enough time has passed', async () => {
      // Mock getLatestSubmissionTime to return recent submission
      mockDocClient.send.mockResolvedValue({
        Items: [{ submissionTime: '2025-01-01 12:09:30' }] // 30 seconds ago
      })

      const result = await canUserSubmit('testuser', 'test-problem', 60) // 60 second delay

      expect(result).toEqual({
        allowed: false,
        waitSeconds: 30 // ceil(60 - 30) = 30
      })
    })

    it('calculates wait time correctly with fractional seconds', async () => {
      // Mock getLatestSubmissionTime - 45.5 seconds ago
      mockDocClient.send.mockResolvedValue({
        Items: [{ submissionTime: '2025-01-01 12:09:14' }] // 46 seconds ago
      })

      const result = await canUserSubmit('testuser', 'test-problem', 60)

      expect(result).toEqual({
        allowed: false,
        waitSeconds: 14 // ceil(60 - 46) = 14
      })
    })

    it('handles exact boundary conditions', async () => {
      // Exactly at delay time
      mockDocClient.send.mockResolvedValue({
        Items: [{ submissionTime: '2025-01-01 12:09:00' }] // Exactly 60 seconds ago
      })

      const result = await canUserSubmit('testuser', 'test-problem', 60)

      expect(result).toEqual({
        allowed: true,
        waitSeconds: 0
      })
    })

    it('works with different delay values', async () => {
      // Test with 5-minute delay
      mockDocClient.send.mockResolvedValue({
        Items: [{ submissionTime: '2025-01-01 12:07:00' }] // 3 minutes ago
      })

      const result = await canUserSubmit('testuser', 'test-problem', 300) // 5 minutes

      expect(result).toEqual({
        allowed: false,
        waitSeconds: 120 // ceil(300 - 180) = 120 seconds = 2 minutes
      })
    })
  })

  describe('getBestSubmission', () => {
    it('returns null when no completed submissions exist', async () => {
      const incompleteSubs = [
        { ...mockSubmission, status: [3, 1, 1, 1] }, // All pending
        { ...mockSubmission, status: [3, 0, 2, 2] }  // One failed, others complete
      ]
      mockDocClient.send.mockResolvedValue({ Items: incompleteSubs })

      const result = await getBestSubmission('testuser', 'test-problem')

      expect(result).toBe(null)
    })

    it('returns submission with highest score', async () => {
      const submissions = [
        { ...mockSubmission, subId: 'sub-1', totalScore: 75, status: [3, 2, 2, 2] },
        { ...mockSubmission, subId: 'sub-2', totalScore: 95, status: [3, 2, 2, 2] },
        { ...mockSubmission, subId: 'sub-3', totalScore: 85, status: [3, 2, 2, 2] }
      ]
      mockDocClient.send.mockResolvedValue({ Items: submissions })

      const result = await getBestSubmission('testuser', 'test-problem')

      expect(result?.subId).toBe('sub-2')
      expect(result?.totalScore).toBe(95)
    })

    it('breaks ties by earliest submission time', async () => {
      const submissions = [
        {
          ...mockSubmission,
          subId: 'sub-1',
          totalScore: 85,
          submissionTime: '2025-01-01 12:05:00',
          status: [3, 2, 2, 2]
        },
        {
          ...mockSubmission,
          subId: 'sub-2',
          totalScore: 85,
          submissionTime: '2025-01-01 12:02:00', // Earlier
          status: [3, 2, 2, 2]
        },
        {
          ...mockSubmission,
          subId: 'sub-3',
          totalScore: 85,
          submissionTime: '2025-01-01 12:07:00',
          status: [3, 2, 2, 2]
        }
      ]
      mockDocClient.send.mockResolvedValue({ Items: submissions })

      const result = await getBestSubmission('testuser', 'test-problem')

      expect(result?.subId).toBe('sub-2')
      expect(result?.submissionTime).toBe('2025-01-01 12:02:00')
    })

    it('only considers completed submissions', async () => {
      const submissions = [
        { ...mockSubmission, subId: 'sub-1', totalScore: 100, status: [3, 2, 1, 2] }, // One pending
        { ...mockSubmission, subId: 'sub-2', totalScore: 85, status: [3, 2, 2, 2] },  // All complete
        { ...mockSubmission, subId: 'sub-3', totalScore: 95, status: [3, 2, 2, 0] }   // One failed
      ]
      mockDocClient.send.mockResolvedValue({ Items: submissions })

      const result = await getBestSubmission('testuser', 'test-problem')

      expect(result?.subId).toBe('sub-2') // Only completed submission
      expect(result?.totalScore).toBe(85)
    })

    it('handles empty submissions list', async () => {
      mockDocClient.send.mockResolvedValue({ Items: [] })

      const result = await getBestSubmission('testuser', 'test-problem')

      expect(result).toBe(null)
    })
  })

  describe('formatSubmissionForDisplay', () => {
    it('formats submission with problem data', async () => {
      const submission = {
        ...mockSubmission,
        maxTime: 1250000, // microseconds
        maxMemory: 65536000 // bytes
      }

      const result = await formatSubmissionForDisplay(submission)

      expect(result).toEqual({
        subId: 'sub-123',
        username: 'testuser',
        problemName: 'test-problem',
        problemTitle: 'Test Problem',
        language: 'cpp',
        languageDisplay: 'C++ 17',
        verdict: 'AC',
        score: 85,
        maxScore: 100,
        time: '1250.00', // maxTime / 1000 = 1250000 / 1000 = 1250.00
        memory: '65536.0', // maxMemory / 1000 = 65536000 / 1000 = 65536.0
        submissionTime: '2025-01-01 12:00:00',
        isGrading: false
      })
    })

    it('maps language codes correctly', async () => {
      const testCases = [
        { language: 'cpp', expected: 'C++ 17' },
        { language: 'py', expected: 'Python 3' },
        { language: 'java', expected: 'Java' },
        { language: 'unknown', expected: 'unknown' }
      ]

      for (const { language, expected } of testCases) {
        const submission = { ...mockSubmission, language }
        const result = await formatSubmissionForDisplay(submission)
        expect(result.languageDisplay).toBe(expected)
      }
    })

    it('detects grading status correctly', async () => {
      // Still grading (no completion time)
      const gradingSubmission = { ...mockSubmission, gradingCompleteTime: null }
      const gradingResult = await formatSubmissionForDisplay(gradingSubmission)
      expect(gradingResult.isGrading).toBe(true)

      // Grading complete
      const completeSubmission = { ...mockSubmission, gradingCompleteTime: '2025-01-01 12:05:00' }
      const completeResult = await formatSubmissionForDisplay(completeSubmission)
      expect(completeResult.isGrading).toBe(false)
    })

    it('handles missing time and memory data', async () => {
      const submission = {
        ...mockSubmission,
        gradingCompleteTime: null // This causes time/memory to show N/A
      }

      const result = await formatSubmissionForDisplay(submission)

      expect(result.time).toBe('N/A')
      expect(result.memory).toBe('N/A')
    })

    it('handles missing problem data', async () => {
      mockGetProblem.mockResolvedValue(null)

      const result = await formatSubmissionForDisplay(mockSubmission)

      expect(result.maxScore).toBe(100) // Default when problem not found
      expect(result.problemTitle).toBe('test-problem') // Falls back to problemName
    })
  })

  describe('updateScoresAfterGrading', () => {
    it('updates scores for all active contests', async () => {
      const submission = {
        ...mockSubmission,
        contestId: 'contest-1',
        totalScore: 85,
        subtasks: [30, 30, 25] // Matches the score of 85
      }

      mockGetUserActiveContests.mockResolvedValue({
        'contest-1': { status: 'started' },
        'contest-2': { status: 'started' }
      })

      await updateScoresAfterGrading(submission)

      expect(mockUpdateUserContestScore).toHaveBeenCalledTimes(2)
      expect(mockUpdateUserContestScore).toHaveBeenCalledWith(
        'testuser',
        'contest-1',
        'test-problem',
        100, // calculateProblemScore returns 100
        '2025-01-01 12:00:00'
      )
      expect(mockUpdateUserContestScore).toHaveBeenCalledWith(
        'testuser',
        'contest-2',
        'test-problem',
        100, // calculateProblemScore returns 100
        '2025-01-01 12:00:00'
      )

      expect(mockUpdateContestScore).toHaveBeenCalledTimes(2)
      expect(mockUpdateContestScore).toHaveBeenCalledWith(
        'contest-1',
        'testuser',
        'test-problem',
        undefined // No subtasks on mockSubmission
      )
    })

    it('calculates total score from subtasks when totalScore missing', async () => {
      const submission = {
        ...mockSubmission,
        totalScore: undefined,
        subtasks: [30, 35, 35] // Should total to 100
      }

      mockGetUserActiveContests.mockResolvedValue({
        'contest-1': { status: 'started' }
      })

      await updateScoresAfterGrading(submission)

      expect(mockUpdateUserContestScore).toHaveBeenCalledWith(
        'testuser',
        'contest-1',
        'test-problem',
        100, // Sum of subtasks
        '2025-01-01 12:00:00'
      )
    })

    it('handles submission with no active contests', async () => {
      mockGetUserActiveContests.mockResolvedValue({})

      await updateScoresAfterGrading(mockSubmission)

      expect(mockUpdateUserContestScore).not.toHaveBeenCalled()
      expect(mockUpdateContestScore).not.toHaveBeenCalled()
    })

    it('handles missing subtasks gracefully', async () => {
      const submission = {
        ...mockSubmission,
        totalScore: 85,
        subtasks: undefined
      }

      mockGetUserActiveContests.mockResolvedValue({
        'contest-1': { status: 'started' }
      })

      await updateScoresAfterGrading(submission)

      expect(mockUpdateContestScore).toHaveBeenCalledWith(
        'contest-1',
        'testuser',
        'test-problem',
        undefined // undefined subtasks passed directly
      )
    })

    it('handles errors in score updates gracefully', async () => {
      mockGetUserActiveContests.mockResolvedValue({
        'contest-1': { status: 'started' }
      })
      mockUpdateUserContestScore.mockRejectedValue(new Error('DB Error'))

      // Should not throw error
      await expect(updateScoresAfterGrading(mockSubmission)).resolves.not.toThrow()

      expect(mockUpdateUserContestScore).toHaveBeenCalled()
    })
  })

  describe('error handling', () => {
    it('handles DynamoDB errors in canUserSubmit', async () => {
      mockDocClient.send.mockRejectedValue(new Error('Query failed'))

      await expect(canUserSubmit('testuser', 'test-problem', 60))
        .rejects.toThrow('Query failed')
    })

    it('handles DynamoDB errors in getBestSubmission', async () => {
      mockDocClient.send.mockRejectedValue(new Error('Query failed'))

      await expect(getBestSubmission('testuser', 'test-problem'))
        .rejects.toThrow('Query failed')
    })
  })
})