import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import {
  listUsers,
  getUser,
  createUser,
  updateUser,
  deleteUser,
  getUserActiveContests,
  addUserToContest,
  removeUserFromContest,
  updateUserContestStatus,
  getUserContestScores,
  updateUserContestScore,
  canUserAccessContest
} from '../users.server'
import type { User, ContestParticipation } from '~/types/database'

// Mock dependencies
vi.mock('../dynamodb-client.server', () => ({
  docClient: {
    send: vi.fn()
  },
  TableNames: {
    users: 'test-users'
  },
  GetCommand: class MockGetCommand { constructor(input: any) { Object.assign(this, input) } },
  PutCommand: class MockPutCommand { constructor(input: any) { Object.assign(this, input) } },
  UpdateCommand: class MockUpdateCommand { constructor(input: any) { Object.assign(this, input) } },
  DeleteCommand: class MockDeleteCommand { constructor(input: any) { Object.assign(this, input) } },
  ScanCommand: class MockScanCommand { constructor(input: any) { Object.assign(this, input) } }
}))

vi.mock('~/types/database', async (importOriginal) => {
  const actual = await importOriginal<typeof import('~/types/database')>()
  return {
    ...actual,
    DEFAULT_USER: {
      username: '',
      role: 'member',
      fullname: '',
      activeContests: {},
      contestScores: {},
      contestSubmissions: {},
      contestLatestSubmissions: {}
    },
    formatDateTime: vi.fn()
  }
})

