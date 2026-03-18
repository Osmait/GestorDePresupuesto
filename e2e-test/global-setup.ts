import { resolve } from 'path'
import { spawn, execSync, ChildProcess } from 'child_process'
import * as http from 'http'
import { mkdirSync, rmSync } from 'fs'
import { PostgreSqlContainer, StartedPostgreSqlContainer } from '@testcontainers/postgresql'

const BACKEND_URL = 'http://127.0.0.1:8080'
const HEALTH_TIMEOUT_MS = 120_000
const HEALTH_POLL_INTERVAL_MS = 1_000
const HEALTH_REQUEST_TIMEOUT_MS = 2_000

const verbose = !!process.env.E2E_VERBOSE

function log(msg: string): void {
  console.log(`[global-setup] ${msg}`)
}

function verboseLog(msg: string): void {
  if (verbose) {
    console.log(`[global-setup:verbose] ${msg}`)
  }
}

/**
 * Polls GET /health until it returns HTTP 200, or throws after timeout.
 */
function waitForBackend(timeoutMs: number): Promise<void> {
  return new Promise((resolve, reject) => {
    const deadline = Date.now() + timeoutMs
    log('⏳ Waiting for backend...')

    function poll(): void {
      if (Date.now() > deadline) {
        reject(new Error(`Backend did not become healthy within ${timeoutMs}ms`))
        return
      }

      const req = http.get(
        `${BACKEND_URL}/health`,
        { timeout: HEALTH_REQUEST_TIMEOUT_MS },
        (res) => {
          if (res.statusCode === 200) {
            log('✅ Backend ready')
            resolve()
          } else {
            verboseLog(`Health check returned status ${res.statusCode}, retrying...`)
            setTimeout(poll, HEALTH_POLL_INTERVAL_MS)
          }
          // Drain the response so the socket is released
          res.resume()
        },
      )

      req.on('error', (err) => {
        verboseLog(`Health check error: ${err.message}, retrying...`)
        setTimeout(poll, HEALTH_POLL_INTERVAL_MS)
      })

      req.on('timeout', () => {
        req.destroy()
        verboseLog('Health check request timed out, retrying...')
        setTimeout(poll, HEALTH_POLL_INTERVAL_MS)
      })
    }

    poll()
  })
}

export default async function globalSetup(): Promise<() => Promise<void>> {
  // Remote testing mode — nothing to spin up locally
  if (process.env.E2E_TARGET_URL) {
    log('E2E_TARGET_URL is set — skipping local infrastructure setup')
    return async () => {}
  }

  // ── 1. Start PostgreSQL testcontainer ────────────────────────────────────
  log('🐘 Starting PostgreSQL...')
  const pgContainer: StartedPostgreSqlContainer = await new PostgreSqlContainer('postgres:15-alpine')
    .withDatabase('e2e_testdb')
    .withUsername('e2e_user')
    .withPassword('e2e_pass')
    .start()

  log(`✅ Postgres ready (host=${pgContainer.getHost()}, port=${pgContainer.getMappedPort(5432)})`)

  // ── 2. Build Go backend binary ────────────────────────────────────────────
  // We build first rather than using `go run` because:
  //  - `go run` spawns the real binary as a child — SIGTERM may not propagate.
  //  - Running the binary directly gives us reliable, immediate signal handling.
  //  - Subsequent runs reuse the cached build (Go's build cache), so it's fast.
  const backendCwd = resolve(__dirname, '../BackEnd')
  const binDir = resolve(backendCwd, 'bin')
  const binaryPath = resolve(binDir, 'e2e-server')

  log('🔨 Building backend binary...')
  mkdirSync(binDir, { recursive: true })
  try {
    execSync(`go build -o ${binaryPath} .`, {
      cwd: backendCwd,
      // Inherit env so Go modules / toolchain are found.
      // No DB vars needed at build time.
      env: process.env,
      stdio: verbose ? 'inherit' : 'pipe',
    })
  } catch (err) {
    await pgContainer.stop()
    throw new Error(`Backend build failed: ${err}`)
  }
  log('✅ Binary built')

  // ── 3. Spawn the compiled binary ──────────────────────────────────────────
  const backendEnv: Record<string, string> = {
    ...process.env as Record<string, string>,
    ENV: 'test',
    DB_TYPE: 'postgres',
    DB_HOST: pgContainer.getHost(),
    DB_PORT: String(pgContainer.getMappedPort(5432)),
    DB_NAME: 'e2e_testdb',
    DB_USER: 'e2e_user',
    DB_PASSWORD: 'e2e_pass',
    DB_SSL_MODE: 'disable',
    JWT_SECRET: 'e2e-playwright-jwt-secret-must-be-at-least-32-characters-long',
    SERVER_PORT: '8080',
    SERVER_HOST: '0.0.0.0',
    GEMINI_API_KEY: '',
    ADMIN_ENABLED: 'false',
  }

  log('🚀 Starting backend...')
  const backendProcess: ChildProcess = spawn(binaryPath, [], {
    cwd: backendCwd,
    env: backendEnv,
    stdio: ['ignore', 'pipe', 'pipe'],
  })

  backendProcess.stdout?.on('data', (chunk: Buffer) => {
    verboseLog(`[backend stdout] ${chunk.toString().trimEnd()}`)
  })

  backendProcess.stderr?.on('data', (chunk: Buffer) => {
    verboseLog(`[backend stderr] ${chunk.toString().trimEnd()}`)
  })

  backendProcess.on('exit', (code, signal) => {
    if (code !== null && code !== 0) {
      console.error(`[global-setup] Backend process exited with code ${code} (signal=${signal})`)
    }
  })

  // ── 3. Wait for healthy backend ───────────────────────────────────────────
  await waitForBackend(HEALTH_TIMEOUT_MS)

  // ── 4. Return teardown ────────────────────────────────────────────────────
  return async (): Promise<void> => {
    log('🛑 Tearing down backend and PostgreSQL...')

    // Kill backend process
    if (!backendProcess.killed) {
      backendProcess.kill('SIGTERM')
      // Give it a moment to exit gracefully; force-kill if needed
      await new Promise<void>((resolve) => {
        const timer = setTimeout(() => {
          if (!backendProcess.killed) {
            backendProcess.kill('SIGKILL')
          }
          resolve()
        }, 5_000)
        backendProcess.on('exit', () => {
          clearTimeout(timer)
          resolve()
        })
      })
    }

    // Remove the compiled binary
    try { rmSync(binaryPath) } catch { /* ignore */ }

    // Stop container
    await pgContainer.stop()
    log('✅ Teardown complete')
  }
}
