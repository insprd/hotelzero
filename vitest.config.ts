import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    // Longer timeouts for browser automation tests
    testTimeout: 120000, // 2 minutes per test
    hookTimeout: 90000,  // 1.5 minutes for setup/teardown
    // Reporter
    reporters: ['verbose'],
    // Run test files sequentially to avoid rate limiting
    fileParallelism: false,
    // Run tests sequentially within files too
    sequence: {
      concurrent: false,
    },
  },
});
