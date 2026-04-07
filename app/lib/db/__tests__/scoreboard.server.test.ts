import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { getScoreboard, type ScoreboardEntry } from '../scoreboard.server'
import type { Contest, Problem, Submission, User } from '~/types/database'

// Mock dependencies
vi.mock('../contests.server', () => ({
  getContest: vi.fn(),
  calculateProblemScore: vi.fn()
}))

vi.mock('../users.server', () => ({
  listUsers: vi.fn(),
  getUser: vi.fn()
}))

vi.mock('../problems.server', () => ({
  getProblem: vi.fn()
}))

vi.mock('../submissions.server', () => ({
  getSubmissionsByUser: vi.fn()
}))

vi.mock('~/types/database', async (importOriginal) => {
  const actual = await importOriginal<typeof import('~/types/database')>()
  return {
    ...actual,
    parseDateTime: vi.fn(),
    getMaxScore: vi.fn()
  }
})

describe('scoreboard.server', () => {
  // Mock implementations
  let mockGetContest: any
  let mockListUsers: any
  let mockGetUser: any
  let mockGetProblem: any
  let mockGetSubmissionsByUser: any
  let mockParseDateTime: any
  let mockGetMaxScore: any

  // Test data
  const mockContest: Contest = {
    contestId: 'contest-123',
    name: 'Test Contest',
    startTime: '2025-01-01 10:00:00',
    endTime: '2025-01-01 15:00:00',
    duration: 300,
    mode: 'centralized',
    problems: ['problem1', 'problem2', 'problem3'],
    users: { 'alice': '0', 'bob': '1', 'charlie': '2' },
    scores: {}
  }

  const mockProblems: Problem[] = [
    {
      problemName: 'problem1',
      title: 'Problem 1',
      validated: true,
      subtaskScores: [30, 35, 35],
      subtaskDependency: [],
      maxScore: 100,
      timeLimit: 1000,
      memoryLimit: 256,
      checker: 'standard',
      verdicts: {} as any,
      remarks: {} as any
    },
    {
      problemName: 'problem2',
      title: 'Problem 2',
      validated: true,
      subtaskScores: [40, 60],
      subtaskDependency: [],
      maxScore: 100,
      timeLimit: 2000,
      memoryLimit: 512,
      checker: 'standard',
      verdicts: {} as any,
      remarks: {} as any
    },
    {
      problemName: 'problem3',
      title: 'Problem 3',
      validated: true,
      subtaskScores: [100],
      subtaskDependency: [],
      maxScore: 100,
      timeLimit: 1500,
      memoryLimit: 256,
      checker: 'standard',
      verdicts: {} as any,
      remarks: {} as any
    }
  ]

  const mockUsers: User[] = [
    {
      username: 'alice',
      role: 'member',
      fullname: 'Alice Smith',
      activeContests: {
        'contest-123': {
          status: 'started',
          joinedAt: '2025-01-01 09:55:00',
          startedAt: '2025-01-01 10:00:00'
        }
      },
      contestScores: {
        'contest-123': {
          'problem1': 85,
          'problem2': 100,
          'problem3': 50
        }
      },
      contestSubmissions: {},
      contestLatestSubmissions: {}
    },
    {
      username: 'bob',
      role: 'member',
      fullname: 'Bob Johnson',
      activeContests: {
        'contest-123': {
          status: 'started',
          joinedAt: '2025-01-01 09:58:00',
          startedAt: '2025-01-01 10:00:00'
        }
      },
      contestScores: {
        'contest-123': {
          'problem1': 100,
          'problem2': 60,
          'problem3': 100
        }
      },
      contestSubmissions: {},
      contestLatestSubmissions: {}
    },
    {
      username: 'charlie',
      role: 'member',
      fullname: 'Charlie Wilson',
      activeContests: {
        'contest-123': {
          status: 'invited', // Not started yet
          joinedAt: '2025-01-01 09:50:00'
        }
      },
      contestScores: {},
      contestSubmissions: {},
      contestLatestSubmissions: {}
    },
    {
      username: 'david',
      role: 'member',
      fullname: 'David Brown',
      activeContests: {
        'other-contest': {
          status: 'started', // In different contest
          joinedAt: '2025-01-01 08:00:00',
          startedAt: '2025-01-01 08:00:00'
        }
      },
      contestScores: {},
      contestSubmissions: {},
      contestLatestSubmissions: {}
    }
  ]

  const mockSubmissions: Record<string, Submission[]> = {
    'alice': [
      {
        subId: 'sub-alice-1',
        username: 'alice',
        problemName: 'problem1',
        language: 'cpp',
        submissionTime: '2025-01-01 10:15:00',
        contestId: 'contest-123',
        totalScore: 65,
        status: [3, 2, 2, 0]
      },
      {
        subId: 'sub-alice-2',
        username: 'alice',
        problemName: 'problem1',
        language: 'cpp',
        submissionTime: '2025-01-01 10:30:00',
        contestId: 'contest-123',
        totalScore: 85,
        status: [3, 2, 2, 2]
      },
      {
        subId: 'sub-alice-3',
        username: 'alice',
        problemName: 'problem2',
        language: 'cpp',
        submissionTime: '2025-01-01 11:00:00',
        contestId: 'contest-123',
        totalScore: 100,
        status: [2, 2, 2]
      }
    ],
    'bob': [
      {
        subId: 'sub-bob-1',
        username: 'bob',
        problemName: 'problem1',
        language: 'py',
        submissionTime: '2025-01-01 10:10:00',
        contestId: 'contest-123',
        totalScore: 100,
        status: [3, 2, 2, 2]
      },
      {
        subId: 'sub-bob-2',
        username: 'bob',
        problemName: 'problem2',
        language: 'py',
        submissionTime: '2025-01-01 11:30:00',
        contestId: 'contest-123',
        totalScore: 60,
        status: [2, 2, 0]
      },
      {
        subId: 'sub-bob-3',
        username: 'bob',
        problemName: 'problem3',
        language: 'py',
        submissionTime: '2025-01-01 12:00:00',
        contestId: 'contest-123',
        totalScore: 100,
        status: [1, 2]
      }
    ]
  }

  beforeEach(async () => {
    vi.clearAllMocks()

    // Set up mock implementations
    const contestsModule = await import('../contests.server')
    const usersModule = await import('../users.server')
    const problemsModule = await import('../problems.server')
    const submissionsModule = await import('../submissions.server')
    const typesModule = await import('~/types/database')

    mockGetContest = vi.mocked(contestsModule.getContest)
    mockListUsers = vi.mocked(usersModule.listUsers)
    mockGetUser = vi.mocked(usersModule.getUser)
    mockGetProblem = vi.mocked(problemsModule.getProblem)
    mockGetSubmissionsByUser = vi.mocked(submissionsModule.getSubmissionsByUser)
    mockParseDateTime = vi.mocked(typesModule.parseDateTime)
    mockGetMaxScore = vi.mocked(typesModule.getMaxScore)

    // Default implementations
    mockGetContest.mockResolvedValue(mockContest)
    mockListUsers.mockResolvedValue(mockUsers)
    mockGetUser.mockImplementation(async (username: string) => {
      return mockUsers.find(u => u.username === username) || null
    })
    mockGetProblem.mockImplementation(async (problemName: string) => {
      return mockProblems.find(p => p.problemName === problemName) || null
    })
    mockGetSubmissionsByUser.mockImplementation(async (username: string) => {
      return mockSubmissions[username] || []
    })
    mockParseDateTime.mockImplementation((dateStr: string) => {
      const isoStr = dateStr.replace(' ', 'T') + 'Z'
      return new Date(isoStr)
    })
    mockGetMaxScore.mockImplementation((problem: Problem) => {
      return problem.subtaskScores.reduce((sum, score) => sum + score, 0)
    })
  })

  afterEach(() => {
    vi.resetModules()
  })

  describe('getScoreboard', () => {
    it('returns empty array when contest not found', async () => {
      mockGetContest.mockResolvedValue(null)

      const result = await getScoreboard('nonexistent-contest')

      expect(result).toEqual([])
    })

    it('returns empty array when no users have started contest', async () => {
      const emptyContest = { ...mockContest, problems: [] }
      mockGetContest.mockResolvedValue(emptyContest)

      // All users are either invited or in different contests
      const usersNotStarted = mockUsers.map(u => ({
        ...u,
        activeContests: {
          'contest-123': {
            status: 'invited' as const,
            joinedAt: '2025-01-01 09:50:00'
          }
        }
      }))
      mockListUsers.mockResolvedValue(usersNotStarted)

      const result = await getScoreboard('contest-123')

      expect(result).toEqual([])
    })

    it('computes scoreboard correctly with proper ranking', async () => {
      const result = await getScoreboard('contest-123')

      expect(result).toHaveLength(2) // Only Alice and Bob have started

      // Check that results are sorted by score (desc), then time (asc)
      expect(result[0].username).toBe('bob')    // 260 points total
      expect(result[1].username).toBe('alice')  // 235 points total

      // Check Bob's entry (rank 1)
      expect(result[0]).toEqual({
        rank: 1,
        username: 'bob',
        fullname: 'Bob Johnson',
        totalScore: 260, // 100 + 60 + 100
        totalTime: 130,  // 10 + 0 + 120 minutes (only count solved problems)
        problems: [
          {
            problemName: 'problem1',
            score: 100,
            maxScore: 100,
            attempts: 1,
            solvedAt: '2025-01-01 10:10:00' // AC submission time
          },
          {
            problemName: 'problem2',
            score: 60,
            maxScore: 100,
            attempts: 1,
            solvedAt: null // Not AC
          },
          {
            problemName: 'problem3',
            score: 100,
            maxScore: 100,
            attempts: 1,
            solvedAt: '2025-01-01 12:00:00'
          }
        ]
      })

      // Check Alice's entry (rank 2)
      expect(result[1]).toEqual({
        rank: 2,
        username: 'alice',
        fullname: 'Alice Smith',
        totalScore: 235, // 85 + 100 + 50
        totalTime: 60,   // 0 + 60 minutes (only problem2 is AC)
        problems: [
          {
            problemName: 'problem1',
            score: 85,
            maxScore: 100,
            attempts: 2,
            solvedAt: null // Not AC (max score is 100, got 85)
          },
          {
            problemName: 'problem2',
            score: 100,
            maxScore: 100,
            attempts: 1,
            solvedAt: '2025-01-01 11:00:00'
          },
          {
            problemName: 'problem3',
            score: 50,
            maxScore: 100,
            attempts: 0, // No submissions
            solvedAt: null
          }
        ]
      })
    })

    it('handles missing user data gracefully', async () => {
      // Mock a case where a user is missing
      mockGetUser.mockImplementation(async (username: string) => {
        if (username === 'alice') return null // Missing user
        return mockUsers.find(u => u.username === username) || null
      })

      const result = await getScoreboard('contest-123')

      expect(result).toHaveLength(1) // Only Bob
      expect(result[0].username).toBe('bob')
    })

    it('handles missing problem data gracefully', async () => {
      // Mock missing problem2
      mockGetProblem.mockImplementation(async (problemName: string) => {
        if (problemName === 'problem2') return null
        return mockProblems.find(p => p.problemName === problemName) || null
      })

      const result = await getScoreboard('contest-123')

      // Should still work, just use default maxScore for missing problem
      expect(result).toHaveLength(2)
      expect(result[0].problems[1].maxScore).toBe(100) // Default maxScore when problem not found
    })

    it('handles users with no submissions', async () => {
      mockGetSubmissionsByUser.mockResolvedValue([])

      const result = await getScoreboard('contest-123')

      expect(result).toHaveLength(2)
      // All problems should have 0 attempts and null solvedAt
      result.forEach(entry => {
        entry.problems.forEach(problem => {
          expect(problem.attempts).toBe(0)
          expect(problem.solvedAt).toBe(null)
        })
      })
    })

    it('handles users with no contest scores', async () => {
      const usersWithoutScores = mockUsers.map(u => ({
        ...u,
        contestScores: {} // No scores for any contest
      }))
      mockListUsers.mockResolvedValue(usersWithoutScores)
      mockGetUser.mockImplementation(async (username: string) => {
        return usersWithoutScores.find(u => u.username === username) || null
      })

      const result = await getScoreboard('contest-123')

      expect(result).toHaveLength(2)
      // All scores should be 0
      result.forEach(entry => {
        expect(entry.totalScore).toBe(0)
        entry.problems.forEach(problem => {
          expect(problem.score).toBe(0)
        })
      })
    })

    it('correctly calculates timing based on contest start', async () => {
      // Mock contest starting at a specific time
      const contestWithEarlierStart = {
        ...mockContest,
        startTime: '2025-01-01 09:00:00' // 1 hour earlier
      }
      mockGetContest.mockResolvedValue(contestWithEarlierStart)

      const result = await getScoreboard('contest-123')

      // Bob's timing should increase by 120 minutes (60 min per solved problem: problem1 + problem3)
      expect(result[0].totalTime).toBe(250) // 130 + 120

      // Alice's timing should increase by 60 minutes (60 min for problem2, only solved problem)
      expect(result[1].totalTime).toBe(120) // 60 + 60
    })

    it('handles tie-breaking by time correctly', async () => {
      // Create a scenario where users have same score but different times
      const tiedUsers = [
        {
          ...mockUsers[0],
          username: 'alice',
          contestScores: { 'contest-123': { 'problem1': 100 } }
        },
        {
          ...mockUsers[1],
          username: 'bob',
          contestScores: { 'contest-123': { 'problem1': 100 } }
        }
      ]
      mockListUsers.mockResolvedValue(tiedUsers)
      mockGetUser.mockImplementation(async (username: string) => {
        return tiedUsers.find(u => u.username === username) || null
      })

      // Alice solves faster (10 minutes vs 15 minutes)
      const fastSubmissions = {
        'alice': [{
          ...mockSubmissions.alice[0],
          submissionTime: '2025-01-01 10:10:00',
          totalScore: 100
        }],
        'bob': [{
          ...mockSubmissions.bob[0],
          submissionTime: '2025-01-01 10:15:00',
          totalScore: 100
        }]
      }
      mockGetSubmissionsByUser.mockImplementation(async (username: string) => {
        return fastSubmissions[username] || []
      })

      const result = await getScoreboard('contest-123')

      expect(result).toHaveLength(2)
      expect(result[0].username).toBe('alice') // Alice wins on time
      expect(result[1].username).toBe('bob')
      expect(result[0].totalTime).toBeLessThan(result[1].totalTime)
    })

    it('assigns ranks correctly with multiple ties', async () => {
      // Create 3 users with identical scores and times
      const identicalUsers = Array.from({length: 3}, (_, i) => ({
        ...mockUsers[0],
        username: `user${i}`,
        fullname: `User ${i}`,
        contestScores: { 'contest-123': { 'problem1': 100 } }
      }))
      mockListUsers.mockResolvedValue(identicalUsers)
      mockGetUser.mockImplementation(async (username: string) => {
        return identicalUsers.find(u => u.username === username) || null
      })

      mockGetSubmissionsByUser.mockImplementation(async (username: string) => {
        return [{
          ...mockSubmissions.alice[0],
          username,
          submissionTime: '2025-01-01 10:10:00',
          totalScore: 100
        }]
      })

      const result = await getScoreboard('contest-123')

      expect(result).toHaveLength(3)
      expect(result[0].rank).toBe(1)
      expect(result[1].rank).toBe(2)
      expect(result[2].rank).toBe(3)
    })

    it('filters users to only those who started the specific contest', async () => {
      const mixedUsers = [
        ...mockUsers, // Includes users in different states
        {
          username: 'eve',
          role: 'member' as const,
          fullname: 'Eve Davis',
          activeContests: {
            'contest-123': {
              status: 'completed' as const, // Completed status should be excluded
              joinedAt: '2025-01-01 09:30:00',
              startedAt: '2025-01-01 10:00:00'
            }
          },
          contestScores: {},
          contestSubmissions: {},
          contestLatestSubmissions: {}
        }
      ]
      mockListUsers.mockResolvedValue(mixedUsers)

      const result = await getScoreboard('contest-123')

      // Should only include Alice and Bob (status: 'started')
      expect(result).toHaveLength(2)
      expect(result.map(r => r.username)).toEqual(expect.arrayContaining(['alice', 'bob']))
    })

    it('handles contest with no problems', async () => {
      const emptyContest = { ...mockContest, problems: [] }
      mockGetContest.mockResolvedValue(emptyContest)

      const result = await getScoreboard('contest-123')

      expect(result).toHaveLength(2)
      result.forEach(entry => {
        expect(entry.problems).toEqual([])
        expect(entry.totalScore).toBe(0)
        expect(entry.totalTime).toBe(0)
      })
    })
  })
})