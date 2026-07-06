import { defineConfig } from 'vitest/config';

// Standalone config: without this, vitest walks up and loads the Mission
// Control root vitest.config.ts (different plugins/aliases). Threads pool —
// the forks pool fails to start under current Node here.
export default defineConfig({
  test: {
    environment: 'node',
    pool: 'threads',
    include: ['src/**/*.test.ts'],
  },
});
