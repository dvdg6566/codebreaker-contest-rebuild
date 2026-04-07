import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import {
  listProblems,
  listValidatedProblems,
  getProblem,
  createProblem,
  updateProblem,
  invalidateProblem,
  getProblemsForContest,
  updateSubtasks,
  validateAndUpdateProblem,
  getValidationStatus,
  getMaxScore,
  type ProblemValidationResult
} from '../problems.server'
import type { Problem } from '~/types/database'

// Mock dependencies
vi.mock('../dynamodb-client.server', () => ({
  docClient: {
    send: vi.fn()
  },
  TableNames: {
    problems: 'test-problems'
  },
  GetCommand: class MockGetCommand { constructor(input: any) { Object.assign(this, input) } },
  PutCommand: class MockPutCommand { constructor(input: any) { Object.assign(this, input) } },
  UpdateCommand: class MockUpdateCommand { constructor(input: any) { Object.assign(this, input) } },
  ScanCommand: class MockScanCommand { constructor(input: any) { Object.assign(this, input) } }
}))

vi.mock('~/types/database', async (importOriginal) => {
  const actual = await importOriginal<typeof import('~/types/database')>()
  return {
    ...actual,
    DEFAULT_PROBLEM: {
      problemName: '',
      title: '',
      validated: false,
      subtaskScores: [100],
      subtaskDependency: [],
      maxScore: 100,
      timeLimit: 1000,
      memoryLimit: 256,
      checker: 'standard',
      verdicts: {
        statement: 0,
        testdata: 0,
        scoring: 0,
        checker: 0,
        grader: 0,
        attachments: 0,
        subtasks: 0
      },
      remarks: {
        statement: 'Not validated',
        testdata: 'Not validated',
        scoring: 'Not validated',
        checker: 'Not validated',
        grader: 'Not validated',
        attachments: 'Not validated',
        subtasks: 'Not validated'
      }
    },
    getMaxScore: vi.fn()
  }
})

vi.mock('@aws-sdk/client-lambda', () => ({
  LambdaClient: class MockLambdaClient {
    send = vi.fn()
  },
  InvokeCommand: class MockInvokeCommand {
    constructor(input: any) { Object.assign(this, input) }
  }
}))

