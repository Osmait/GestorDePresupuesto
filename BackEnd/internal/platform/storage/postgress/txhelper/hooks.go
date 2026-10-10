package txhelper

import (
	"context"
	"sync"

	"github.com/gin-gonic/gin"
)

// TxHooks collects callbacks that must run once the request-scoped
// transaction has finished (committed or rolled back). In-memory caches use
// it to drop entries only after their writes are visible to other
// connections: invalidating before the commit would let a concurrent request
// re-cache the old value for a whole TTL.
//
// Callbacks registered with AfterCommit only run when the owner reported a
// successful commit (MarkCommitted) before Run.
type TxHooks struct {
	mu        sync.Mutex
	fns       []func()
	commitFns []func()
	committed bool
	done      bool
}

type hooksKey struct{}

// ginHooksKey is the gin.Context key under which RLSMiddleware stores the hooks.
const ginHooksKey = "db_tx_hooks"

// NewTxHooks returns an empty hook list.
func NewTxHooks() *TxHooks { return &TxHooks{} }

// WithTxHooks returns a copy of ctx carrying h.
func WithTxHooks(ctx context.Context, h *TxHooks) context.Context {
	return context.WithValue(ctx, hooksKey{}, h)
}

// SetGinTxHooks stores h in the gin context so handlers that pass the
// *gin.Context (rather than c.Request.Context()) find it too.
func SetGinTxHooks(c *gin.Context, h *TxHooks) {
	c.Set(ginHooksKey, h)
}

// MarkCommitted records that the transaction committed; AfterCommit
// callbacks then run in Run. Without it they are dropped.
func (h *TxHooks) MarkCommitted() {
	h.mu.Lock()
	h.committed = true
	h.mu.Unlock()
}

// Run executes the registered callbacks once (AfterTx callbacks always,
// AfterCommit callbacks only after MarkCommitted); later AfterTx calls run
// immediately and later AfterCommit calls run only if the transaction
// committed.
func (h *TxHooks) Run() {
	h.mu.Lock()
	fns := h.fns
	commitFns := h.commitFns
	committed := h.committed
	h.fns, h.commitFns = nil, nil
	h.done = true
	h.mu.Unlock()
	for _, fn := range fns {
		fn()
	}
	if committed {
		for _, fn := range commitFns {
			fn()
		}
	}
}

func (h *TxHooks) add(fn func()) bool {
	h.mu.Lock()
	defer h.mu.Unlock()
	if h.done {
		return false
	}
	h.fns = append(h.fns, fn)
	return true
}

// addOnCommit queues fn for after the commit. When the transaction already
// finished it reports whether fn may still run (it committed).
func (h *TxHooks) addOnCommit(fn func()) (queued, runNow bool) {
	h.mu.Lock()
	defer h.mu.Unlock()
	if h.done {
		return false, h.committed
	}
	h.commitFns = append(h.commitFns, fn)
	return true, false
}

func hooksFromContext(ctx context.Context) *TxHooks {
	if ctx == nil {
		return nil
	}
	if h, ok := ctx.Value(hooksKey{}).(*TxHooks); ok && h != nil {
		return h
	}
	ginCtx, ok := ctx.(*gin.Context)
	if !ok {
		ginCtx, _ = ctx.Value(gin.ContextKey).(*gin.Context)
	}
	if ginCtx != nil {
		if v, exists := ginCtx.Get(ginHooksKey); exists {
			if h, ok := v.(*TxHooks); ok {
				return h
			}
		}
		if ginCtx.Request != nil {
			if h, ok := ginCtx.Request.Context().Value(hooksKey{}).(*TxHooks); ok && h != nil {
				return h
			}
		}
	}
	return nil
}

// AfterTx runs fn after the request transaction carried by ctx has finished.
// Without a request transaction (background jobs, pre-auth paths, MCP tools,
// or when the transaction already ended) fn runs immediately.
func AfterTx(ctx context.Context, fn func()) {
	if h := hooksFromContext(ctx); h != nil && h.add(fn) {
		return
	}
	fn()
}

// AfterCommit runs fn only once the request transaction carried by ctx has
// committed; it is dropped when the transaction rolls back. Use it for side
// effects that must not announce data that was never persisted (user
// notifications). Without a request transaction (background jobs, MCP
// tools) fn runs immediately, like AfterTx.
func AfterCommit(ctx context.Context, fn func()) {
	h := hooksFromContext(ctx)
	if h == nil {
		fn()
		return
	}
	if queued, runNow := h.addOnCommit(fn); !queued && runNow {
		fn()
	}
}
