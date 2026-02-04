/**
 * Example Service Template
 *
 * This file demonstrates the service layer pattern with mock mode support.
 * Copy this template when adding new external service integrations.
 *
 * Features:
 * - Mock mode for development without API keys
 * - Type-safe inputs and outputs
 * - Error handling
 * - Easy to test
 *
 * Usage:
 * 1. Copy this file and rename to your-service.service.ts
 * 2. Set MOCK_YOUR_SERVICE=true in .env.local for development
 * 3. Implement the real API calls
 * 4. Export from index.ts
 */

// Check if mock mode is enabled via environment variable
const MOCK_EXAMPLE = process.env.MOCK_EXAMPLE === 'true'

// =============================================================================
// Types
// =============================================================================

export interface ExampleInput {
  query: string
  options?: {
    limit?: number
    format?: 'json' | 'text'
  }
}

export interface ExampleOutput {
  success: boolean
  data: string
  timestamp: Date
}

// =============================================================================
// Main Service Function
// =============================================================================

/**
 * Example service call with mock mode support
 *
 * @example
 * ```typescript
 * const result = await exampleServiceCall({
 *   query: 'hello world',
 *   options: { limit: 10 }
 * })
 * ```
 */
export async function exampleServiceCall(
  input: ExampleInput,
): Promise<ExampleOutput> {
  // Return mock response if mock mode is enabled
  if (MOCK_EXAMPLE) {
    return mockResponse(input)
  }

  // Real implementation would go here
  // Example:
  // const response = await fetch('https://api.example.com/endpoint', {
  //   method: 'POST',
  //   headers: {
  //     'Authorization': `Bearer ${process.env.EXAMPLE_API_KEY}`,
  //     'Content-Type': 'application/json',
  //   },
  //   body: JSON.stringify(input),
  // })
  //
  // if (!response.ok) {
  //   throw new Error(`API error: ${response.status}`)
  // }
  //
  // return response.json()

  // For now, return mock since there's no real API
  return mockResponse(input)
}

// =============================================================================
// Mock Implementation
// =============================================================================

/**
 * Mock response for development/testing
 * Simulates realistic API behavior without network calls
 */
function mockResponse(input: ExampleInput): ExampleOutput {
  // Simulate some processing delay in development
  // await new Promise(resolve => setTimeout(resolve, 100))

  return {
    success: true,
    data: `Mock response for query: "${input.query}"`,
    timestamp: new Date(),
  }
}

// =============================================================================
// Additional Helper Functions
// =============================================================================

/**
 * Check if the service is available
 * Useful for health checks
 */
export function isExampleServiceAvailable(): boolean {
  if (MOCK_EXAMPLE) return true
  return !!process.env.EXAMPLE_API_KEY
}
