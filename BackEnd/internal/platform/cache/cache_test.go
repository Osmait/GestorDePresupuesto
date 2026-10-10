package cache

import (
	"fmt"
	"sync"
	"testing"
	"time"
)

func get(c *InMemoryCache, key string) bool {
	_, ok := c.Get(key)
	return ok
}

func TestDeleteByPrefix_InvalidatesOnlyMatchingKeys(t *testing.T) {
	c := NewInMemoryCache(time.Minute, time.Minute)
	keys := []string{
		"transactions:user:u1:filter:{\"a\":1}:summary:true",
		"transactions:user:u1:filter:{}:summary:false",
		"transactions:user:u2:filter:{}:summary:false",
		"transactions:user:u10:filter:{}:summary:false",
		"ai:analyze:u1:2026-01-01:2026-02-01",
		"ai:extract:v2:u1:hash:pdf",
		"short",
	}
	for _, k := range keys {
		c.Set(k, k, time.Minute)
	}
	for _, k := range keys {
		if !get(c, k) {
			t.Fatalf("%s not cached", k)
		}
	}

	c.DeleteByPrefix("transactions:user:u1:")
	want := map[string]bool{keys[0]: false, keys[1]: false, keys[2]: true, keys[3]: true, keys[4]: true, keys[5]: true, keys[6]: true}
	for k, ok := range want {
		if get(c, k) != ok {
			t.Errorf("after user prefix: %s cached=%v, want %v", k, !ok, ok)
		}
	}

	// the old prefix shape (no trailing ':') still matches by prefix: u1 and u10
	c.Set(keys[0], 1, time.Minute)
	c.DeleteByPrefix("transactions:user:u1")
	if get(c, keys[0]) || get(c, keys[3]) || !get(c, keys[2]) {
		t.Errorf("short prefix: u1=%v u10=%v u2=%v", get(c, keys[0]), get(c, keys[3]), get(c, keys[2]))
	}

	// a prefix that matches nothing (keys use ai:extract:v2:) changes nothing
	c.DeleteByPrefix("ai:extract:u1:")
	if !get(c, keys[5]) || !get(c, keys[4]) {
		t.Error("unrelated ai keys invalidated")
	}

	c.DeleteByPrefix("sh")
	if get(c, "short") {
		t.Error("short key not invalidated")
	}

	// new entries after an invalidation are visible again
	c.Set(keys[1], "fresh", time.Minute)
	if v, ok := c.Get(keys[1]); !ok || v != "fresh" {
		t.Errorf("fresh entry: %v %v", v, ok)
	}
	c.Delete(keys[1])
	if get(c, keys[1]) {
		t.Error("Delete")
	}
	c.Flush()
	if get(c, keys[2]) {
		t.Error("Flush")
	}
}

func TestInMemoryCache_Concurrent(t *testing.T) {
	c := NewInMemoryCache(time.Minute, time.Minute)
	var wg sync.WaitGroup
	for g := 0; g < 8; g++ {
		wg.Add(1)
		go func(g int) {
			defer wg.Done()
			for i := 0; i < 500; i++ {
				k := fmt.Sprintf("transactions:user:u%d:filter:%d", g%3, i%10)
				c.Set(k, i, time.Minute)
				c.Get(k)
				if i%50 == 0 {
					c.DeleteByPrefix(fmt.Sprintf("transactions:user:u%d:", g%3))
				}
			}
		}(g)
	}
	wg.Wait()
}

func BenchmarkDeleteByPrefix_10kEntries(b *testing.B) {
	c := NewInMemoryCache(time.Minute, time.Minute)
	for i := 0; i < 10000; i++ {
		c.Set(fmt.Sprintf("transactions:user:u%d:filter:%d", i%500, i), i, time.Minute)
	}
	b.ResetTimer()
	for i := 0; i < b.N; i++ {
		c.DeleteByPrefix("transactions:user:u7:")
	}
}

func TestDeleteByPrefix_FreesOldEntries(t *testing.T) {
	c := NewInMemoryCache(time.Minute, time.Minute)
	for round := 0; round < 100; round++ {
		for i := 0; i < 10; i++ {
			c.Set(fmt.Sprintf("transactions:user:u1:filter:%d", i), i, time.Minute)
		}
		c.Set("transactions:user:u2:filter:0", round, time.Minute)
		c.DeleteByPrefix("transactions:user:u1:")
	}
	if n := c.cache.ItemCount(); n != 1 {
		t.Errorf("stored items after invalidations = %d, want 1 (u2 only)", n)
	}
	if len(c.members) != 1 {
		t.Errorf("indexed groups = %d, want 1", len(c.members))
	}

	c.Delete("transactions:user:u2:filter:0")
	c.Set("ai:analyze:u1:x", 1, time.Nanosecond)
	time.Sleep(time.Millisecond)
	c.cache.DeleteExpired()
	if n := c.cache.ItemCount(); n != 0 || len(c.members) != 0 {
		t.Errorf("after Delete and expiry: items=%d groups=%d, want 0 and 0", n, len(c.members))
	}
}
