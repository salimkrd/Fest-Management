import { defineConfig } from 'vitest/config';
import path from 'path';
import { loadEnvConfig } from '@next/env';

// Load environment variables consistent with Next.js resolution rules (.env.local, .env, etc.)
loadEnvConfig(process.cwd());

export default defineConfig({
  test: {
    environment: 'node',
    globals: true,
    setupFiles: ['./src/__tests__/setupEnv.ts'],
    testTimeout: 20000,
    hookTimeout: 20000,
    fileParallelism: false
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src')
    }
  }
});