describe('problems.server', () => {
  // Mock implementations
  let mockDocClient: any
  let mockGetMaxScore: any
  let mockInvokeCommand: any

  // Test data
  const mockProblem: Problem = {
    problemName: 'test-problem',
    title: 'Test Problem',
    validated: true,
    subtaskScores: [30, 35, 35],
    subtaskDependency: [],
    maxScore: 100,
    timeLimit: 1000,
    memoryLimit: 256,
    checker: 'standard',
    verdicts: {
      statement: 1,
      testdata: 1,
      scoring: 1,
      checker: 1,
      grader: 1,
      attachments: 1,
      subtasks: 1
    },
    remarks: {
      statement: 'Valid',
      testdata: 'Valid',
      scoring: 'Valid',
      checker: 'Valid',
      grader: 'Valid',
      attachments: 'Valid',
      subtasks: 'Valid'
    }
  }

  const mockInvalidProblem: Problem = {
    ...mockProblem,
    problemName: 'invalid-problem',
    validated: false,
    verdicts: {
      statement: 1,
      testdata: 0, // Invalid
      scoring: 1,
      checker: 1,
      grader: 0, // Invalid
      attachments: 1,
      subtasks: 1
    },
    remarks: {
      statement: 'Valid',
      testdata: 'Missing test files',
      scoring: 'Valid',
      checker: 'Valid',
      grader: 'Grader script not found',
      attachments: 'Valid',
      subtasks: 'Valid'
    }
  }

  beforeEach(async () => {
    vi.clearAllMocks()

    // Set up mock implementations
    const dynamoModule = await import('../dynamodb-client.server')
    const typesModule = await import('~/types/database')
    const lambdaModule = await import('@aws-sdk/client-lambda')

    mockDocClient = vi.mocked(dynamoModule.docClient)
    mockGetMaxScore = vi.mocked(typesModule.getMaxScore)
    mockInvokeCommand = vi.mocked(lambdaModule.InvokeCommand)

    // Reset Lambda client mock for each test
    const MockLambdaClient = vi.mocked(lambdaModule.LambdaClient)
    MockLambdaClient.prototype.send = vi.fn()

    // Default implementations
    mockDocClient.send.mockResolvedValue({ Items: [] })
    mockGetMaxScore.mockImplementation((subtaskScores: number[]) =>
      subtaskScores.reduce((sum, score) => sum + score, 0)
    )

    // Set up environment variables
    process.env.AWS_REGION = 'ap-southeast-1'
    process.env.AWS_ACCOUNT_ID = '123456789012'
    process.env.JUDGE_NAME = 'testjudge'
  })

  afterEach(() => {
    vi.resetModules()
    delete process.env.AWS_REGION
    delete process.env.AWS_ACCOUNT_ID
    delete process.env.JUDGE_NAME
  })

  describe('Basic CRUD operations', () => {
    describe('listProblems', () => {
      it('returns all problems from database', async () => {
        const mockProblems = [mockProblem, mockInvalidProblem]
        mockDocClient.send.mockResolvedValue({ Items: mockProblems })

        const result = await listProblems()

        expect(result).toEqual(mockProblems)
        expect(mockDocClient.send).toHaveBeenCalledWith(
          expect.objectContaining({
            TableName: 'test-problems'
          })
        )
      })

      it('returns empty array when no problems exist', async () => {
        mockDocClient.send.mockResolvedValue({ Items: [] })

        const result = await listProblems()

        expect(result).toEqual([])
      })

      it('handles undefined Items in response', async () => {
        mockDocClient.send.mockResolvedValue({})

        const result = await listProblems()

        expect(result).toEqual([])
      })
    })

    describe('listValidatedProblems', () => {
      it('returns only validated problems', async () => {
        const mockProblems = [mockProblem, mockInvalidProblem]
        mockDocClient.send.mockResolvedValue({ Items: mockProblems })

        const result = await listValidatedProblems()

        expect(result).toEqual([mockProblem]) // Only the validated one
      })

      it('returns empty array when no validated problems exist', async () => {
        mockDocClient.send.mockResolvedValue({ Items: [mockInvalidProblem] })

        const result = await listValidatedProblems()

        expect(result).toEqual([])
      })
    })

    describe('getProblem', () => {
      it('returns problem when found', async () => {
        mockDocClient.send.mockResolvedValue({ Item: mockProblem })

        const result = await getProblem('test-problem')

        expect(result).toEqual(mockProblem)
        expect(mockDocClient.send).toHaveBeenCalledWith(
          expect.objectContaining({
            TableName: 'test-problems',
            Key: { problemName: 'test-problem' }
          })
        )
      })

      it('returns null when problem not found', async () => {
        mockDocClient.send.mockResolvedValue({})

        const result = await getProblem('nonexistent')

        expect(result).toBe(null)
      })
    })

    describe('createProblem', () => {
      it('creates problem with default values', async () => {
        mockDocClient.send.mockResolvedValue({})

        const result = await createProblem('new-problem')

        expect(result).toEqual({
          problemName: 'new-problem',
          title: 'new-problem',
          validated: false,
          subtaskScores: [100],
          subtaskDependency: [],
          maxScore: 100,
          timeLimit: 1000,
          memoryLimit: 256,
          checker: 'standard',
          verdicts: expect.any(Object),
          remarks: expect.any(Object)
        })
        expect(mockDocClient.send).toHaveBeenCalledWith(
          expect.objectContaining({
            TableName: 'test-problems',
            Item: expect.objectContaining({
              problemName: 'new-problem'
            }),
            ConditionExpression: 'attribute_not_exists(problemName)'
          })
        )
      })

      it('creates problem with provided data', async () => {
        const customData = {
          title: 'Custom Problem Title',
          subtaskScores: [40, 60],
          timeLimit: 2000
        }
        mockDocClient.send.mockResolvedValue({})

        const result = await createProblem('custom-problem', customData)

        expect(result.title).toBe('Custom Problem Title')
        expect(result.subtaskScores).toEqual([40, 60])
        expect(result.timeLimit).toBe(2000)
        expect(result.problemName).toBe('custom-problem')
      })
    })

    describe('updateProblem', () => {
      it('updates problem fields correctly', async () => {
        const updates = { title: 'Updated Title', validated: true }
        const updatedProblem = { ...mockProblem, ...updates }
        mockDocClient.send.mockResolvedValue({ Attributes: updatedProblem })

        const result = await updateProblem('test-problem', updates)

        expect(result).toEqual(updatedProblem)
        expect(mockDocClient.send).toHaveBeenCalledWith(
          expect.objectContaining({
            TableName: 'test-problems',
            Key: { problemName: 'test-problem' },
            UpdateExpression: expect.stringContaining('SET'),
            ReturnValues: 'ALL_NEW'
          })
        )
      })

      it('handles empty updates by returning current problem', async () => {
        mockDocClient.send.mockResolvedValueOnce({ Item: mockProblem }) // getProblem call

        const result = await updateProblem('test-problem', {})

        expect(result).toEqual(mockProblem)
        expect(mockDocClient.send).toHaveBeenCalledTimes(1) // Only getProblem, no update
      })

      it('skips undefined values in updates', async () => {
        const updates = { title: 'New Title', validated: undefined }
        mockDocClient.send.mockResolvedValue({ Attributes: mockProblem })

        await updateProblem('test-problem', updates)

        expect(mockDocClient.send).toHaveBeenCalledWith(
          expect.objectContaining({
            UpdateExpression: expect.stringMatching(/SET #attr0 = :val0$/), // Only one field
            ExpressionAttributeNames: { '#attr0': 'title' },
            ExpressionAttributeValues: { ':val0': 'New Title' }
          })
        )
      })
    })

    describe('invalidateProblem', () => {
      it('marks problem as not validated', async () => {
        const invalidatedProblem = { ...mockProblem, validated: false }
        mockDocClient.send.mockResolvedValue({ Attributes: invalidatedProblem })

        const result = await invalidateProblem('test-problem')

        expect(result?.validated).toBe(false)
        expect(mockDocClient.send).toHaveBeenCalledWith(
          expect.objectContaining({
            UpdateExpression: expect.stringContaining('SET'),
            ExpressionAttributeValues: expect.objectContaining({
              ':val0': false
            })
          })
        )
      })
    })
  })

  describe('Contest-specific functions', () => {
    describe('getProblemsForContest', () => {
      it('returns problems in specified order', async () => {
        const problem1 = { ...mockProblem, problemName: 'problem1' }
        const problem2 = { ...mockProblem, problemName: 'problem2' }
        const problem3 = { ...mockProblem, problemName: 'problem3' }

        mockDocClient.send
          .mockResolvedValueOnce({ Item: problem2 }) // problem2
          .mockResolvedValueOnce({ Item: problem1 }) // problem1
          .mockResolvedValueOnce({ Item: problem3 }) // problem3

        const result = await getProblemsForContest(['problem2', 'problem1', 'problem3'])

        expect(result).toEqual([problem2, problem1, problem3])
        expect(result[0].problemName).toBe('problem2')
        expect(result[1].problemName).toBe('problem1')
        expect(result[2].problemName).toBe('problem3')
      })

      it('handles missing problems gracefully', async () => {
        const problem1 = { ...mockProblem, problemName: 'problem1' }

        mockDocClient.send
          .mockResolvedValueOnce({ Item: problem1 }) // problem1 found
          .mockResolvedValueOnce({}) // problem2 not found
          .mockResolvedValueOnce({ Item: null }) // problem3 null

        const result = await getProblemsForContest(['problem1', 'problem2', 'problem3'])

        expect(result).toEqual([problem1]) // Only found problems
      })

      it('returns empty array for empty input', async () => {
        const result = await getProblemsForContest([])

        expect(result).toEqual([])
        expect(mockDocClient.send).not.toHaveBeenCalled()
      })

      it('maintains order even with missing problems', async () => {
        const problem1 = { ...mockProblem, problemName: 'problem1' }
        const problem3 = { ...mockProblem, problemName: 'problem3' }

        mockDocClient.send
          .mockResolvedValueOnce({ Item: problem1 }) // problem1 found
          .mockResolvedValueOnce({}) // problem2 not found
          .mockResolvedValueOnce({ Item: problem3 }) // problem3 found

        const result = await getProblemsForContest(['problem1', 'problem2', 'problem3'])

        expect(result).toEqual([problem1, problem3])
        expect(result[0].problemName).toBe('problem1')
        expect(result[1].problemName).toBe('problem3')
      })
    })

    describe('updateSubtasks', () => {
      it('updates subtask configuration', async () => {
        const newSubtaskScores = [25, 25, 50]
        const newSubtaskDependency = ['1', '1,2', '']
        const updatedProblem = {
          ...mockProblem,
          subtaskScores: newSubtaskScores,
          subtaskDependency: newSubtaskDependency
        }

        mockDocClient.send.mockResolvedValue({ Attributes: updatedProblem })

        const result = await updateSubtasks('test-problem', newSubtaskScores, newSubtaskDependency)

        expect(result?.subtaskScores).toEqual(newSubtaskScores)
        expect(result?.subtaskDependency).toEqual(newSubtaskDependency)
        expect(mockDocClient.send).toHaveBeenCalledWith(
          expect.objectContaining({
            ExpressionAttributeValues: expect.objectContaining({
              ':val0': newSubtaskScores,
              ':val1': newSubtaskDependency
            })
          })
        )
      })
    })
  })

  describe('Problem validation', () => {
    describe('validateAndUpdateProblem', () => {
      it.skip('invokes Lambda and processes validation result', async () => {
        const mockLambdaResult = {
          verdicts: {
            statement: 1,
            testdata: 1,
            scoring: 1,
            checker: 1,
            grader: 1,
            attachments: 1,
            subtasks: 1
          },
          remarks: {
            statement: 'Valid',
            testdata: 'Valid',
            scoring: 'Valid',
            checker: 'Valid',
            grader: 'Valid',
            attachments: 'Valid',
            subtasks: 'Valid'
          }
        }

        const mockPayload = new TextEncoder().encode(JSON.stringify(mockLambdaResult))

        const lambdaModuleInstance = await import('@aws-sdk/client-lambda')
        const MockLambdaClientInstance = vi.mocked(lambdaModuleInstance.LambdaClient)
        MockLambdaClientInstance.prototype.send = vi.fn().mockResolvedValue({ Payload: mockPayload })

        const result = await validateAndUpdateProblem('test-problem')

        expect(result).toEqual({
          validated: true, // All verdicts are 1
          verdicts: mockLambdaResult.verdicts,
          remarks: mockLambdaResult.remarks
        })

        expect(mockInvokeCommand).toHaveBeenCalledWith({
          FunctionName: 'arn:aws:lambda:ap-southeast-1:123456789012:function:testjudge-problem-validation',
          InvocationType: 'RequestResponse',
          Payload: JSON.stringify({ problemName: 'test-problem' })
        })
      })

      it.skip('handles validation failures', async () => {
        const mockLambdaResult = {
          verdicts: {
            statement: 1,
            testdata: 0, // Failed
            scoring: 1,
            checker: 1,
            grader: 0, // Failed
            attachments: 1,
            subtasks: 1
          },
          remarks: {
            statement: 'Valid',
            testdata: 'Missing test files',
            scoring: 'Valid',
            checker: 'Valid',
            grader: 'Grader script not found',
            attachments: 'Valid',
            subtasks: 'Valid'
          }
        }

        const mockPayload = new TextEncoder().encode(JSON.stringify(mockLambdaResult))

        const lambdaModuleInstance = await import('@aws-sdk/client-lambda')
        const MockLambdaClientInstance = vi.mocked(lambdaModuleInstance.LambdaClient)
        MockLambdaClientInstance.prototype.send = vi.fn().mockResolvedValue({ Payload: mockPayload })

        const result = await validateAndUpdateProblem('test-problem')

        expect(result.validated).toBe(false) // Some verdicts are 0
        expect(result.verdicts.testdata).toBe(0)
        expect(result.verdicts.grader).toBe(0)
        expect(result.remarks.testdata).toBe('Missing test files')
        expect(result.remarks.grader).toBe('Grader script not found')
      })

      it.skip('uses default environment variables', async () => {
        delete process.env.AWS_REGION
        delete process.env.AWS_ACCOUNT_ID
        delete process.env.JUDGE_NAME

        const mockPayload = new TextEncoder().encode(JSON.stringify({
          verdicts: {}, remarks: {}
        }))

        const lambdaModuleInstance = await import('@aws-sdk/client-lambda')
        const MockLambdaClientInstance = vi.mocked(lambdaModuleInstance.LambdaClient)
        MockLambdaClientInstance.prototype.send = vi.fn().mockResolvedValue({ Payload: mockPayload })

        await validateAndUpdateProblem('test-problem')

        expect(mockInvokeCommand).toHaveBeenCalledWith({
          FunctionName: 'arn:aws:lambda:ap-southeast-1::function:codebreakercontest01-problem-validation',
          InvocationType: 'RequestResponse',
          Payload: JSON.stringify({ problemName: 'test-problem' })
        })
      })
    })

    describe('getValidationStatus', () => {
      it('returns validation status from problem record', async () => {
        mockDocClient.send.mockResolvedValue({ Item: mockProblem })

        const result = await getValidationStatus('test-problem')

        expect(result).toEqual({
          validated: true,
          verdicts: mockProblem.verdicts,
          remarks: mockProblem.remarks
        })
      })

      it('computes validation status from verdicts', async () => {
        mockDocClient.send.mockResolvedValue({ Item: mockInvalidProblem })

        const result = await getValidationStatus('invalid-problem')

        expect(result?.validated).toBe(false) // Computed from verdicts, not database field
      })

      it('returns null when problem not found', async () => {
        mockDocClient.send.mockResolvedValue({})

        const result = await getValidationStatus('nonexistent')

        expect(result).toBe(null)
      })

      it('handles missing verdicts and remarks', async () => {
        const problemWithoutValidation = {
          ...mockProblem,
          verdicts: undefined,
          remarks: undefined
        }
        mockDocClient.send.mockResolvedValue({ Item: problemWithoutValidation })

        const result = await getValidationStatus('test-problem')

        expect(result?.verdicts).toEqual({
          statement: 0,
          testdata: 0,
          scoring: 0,
          checker: 0,
          grader: 0,
          attachments: 0,
          subtasks: 0
        })
        expect(result?.remarks).toEqual({
          statement: 'Not validated',
          testdata: 'Not validated',
          scoring: 'Not validated',
          checker: 'Not validated',
          grader: 'Not validated',
          attachments: 'Not validated',
          subtasks: 'Not validated'
        })
        expect(result?.validated).toBe(false)
      })

      it('correctly validates when all verdicts are 1', async () => {
        const fullyValidatedProblem = {
          ...mockProblem,
          verdicts: {
            statement: 1,
            testdata: 1,
            scoring: 1,
            checker: 1,
            grader: 1,
            attachments: 1,
            subtasks: 1
          }
        }
        mockDocClient.send.mockResolvedValue({ Item: fullyValidatedProblem })

        const result = await getValidationStatus('test-problem')

        expect(result?.validated).toBe(true)
      })

      it('rejects validation when any verdict is not 1', async () => {
        const partiallyValidatedProblem = {
          ...mockProblem,
          verdicts: {
            statement: 1,
            testdata: 1,
            scoring: 1,
            checker: 1,
            grader: 1,
            attachments: 1,
            subtasks: 0 // This one fails
          }
        }
        mockDocClient.send.mockResolvedValue({ Item: partiallyValidatedProblem })

        const result = await getValidationStatus('test-problem')

        expect(result?.validated).toBe(false)
      })
    })
  })

  describe('Utility functions', () => {
    describe('getMaxScore', () => {
      it('is re-exported from types/database', () => {
        expect(typeof getMaxScore).toBe('function')

        getMaxScore([30, 35, 35])

        expect(mockGetMaxScore).toHaveBeenCalledWith([30, 35, 35])
      })
    })
  })

  describe('Error handling', () => {
    it('handles DynamoDB errors in getProblem', async () => {
      mockDocClient.send.mockRejectedValue(new Error('DynamoDB error'))

      await expect(getProblem('test-problem')).rejects.toThrow('DynamoDB error')
    })

    it('handles DynamoDB errors in listProblems', async () => {
      mockDocClient.send.mockRejectedValue(new Error('Scan failed'))

      await expect(listProblems()).rejects.toThrow('Scan failed')
    })

    it('handles condition check failures in createProblem', async () => {
      mockDocClient.send.mockRejectedValue(new Error('ConditionalCheckFailedException'))

      await expect(createProblem('existing-problem'))
        .rejects.toThrow('ConditionalCheckFailedException')
    })

    it.skip('handles Lambda invocation errors', async () => {
      const lambdaModuleInstance = await import('@aws-sdk/client-lambda')
      const MockLambdaClientInstance = vi.mocked(lambdaModuleInstance.LambdaClient)
      MockLambdaClientInstance.prototype.send = vi.fn().mockRejectedValue(new Error('Lambda invocation failed'))

      await expect(validateAndUpdateProblem('test-problem'))
        .rejects.toThrow('Lambda invocation failed')
    })

    it.skip('handles malformed Lambda response', async () => {
      const invalidPayload = new TextEncoder().encode('invalid json')

      const lambdaModuleInstance = await import('@aws-sdk/client-lambda')
      const MockLambdaClientInstance = vi.mocked(lambdaModuleInstance.LambdaClient)
      MockLambdaClientInstance.prototype.send = vi.fn().mockResolvedValue({ Payload: invalidPayload })

      await expect(validateAndUpdateProblem('test-problem'))
        .rejects.toThrow()
    })
  })
})