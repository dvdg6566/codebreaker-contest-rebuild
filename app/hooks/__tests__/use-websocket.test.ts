import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { useWebSocket } from '../use-websocket'
import type { WebSocketMessage } from '../use-websocket'

// Mock WebSocket
class MockWebSocket {
  url: string
  readyState: number = WebSocket.CONNECTING
  onopen: ((event: Event) => void) | null = null
  onmessage: ((event: MessageEvent) => void) | null = null
  onerror: ((event: Event) => void) | null = null
  onclose: ((event: CloseEvent) => void) | null = null

  static CONNECTING = 0
  static OPEN = 1
  static CLOSING = 2
  static CLOSED = 3

  constructor(url: string) {
    this.url = url
    // Store reference for testing
    ;(global as any).mockWebSocketInstance = this
  }

  send = vi.fn()
  close = vi.fn()

  // Test helpers
  simulateOpen() {
    this.readyState = WebSocket.OPEN
    this.onopen?.(new Event('open'))
  }

  simulateMessage(data: any) {
    this.onmessage?.(new MessageEvent('message', { data: JSON.stringify(data) }))
  }

  simulateError() {
    this.onerror?.(new Event('error'))
  }

  simulateClose(code = 1000) {
    this.readyState = WebSocket.CLOSED
    this.onclose?.(new CloseEvent('close', { code }))
  }
}

// Global WebSocket mock
Object.defineProperty(global, 'WebSocket', {
  writable: true,
  value: MockWebSocket
})

