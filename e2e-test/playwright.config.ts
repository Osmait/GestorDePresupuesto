import { defineConfig, devices } from '@playwright/test';

// Check if running against a remote target (Render)
const targetURL = process.env.E2E_TARGET_URL;
const isCI = !!process.env.CI;

// Optional overrides for machines where the default ports are taken.
// E2E_FRONTEND_PORT: port for the Next dev server (default 3000).
// E2E_BACKEND_PORT: port for the Go backend started by global-setup (default 8080);
// when set, the dev server is pointed at it through BACKEND_URL.
const frontendPort = process.env.E2E_FRONTEND_PORT || '3000';
const localURL = `http://localhost:${frontendPort}`;
const backendPort = process.env.E2E_BACKEND_PORT;
const webServerEnv: Record<string, string> = backendPort
  ? { BACKEND_URL: `http://127.0.0.1:${backendPort}` }
  : {};

// The backend is managed by global-setup (testcontainers + go run).
// Only the frontend dev server is started here via webServer.
const webServerConfig = targetURL ? undefined : [
  {
    command: process.env.E2E_FRONTEND_PORT
      ? `cd ../FrontendNextjs/gestor && npm run dev -- -p ${frontendPort}`
      : 'cd ../FrontendNextjs/gestor && npm run dev',
    url: localURL,
    env: webServerEnv,
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
    baseURL: targetURL || localURL,
    trace: 'on-first-retry',
  },
  timeout: 60000,

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
