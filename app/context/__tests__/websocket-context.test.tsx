import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, act, waitFor } from '@testing-library/react'
import { WebSocketProvider, useWebSocketContext } from '../websocket-context'

// Mock the WebSocket hook
const mockSendIdentity = vi.fn()
const mockWebSocketHook = {
  isConnected: false,
  sendIdentity: mockSendIdentity
}

vi.mock('~/hooks/use-websocket', () => ({
  useWebSocket: vi.fn(() => mockWebSocketHook)
}))

vi.mock('~/context/auth-context', () => ({
  useAuth: () => ({
    user: { username: 'testuser', role: 'member' },
    isAuthenticated: true,
    isAdmin: false
  })
}))

// Test component that uses WebSocket context
function TestComponent() {
  const context = useWebSocketContext()
  return (
    <div>
      <div data-testid="connection-status">
        {context.isConnected ? 'Connected' : 'Disconnected'}
      </div>
      <div data-testid="notification-count">{context.unreadCount}</div>
      <div data-testid="contest-id">{context.contestId}</div>
      <button
        onClick={() => context.setContestId('test-contest')}
        data-testid="set-contest"
      >
        Set Contest
      </button>
    </div>
  )
}

describe('WebSocketProvider', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('provides initial context values', () => {
    render(
      <WebSocketProvider wsEndpoint="ws://test.com">
        <TestComponent />
      </WebSocketProvider>
    )

    expect(screen.getByTestId('connection-status')).toHaveTextContent('Disconnected')
    expect(screen.getByTestId('notification-count')).toHaveTextContent('0')
    expect(screen.getByTestId('contest-id')).toHaveTextContent('')
  })

  it('updates contest ID and calls sendIdentity', async () => {
    render(
      <WebSocketProvider wsEndpoint="ws://test.com">
        <TestComponent />
      </WebSocketProvider>
    )

    const setButton = screen.getByTestId('set-contest')

    act(() => {
      setButton.click()
    })

    await waitFor(() => {
      expect(screen.getByTestId('contest-id')).toHaveTextContent('test-contest')
    })

    expect(mockSendIdentity).toHaveBeenCalledWith('test-contest')
  })

  it('creates notifications from WebSocket messages', async () => {
    let messageHandler: (msg: any) => void

    const mockWebSocketWithMessage = {
      ...mockWebSocketHook,
      isConnected: true
    }

    const { useWebSocket } = await import('~/hooks/use-websocket')
    vi.mocked(useWebSocket).mockImplementation(({ onMessage }) => {
      messageHandler = onMessage
      return mockWebSocketWithMessage
    })

    render(
      <WebSocketProvider wsEndpoint="ws://test.com">
        <TestComponent />
      </WebSocketProvider>
    )

    // Simulate receiving an announcement
    act(() => {
      messageHandler({
        notificationType: 'announce',
        timestamp: '2025-01-01T00:00:00Z'
      })
    })

    await waitFor(() => {
      expect(screen.getByTestId('notification-count')).toHaveTextContent('1')
    })
  })

  it('filters admin notifications for regular users', async () => {
    let messageHandler: (msg: any) => void

    const { useWebSocket } = await import('~/hooks/use-websocket')
    vi.mocked(useWebSocket).mockImplementation(({ onMessage }) => {
      messageHandler = onMessage
      return mockWebSocketHook
    })

    render(
      <WebSocketProvider wsEndpoint="ws://test.com">
        <TestComponent />
      </WebSocketProvider>
    )

    // Simulate admin-only notification
    act(() => {
      messageHandler({
        notificationType: 'postClarification',
        timestamp: '2025-01-01T00:00:00Z'
      })
    })

    // Should remain 0 since user is not admin
    await waitFor(() => {
      expect(screen.getByTestId('notification-count')).toHaveTextContent('0')
    })
  })
})