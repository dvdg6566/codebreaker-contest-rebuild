import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import {
  submitSolution,
  getSubmissionStats,
  type SubmitSolutionParams
} from '../submissions.server'
import type { Problem, Submission } from '~/types/database'

// Mock dependencies
vi.mock('../db/submissions.server', () => ({
  createSubmissionWithSource: vi.fn(),
  createCommunicationSubmission: vi.fn(),
  getSubmissionsByUserAndProblem: vi.fn()
}))

vi.mock('../contest.server', () => ({
  isUserInActiveContest: vi.fn()
}))

vi.mock('../db/problems.server', () => ({
  getProblem: vi.fn()
}))

vi.mock('../grading.server', () => ({
  startGrading: vi.fn()
}))

describe('submissions.server', () => {
  // Mock implementations
  let mockCreateSubmissionWithSource: any
  let mockCreateCommunicationSubmission: any
  let mockGetSubmissionsByUserAndProblem: any
  let mockIsUserInActiveContest: any
  let mockGetProblem: any
  let mockStartGrading: any

  // Test data
  const mockBatchProblem: Problem = {
    problemName: 'test-problem',
    validated: true,
    problem_type: 'Batch',
    testcaseCount: 10,
    title: 'Test Problem',
    statement: 'Test statement',
    timeLimit: 1000,
    memoryLimit: 256
  }

  const mockCommunicationProblem: Problem = {
    ...mockBatchProblem,
    problemName: 'comm-problem',
    problem_type: 'Communication'
  }

  const mockSubmission: Submission = {
    subId: 'sub-123',
    username: 'testuser',
    problemName: 'test-problem',
    language: 'cpp',
    submissionTime: '2025-01-01 12:00:00',
    contestId: 'contest-123',
    totalScore: 0,
    gradingCompleteTime: null
  }

  const mockContestStatus = {
    active: true,
    contest: {
      contestId: 'contest-123',
      problems: ['test-problem', 'other-problem']
    },
    participation: null,
    timeRemaining: 3600,
    contestStart: new Date(),
    contestEnd: new Date()
  }

  beforeEach(async () => {
    vi.clearAllMocks()

    // Set up mock implementations
    const submissionsModule = await import('../db/submissions.server')
    const contestModule = await import('../contest.server')
    const problemsModule = await import('../db/problems.server')
    const gradingModule = await import('../grading.server')

    mockCreateSubmissionWithSource = vi.mocked(submissionsModule.createSubmissionWithSource)
    mockCreateCommunicationSubmission = vi.mocked(submissionsModule.createCommunicationSubmission)
    mockGetSubmissionsByUserAndProblem = vi.mocked(submissionsModule.getSubmissionsByUserAndProblem)
    mockIsUserInActiveContest = vi.mocked(contestModule.isUserInActiveContest)
    mockGetProblem = vi.mocked(problemsModule.getProblem)
    mockStartGrading = vi.mocked(gradingModule.startGrading)

    // Default mock setup
    mockGetProblem.mockResolvedValue(mockBatchProblem)
    mockIsUserInActiveContest.mockResolvedValue(mockContestStatus)
    mockCreateSubmissionWithSource.mockResolvedValue(mockSubmission)
    mockCreateCommunicationSubmission.mockResolvedValue(mockSubmission)
    mockStartGrading.mockResolvedValue(undefined)
  })

  afterEach(() => {
    vi.resetModules()
  })

  describe('submitSolution', () => {
    const baseParams: SubmitSolutionParams = {
      username: 'testuser',
      problemName: 'test-problem',
      language: 'cpp',
      code: '#include <iostream>\nint main() { return 0; }'
    }

    describe('problem validation', () => {
      it('throws error when problem not found', async () => {
        mockGetProblem.mockResolvedValue(null)

        await expect(submitSolution(baseParams)).rejects.toThrow('Problem not found')
        expect(mockGetProblem).toHaveBeenCalledWith('test-problem')
      })

      it('throws error when problem not validated', async () => {
        mockGetProblem.mockResolvedValue({ ...mockBatchProblem, validated: false })

        await expect(submitSolution(baseParams)).rejects.toThrow(
          'Problem is not available for submissions'
        )
      })
    })

    describe('contest validation', () => {
      const contestParams = { ...baseParams, contestId: 'contest-123' }

      it('validates contest access when contestId provided', async () => {
        await submitSolution(contestParams)

        expect(mockIsUserInActiveContest).toHaveBeenCalledWith('testuser', 'contest-123')
        expect(mockCreateSubmissionWithSource).toHaveBeenCalledWith(
          'testuser',
          'test-problem',
          'cpp',
          expect.any(String),
          'contest-123',
          10
        )
      })

      it('throws error when contest not active', async () => {
        mockIsUserInActiveContest.mockResolvedValue({ ...mockContestStatus, active: false })

        await expect(submitSolution(contestParams)).rejects.toThrow(
          'Contest is not active or you don\'t have access'
        )
      })

      it('throws error when problem not in contest', async () => {
        mockIsUserInActiveContest.mockResolvedValue({
          ...mockContestStatus,
          contest: { ...mockContestStatus.contest!, problems: ['other-problem'] }
        })

        await expect(submitSolution(contestParams)).rejects.toThrow(
          'Problem is not part of this contest'
        )
      })

      it('uses "global" contestId when none provided', async () => {
        await submitSolution(baseParams)

        expect(mockCreateSubmissionWithSource).toHaveBeenCalledWith(
          'testuser',
          'test-problem',
          'cpp',
          expect.any(String),
          'global',
          10
        )
      })
    })

    describe('language validation', () => {
      it('accepts supported languages', async () => {
        const languages = ['cpp', 'py', 'java']

        for (const language of languages) {
          mockCreateSubmissionWithSource.mockClear()
          await submitSolution({ ...baseParams, language })
          expect(mockCreateSubmissionWithSource).toHaveBeenCalled()
        }
      })

      it('throws error for unsupported language', async () => {
        await expect(submitSolution({ ...baseParams, language: 'rust' })).rejects.toThrow(
          'Unsupported language: rust'
        )
      })
    })

    describe('communication problems', () => {
      beforeEach(() => {
        mockGetProblem.mockResolvedValue(mockCommunicationProblem)
      })

      it('successfully submits with both code files', async () => {
        const params = {
          ...baseParams,
          problemName: 'comm-problem',
          code: undefined,
          codeA: 'Code A content',
          codeB: 'Code B content'
        }

        const result = await submitSolution(params)

        expect(mockCreateCommunicationSubmission).toHaveBeenCalledWith(
          'testuser',
          'comm-problem',
          'cpp',
          'Code A content',
          'Code B content',
          'global',
          10
        )

        expect(mockStartGrading).toHaveBeenCalledWith({
          problemName: 'comm-problem',
          submissionId: 'sub-123',
          username: 'testuser',
          language: 'cpp',
          problemType: 'Communication'
        })

        expect(result).toBe(mockSubmission)
      })

      it('throws error when codeA missing', async () => {
        const params = {
          ...baseParams,
          problemName: 'comm-problem',
          code: undefined,
          codeA: '',
          codeB: 'Code B content'
        }

        await expect(submitSolution(params)).rejects.toThrow(
          'Communication problems require both source files'
        )
      })

      it('throws error when codeB missing', async () => {
        const params = {
          ...baseParams,
          problemName: 'comm-problem',
          code: undefined,
          codeA: 'Code A content',
          codeB: '   '
        }

        await expect(submitSolution(params)).rejects.toThrow(
          'Communication problems require both source files'
        )
      })

      it('throws error when codeA too large', async () => {
        const params = {
          ...baseParams,
          problemName: 'comm-problem',
          code: undefined,
          codeA: 'a'.repeat(1000001),
          codeB: 'Code B content'
        }

        await expect(submitSolution(params)).rejects.toThrow('Code is too large')
      })

      it('throws error when codeB too large', async () => {
        const params = {
          ...baseParams,
          problemName: 'comm-problem',
          code: undefined,
          codeA: 'Code A content',
          codeB: 'b'.repeat(1000001)
        }

        await expect(submitSolution(params)).rejects.toThrow('Code is too large')
      })
    })

    describe('regular problems (Batch/Interactive)', () => {
      it('successfully submits regular problem', async () => {
        const result = await submitSolution(baseParams)

        expect(mockCreateSubmissionWithSource).toHaveBeenCalledWith(
          'testuser',
          'test-problem',
          'cpp',
          '#include <iostream>\nint main() { return 0; }',
          'global',
          10
        )

        expect(mockStartGrading).toHaveBeenCalledWith({
          problemName: 'test-problem',
          submissionId: 'sub-123',
          username: 'testuser',
          language: 'cpp',
          problemType: 'Batch'
        })

        expect(result).toBe(mockSubmission)
      })

      it('throws error when code is empty', async () => {
        await expect(submitSolution({ ...baseParams, code: '' })).rejects.toThrow(
          'Code cannot be empty'
        )
      })

      it('throws error when code is only whitespace', async () => {
        await expect(submitSolution({ ...baseParams, code: '   \n\t  ' })).rejects.toThrow(
          'Code cannot be empty'
        )
      })

      it('throws error when code too large', async () => {
        await expect(submitSolution({
          ...baseParams,
          code: 'x'.repeat(1000001)
        })).rejects.toThrow('Code is too large')
      })

      it('accepts code at size limit', async () => {
        const largecode = 'x'.repeat(1000000) // Exactly 1MB

        await submitSolution({ ...baseParams, code: largecode })

        expect(mockCreateSubmissionWithSource).toHaveBeenCalledWith(
          'testuser',
          'test-problem',
          'cpp',
          largecode,
          'global',
          10
        )
      })
    })

    describe('grading integration', () => {
      it('triggers grading for regular problems', async () => {
        await submitSolution(baseParams)

        expect(mockStartGrading).toHaveBeenCalledWith({
          problemName: 'test-problem',
          submissionId: 'sub-123',
          username: 'testuser',
          language: 'cpp',
          problemType: 'Batch'
        })
      })

      it('triggers grading for communication problems', async () => {
        mockGetProblem.mockResolvedValue(mockCommunicationProblem)

        await submitSolution({
          ...baseParams,
          problemName: 'comm-problem',
          code: undefined,
          codeA: 'Code A',
          codeB: 'Code B'
        })

        expect(mockStartGrading).toHaveBeenCalledWith({
          problemName: 'comm-problem',
          submissionId: 'sub-123',
          username: 'testuser',
          language: 'cpp',
          problemType: 'Communication'
        })
      })

      it('handles grading failures gracefully', async () => {
        mockStartGrading.mockRejectedValue(new Error('Grading service unavailable'))

        // Should still create submission even if grading fails
        await expect(submitSolution(baseParams)).rejects.toThrow('Grading service unavailable')

        expect(mockCreateSubmissionWithSource).toHaveBeenCalled()
      })
    })
  })

  describe('getSubmissionStats', () => {
    const mockSubmissions = [
      { totalScore: 100, gradingCompleteTime: '2025-01-01 12:00:00' }, // Accepted
      { totalScore: 50, gradingCompleteTime: '2025-01-01 12:01:00' },  // Partial
      { totalScore: 0, gradingCompleteTime: '2025-01-01 12:02:00' },   // Wrong
      { totalScore: null, gradingCompleteTime: null },                  // Pending
      { totalScore: 75, gradingCompleteTime: '2025-01-01 12:03:00' },  // Partial
      { totalScore: 100, gradingCompleteTime: '2025-01-01 12:04:00' }, // Accepted
      { totalScore: undefined, gradingCompleteTime: null },             // Pending
    ]

    beforeEach(() => {
      mockGetSubmissionsByUserAndProblem.mockResolvedValue(mockSubmissions)
    })

    it('calculates statistics correctly', async () => {
      const stats = await getSubmissionStats('testuser', 'test-problem')

      expect(stats).toEqual({
        total: 7,
        accepted: 2,  // Submissions with totalScore === 100
        pending: 2,   // Submissions without gradingCompleteTime
        bestScore: 100 // Maximum score
      })

      expect(mockGetSubmissionsByUserAndProblem).toHaveBeenCalledWith('testuser', 'test-problem')
    })

    it('handles empty submissions list', async () => {
      mockGetSubmissionsByUserAndProblem.mockResolvedValue([])

      const stats = await getSubmissionStats('testuser', 'test-problem')

      expect(stats).toEqual({
        total: 0,
        accepted: 0,
        pending: 0,
        bestScore: 0
      })
    })

    it('handles submissions with null/undefined scores', async () => {
      mockGetSubmissionsByUserAndProblem.mockResolvedValue([
        { totalScore: null, gradingCompleteTime: '2025-01-01 12:00:00' },
        { totalScore: undefined, gradingCompleteTime: '2025-01-01 12:01:00' }
      ])

      const stats = await getSubmissionStats('testuser', 'test-problem')

      expect(stats).toEqual({
        total: 2,
        accepted: 0,
        pending: 0,
        bestScore: 0 // null/undefined scores treated as 0
      })
    })

    it('handles all pending submissions', async () => {
      mockGetSubmissionsByUserAndProblem.mockResolvedValue([
        { totalScore: null, gradingCompleteTime: null },
        { totalScore: undefined, gradingCompleteTime: null }
      ])

      const stats = await getSubmissionStats('testuser', 'test-problem')

      expect(stats).toEqual({
        total: 2,
        accepted: 0,
        pending: 2,
        bestScore: 0
      })
    })
  })
})