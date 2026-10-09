package auth

import (
	"strings"
	"sync"
	"time"
)

// loginAttemptLimiter tracks failed password logins per (email, client IP)
// and locks that pair out for lockTime once maxAttempts failures accumulate
// within lockTime. Keying on the pair (not the email alone) stops online
// password guessing without letting a third party lock a victim out from
// every network.
//
// State is in-process memory: with several replicas each one enforces its own
// budget, which still bounds guessing to maxAttempts × replicas per window.
type loginAttemptLimiter struct {
	mu          sync.Mutex
	entries     map[string]*loginAttempts
	maxAttempts int
	lockTime    time.Duration
	now         func() time.Time
	lastSweep   time.Time
}

type loginAttempts struct {
	failures    int
	firstFail   time.Time
	lockedUntil time.Time
}

const (
	defaultMaxLoginAttempts = 5
	defaultAccountLockTime  = 15 * time.Minute
)

func newLoginAttemptLimiter(maxAttempts int, lockTime time.Duration) *loginAttemptLimiter {
	if maxAttempts <= 0 {
		maxAttempts = defaultMaxLoginAttempts
	}
	if lockTime <= 0 {
		lockTime = defaultAccountLockTime
	}
	return &loginAttemptLimiter{
		entries:     make(map[string]*loginAttempts),
		maxAttempts: maxAttempts,
		lockTime:    lockTime,
		now:         time.Now,
	}
}

func loginAttemptKey(email, ip string) string {
	return strings.ToLower(strings.TrimSpace(email)) + "|" + ip
}

// retryAfter returns how long the key is still locked out (0 if it is not).
func (l *loginAttemptLimiter) retryAfter(key string) time.Duration {
	l.mu.Lock()
	defer l.mu.Unlock()

	e, ok := l.entries[key]
	if !ok {
		return 0
	}
	if wait := e.lockedUntil.Sub(l.now()); wait > 0 {
		return wait
	}
	return 0
}

// recordFailure registers a failed attempt and reports the lockout duration
// if this failure triggered one.
func (l *loginAttemptLimiter) recordFailure(key string) time.Duration {
	l.mu.Lock()
	defer l.mu.Unlock()

	now := l.now()
	l.sweepLocked(now)

	e, ok := l.entries[key]
	if !ok || now.Sub(e.firstFail) > l.lockTime {
		e = &loginAttempts{firstFail: now}
		l.entries[key] = e
	}
	e.failures++
	if e.failures >= l.maxAttempts {
		e.lockedUntil = now.Add(l.lockTime)
		e.failures = 0
		e.firstFail = now
		return l.lockTime
	}
	return 0
}

// recordSuccess clears the failure history of the key.
func (l *loginAttemptLimiter) recordSuccess(key string) {
	l.mu.Lock()
	defer l.mu.Unlock()
	delete(l.entries, key)
}

// sweepLocked evicts stale entries at most once per lockTime so the map
// cannot grow without bound. Caller holds the lock.
func (l *loginAttemptLimiter) sweepLocked(now time.Time) {
	if now.Sub(l.lastSweep) < l.lockTime {
		return
	}
	l.lastSweep = now
	for k, e := range l.entries {
		if now.After(e.lockedUntil) && now.Sub(e.firstFail) > l.lockTime {
			delete(l.entries, k)
		}
	}
}

func (l *loginAttemptLimiter) size() int {
	l.mu.Lock()
	defer l.mu.Unlock()
	return len(l.entries)
}
