package mcp

import (
	"encoding/json"
	"fmt"

	"github.com/mark3labs/mcp-go/mcp"

	"github.com/osmait/gestorDePresupuesto/internal/domain/money"
)

// amountArg reads a numeric tool argument as an exact money.Amount.
//
// This is a float boundary: mcp-go decodes tool arguments with encoding/json
// into map[string]any, so JSON numbers arrive as float64. They are converted
// exactly once here (shortest decimal representation, rounded half-even to
// places); numeric strings are parsed without any float step. A missing or
// null argument yields zero.
func amountArg(req mcp.CallToolRequest, key string, places int32) (money.Amount, error) {
	raw, ok := req.GetArguments()[key]
	if !ok || raw == nil {
		return money.Zero, nil
	}
	switch v := raw.(type) {
	case float64:
		return money.FromExternalFloat(v, places)
	case int:
		return money.FromInt(int64(v)), nil
	case int64:
		return money.FromInt(v), nil
	case json.Number:
		a, err := money.Parse(v.String())
		return a.Round(places), err
	case string:
		a, err := money.Parse(v)
		return a.Round(places), err
	default:
		return money.Zero, fmt.Errorf("%s must be a number", key)
	}
}
