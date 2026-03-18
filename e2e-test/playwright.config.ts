import { defineConfig, devices } from '@playwright/test';

// Check if running against a remote target (Render)
const targetURL = process.env.E2E_TARGET_URL;
const isCI = !!process.env.CI;

// The backend is managed by global-setup (testcontainers + go run).
// Only the frontend dev server is started here via webServer.
const webServerConfig = targetURL ? undefined : [
  {
    command: 'cd ../FrontendNextjs/gestor && npm run dev',
    url: 'http://localhost:3000',
    reuseExistingServer: !isCI,
    timeout: 120 * 1000,
    stdout: 'pipe' as 'pipe',
    stderr: 'pipe' as 'pipe',
  }
];

export default defineConfig({
  globalSetup: require.resolve('./global-setup'),
  testDir: './tests',
  fullyParallel: true,
  forbidOnly: isCI,
  retries: isCI ? 2 : 0,
  workers: 1,
  reporter: [['html', { open: 'never' }]],
  use: {
    baseURL: targetURL || 'http://localhost:3000',
    trace: 'on-first-retry',
  },
  timeout: 120000,

  projects: [
    { name: 'setup', testMatch: /.*\.setup\.ts/ },

    {
      name: 'chromium',
      use: {
        ...devices['Desktop Chrome'],
        storageState: 'playwright/.auth/user.json',
      },
      dependencies: ['setup'],
    },
    /*
    {
        name: 'firefox',
        use: { 
            ...devices['Desktop Firefox'],
            storageState: 'playwright/.auth/user.json',
        },
        dependencies: ['setup'],
    },
    */
  ],
  // Only use webServer if NOT targeting a remote environment
  webServer: webServerConfig,
});
