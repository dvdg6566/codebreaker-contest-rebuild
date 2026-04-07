import React from 'react'
import { render, RenderOptions } from '@testing-library/react'
import { vi } from 'vitest'

// Common test utilities and mocks

// Mock React Router hooks
export const mockNavigate = vi.fn()
export const mockUseNavigate = vi.fn(() => mockNavigate)
export const mockUseParams = vi.fn(() => ({}))
export const mockUseSearchParams = vi.fn(() => [new URLSearchParams(), vi.fn()])
export const mockUseLoaderData = vi.fn()
export const mockUseFetcher = vi.fn(() => ({
  Form: 'form',
  submit: vi.fn(),
  load: vi.fn(),
  data: null,
  formData: null,
  state: 'idle'
}))

// Mock authentication context
export const mockAuthContext = {
  user: { username: 'testuser', role: 'member' },
  isAuthenticated: true,
  isAdmin: false
}

// Mock WebSocket context
export const mockWebSocketContext = {
  isConnected: false,
  notifications: [],
  unreadCount: 0,
  contestId: '',
  setContestId: vi.fn(),
  markAsRead: vi.fn(),
  clearAll: vi.fn()
}

// Setup mocks for common modules
export function setupCommonMocks() {
  vi.mock('react-router', () => ({
    useNavigate: mockUseNavigate,
    useParams: mockUseParams,
    useSearchParams: mockUseSearchParams,
    useLoaderData: mockUseLoaderData,
    useFetcher: mockUseFetcher,
    Outlet: ({ children }: { children?: React.ReactNode }) => children || null,
    Link: ({ children, to, ...props }: any) => <a href={to} {...props}>{children}</a>
  }))

  vi.mock('~/context/auth-context', () => ({
    useAuth: () => mockAuthContext
  }))

  vi.mock('~/context/websocket-context', () => ({
    useWebSocketContext: () => mockWebSocketContext
  }))
}

// Custom render function with providers
interface CustomRenderOptions extends RenderOptions {
  // Add any provider options here if needed
}

export function renderWithProviders(
  ui: React.ReactElement,
  options?: CustomRenderOptions
) {
  const AllTheProviders = ({ children }: { children: React.ReactNode }) => {
    // Add any global providers here
    return <>{children}</>
  }

  return render(ui, { wrapper: AllTheProviders, ...options })
}

// Re-export everything from testing-library
export * from '@testing-library/react'
export { default as userEvent } from '@testing-library/user-event'