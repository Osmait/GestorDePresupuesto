package cache

import (
	"strconv"
	"strings"
	"sync"
	"time"

	"github.com/patrickmn/go-cache"
)

type CacheRepository interface {
	Get(key string) (interface{}, bool)
	Set(key string, value interface{}, duration time.Duration)
	Delete(key string)
	// DeleteByPrefix invalidates every key starting with prefix.
	DeleteByPrefix(prefix string)
	Flush()
}

// groupSegments is the number of leading ':'-separated key segments that
// form a key's invalidation group, e.g. "transactions:user:<id>" or
// "ai:analyze:<id>".
const groupSegments = 3

// InMemoryCache is a go-cache store with O(1) prefix invalidation.
//
// Every key belongs to a group: its first three ':'-separated segments. Each
// group has a generation number that is part of the stored key, so
// DeleteByPrefix on a prefix that spans the whole group (at least three
// segments, e.g. "transactions:user:<id>:") bumps that one counter: the
// group's old entries become unreachable at once. The stored keys of each
// group are also indexed, so the bump deletes the old entries right away
// (cost: the size of that group) instead of leaving them in memory until
// their TTL, which made the heap grow with the write rate. Before,
// DeleteByPrefix copied and scanned every item of the cache (go-cache
// Items()) on each write.
//
// Bumping the whole group can invalidate more than the prefix asked for
// (never less), which only costs cache misses. Shorter prefixes bump every
// known group they cover.
type InMemoryCache struct {
	cache *cache.Cache

	mu          sync.RWMutex
	generations map[string]uint64
	// members holds the stored keys of each group, so a bump can delete
	// them; entries leave it when go-cache evicts them.
	members map[string]map[string]struct{}
}

func NewInMemoryCache(defaultExpiration, cleanupInterval time.Duration) *InMemoryCache {
	c := &InMemoryCache{
		cache:       cache.New(defaultExpiration, cleanupInterval),
		generations: make(map[string]uint64),
		members:     make(map[string]map[string]struct{}),
	}
	// go-cache calls this outside its own lock, on Delete and on expiry.
	c.cache.OnEvicted(func(stored string, _ interface{}) { c.forget(stored) })
	return c
}

// forget removes stored (a go-cache key) from its group's index.
func (c *InMemoryCache) forget(stored string) {
	key := stored[strings.IndexByte(stored, '|')+1:]
	group, _ := groupOf(key)
	c.mu.Lock()
	if set := c.members[group]; set != nil {
		delete(set, stored)
		if len(set) == 0 {
			delete(c.members, group)
		}
	}
	c.mu.Unlock()
}

// groupOf returns the group of key (or of a prefix): everything before the
// third ':', and whether key has that many segments.
func groupOf(key string) (string, bool) {
	idx := 0
	for i := 0; i < groupSegments; i++ {
		j := strings.IndexByte(key[idx:], ':')
		if j < 0 {
			return key, false
		}
		if i == groupSegments-1 {
			return key[:idx+j], true
		}
		idx += j + 1
	}
	return key, false
}

// storedKey maps key to the go-cache key of its group's current generation.
// register records the group so that short prefixes can find it later.
func (c *InMemoryCache) storedKey(key string, register bool) string {
	group, _ := groupOf(key)
	c.mu.RLock()
	gen, known := c.generations[group]
	c.mu.RUnlock()
	if !known && register {
		c.mu.Lock()
		if _, known = c.generations[group]; !known {
			c.generations[group] = 0
		}
		gen = c.generations[group]
		c.mu.Unlock()
	}
	return strconv.FormatUint(gen, 36) + "|" + key
}

func (c *InMemoryCache) Get(key string) (interface{}, bool) {
	return c.cache.Get(c.storedKey(key, false))
}

func (c *InMemoryCache) Set(key string, value interface{}, duration time.Duration) {
	stored := c.storedKey(key, true)
	group, _ := groupOf(key)
	c.mu.Lock()
	set := c.members[group]
	if set == nil {
		set = make(map[string]struct{})
		c.members[group] = set
	}
	set[stored] = struct{}{}
	c.mu.Unlock()
	c.cache.Set(stored, value, duration)
}

func (c *InMemoryCache) Delete(key string) {
	c.cache.Delete(c.storedKey(key, false))
}

func (c *InMemoryCache) DeleteByPrefix(prefix string) {
	var stale []string
	bump := func(group string) {
		c.generations[group]++
		for stored := range c.members[group] {
			stale = append(stale, stored)
		}
		delete(c.members, group)
	}
	c.mu.Lock()
	if group, whole := groupOf(prefix); whole {
		bump(group)
	} else {
		for group := range c.generations {
			if strings.HasPrefix(group, prefix) {
				bump(group)
			}
		}
	}
	c.mu.Unlock()
	// Outside c.mu: Delete runs the OnEvicted callback, which takes it.
	for _, stored := range stale {
		c.cache.Delete(stored)
	}
}

func (c *InMemoryCache) Flush() {
	c.mu.Lock()
	c.members = make(map[string]map[string]struct{})
	c.mu.Unlock()
	c.cache.Flush()
}
