import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import {
  getSession,
  createSession,
  destroySession,
  requireAuth,
  requireAdmin,
  sessionCookie,
  type SessionData
} from '../session.server'

// Mock react-router
vi.mock('react-router', () => ({
  createCookie: vi.fn(() => ({
    parse: vi.fn(),
    serialize: vi.fn()
  })),
  redirect: vi.fn()
}))

describe('session.server', () => {
  // Mock implementations
  let mockParse: any
  let mockSerialize: any
  let mockRedirect: any

  // Test data
  const mockSessionData: SessionData = {
    sessionId: 'session-123',
    userId: 'user-123',
    username: 'testuser',
    role: 'member',
    expiresAt: Date.now() + 6 * 60 * 60 * 1000 // 6 hours from now
  }

  const mockAdminSession: SessionData = {
    ...mockSessionData,
    username: 'admin',
    role: 'admin'
  }

  beforeEach(async () => {
    vi.clearAllMocks()

    // Set up mock implementations
    const reactRouterModule = await import('react-router')
    mockRedirect = vi.mocked(reactRouterModule.redirect)

    // Mock the cookie methods
    mockParse = vi.fn()
    mockSerialize = vi.fn()

    // Update the sessionCookie mock
    vi.mocked(sessionCookie).parse = mockParse
    vi.mocked(sessionCookie).serialize = mockSerialize

    // Set up fake timers
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2025-01-01T12:00:00Z'))
  })

  afterEach(() => {
    vi.useRealTimers()
    vi.resetModules()
  })

  describe('getSession', () => {
    it('returns session data when valid session exists', async () => {
      const mockRequest = new Request('https://example.com', {
        headers: { Cookie: 'session=valid' }
      })

      mockParse.mockResolvedValue(mockSessionData)

      const result = await getSession(mockRequest)

      expect(result).toEqual(mockSessionData)
      expect(mockParse).toHaveBeenCalledWith('session=valid')
    })

    it('returns null when no session cookie exists', async () => {
      const mockRequest = new Request('https://example.com')

      mockParse.mockResolvedValue(null)

      const result = await getSession(mockRequest)

      expect(result).toBe(null)
      expect(mockParse).toHaveBeenCalledWith(null)
    })

    it('returns null when session is expired', async () => {
      const expiredSession = {
        ...mockSessionData,
        expiresAt: Date.now() - 1000 // 1 second ago
      }

      const mockRequest = new Request('https://example.com', {
        headers: { Cookie: 'session=expired' }
      })

      mockParse.mockResolvedValue(expiredSession)

      const result = await getSession(mockRequest)

      expect(result).toBe(null)
    })

    it('handles session without expiresAt field', async () => {
      const sessionWithoutExpiry = { ...mockSessionData }
      delete sessionWithoutExpiry.expiresAt

      const mockRequest = new Request('https://example.com', {
        headers: { Cookie: 'session=no-expiry' }
      })

      mockParse.mockResolvedValue(sessionWithoutExpiry)

      const result = await getSession(mockRequest)

      expect(result).toEqual(sessionWithoutExpiry)
    })

    it('returns valid session exactly at expiration time', async () => {
      const sessionAtExpiry = {
        ...mockSessionData,
        expiresAt: Date.now() // Exactly now
      }

      const mockRequest = new Request('https://example.com', {
        headers: { Cookie: 'session=at-expiry' }
      })

      mockParse.mockResolvedValue(sessionAtExpiry)

      const result = await getSession(mockRequest)

      expect(result).toEqual(sessionAtExpiry)
    })

    it('returns null for session one millisecond past expiry', async () => {
      const expiredSession = {
        ...mockSessionData,
        expiresAt: Date.now() - 1 // 1ms ago
      }

      const mockRequest = new Request('https://example.com', {
        headers: { Cookie: 'session=just-expired' }
      })

      mockParse.mockResolvedValue(expiredSession)

      const result = await getSession(mockRequest)

      expect(result).toBe(null)
    })

    it('extracts cookie from request headers correctly', async () => {
      const mockRequest = new Request('https://example.com', {
        headers: {
          Cookie: 'other=value; session=target; another=cookie',
          'User-Agent': 'Test Browser'
        }
      })

      mockParse.mockResolvedValue(mockSessionData)

      await getSession(mockRequest)

      expect(mockParse).toHaveBeenCalledWith('other=value; session=target; another=cookie')
    })
  })

  describe('createSession', () => {
    it('creates session cookie with calculated maxAge', async () => {
      const sessionData = {
        ...mockSessionData,
        expiresAt: Date.now() + 3600000 // 1 hour from now
      }

      mockSerialize.mockResolvedValue('serialized-cookie')

      const result = await createSession(sessionData)

      expect(result).toBe('serialized-cookie')
      expect(mockSerialize).toHaveBeenCalledWith(sessionData, {
        maxAge: 3600 // 1 hour in seconds
      })
    })

    it('uses provided maxAge when given', async () => {
      const customMaxAge = 7200 // 2 hours

      mockSerialize.mockResolvedValue('custom-cookie')

      const result = await createSession(mockSessionData, customMaxAge)

      expect(result).toBe('custom-cookie')
      expect(mockSerialize).toHaveBeenCalledWith(mockSessionData, {
        maxAge: customMaxAge
      })
    })

    it('handles session with very short expiry', async () => {
      const shortSession = {
        ...mockSessionData,
        expiresAt: Date.now() + 30000 // 30 seconds
      }

      mockSerialize.mockResolvedValue('short-cookie')

      await createSession(shortSession)

      expect(mockSerialize).toHaveBeenCalledWith(shortSession, {
        maxAge: 30
      })
    })

    it('handles negative maxAge (expired session)', async () => {
      const expiredSession = {
        ...mockSessionData,
        expiresAt: Date.now() - 1000 // Already expired
      }

      mockSerialize.mockResolvedValue('expired-cookie')

      await createSession(expiredSession)

      expect(mockSerialize).toHaveBeenCalledWith(expiredSession, {
        maxAge: -1 // Negative maxAge
      })
    })

    it('rounds down fractional maxAge values', async () => {
      const sessionData = {
        ...mockSessionData,
        expiresAt: Date.now() + 3600500 // 1 hour + 500ms
      }

      mockSerialize.mockResolvedValue('rounded-cookie')

      await createSession(sessionData)

      expect(mockSerialize).toHaveBeenCalledWith(sessionData, {
        maxAge: 3600 // Should floor to 3600, not 3601
      })
    })
  })

  describe('destroySession', () => {
    it('creates cookie with maxAge 0 to clear session', async () => {
      mockSerialize.mockResolvedValue('destroy-cookie')

      const result = await destroySession()

      expect(result).toBe('destroy-cookie')
      expect(mockSerialize).toHaveBeenCalledWith({}, { maxAge: 0 })
    })

    it('returns serialized destroy cookie', async () => {
      const destroyCookie = 'session=; Path=/; Expires=Thu, 01 Jan 1970 00:00:00 GMT'
      mockSerialize.mockResolvedValue(destroyCookie)

      const result = await destroySession()

      expect(result).toBe(destroyCookie)
    })
  })

  describe('requireAuth', () => {
    it('returns session data when user is authenticated', async () => {
      const mockRequest = new Request('https://example.com', {
        headers: { Cookie: 'session=valid' }
      })

      mockParse.mockResolvedValue(mockSessionData)

      const result = await requireAuth(mockRequest)

      expect(result).toEqual(mockSessionData)
      expect(mockRedirect).not.toHaveBeenCalled()
    })

    it('redirects to login when no session exists', async () => {
      const mockRequest = new Request('https://example.com')

      mockParse.mockResolvedValue(null)
      mockRedirect.mockImplementation((url) => { throw new Error(`Redirect to ${url}`) })

      await expect(requireAuth(mockRequest)).rejects.toThrow('Redirect to /login')
      expect(mockRedirect).toHaveBeenCalledWith('/login')
    })

    it('redirects to login when session is expired', async () => {
      const expiredSession = {
        ...mockSessionData,
        expiresAt: Date.now() - 1000
      }

      const mockRequest = new Request('https://example.com', {
        headers: { Cookie: 'session=expired' }
      })

      mockParse.mockResolvedValue(expiredSession)
      mockRedirect.mockImplementation((url) => { throw new Error(`Redirect to ${url}`) })

      await expect(requireAuth(mockRequest)).rejects.toThrow('Redirect to /login')
      expect(mockRedirect).toHaveBeenCalledWith('/login')
    })

    it('handles malformed cookies gracefully', async () => {
      const mockRequest = new Request('https://example.com', {
        headers: { Cookie: 'malformed' }
      })

      mockParse.mockRejectedValue(new Error('Parse error'))

      await expect(requireAuth(mockRequest)).rejects.toThrow('Parse error')
    })
  })

  describe('requireAdmin', () => {
    it('returns session data when user is admin', async () => {
      const mockRequest = new Request('https://example.com', {
        headers: { Cookie: 'session=admin' }
      })

      mockParse.mockResolvedValue(mockAdminSession)

      const result = await requireAdmin(mockRequest)

      expect(result).toEqual(mockAdminSession)
    })

    it('throws 403 Response when user is not admin', async () => {
      const mockRequest = new Request('https://example.com', {
        headers: { Cookie: 'session=member' }
      })

      mockParse.mockResolvedValue(mockSessionData) // role: 'member'

      try {
        await requireAdmin(mockRequest)
        expect.fail('Should have thrown a Response')
      } catch (error) {
        expect(error).toBeInstanceOf(Response)
        expect(error.status).toBe(403)
        expect(await error.text()).toBe('Forbidden')
      }
    })

    it('redirects to login when no session exists', async () => {
      const mockRequest = new Request('https://example.com')

      mockParse.mockResolvedValue(null)
      mockRedirect.mockImplementation((url) => { throw new Error(`Redirect to ${url}`) })

      await expect(requireAdmin(mockRequest)).rejects.toThrow('Redirect to /login')
      expect(mockRedirect).toHaveBeenCalledWith('/login')
    })

    it('handles different admin role variations', async () => {
      const differentRoles = ['Admin', 'ADMIN', 'administrator', 'member', 'user', '']

      for (const role of differentRoles) {
        const sessionWithRole = { ...mockSessionData, role }
        const mockRequest = new Request('https://example.com', {
          headers: { Cookie: `session=${role}` }
        })

        mockParse.mockResolvedValue(sessionWithRole)

        if (role === 'admin') {
          const result = await requireAdmin(mockRequest)
          expect(result.role).toBe('admin')
        } else {
          try {
            await requireAdmin(mockRequest)
            expect.fail(`Should have thrown 403 for role: ${role}`)
          } catch (error) {
            expect(error).toBeInstanceOf(Response)
            expect(error.status).toBe(403)
          }
        }
      }
    })
  })

  describe('security considerations', () => {
    it('handles concurrent session validation', async () => {
      const mockRequest = new Request('https://example.com', {
        headers: { Cookie: 'session=valid' }
      })

      mockParse.mockResolvedValue(mockSessionData)

      // Simulate concurrent requests
      const promises = Array.from({ length: 10 }, () => getSession(mockRequest))
      const results = await Promise.all(promises)

      // All should return the same valid session
      results.forEach(result => {
        expect(result).toEqual(mockSessionData)
      })
      expect(mockParse).toHaveBeenCalledTimes(10)
    })

    it('properly validates session timestamps', async () => {
      const times = [
        Date.now() - 1, // Just expired
        Date.now(),     // Exactly now
        Date.now() + 1, // Just valid
        Date.now() + 86400000, // Valid for 1 day
        0, // Falsy timestamp (treated as never expires)
        -1, // Negative timestamp (expired)
        Infinity, // Infinity (treated as never expires)
        NaN // NaN (falsy, treated as never expires)
      ]

      for (let i = 0; i < times.length; i++) {
        const sessionWithTime = { ...mockSessionData, expiresAt: times[i] }
        const mockRequest = new Request('https://example.com', {
          headers: { Cookie: `session=test-${i}` }
        })

        mockParse.mockResolvedValue(sessionWithTime)

        const result = await getSession(mockRequest)

        // Logic: if expiresAt is truthy AND Date.now() > expiresAt, return null
        // Otherwise return session (includes falsy values and future times)
        if (times[i] && Date.now() > times[i]) {
          expect(result).toBe(null)
        } else {
          expect(result).toEqual(sessionWithTime)
        }
      }
    })

    it('handles session data without required fields', async () => {
      const incompleteSession = {
        userId: 'user-123'
        // Missing sessionId, username, role, expiresAt
      }

      const mockRequest = new Request('https://example.com', {
        headers: { Cookie: 'session=incomplete' }
      })

      mockParse.mockResolvedValue(incompleteSession)

      const result = await getSession(mockRequest)

      // Should still return the session even if incomplete
      expect(result).toEqual(incompleteSession)
    })
  })

  describe('cookie parsing edge cases', () => {
    it('handles empty cookie headers', async () => {
      const mockRequest = new Request('https://example.com', {
        headers: { Cookie: '' }
      })

      mockParse.mockResolvedValue(null)

      const result = await getSession(mockRequest)

      expect(result).toBe(null)
      expect(mockParse).toHaveBeenCalledWith('')
    })

    it('handles requests without cookie header', async () => {
      const mockRequest = new Request('https://example.com')

      mockParse.mockResolvedValue(null)

      const result = await getSession(mockRequest)

      expect(result).toBe(null)
      expect(mockParse).toHaveBeenCalledWith(null)
    })

    it('handles multiple cookie headers', async () => {
      const mockRequest = new Request('https://example.com', {
        headers: {
          Cookie: 'session=abc123; other=xyz',
        }
      })

      mockParse.mockResolvedValue(mockSessionData)

      const result = await getSession(mockRequest)

      expect(result).toEqual(mockSessionData)
      expect(mockParse).toHaveBeenCalledWith('session=abc123; other=xyz')
    })
  })
})