import { defineConfig } from 'vitest/config';

// Standalone config so vitest does not walk up and inherit the Mission
// Control root config (whose setupFiles don't exist down here).
export default defineConfig({
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts'],
  },
});
