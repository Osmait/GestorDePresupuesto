package mcp

import (
	"context"
	"testing"
	"time"

	"github.com/mark3labs/mcp-go/mcp"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

// Every registered tool carries the annotations of its kind, and toolKinds
// has no stale entries.
func TestTools_AreAnnotatedByKind(t *testing.T) {
	t.Parallel()
	tools := NewMCPServer("test", "0", &Services{}, nil).GetServer().ListTools()
	require.Len(t, tools, len(toolKinds), "toolKinds and the registered tools must match")

	for name, st := range tools {
		kind, ok := toolKinds[name]
		require.True(t, ok, name)
		a := st.Tool.Annotations
		require.NotNil(t, a.ReadOnlyHint, name)
		require.NotNil(t, a.DestructiveHint, name)
		require.NotNil(t, a.IdempotentHint, name)
		require.NotNil(t, a.OpenWorldHint, name)
		assert.Equal(t, kind == kindRead, *a.ReadOnlyHint, "%s readOnly", name)
		assert.Equal(t, kind == kindUpdate || kind == kindDelete, *a.DestructiveHint, "%s destructive", name)
		assert.Equal(t, kind != kindCreate, *a.IdempotentHint, "%s idempotent", name)
		assert.False(t, *a.OpenWorldHint, "%s openWorld", name)
	}
	assert.Equal(t, kindDelete, toolKinds["delete_transaction"])
	assert.Equal(t, kindCreate, toolKinds["pay_credit_card"], "paying twice pays twice")
}

func TestTools_UnannotatedToolPanics(t *testing.T) {
	t.Parallel()
	s := NewMCPServer("test", "0", &Services{}, nil)
	assert.Panics(t, func() {
		s.addTool(mcp.NewTool("not_in_the_table"), nil)
	})
}

func TestPrompts_AreRegisteredAndUseTheMonth(t *testing.T) {
	t.Parallel()
	prompts := NewMCPServer("test", "0", &Services{}, nil).GetServer().ListPrompts()
	require.Contains(t, prompts, "monthly_review")
	require.Contains(t, prompts, "reconcile_accounts")

	req := mcp.GetPromptRequest{}
	req.Params.Arguments = map[string]string{"month": "2026-09"}
	res, err := prompts["monthly_review"].Handler(context.Background(), req)
	require.NoError(t, err)
	require.Len(t, res.Messages, 1)
	text := res.Messages[0].Content.(mcp.TextContent).Text
	assert.Contains(t, text, "el mes 2026-09")
	assert.Contains(t, text, "80%")
	assert.NotContains(t, text, "%!")
}

func TestParseTransactionDate(t *testing.T) {
	t.Parallel()
	for _, tc := range []struct {
		in   string
		want time.Time
	}{
		// A calendar day is noon UTC: the same day in UTC and in Santo Domingo.
		{"2026-10-29", time.Date(2026, 10, 29, 12, 0, 0, 0, time.UTC)},
		{"2026/10/29", time.Date(2026, 10, 29, 12, 0, 0, 0, time.UTC)},
		{"2026-10-29T08:30:00-04:00", time.Date(2026, 10, 29, 12, 30, 0, 0, time.UTC)},
	} {
		got, err := parseTransactionDate(tc.in)
		require.NoError(t, err, tc.in)
		assert.True(t, got.Equal(tc.want), "%s -> %s", tc.in, got)
	}
	for _, bad := range []string{"29/10/2026", "yesterday", "2026-13-01"} {
		_, err := parseTransactionDate(bad)
		assert.Error(t, err, bad)
	}
}
