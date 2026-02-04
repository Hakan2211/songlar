/**
 * Service Layer Barrel Export
 *
 * All external service integrations are exported from here.
 * Each service follows the mock mode pattern for easy development.
 *
 * Adding a new service:
 * 1. Create a new file: your-service.service.ts
 * 2. Add MOCK_YOUR_SERVICE env var support
 * 3. Export from this file
 * 4. Document in .env.example
 */

// Example service (template for new services)
export {
  exampleServiceCall,
  isExampleServiceAvailable,
  type ExampleInput,
  type ExampleOutput,
} from './example.service'

// Add your service exports here:
// export { myServiceCall } from './my-service.service'
