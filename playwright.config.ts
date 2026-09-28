import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './apps/web/e2e',
  testMatch: '**/*.e2e.ts',
  timeout: 180_000,
  use: { baseURL: 'http://127.0.0.1:4173', viewport: { width: 844, height: 390 } },
  webServer: {
    command: 'pnpm --filter @gaple/web exec vite preview --host 127.0.0.1 --port 4173 --strictPort',
    url: 'http://127.0.0.1:4173',
    reuseExistingServer: !process.env.CI,
  },
});
