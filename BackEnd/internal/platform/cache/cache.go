package cache

import (
	"time"

	"github.com/patrickmn/go-cache"
)

type CacheRepository interface {
	Get(key string) (interface{}, bool)
	Set(key string, value interface{}, duration time.Duration)
	Delete(key string)
	DeleteByPrefix(prefix string)
	Flush()
}

type InMemoryCache struct {
	cache *cache.Cache
}

func NewInMemoryCache(defaultExpiration, cleanupInterval time.Duration) *InMemoryCache {
	return &InMemoryCache{
		cache: cache.New(defaultExpiration, cleanupInterval),
	}
}

func (c *InMemoryCache) Get(key string) (interface{}, bool) {
	return c.cache.Get(key)
}

func (c *InMemoryCache) Set(key string, value interface{}, duration time.Duration) {
	c.cache.Set(key, value, duration)
}

func (c *InMemoryCache) Delete(key string) {
	c.cache.Delete(key)
}

func (c *InMemoryCache) DeleteByPrefix(prefix string) {
	items := c.cache.Items()
	for k := range items {
		if len(k) >= len(prefix) && k[:len(prefix)] == prefix {
			c.cache.Delete(k)
		}
	}
}

func (c *InMemoryCache) Flush() {
	c.cache.Flush()
}
