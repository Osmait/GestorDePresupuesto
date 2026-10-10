package user

import (
	"context"
	"sync"
	"time"

	dto "github.com/osmait/gestorDePresupuesto/internal/platform/dto/user"
	"github.com/osmait/gestorDePresupuesto/internal/platform/storage/postgress/txhelper"
)

// maxAuthCacheEntries bounds memory: when exceeded the cache is reset.
const maxAuthCacheEntries = 50000

// authUserCache is a short-TTL cache for the auth middleware's per-request
// "user exists and is active" lookup, the most frequent query of the API.
//
// Staleness is bounded: every user mutation made through UserService
// (update, role change, soft/hard delete, demo cleanup) invalidates the
// entry immediately and again after the request transaction ends; other
// instances, and writes made outside UserService, are picked up when the
// entry expires. Keep the TTL short (AUTH_USER_CACHE_TTL, default 15s).
type authUserCache struct {
	ttl time.Duration
	now func() time.Time

	mu         sync.Mutex
	generation uint64
	entries    map[string]authUserEntry
}

type authUserEntry struct {
	user    dto.UserResponse
	expires time.Time
}

func newAuthUserCache(ttl time.Duration) *authUserCache {
	return &authUserCache{ttl: ttl, now: time.Now, entries: make(map[string]authUserEntry)}
}

func (c *authUserCache) get(id string) (*dto.UserResponse, uint64, bool) {
	c.mu.Lock()
	defer c.mu.Unlock()
	if e, ok := c.entries[id]; ok && c.now().Before(e.expires) {
		u := e.user // copy: callers may mutate their pointer
		return &u, c.generation, true
	}
	return nil, c.generation, false
}

func (c *authUserCache) put(id string, u *dto.UserResponse, generation uint64) {
	c.mu.Lock()
	defer c.mu.Unlock()
	if generation != c.generation {
		return // a mutation happened while we were reading: do not cache
	}
	if len(c.entries) >= maxAuthCacheEntries {
		c.entries = make(map[string]authUserEntry)
	}
	c.entries[id] = authUserEntry{user: *u, expires: c.now().Add(c.ttl)}
}

func (c *authUserCache) invalidate(id string) {
	c.mu.Lock()
	defer c.mu.Unlock()
	c.generation++
	delete(c.entries, id)
}

func (c *authUserCache) invalidateAll() {
	c.mu.Lock()
	defer c.mu.Unlock()
	c.generation++
	c.entries = make(map[string]authUserEntry)
}

// EnableAuthCache turns on the auth lookup cache with the given TTL
// (ttl <= 0 leaves it disabled). Call it once at wiring time.
func (u *UserService) EnableAuthCache(ttl time.Duration) {
	if ttl <= 0 {
		u.authCache = nil
		return
	}
	u.authCache = newAuthUserCache(ttl)
}

// FindActiveUserForAuth is FindUserById for the auth middleware: it returns
// the user only while it exists and is not soft-deleted, served from the
// short-TTL cache when enabled. Errors are never cached.
func (u *UserService) FindActiveUserForAuth(ctx context.Context, id string) (*dto.UserResponse, error) {
	c := u.authCache
	if c == nil {
		return u.FindUserById(ctx, id)
	}
	cached, generation, ok := c.get(id)
	if ok {
		return cached, nil
	}
	found, err := u.FindUserById(ctx, id)
	if err != nil {
		return nil, err
	}
	c.put(id, found, generation)
	return found, nil
}

// invalidateAuthUser drops id from the auth cache now and again once the
// request transaction carried by ctx has finished (a concurrent lookup
// between the write and the commit would otherwise re-cache the old row).
func (u *UserService) invalidateAuthUser(ctx context.Context, id string) {
	c := u.authCache
	if c == nil {
		return
	}
	c.invalidate(id)
	txhelper.AfterTx(ctx, func() { c.invalidate(id) })
}

func (u *UserService) invalidateAllAuthUsers(ctx context.Context) {
	c := u.authCache
	if c == nil {
		return
	}
	c.invalidateAll()
	txhelper.AfterTx(ctx, c.invalidateAll)
}
