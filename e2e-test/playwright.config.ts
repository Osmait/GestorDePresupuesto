import { defineConfig, devices } from '@playwright/test';

// Check if running against a remote target (Render)
const targetURL = process.env.E2E_TARGET_URL;
const isCI = !!process.env.CI;

// If target URL is provided, we don't need to spin up local servers
const webServerConfig = targetURL ? undefined : [
    {
        // Use direct go run to ensure the process exits correctly on SIGTERM. 
        // 'make backend' uses 'air' which might swallow signals.
        command: 'cd ../BackEnd && go run main.go',
        url: 'http://localhost:8080',
        reuseExistingServer: !isCI,
        timeout: 120 * 1000,
        stdout: 'pipe' as 'pipe', // Explicit cast to satisfy union type
        stderr: 'pipe' as 'pipe',
    },
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
        {
            name: 'chromium',
            use: { ...devices['Desktop Chrome'] },
        },
        // {
        //     name: 'firefox',
        //     use: { ...devices['Desktop Firefox'] },
        // },
        // {
        //     name: 'webkit',
        //     use: { ...devices['Desktop Safari'] },
        // },
    ],
    // Only use webServer if NOT targeting a remote environment
    webServer: webServerConfig,
});
