package routes

import (
	aiHandler "github.com/osmait/gestorDePresupuesto/internal/platform/server/handler/ai"
	"github.com/osmait/gestorDePresupuesto/internal/platform/server/middleware"

	"github.com/gin-gonic/gin"
)

// AIProviderRoutes registers the AI routes that call the AI provider
// (extraction, reconciliation preview, spending analysis). A provider call
// can take minutes with retries, so these routes must be registered BEFORE
// RLSMiddleware: they do their database reads and writes in short
// transactions of their own (txhelper.WithUserTx) and hold no pooled
// connection while waiting for the provider. maxConcurrent caps provider
// calls in flight across all users (AI_MAX_CONCURRENT_CALLS); beyond it they
// fail fast with 503.
func AIProviderRoutes(r gin.IRoutes, handler *aiHandler.Handler, flags *middleware.FeatureFlags, maxConcurrent int) {
	limit := middleware.ConcurrencyLimit("ai_provider", maxConcurrent)
	r.POST("/ai/extract/transactions", flags.Require("ai_extraction"), limit, handler.ExtractTransactions)
	r.POST("/ai/reconcile/preview", flags.Require("ai_reconciliation"), limit, handler.ReconciliationPreview)
	r.POST("/ai/analyze/spending", flags.Require("ai_extraction"), limit, handler.AnalyzeSpending)
}

// AIRoutes registers the AI routes that only use the database; they run
// under RLSMiddleware like any other route.
func AIRoutes(r *gin.Engine, handler *aiHandler.Handler, flags *middleware.FeatureFlags) {
	ai := r.Group("/ai")
	{
		ai.GET("/reconcile/:session_id", flags.Require("ai_reconciliation"), handler.GetReconciliationSession)
		ai.POST("/reconcile/:session_id/apply", flags.Require("ai_reconciliation"), handler.ApplyReconciliationSession)
		ai.POST("/goals/savings-plan", flags.Require("ai_savings_plan"), handler.SavingsPlan)
		ai.POST("/goals", flags.Require("ai_savings_goals_crud"), handler.CreateSavingsGoal)
		ai.GET("/goals", flags.Require("ai_savings_goals_crud"), handler.ListSavingsGoals)
		ai.PATCH("/goals/:goal_id", flags.Require("ai_savings_goals_crud"), handler.UpdateSavingsGoal)
		ai.DELETE("/goals/:goal_id", flags.Require("ai_savings_goals_crud"), handler.DeleteSavingsGoal)
		ai.GET("/goals/:goal_id/progress", flags.Require("ai_savings_goals_crud"), handler.GetSavingsGoalProgress)
		ai.POST("/suggest-category", flags.Require("ai_category_suggestions"), handler.SuggestCategory)
		ai.POST("/suggest-categories/batch", flags.Require("ai_category_suggestions"), handler.SuggestCategoriesBatch)
	}
}
