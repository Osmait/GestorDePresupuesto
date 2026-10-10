package txhelper

import (
	"context"
	"testing"

	"github.com/stretchr/testify/assert"
)

func TestAfterCommit_RunsOnlyWhenCommitted(t *testing.T) {
	for _, committed := range []bool{true, false} {
		h := NewTxHooks()
		ctx := WithTxHooks(context.Background(), h)
		var afterTx, afterCommit int
		AfterTx(ctx, func() { afterTx++ })
		AfterCommit(ctx, func() { afterCommit++ })
		assert.Zero(t, afterTx+afterCommit, "nothing runs before the transaction ends")

		if committed {
			h.MarkCommitted()
		}
		h.Run()
		assert.Equal(t, 1, afterTx)
		assert.Equal(t, map[bool]int{true: 1, false: 0}[committed], afterCommit)

		// Registered after the end: AfterTx runs now, AfterCommit only if committed.
		AfterTx(ctx, func() { afterTx++ })
		AfterCommit(ctx, func() { afterCommit++ })
		assert.Equal(t, 2, afterTx)
		assert.Equal(t, map[bool]int{true: 2, false: 0}[committed], afterCommit)
	}
}

func TestAfterCommit_WithoutRequestTxRunsImmediately(t *testing.T) {
	ran := false
	AfterCommit(context.Background(), func() { ran = true })
	assert.True(t, ran)
}
