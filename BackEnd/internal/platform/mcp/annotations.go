package mcp

import (
	"fmt"

	"github.com/mark3labs/mcp-go/mcp"
	"github.com/mark3labs/mcp-go/server"
)

// toolKind is what a tool does to the user's data, published as MCP tool
// annotations so clients can skip confirmation for reads and ask before
// destructive calls.
type toolKind int

const (
	kindRead toolKind = iota
	// kindCreate adds data and never overwrites or removes any; calling it
	// twice creates twice.
	kindCreate
	// kindUpdate overwrites existing data; repeating the same call is a no-op.
	kindUpdate
	// kindDelete removes data; repeating the same call is a no-op.
	kindDelete
)

// toolKinds lists every tool the server registers. addTool refuses a tool
// missing here, so a new tool cannot ship without its annotations.
var toolKinds = map[string]toolKind{
	// reads
	"list_accounts":                kindRead,
	"list_categories":              kindRead,
	"list_transactions":            kindRead,
	"get_balance":                  kindRead,
	"analyze_spending":             kindRead,
	"balance_by_period":            kindRead,
	"financial_summary":            kindRead,
	"get_net_worth":                kindRead,
	"list_credit_cards":            kindRead,
	"credit_card_summary":          kindRead,
	"list_loans":                   kindRead,
	"get_loan":                     kindRead,
	"loan_summary":                 kindRead,
	"list_account_reconciliations": kindRead,
	"list_budgets":                 kindRead,
	"list_recurring_transactions":  kindRead,
	"get_monthly_plan":             kindRead,
	"search":                       kindRead,
	// creates
	"create_transaction":           kindCreate,
	"create_account":               kindCreate,
	"create_category":              kindCreate,
	"create_loan":                  kindCreate,
	"register_loan_payment":        kindCreate,
	"pay_credit_card":              kindCreate,
	"create_budget":                kindCreate,
	"create_recurring_transaction": kindCreate,
	// updates (reconciling to the same balance twice changes nothing)
	"update_transaction":        kindUpdate,
	"update_account":            kindUpdate,
	"update_category":           kindUpdate,
	"update_budget":             kindUpdate,
	"reconcile_account":         kindUpdate,
	"reset_credit_card_balance": kindUpdate,
	// deletes
	"delete_transaction":           kindDelete,
	"delete_account":               kindDelete,
	"delete_category":              kindDelete,
	"delete_budget":                kindDelete,
	"delete_recurring_transaction": kindDelete,
}

// addTool registers tool with the annotations of its kind. Every tool acts on
// the app's own data only (openWorld false).
func (s *MCPServer) addTool(tool mcp.Tool, handler server.ToolHandlerFunc) {
	kind, ok := toolKinds[tool.Name]
	if !ok {
		panic(fmt.Sprintf("mcp: tool %q has no entry in toolKinds", tool.Name))
	}
	readOnly := kind == kindRead
	destructive := kind == kindUpdate || kind == kindDelete
	idempotent := kind != kindCreate
	openWorld := false
	tool.Annotations.ReadOnlyHint = &readOnly
	tool.Annotations.DestructiveHint = &destructive
	tool.Annotations.IdempotentHint = &idempotent
	tool.Annotations.OpenWorldHint = &openWorld
	s.server.AddTool(tool, handler)
}
