// Load environment variables first
import * as dotenv from 'dotenv'
dotenv.config()

import '@testing-library/jest-dom'
import { cleanup } from '@testing-library/react'
import { afterEach, vi } from 'vitest'

// Clean up after each test
afterEach(() => {
  cleanup()
})

// Environment variables for tests
process.env.NODE_ENV = 'test'

// AWS environment setup for integration tests
// Use values from .env file, with fallbacks only if not set
if (!process.env.JUDGE_NAME) {
  process.env.JUDGE_NAME = 'codebreakercontest07'
}

if (!process.env.AWS_REGION) {
  process.env.AWS_REGION = 'ap-southeast-1'
}

if (!process.env.AWS_ACCOUNT_ID) {
  process.env.AWS_ACCOUNT_ID = '354145626860'
}

// Console setup for better test output
const originalConsoleLog = console.log
const originalConsoleWarn = console.warn

// Allow test-related console output but suppress noise
console.log = (...args: any[]) => {
  const message = args.join(' ')
  if (message.includes('🧪') || message.includes('✅') || message.includes('🔬') ||
      message.includes('⏳') || message.includes('🧹') || message.includes('❌')) {
    originalConsoleLog(...args)
  }
}

console.warn = (...args: any[]) => {
  const message = args.join(' ')
  if (message.includes('Cleanup warning')) {
    originalConsoleWarn(...args)
  }
}