package auth

import (
	"context"
	"fmt"
	"testing"
	"time"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

// An attacker rotating IPs never trips the (email, IP) lockout, but the
// account lockout stops it after LoginAccountMaxFailures failures, with an
// exponentially growing lock; a successful login resets the account.
func TestLogin_AccountLockoutAcrossIPs(t *testing.T) {
	cfg := hardeningConfig() // 3 attempts per (email, IP)
	cfg.Security.LoginAccountMaxFailures = 10
	cfg.Security.LoginAccountWindow = 15 * time.Minute
	cfg.Security.LoginAccountLockTime = 15 * time.Minute
	cfg.Security.LoginAccountMaxLockTime = time.Hour
	svc := NewAuthService(newUsersWithAlice(t), nil, nil, nil, nil, cfg)
	now := time.Now()
	svc.loginLimiter.now = func() time.Time { return now }
	svc.accountLimiter.now = func() time.Time { return now }
	ctx := context.Background()

	guessFrom := func(n int) {
		t.Helper()
		for i := 0; i < n; i++ {
			_, err := svc.LoginFromIP(ctx, loginReq("Alice@Example.com ", "guess"), fmt.Sprintf("10.0.%d.%d", n, i))
			require.ErrorIs(t, err, ErrInvalidCredentials, "attempt %d", i+1)
		}
	}
	requireLocked := func(want time.Duration) {
		t.Helper()
		// Even the right password from a fresh IP is refused.
		_, err := svc.LoginFromIP(ctx, loginReq("alice@example.com", testPassword), "203.0.113.9")
		var locked *LoginLockedError
		require.ErrorAs(t, err, &locked)
		assert.InDelta(t, want.Seconds(), locked.RetryAfter.Seconds(), 1)
	}

	guessFrom(10) // ten IPs, one guess each (the email is normalized)
	requireLocked(15 * time.Minute)

	// Backoff: the next round of failures locks for twice as long, then four
	// times, capped at the maximum.
	now = now.Add(15*time.Minute + time.Second)
	guessFrom(10)
	requireLocked(30 * time.Minute)
	now = now.Add(30*time.Minute + time.Second)
	guessFrom(10)
	requireLocked(time.Hour)
	now = now.Add(time.Hour + time.Second)
	guessFrom(10)
	requireLocked(time.Hour)

	// After the lock, a successful login resets the account.
	now = now.Add(time.Hour + time.Second)
	_, err := svc.LoginFromIP(ctx, loginReq("alice@example.com", testPassword), "203.0.113.9")
	require.NoError(t, err)
	guessFrom(9)
	_, err = svc.LoginFromIP(ctx, loginReq("alice@example.com", testPassword), "203.0.113.9")
	require.NoError(t, err, "nine failures do not lock, and the count starts again from zero")

	// The MCP OAuth login page authenticates through the same service (no
	// client IP): it is subject to the same account lock.
	guessFrom(10)
	_, err = svc.Login(ctx, loginReq("alice@example.com", testPassword))
	assert.ErrorIs(t, err, ErrTooManyLoginAttempts)
}

func TestAccountLoginLimiter_WindowSweepAndDefaults(t *testing.T) {
	l := newAccountLoginLimiter(2, time.Minute, time.Minute, 4*time.Minute)
	now := time.Now()
	l.now = func() time.Time { return now }

	assert.Zero(t, l.recordFailure("a@example.com"))
	now = now.Add(2 * time.Minute) // outside the window: does not accumulate
	assert.Zero(t, l.recordFailure("a@example.com"))
	assert.Equal(t, time.Minute, l.recordFailure("A@example.com"))
	assert.Greater(t, l.retryAfter("a@example.com"), time.Duration(0))

	// A long quiet period after a lock forgets the backoff.
	now = now.Add(10 * time.Minute)
	assert.Zero(t, l.retryAfter("a@example.com"))
	l.recordFailure("a@example.com")
	assert.Equal(t, time.Minute, l.recordFailure("a@example.com"), "back to the base lock")

	// Stale entries are swept.
	l.recordFailure("b@example.com")
	now = now.Add(time.Hour)
	l.recordFailure("c@example.com")
	assert.Equal(t, 1, l.size())

	d := newAccountLoginLimiter(0, 0, 0, 0)
	assert.Equal(t, defaultAccountMaxFailures, d.maxFailures)
	assert.Equal(t, defaultAccountWindow, d.window)
	assert.Equal(t, defaultAccountBaseLock, d.baseLock)
	assert.Equal(t, defaultAccountMaxLock, d.maxLock)
	assert.Equal(t, 2*time.Hour, newAccountLoginLimiter(1, time.Minute, 2*time.Hour, time.Hour).maxLock,
		"the maximum lock is never below the base lock")
}
