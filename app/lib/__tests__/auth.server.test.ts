import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { redirect } from 'react-router'
import {
  login,
  logout,
  requireAuth,
  requireAdmin,
  getCurrentUser,
  requireContestAccess,
  getUserWithContestContext
} from '../auth.server'
import type { SessionData } from '../auth.server'

// Mock dependencies
vi.mock('react-router', () => ({
  redirect: vi.fn()
}))

vi.mock('../session.server', () => ({
  getSession: vi.fn(),
  createSession: vi.fn(),
  destroySession: vi.fn()
}))

vi.mock('../cognito.server', () => ({
  authenticate: vi.fn(),
  getUserRole: vi.fn(),
  parseIdToken: vi.fn()
}))

vi.mock('../contest.server', () => ({
  canUserAccessContest: vi.fn(),
  getContest: vi.fn()
}))

// Note: crypto.randomBytes is used for session ID generation but we test the format rather than exact value

describe('auth.server', () => {
  // Mock implementations - will be set in beforeEach
  let mockGetSession: any
  let mockCreateSession: any
  let mockDestroySession: any
  let mockAuthenticate: any
  let mockGetUserRole: any
  let mockParseIdToken: any
  let mockCanUserAccessContest: any
  let mockGetContest: any
  let mockRedirect: any

  // Test data
  const mockRequest = new Request('https://example.com')
  const mockSession: SessionData = {
    sessionId: 'session-123',
    userId: 'testuser',
    username: 'testuser',
    role: 'member',
    expiresAt: Date.now() + 6 * 60 * 60 * 1000
  }
  const mockAdminSession: SessionData = {
    ...mockSession,
    username: 'admin',
    role: 'admin'
  }

  beforeEach(async () => {
    vi.clearAllMocks()

    // Set up mock implementations
    const sessionModule = await import('../session.server')
    const cognitoModule = await import('../cognito.server')
    const contestModule = await import('../contest.server')

    mockGetSession = vi.mocked(sessionModule.getSession)
    mockCreateSession = vi.mocked(sessionModule.createSession)
    mockDestroySession = vi.mocked(sessionModule.destroySession)
    mockAuthenticate = vi.mocked(cognitoModule.authenticate)
    mockGetUserRole = vi.mocked(cognitoModule.getUserRole)
    mockParseIdToken = vi.mocked(cognitoModule.parseIdToken)
    mockCanUserAccessContest = vi.mocked(contestModule.canUserAccessContest)
    mockGetContest = vi.mocked(contestModule.getContest)
    mockRedirect = vi.mocked(redirect)

    // Reset Date.now to a fixed value for consistent testing
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2025-01-01T12:00:00Z'))
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  describe('login', () => {
    const mockAuthResult = {
      idToken: 'mock-id-token'
    }
    const mockTokenInfo = {
      username: 'testuser'
    }

    beforeEach(() => {
      mockAuthenticate.mockResolvedValue(mockAuthResult)
      mockParseIdToken.mockReturnValue(mockTokenInfo)
      mockGetUserRole.mockResolvedValue('member')
      mockCreateSession.mockResolvedValue('cookie-string')
    })

    it('creates session with 6 hour duration by default', async () => {
      const result = await login('testuser', 'password')

      expect(mockAuthenticate).toHaveBeenCalledWith('testuser', 'password')
      expect(mockParseIdToken).toHaveBeenCalledWith('mock-id-token')
      expect(mockGetUserRole).toHaveBeenCalledWith('testuser')

      expect(result.session).toMatchObject({
        userId: 'testuser',
        username: 'testuser',
        role: 'member',
        expiresAt: Date.now() + 6 * 60 * 60 * 1000 // 6 hours
      })
      expect(result.session.sessionId).toMatch(/^[a-f0-9]{64}$/) // 32 bytes hex = 64 chars

      expect(mockCreateSession).toHaveBeenCalledWith(
        result.session,
        6 * 60 * 60 // 6 hours in seconds
      )
    })

    it('creates session with 7 day duration when rememberMe is true', async () => {
      const result = await login('testuser', 'password', true)

      expect(result.session.expiresAt).toBe(Date.now() + 7 * 24 * 60 * 60 * 1000) // 7 days
      expect(mockCreateSession).toHaveBeenCalledWith(
        result.session,
        7 * 24 * 60 * 60 // 7 days in seconds
      )
    })

    it('generates unique session ID', async () => {
      const result1 = await login('testuser', 'password')
      const result2 = await login('testuser', 'password')

      expect(result1.session.sessionId).toMatch(/^[a-f0-9]{64}$/) // 32 bytes hex = 64 chars
      expect(result2.session.sessionId).toMatch(/^[a-f0-9]{64}$/)
      expect(result1.session.sessionId).not.toBe(result2.session.sessionId) // Should be unique
    })

    it('returns admin role when user is admin', async () => {
      mockGetUserRole.mockResolvedValue('admin')

      const result = await login('admin', 'password')

      expect(result.session.role).toBe('admin')
    })
  })

  describe('logout', () => {
    it('destroys session and returns cookie string', async () => {
      mockDestroySession.mockResolvedValue('destroyed-cookie')

      const result = await logout()

      expect(mockDestroySession).toHaveBeenCalled()
      expect(result).toBe('destroyed-cookie')
    })
  })

  describe('requireAuth', () => {
    it('returns session when user is authenticated', async () => {
      mockGetSession.mockResolvedValue(mockSession)

      const result = await requireAuth(mockRequest)

      expect(result).toEqual(mockSession)
      expect(mockRedirect).not.toHaveBeenCalled()
    })

    it('redirects to login when user is not authenticated', async () => {
      mockGetSession.mockResolvedValue(null)
      mockRedirect.mockImplementation((url) => { throw new Error(`Redirect to ${url}`) })

      await expect(requireAuth(mockRequest)).rejects.toThrow('Redirect to /login')
      expect(mockRedirect).toHaveBeenCalledWith('/login')
    })
  })

  describe('requireAdmin', () => {
    it('returns session when user is admin', async () => {
      mockGetSession.mockResolvedValue(mockAdminSession)

      const result = await requireAdmin(mockRequest)

      expect(result).toEqual(mockAdminSession)
    })

    it('returns 403 when user is not admin', async () => {
      mockGetSession.mockResolvedValue(mockSession)

      try {
        await requireAdmin(mockRequest)
        expect.fail('Should have thrown a Response')
      } catch (error) {
        expect(error).toBeInstanceOf(Response)
        expect(error.status).toBe(403)
        expect(await error.text()).toBe('Forbidden')
      }
    })

    it('redirects to login when user is not authenticated', async () => {
      mockGetSession.mockResolvedValue(null)
      mockRedirect.mockImplementation((url) => { throw new Error(`Redirect to ${url}`) })

      await expect(requireAdmin(mockRequest)).rejects.toThrow('Redirect to /login')
    })
  })

  describe('getCurrentUser', () => {
    it('returns session when user is authenticated', async () => {
      mockGetSession.mockResolvedValue(mockSession)

      const result = await getCurrentUser(mockRequest)

      expect(result).toEqual(mockSession)
    })

    it('returns null when user is not authenticated', async () => {
      mockGetSession.mockResolvedValue(null)

      const result = await getCurrentUser(mockRequest)

      expect(result).toBe(null)
    })
  })

  describe('requireContestAccess', () => {
    const contestId = 'contest-123'

    it('allows admin access to any contest', async () => {
      mockGetSession.mockResolvedValue(mockAdminSession)

      const result = await requireContestAccess(mockRequest, contestId)

      expect(result).toEqual(mockAdminSession)
      expect(mockCanUserAccessContest).not.toHaveBeenCalled()
    })

    it('allows member access when they are in contest', async () => {
      mockGetSession.mockResolvedValue(mockSession)
      mockCanUserAccessContest.mockResolvedValue(true)

      const result = await requireContestAccess(mockRequest, contestId)

      expect(result).toEqual(mockSession)
      expect(mockCanUserAccessContest).toHaveBeenCalledWith('testuser', contestId)
    })

    it('returns 403 when member is not in contest', async () => {
      mockGetSession.mockResolvedValue(mockSession)
      mockCanUserAccessContest.mockResolvedValue(false)

      try {
        await requireContestAccess(mockRequest, contestId)
        expect.fail('Should have thrown a Response')
      } catch (error) {
        expect(error).toBeInstanceOf(Response)
        expect(error.status).toBe(403)
        expect(await error.text()).toBe('User testuser is not in contest contest-123')
      }
    })

    it('redirects to login when user is not authenticated', async () => {
      mockGetSession.mockResolvedValue(null)
      mockRedirect.mockImplementation((url) => { throw new Error(`Redirect to ${url}`) })

      await expect(requireContestAccess(mockRequest, contestId)).rejects.toThrow('Redirect to /login')
    })
  })

  describe('getUserWithContestContext', () => {
    const contestId = 'contest-123'
    const mockContest = { contestId, name: 'Test Contest' }

    beforeEach(() => {
      mockGetContest.mockResolvedValue(mockContest)
    })

    it('returns session and contest for admin', async () => {
      mockGetSession.mockResolvedValue(mockAdminSession)

      const result = await getUserWithContestContext(mockRequest, contestId)

      expect(result).toEqual({
        session: mockAdminSession,
        contest: mockContest
      })
      expect(mockGetContest).toHaveBeenCalledWith(contestId)
      expect(mockCanUserAccessContest).not.toHaveBeenCalled()
    })

    it('returns session and contest when member has access', async () => {
      mockGetSession.mockResolvedValue(mockSession)
      mockCanUserAccessContest.mockResolvedValue(true)

      const result = await getUserWithContestContext(mockRequest, contestId)

      expect(result).toEqual({
        session: mockSession,
        contest: mockContest
      })
      expect(mockCanUserAccessContest).toHaveBeenCalledWith('testuser', contestId)
    })

    it('returns session and null contest when member has no access', async () => {
      mockGetSession.mockResolvedValue(mockSession)
      mockCanUserAccessContest.mockResolvedValue(false)

      const result = await getUserWithContestContext(mockRequest, contestId)

      expect(result).toEqual({
        session: mockSession,
        contest: null
      })
    })
  })
})