describe('users.server', () => {
  // Mock implementations
  let mockDocClient: any
  let mockFormatDateTime: any

  // Test data
  const mockUser: User = {
    username: 'testuser',
    role: 'member',
    fullname: 'Test User',
    activeContests: {
      'contest-1': {
        status: 'started',
        joinedAt: '2025-01-01 10:00:00',
        startedAt: '2025-01-01 10:30:00'
      }
    },
    contestScores: {
      'contest-1': {
        'problem1': 85,
        'problem2': 95
      }
    },
    contestSubmissions: {
      'contest-1': {
        'problem1': 3,
        'problem2': 1
      }
    },
    contestLatestSubmissions: {
      'contest-1': {
        'problem1': '2025-01-01 11:30:00',
        'problem2': '2025-01-01 12:00:00'
      }
    }
  }

  const mockAdminUser: User = {
    ...mockUser,
    username: 'admin',
    role: 'admin',
    fullname: 'Admin User'
  }

  beforeEach(async () => {
    vi.clearAllMocks()

    // Set up mock implementations
    const dynamoModule = await import('../dynamodb-client.server')
    const typesModule = await import('~/types/database')

    mockDocClient = vi.mocked(dynamoModule.docClient)
    mockFormatDateTime = vi.mocked(typesModule.formatDateTime)

    // Default implementations
    mockDocClient.send.mockResolvedValue({ Items: [] })
    mockFormatDateTime.mockImplementation((date: Date) => {
      return date.toISOString().replace('T', ' ').replace('Z', '').slice(0, 19)
    })

    vi.useFakeTimers()
    vi.setSystemTime(new Date('2025-01-01T12:00:00Z'))
  })

  afterEach(() => {
    vi.useRealTimers()
    vi.resetModules()
  })

  describe('Basic CRUD operations', () => {
    describe('listUsers', () => {
      it('returns all users from database', async () => {
        const mockUsers = [mockUser, mockAdminUser]
        mockDocClient.send.mockResolvedValue({ Items: mockUsers })

        const result = await listUsers()

        expect(result).toEqual(mockUsers)
        expect(mockDocClient.send).toHaveBeenCalledWith(
          expect.objectContaining({
            TableName: 'test-users'
          })
        )
      })

      it('returns empty array when no users exist', async () => {
        mockDocClient.send.mockResolvedValue({ Items: [] })

        const result = await listUsers()

        expect(result).toEqual([])
      })

      it('handles undefined Items in response', async () => {
        mockDocClient.send.mockResolvedValue({})

        const result = await listUsers()

        expect(result).toEqual([])
      })
    })

    describe('getUser', () => {
      it('returns user when found', async () => {
        mockDocClient.send.mockResolvedValue({ Item: mockUser })

        const result = await getUser('testuser')

        expect(result).toEqual(mockUser)
        expect(mockDocClient.send).toHaveBeenCalledWith(
          expect.objectContaining({
            TableName: 'test-users',
            Key: { username: 'testuser' }
          })
        )
      })

      it('returns null when user not found', async () => {
        mockDocClient.send.mockResolvedValue({})

        const result = await getUser('nonexistent')

        expect(result).toBe(null)
      })
    })

    describe('createUser', () => {
      it('creates user with default values', async () => {
        mockDocClient.send.mockResolvedValue({})

        const result = await createUser('newuser', 'member')

        expect(result).toEqual({
          username: 'newuser',
          role: 'member',
          fullname: 'newuser',
          activeContests: {},
          contestScores: {},
          contestSubmissions: {},
          contestLatestSubmissions: {}
        })
        expect(mockDocClient.send).toHaveBeenCalledWith(
          expect.objectContaining({
            TableName: 'test-users',
            Item: expect.objectContaining({
              username: 'newuser',
              role: 'member'
            }),
            ConditionExpression: 'attribute_not_exists(username)'
          })
        )
      })

      it('creates user with provided data', async () => {
        const customData = {
          fullname: 'Custom User Name'
        }
        mockDocClient.send.mockResolvedValue({})

        const result = await createUser('customuser', 'admin', customData)

        expect(result.fullname).toBe('Custom User Name')
        expect(result.role).toBe('admin')
        expect(result.username).toBe('customuser')
      })

      it('creates admin user correctly', async () => {
        mockDocClient.send.mockResolvedValue({})

        const result = await createUser('admin', 'admin', { fullname: 'Administrator' })

        expect(result.role).toBe('admin')
        expect(result.fullname).toBe('Administrator')
      })
    })

    describe('updateUser', () => {
      it('updates user fields correctly', async () => {
        const updates = { fullname: 'Updated Name', role: 'admin' as const }
        const updatedUser = { ...mockUser, ...updates }
        mockDocClient.send.mockResolvedValue({ Attributes: updatedUser })

        const result = await updateUser('testuser', updates)

        expect(result).toEqual(updatedUser)
        expect(mockDocClient.send).toHaveBeenCalledWith(
          expect.objectContaining({
            TableName: 'test-users',
            Key: { username: 'testuser' },
            UpdateExpression: expect.stringContaining('SET'),
            ReturnValues: 'ALL_NEW'
          })
        )
      })

      it('handles empty updates by returning current user', async () => {
        mockDocClient.send
          .mockResolvedValueOnce({ Item: mockUser }) // getUser call

        const result = await updateUser('testuser', {})

        expect(result).toEqual(mockUser)
        expect(mockDocClient.send).toHaveBeenCalledTimes(1) // Only getUser, no update
      })

      it('skips undefined values in updates', async () => {
        const updates = { fullname: 'New Name', role: undefined }
        mockDocClient.send.mockResolvedValue({ Attributes: mockUser })

        await updateUser('testuser', updates)

        expect(mockDocClient.send).toHaveBeenCalledWith(
          expect.objectContaining({
            UpdateExpression: expect.stringMatching(/SET #attr0 = :val0$/), // Only one field
            ExpressionAttributeNames: { '#attr0': 'fullname' },
            ExpressionAttributeValues: { ':val0': 'New Name' }
          })
        )
      })
    })

    describe('deleteUser', () => {
      it('deletes user and returns true', async () => {
        mockDocClient.send.mockResolvedValue({})

        const result = await deleteUser('testuser')

        expect(result).toBe(true)
        expect(mockDocClient.send).toHaveBeenCalledWith(
          expect.objectContaining({
            TableName: 'test-users',
            Key: { username: 'testuser' }
          })
        )
      })
    })
  })

  describe('Multi-contest functions', () => {
    describe('getUserActiveContests', () => {
      it('returns user active contests', async () => {
        mockDocClient.send.mockResolvedValue({ Item: mockUser })

        const result = await getUserActiveContests('testuser')

        expect(result).toEqual(mockUser.activeContests)
      })

      it('returns empty object when user not found', async () => {
        mockDocClient.send.mockResolvedValue({})

        const result = await getUserActiveContests('nonexistent')

        expect(result).toEqual({})
      })
    })

    describe('addUserToContest', () => {
      it('adds user to contest with invited status', async () => {
        mockDocClient.send
          .mockResolvedValueOnce({ Item: mockUser }) // getUser call
          .mockResolvedValueOnce({ Attributes: {} }) // updateUser call

        mockFormatDateTime.mockReturnValue('2025-01-01 12:00:00')

        await addUserToContest('testuser', 'contest-2', 'invited')

        expect(mockDocClient.send).toHaveBeenCalledWith(
          expect.objectContaining({
            UpdateExpression: expect.stringContaining('SET'),
            ExpressionAttributeValues: expect.objectContaining({
              ':val0': {
                ...mockUser.activeContests,
                'contest-2': {
                  status: 'invited',
                  joinedAt: '2025-01-01 12:00:00'
                }
              }
            })
          })
        )
      })

      it('adds user to contest with started status', async () => {
        mockDocClient.send
          .mockResolvedValueOnce({ Item: mockUser })
          .mockResolvedValueOnce({ Attributes: {} })

        mockFormatDateTime.mockReturnValue('2025-01-01 12:00:00')

        await addUserToContest('testuser', 'contest-2', 'started')

        expect(mockDocClient.send).toHaveBeenCalledWith(
          expect.objectContaining({
            ExpressionAttributeValues: expect.objectContaining({
              ':val0': {
                ...mockUser.activeContests,
                'contest-2': {
                  status: 'started',
                  joinedAt: '2025-01-01 12:00:00',
                  startedAt: '2025-01-01 12:00:00'
                }
              }
            })
          })
        )
      })

      it('throws error when user not found', async () => {
        mockDocClient.send.mockResolvedValue({})

        await expect(addUserToContest('nonexistent', 'contest-1'))
          .rejects.toThrow('User nonexistent not found')
      })
    })

    describe('removeUserFromContest', () => {
      it('removes user from contest', async () => {
        mockDocClient.send
          .mockResolvedValueOnce({ Item: mockUser })
          .mockResolvedValueOnce({ Attributes: {} })

        await removeUserFromContest('testuser', 'contest-1')

        expect(mockDocClient.send).toHaveBeenCalledWith(
          expect.objectContaining({
            ExpressionAttributeValues: expect.objectContaining({
              ':val0': {} // contest-1 should be removed
            })
          })
        )
      })

      it('handles user not found gracefully', async () => {
        mockDocClient.send.mockResolvedValue({})

        await expect(removeUserFromContest('nonexistent', 'contest-1'))
          .resolves.not.toThrow()
      })
    })

    describe('updateUserContestStatus', () => {
      it('updates contest participation status', async () => {
        mockDocClient.send
          .mockResolvedValueOnce({ Item: mockUser })
          .mockResolvedValueOnce({ Attributes: {} })

        const updates = { status: 'completed' as const, finalScore: 180 }

        await updateUserContestStatus('testuser', 'contest-1', updates)

        expect(mockDocClient.send).toHaveBeenCalledWith(
          expect.objectContaining({
            ExpressionAttributeValues: expect.objectContaining({
              ':val0': {
                ...mockUser.activeContests,
                'contest-1': {
                  ...mockUser.activeContests['contest-1'],
                  ...updates
                }
              }
            })
          })
        )
      })

      it('throws error when user not in contest', async () => {
        mockDocClient.send.mockResolvedValue({ Item: mockUser })

        await expect(updateUserContestStatus('testuser', 'nonexistent-contest', {}))
          .rejects.toThrow('User testuser is not in contest nonexistent-contest')
      })

      it('throws error when user not found', async () => {
        mockDocClient.send.mockResolvedValue({})

        await expect(updateUserContestStatus('nonexistent', 'contest-1', {}))
          .rejects.toThrow('User nonexistent is not in contest contest-1')
      })
    })
  })

  describe('Contest scoring', () => {
    describe('getUserContestScores', () => {
      it('returns contest scores for user', async () => {
        mockDocClient.send.mockResolvedValue({ Item: mockUser })

        const result = await getUserContestScores('testuser', 'contest-1')

        expect(result).toEqual({
          'problem1': 85,
          'problem2': 95
        })
      })

      it('returns empty object when user not found', async () => {
        mockDocClient.send.mockResolvedValue({})

        const result = await getUserContestScores('nonexistent', 'contest-1')

        expect(result).toEqual({})
      })

      it('returns empty object when contest not found', async () => {
        mockDocClient.send.mockResolvedValue({ Item: mockUser })

        const result = await getUserContestScores('testuser', 'nonexistent-contest')

        expect(result).toEqual({})
      })
    })

    describe('updateUserContestScore', () => {
      it('updates score when new score is higher', async () => {
        mockDocClient.send
          .mockResolvedValueOnce({ Item: mockUser })
          .mockResolvedValueOnce({ Attributes: {} })

        await updateUserContestScore('testuser', 'contest-1', 'problem1', 90, '2025-01-01 13:00:00')

        expect(mockDocClient.send).toHaveBeenCalledWith(
          expect.objectContaining({
            ExpressionAttributeValues: expect.objectContaining({
              ':val0': {
                ...mockUser.contestSubmissions,
                'contest-1': {
                  ...mockUser.contestSubmissions['contest-1'],
                  'problem1': 4 // 3 + 1
                }
              },
              ':val1': {
                ...mockUser.contestLatestSubmissions,
                'contest-1': {
                  ...mockUser.contestLatestSubmissions['contest-1'],
                  'problem1': '2025-01-01 13:00:00'
                }
              },
              ':val2': {
                ...mockUser.contestScores,
                'contest-1': {
                  ...mockUser.contestScores['contest-1'],
                  'problem1': 90 // Updated from 85 to 90
                }
              }
            })
          })
        )
      })

      it('does not update score when new score is lower', async () => {
        mockDocClient.send
          .mockResolvedValueOnce({ Item: mockUser })
          .mockResolvedValueOnce({ Attributes: {} })

        await updateUserContestScore('testuser', 'contest-1', 'problem1', 80, '2025-01-01 13:00:00')

        // Should update submissions and latest submission but not score
        expect(mockDocClient.send).toHaveBeenCalledWith(
          expect.objectContaining({
            ExpressionAttributeValues: expect.not.objectContaining({
              ':val2': expect.anything() // No score update
            })
          })
        )
      })

      it('updates final score for completed contests', async () => {
        const completedContestUser = {
          ...mockUser,
          activeContests: {
            'contest-1': {
              status: 'completed',
              joinedAt: '2025-01-01 10:00:00',
              startedAt: '2025-01-01 10:30:00',
              finalScore: 180
            }
          }
        }

        mockDocClient.send
          .mockResolvedValueOnce({ Item: completedContestUser })
          .mockResolvedValueOnce({ Attributes: {} })

        await updateUserContestScore('testuser', 'contest-1', 'problem1', 90, '2025-01-01 13:00:00')

        expect(mockDocClient.send).toHaveBeenCalledWith(
          expect.objectContaining({
            ExpressionAttributeValues: expect.objectContaining({
              ':val3': {
                ...completedContestUser.activeContests,
                'contest-1': {
                  ...completedContestUser.activeContests['contest-1'],
                  finalScore: 185 // 90 + 95 = 185
                }
              }
            })
          })
        )
      })

      it('handles new problem scores correctly', async () => {
        mockDocClient.send
          .mockResolvedValueOnce({ Item: mockUser })
          .mockResolvedValueOnce({ Attributes: {} })

        await updateUserContestScore('testuser', 'contest-1', 'problem3', 75, '2025-01-01 13:00:00')

        expect(mockDocClient.send).toHaveBeenCalledWith(
          expect.objectContaining({
            ExpressionAttributeValues: expect.objectContaining({
              ':val0': {
                ...mockUser.contestSubmissions,
                'contest-1': {
                  ...mockUser.contestSubmissions['contest-1'],
                  'problem3': 1 // 0 + 1 (new problem)
                }
              },
              ':val2': {
                ...mockUser.contestScores,
                'contest-1': {
                  ...mockUser.contestScores['contest-1'],
                  'problem3': 75 // New problem score
                }
              }
            })
          })
        )
      })

      it('handles user not found gracefully', async () => {
        mockDocClient.send.mockResolvedValue({})

        await expect(updateUserContestScore('nonexistent', 'contest-1', 'problem1', 90, '2025-01-01 13:00:00'))
          .resolves.not.toThrow()
      })

      it('handles new contest correctly', async () => {
        const userWithNoContest = {
          ...mockUser,
          contestScores: {},
          contestSubmissions: {},
          contestLatestSubmissions: {}
        }

        mockDocClient.send
          .mockResolvedValueOnce({ Item: userWithNoContest })
          .mockResolvedValueOnce({ Attributes: {} })

        await updateUserContestScore('testuser', 'new-contest', 'problem1', 85, '2025-01-01 13:00:00')

        expect(mockDocClient.send).toHaveBeenCalledWith(
          expect.objectContaining({
            ExpressionAttributeValues: expect.objectContaining({
              ':val0': {
                'new-contest': {
                  'problem1': 1
                }
              },
              ':val2': {
                'new-contest': {
                  'problem1': 85
                }
              }
            })
          })
        )
      })
    })

    describe('canUserAccessContest', () => {
      it('returns true when user is in contest', async () => {
        mockDocClient.send.mockResolvedValue({ Item: mockUser })

        const result = await canUserAccessContest('testuser', 'contest-1')

        expect(result).toBe(true)
      })

      it('returns false when user is not in contest', async () => {
        mockDocClient.send.mockResolvedValue({ Item: mockUser })

        const result = await canUserAccessContest('testuser', 'contest-999')

        expect(result).toBe(false)
      })

      it('returns false when user not found', async () => {
        mockDocClient.send.mockResolvedValue({})

        const result = await canUserAccessContest('nonexistent', 'contest-1')

        expect(result).toBe(false)
      })
    })
  })

  describe('Error handling', () => {
    it('handles DynamoDB errors in getUser', async () => {
      mockDocClient.send.mockRejectedValue(new Error('DynamoDB error'))

      await expect(getUser('testuser')).rejects.toThrow('DynamoDB error')
    })

    it('handles DynamoDB errors in listUsers', async () => {
      mockDocClient.send.mockRejectedValue(new Error('Scan failed'))

      await expect(listUsers()).rejects.toThrow('Scan failed')
    })

    it('handles condition check failures in createUser', async () => {
      mockDocClient.send.mockRejectedValue(new Error('ConditionalCheckFailedException'))

      await expect(createUser('existing', 'member'))
        .rejects.toThrow('ConditionalCheckFailedException')
    })
  })
})