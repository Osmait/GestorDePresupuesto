package mcp

import (
	"context"
	"fmt"
	"strings"

	"github.com/mark3labs/mcp-go/mcp"
)

// registerPrompts registers prompts that walk the assistant through the
// app's two recurring chores with the tools above.
func (s *MCPServer) registerPrompts() {
	s.server.AddPrompt(
		mcp.NewPrompt("monthly_review",
			mcp.WithPromptDescription("Revisión mensual: ingresos, gastos, presupuestos, tarjetas y patrimonio de un mes"),
			mcp.WithArgument("month", mcp.ArgumentDescription("Mes a revisar, YYYY-MM (por defecto el mes actual)")),
		),
		handleMonthlyReviewPrompt,
	)
	s.server.AddPrompt(
		mcp.NewPrompt("reconcile_accounts",
			mcp.WithPromptDescription("Cuadrar mis cuentas y tarjetas con lo que muestra el banco"),
		),
		handleReconcileAccountsPrompt,
	)
}

func handleMonthlyReviewPrompt(_ context.Context, req mcp.GetPromptRequest) (*mcp.GetPromptResult, error) {
	month := strings.TrimSpace(req.Params.Arguments["month"])
	period := "el mes actual"
	if month != "" {
		period = "el mes " + month
	}
	text := fmt.Sprintf(`Haz la revisión financiera de %s con las herramientas del Gestor de Presupuesto.

1. balance_by_period y financial_summary del periodo: ingresos, gastos y ahorro, comparados con el mes anterior.
2. analyze_spending y list_transactions (filtra por fechas): las 5 categorías con más gasto y cualquier gasto inusual.
3. list_budgets: qué presupuestos se pasaron o están por encima del 80%%.
4. credit_card_summary: deuda de cada tarjeta y uso del límite.
5. get_net_worth: patrimonio neto actual.
6. list_recurring_transactions y get_monthly_plan: compromisos fijos del mes siguiente.

Termina con un resumen corto en español y como máximo 3 acciones concretas. Los montos en DOP, salvo que la cuenta sea en USD.`, period)
	return mcp.NewGetPromptResult("Revisión mensual",
		[]mcp.PromptMessage{mcp.NewPromptMessage(mcp.RoleUser, mcp.NewTextContent(text))}), nil
}

func handleReconcileAccountsPrompt(_ context.Context, _ mcp.GetPromptRequest) (*mcp.GetPromptResult, error) {
	text := `Ayúdame a cuadrar mis cuentas con el banco, una por una.

1. list_accounts: muéstrame cada cuenta bancaria con su saldo en la app y cuándo se cuadró por última vez (last_reconciled_at).
2. Para cada cuenta, pregúntame el saldo que muestra el banco ahora. Si te doy un estado de cuenta, compáralo con list_transactions de ese periodo y dime qué movimientos faltan; regístralos con create_transaction solo si te lo confirmo.
3. Con el saldo del banco, usa reconcile_account: crea un ajuste por la diferencia que quede (no cuenta como ingreso ni gasto).
4. Tarjetas: list_credit_cards; pregúntame la deuda de cada estado de cuenta y usa reconcile_account con esa deuda en negativo (debo 1000 -> -1000) en su moneda.

No cuadres ni registres nada sin que te confirme el monto. Al final dame un resumen de los ajustes hechos.`
	return mcp.NewGetPromptResult("Cuadrar cuentas",
		[]mcp.PromptMessage{mcp.NewPromptMessage(mcp.RoleUser, mcp.NewTextContent(text))}), nil
}
