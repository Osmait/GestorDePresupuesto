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
// segments, e.g. "transactions:user:<id>:") just bumps that one counter: the
// group's old entries become unreachable at once and expire with their TTL
// (go-cache's janitor frees them). Before, DeleteByPrefix copied and scanned
// every item of the cache (go-cache Items()) on each write.
//
// Bumping the whole group can invalidate more than the prefix asked for
// (never less), which only costs cache misses. Shorter prefixes bump every
// known group they cover.
type InMemoryCache struct {
	cache *cache.Cache

	mu          sync.RWMutex
	generations map[string]uint64
}

func NewInMemoryCache(defaultExpiration, cleanupInterval time.Duration) *InMemoryCache {
	return &InMemoryCache{
		cache:       cache.New(defaultExpiration, cleanupInterval),
		generations: make(map[string]uint64),
	}
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
	c.cache.Set(c.storedKey(key, true), value, duration)
}

func (c *InMemoryCache) Delete(key string) {
	c.cache.Delete(c.storedKey(key, false))
}

func (c *InMemoryCache) DeleteByPrefix(prefix string) {
	c.mu.Lock()
	defer c.mu.Unlock()
	if group, whole := groupOf(prefix); whole {
		c.generations[group]++
		return
	}
	for group := range c.generations {
		if strings.HasPrefix(group, prefix) {
			c.generations[group]++
		}
	}
}

func (c *InMemoryCache) Flush() {
	c.cache.Flush()
}
