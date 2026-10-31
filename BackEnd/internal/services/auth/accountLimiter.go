package auth

import (
	"strings"
	"sync"
	"time"
)

// accountLoginLimiter bounds failed password logins per account (email)
// across every client IP: the (email, IP) limiter alone puts no ceiling on an
// attacker rotating IPs. After maxFailures failures within window the email
// is locked for baseLock; each further lockout that follows without a
// successful login doubles the lock, up to maxLock. A successful login resets
// the account.
//
// The trade-off: anyone can lock a known email out of password login for a
// while by failing on purpose. Locks start short and are bounded by maxLock,
// and passkey login is not affected.
//
// State is in-process memory, like loginAttemptLimiter: with several replicas
// each one enforces its own budget.
type accountLoginLimiter struct {
	mu          sync.Mutex
	entries     map[string]*accountAttempts
	maxFailures int
	window      time.Duration
	baseLock    time.Duration
	maxLock     time.Duration
	now         func() time.Time
	lastSweep   time.Time
}

type accountAttempts struct {
	failures    int
	firstFail   time.Time
	lockedUntil time.Time
	// lockouts counts the consecutive lockouts (the backoff exponent).
	lockouts int
}

const (
	defaultAccountMaxFailures = 10
	defaultAccountWindow      = 15 * time.Minute
	defaultAccountBaseLock    = 15 * time.Minute
	defaultAccountMaxLock     = 4 * time.Hour
)

func newAccountLoginLimiter(maxFailures int, window, baseLock, maxLock time.Duration) *accountLoginLimiter {
	if maxFailures <= 0 {
		maxFailures = defaultAccountMaxFailures
	}
	if window <= 0 {
		window = defaultAccountWindow
	}
	if baseLock <= 0 {
		baseLock = defaultAccountBaseLock
	}
	if maxLock <= 0 {
		maxLock = defaultAccountMaxLock
	}
	maxLock = max(maxLock, baseLock)
	return &accountLoginLimiter{
		entries:     make(map[string]*accountAttempts),
		maxFailures: maxFailures,
		window:      window,
		baseLock:    baseLock,
		maxLock:     maxLock,
		now:         time.Now,
	}
}

func accountKey(email string) string {
	return strings.ToLower(strings.TrimSpace(email))
}

// retryAfter returns how long the account is still locked (0 if it is not).
func (l *accountLoginLimiter) retryAfter(email string) time.Duration {
	l.mu.Lock()
	defer l.mu.Unlock()
	e, ok := l.entries[accountKey(email)]
	if !ok {
		return 0
	}
	if wait := e.lockedUntil.Sub(l.now()); wait > 0 {
		return wait
	}
	return 0
}

// recordFailure registers a failed attempt and returns the lock duration if
// this failure locked the account.
func (l *accountLoginLimiter) recordFailure(email string) time.Duration {
	l.mu.Lock()
	defer l.mu.Unlock()

	now := l.now()
	l.sweepLocked(now)

	key := accountKey(email)
	e, ok := l.entries[key]
	if !ok {
		e = &accountAttempts{firstFail: now}
		l.entries[key] = e
	}
	if now.Sub(e.firstFail) > l.window {
		e.failures = 0
		e.firstFail = now
	}
	// A long quiet period after the last lock forgets the backoff.
	if e.lockouts > 0 && now.Sub(e.lockedUntil) > l.maxLock {
		e.lockouts = 0
	}
	e.failures++
	if e.failures < l.maxFailures {
		return 0
	}
	lock := l.baseLock
	for i := 0; i < e.lockouts && lock < l.maxLock; i++ {
		lock *= 2
	}
	lock = min(lock, l.maxLock)
	e.lockouts++
	e.lockedUntil = now.Add(lock)
	e.failures = 0
	e.firstFail = now
	return lock
}

// recordSuccess clears the account's failures and backoff.
func (l *accountLoginLimiter) recordSuccess(email string) {
	l.mu.Lock()
	defer l.mu.Unlock()
	delete(l.entries, accountKey(email))
}

// sweepLocked evicts entries that are neither locked, counting failures nor
// remembering a recent backoff, at most once per window. Caller holds the lock.
func (l *accountLoginLimiter) sweepLocked(now time.Time) {
	if now.Sub(l.lastSweep) < l.window {
		return
	}
	l.lastSweep = now
	for k, e := range l.entries {
		if now.Sub(e.firstFail) > l.window && now.Sub(e.lockedUntil) > l.maxLock {
			delete(l.entries, k)
		}
	}
}

func (l *accountLoginLimiter) size() int {
	l.mu.Lock()
	defer l.mu.Unlock()
	return len(l.entries)
}