describe('useWebSocket', () => {
  let mockWs: MockWebSocket

  const defaultOptions = {
    url: 'ws://test.com',
    accountRole: 'member',
    username: 'testuser',
    contestId: 'contest-123'
  }

  beforeEach(() => {
    vi.useFakeTimers()
    vi.clearAllMocks()
    ;(global as any).mockWebSocketInstance = null
  })

  afterEach(() => {
    vi.useRealTimers()
    ;(global as any).mockWebSocketInstance = null
  })

  describe('connection lifecycle', () => {
    it('initializes with disconnected state', () => {
      const { result } = renderHook(() => useWebSocket(defaultOptions))

      expect(result.current.isConnected).toBe(false)
      expect(result.current.lastMessage).toBe(null)
      expect(result.current.error).toBe(null)
    })

    it('creates WebSocket connection on mount', () => {
      renderHook(() => useWebSocket(defaultOptions))

      mockWs = (global as any).mockWebSocketInstance
      expect(mockWs).toBeTruthy()
      expect(mockWs.url).toBe('ws://test.com')
    })

    it('does not connect when url is null', () => {
      renderHook(() => useWebSocket({ ...defaultOptions, url: null }))

      expect((global as any).mockWebSocketInstance).toBe(null)
    })

    it('does not connect when enabled is false', () => {
      renderHook(() => useWebSocket({ ...defaultOptions, enabled: false }))

      expect((global as any).mockWebSocketInstance).toBe(null)
    })

    it('updates state on successful connection', async () => {
      const { result } = renderHook(() => useWebSocket(defaultOptions))
      mockWs = (global as any).mockWebSocketInstance

      act(() => {
        mockWs.simulateOpen()
      })

      expect(result.current.isConnected).toBe(true)
      expect(result.current.error).toBe(null)
    })

    it('sends identity message on connection', async () => {
      renderHook(() => useWebSocket(defaultOptions))
      mockWs = (global as any).mockWebSocketInstance

      act(() => {
        mockWs.simulateOpen()
      })

      expect(mockWs.send).toHaveBeenCalledWith(
        JSON.stringify({
          action: 'message',
          accountRole: 'member',
          username: 'testuser',
          contestId: 'contest-123'
        })
      )
    })

    it('handles connection errors', async () => {
      const { result } = renderHook(() => useWebSocket(defaultOptions))
      mockWs = (global as any).mockWebSocketInstance

      act(() => {
        mockWs.simulateError()
      })

      expect(result.current.error).toBe('WebSocket error occurred')
    })

    it('updates state on disconnection', async () => {
      const { result } = renderHook(() => useWebSocket(defaultOptions))
      mockWs = (global as any).mockWebSocketInstance

      act(() => {
        mockWs.simulateOpen()
      })
      expect(result.current.isConnected).toBe(true)

      act(() => {
        mockWs.simulateClose()
      })
      expect(result.current.isConnected).toBe(false)
    })

    it('cleans up on unmount', () => {
      const { unmount } = renderHook(() => useWebSocket(defaultOptions))
      mockWs = (global as any).mockWebSocketInstance

      const closeSpy = vi.spyOn(mockWs, 'close')
      unmount()

      expect(closeSpy).toHaveBeenCalled()
    })
  })

  describe('message handling', () => {
    it('parses and stores incoming messages', async () => {
      const { result } = renderHook(() => useWebSocket(defaultOptions))
      mockWs = (global as any).mockWebSocketInstance

      const testMessage: WebSocketMessage = {
        notificationType: 'announce',
        timestamp: '2025-01-01T12:00:00Z'
      }

      act(() => {
        mockWs.simulateMessage(testMessage)
      })

      expect(result.current.lastMessage).toEqual(testMessage)
    })

    it('calls onMessage callback when provided', async () => {
      const onMessage = vi.fn()
      renderHook(() => useWebSocket({ ...defaultOptions, onMessage }))
      mockWs = (global as any).mockWebSocketInstance

      const testMessage: WebSocketMessage = {
        notificationType: 'postClarification'
      }

      act(() => {
        mockWs.simulateMessage(testMessage)
      })

      expect(onMessage).toHaveBeenCalledWith(testMessage)
    })

    it('handles invalid JSON messages gracefully', async () => {
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
      renderHook(() => useWebSocket(defaultOptions))
      mockWs = (global as any).mockWebSocketInstance

      // Send invalid JSON
      act(() => {
        mockWs.onmessage?.(new MessageEvent('message', { data: 'invalid json' }))
      })

      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('[WebSocket] Failed to parse message:'),
        expect.any(Error)
      )

      consoleSpy.mockRestore()
    })

    it('ignores messages after unmount', async () => {
      const onMessage = vi.fn()
      const { unmount } = renderHook(() => useWebSocket({ ...defaultOptions, onMessage }))
      mockWs = (global as any).mockWebSocketInstance

      unmount()

      act(() => {
        mockWs.simulateMessage({ notificationType: 'announce' })
      })

      expect(onMessage).not.toHaveBeenCalled()
    })
  })

  describe('reconnection logic', () => {
    it('schedules reconnection after disconnect', async () => {
      renderHook(() => useWebSocket(defaultOptions))
      mockWs = (global as any).mockWebSocketInstance
      const firstWs = mockWs

      act(() => {
        mockWs.simulateClose()
      })

      // Advance timer by 1 second (initial delay)
      act(() => {
        vi.advanceTimersByTime(1000)
      })

      // Should create new connection
      const newWs = (global as any).mockWebSocketInstance
      expect(newWs).not.toBe(firstWs)
    })

    it('implements exponential backoff', async () => {
      renderHook(() => useWebSocket(defaultOptions))

      // Track reconnection attempts
      const reconnectTimes: number[] = []

      // Disconnect and reconnect multiple times
      for (let i = 0; i < 4; i++) {
        mockWs = (global as any).mockWebSocketInstance

        act(() => {
          mockWs.simulateClose()
        })

        // Calculate expected delay: 1s, 2s, 4s, 8s
        const expectedDelay = Math.pow(2, i) * 1000
        reconnectTimes.push(expectedDelay)

        act(() => {
          vi.advanceTimersByTime(expectedDelay)
        })

        // Verify new connection was created
        expect((global as any).mockWebSocketInstance).toBeTruthy()
      }

      expect(reconnectTimes).toEqual([1000, 2000, 4000, 8000])
    })

    it('caps reconnection delay at 32 seconds', async () => {
      renderHook(() => useWebSocket(defaultOptions))

      // Disconnect many times to exceed max delay
      for (let i = 0; i < 8; i++) {
        mockWs = (global as any).mockWebSocketInstance

        act(() => {
          mockWs.simulateClose()
        })

        // After 5 disconnections, delay should cap at 32s
        const expectedDelay = i < 5 ? Math.pow(2, i) * 1000 : 32000

        act(() => {
          vi.advanceTimersByTime(expectedDelay)
        })
      }

      // Final test: next disconnect should still use 32s max
      mockWs = (global as any).mockWebSocketInstance
      act(() => {
        mockWs.simulateClose()
      })

      // Should not reconnect before 32s
      act(() => {
        vi.advanceTimersByTime(31999)
      })
      expect(mockWs).toBe((global as any).mockWebSocketInstance) // Same instance

      // Should reconnect after 32s
      act(() => {
        vi.advanceTimersByTime(1)
      })
      expect((global as any).mockWebSocketInstance).not.toBe(mockWs) // New instance
    })

    it('resets delay after successful connection', async () => {
      renderHook(() => useWebSocket(defaultOptions))
      mockWs = (global as any).mockWebSocketInstance

      // Disconnect to increase delay
      act(() => {
        mockWs.simulateClose()
      })

      act(() => {
        vi.advanceTimersByTime(1000)
      })

      // Simulate successful connection
      mockWs = (global as any).mockWebSocketInstance
      act(() => {
        mockWs.simulateOpen()
      })

      // Disconnect again
      act(() => {
        mockWs.simulateClose()
      })

      // Should use initial delay (1s) not increased delay
      act(() => {
        vi.advanceTimersByTime(1000)
      })
      expect((global as any).mockWebSocketInstance).not.toBe(mockWs) // Reconnected
    })

    it('does not reconnect when disabled', async () => {
      const { rerender } = renderHook(
        ({ enabled }) => useWebSocket({ ...defaultOptions, enabled }),
        { initialProps: { enabled: true } }
      )

      mockWs = (global as any).mockWebSocketInstance

      // First disconnect to trigger reconnection timer
      act(() => {
        mockWs.simulateClose()
      })

      // Then disable
      rerender({ enabled: false })

      // Advance timer - should not reconnect since disabled
      const originalInstance = (global as any).mockWebSocketInstance
      act(() => {
        vi.advanceTimersByTime(5000)
      })

      // Should be same instance (no new connection created)
      expect((global as any).mockWebSocketInstance).toBe(originalInstance)
    })

    it('cancels pending reconnection on unmount', async () => {
      const { unmount } = renderHook(() => useWebSocket(defaultOptions))
      mockWs = (global as any).mockWebSocketInstance

      act(() => {
        mockWs.simulateClose()
      })

      unmount()

      // Advance timer - should not reconnect
      act(() => {
        vi.advanceTimersByTime(5000)
      })

      expect((global as any).mockWebSocketInstance).toBe(mockWs) // Same instance
    })
  })

  describe('sendIdentity function', () => {
    it('provides sendIdentity function', () => {
      const { result } = renderHook(() => useWebSocket(defaultOptions))

      expect(typeof result.current.sendIdentity).toBe('function')
    })

    it('sends updated identity with new contestId', async () => {
      const { result } = renderHook(() => useWebSocket(defaultOptions))
      mockWs = (global as any).mockWebSocketInstance

      act(() => {
        mockWs.simulateOpen()
      })

      vi.clearAllMocks()

      act(() => {
        result.current.sendIdentity('new-contest-456')
      })

      expect(mockWs.send).toHaveBeenCalledWith(
        JSON.stringify({
          action: 'message',
          accountRole: 'member',
          username: 'testuser',
          contestId: 'new-contest-456'
        })
      )
    })

    it('uses empty string when contestId explicitly provided', async () => {
      const { result } = renderHook(() => useWebSocket(defaultOptions))
      mockWs = (global as any).mockWebSocketInstance

      act(() => {
        mockWs.simulateOpen()
      })

      vi.clearAllMocks()

      act(() => {
        result.current.sendIdentity('')
      })

      expect(mockWs.send).toHaveBeenCalledWith(
        JSON.stringify({
          action: 'message',
          accountRole: 'member',
          username: 'testuser',
          contestId: ''
        })
      )
    })

    it('does not send when not connected', async () => {
      const { result } = renderHook(() => useWebSocket(defaultOptions))
      mockWs = (global as any).mockWebSocketInstance

      // Don't call simulateOpen - stay disconnected

      act(() => {
        result.current.sendIdentity('contest-id')
      })

      expect(mockWs.send).not.toHaveBeenCalled()
    })
  })

  describe('option updates', () => {
    it('reconnects when url changes', async () => {
      const { rerender } = renderHook(
        ({ url }) => useWebSocket({ ...defaultOptions, url }),
        { initialProps: { url: 'ws://test1.com' } }
      )

      const firstWs = (global as any).mockWebSocketInstance
      expect(firstWs.url).toBe('ws://test1.com')

      rerender({ url: 'ws://test2.com' })

      const secondWs = (global as any).mockWebSocketInstance
      expect(secondWs).not.toBe(firstWs)
      expect(secondWs.url).toBe('ws://test2.com')
    })

    it('updates onMessage callback without reconnecting', async () => {
      const onMessage1 = vi.fn()
      const onMessage2 = vi.fn()

      const { rerender } = renderHook(
        ({ onMessage }) => useWebSocket({ ...defaultOptions, onMessage }),
        { initialProps: { onMessage: onMessage1 } }
      )

      mockWs = (global as any).mockWebSocketInstance
      const originalWs = mockWs

      rerender({ onMessage: onMessage2 })

      // Should be same WebSocket instance
      expect((global as any).mockWebSocketInstance).toBe(originalWs)

      // Test new callback is used
      act(() => {
        mockWs.simulateMessage({ notificationType: 'announce' })
      })

      expect(onMessage1).not.toHaveBeenCalled()
      expect(onMessage2).toHaveBeenCalled()
    })
  })
})