package routes

import (
	"database/sql"

	aiHandler "github.com/osmait/gestorDePresupuesto/internal/platform/server/handler/ai"
	"github.com/osmait/gestorDePresupuesto/internal/platform/server/middleware"
	categoryRepo "github.com/osmait/gestorDePresupuesto/internal/platform/storage/postgress/category"
	transactionRepo "github.com/osmait/gestorDePresupuesto/internal/platform/storage/postgress/transaction"
	aiService "github.com/osmait/gestorDePresupuesto/internal/services/ai"
	transactionService "github.com/osmait/gestorDePresupuesto/internal/services/transaction"

	"github.com/gin-gonic/gin"
)

func AIRoutes(
	r *gin.Engine,
	aiService *aiService.Service,
	categoryRepo categoryRepo.CategoryRepoInterface,
	transactionRepo transactionRepo.TransactionRepositoryInterface,
	transactionService *transactionService.TransactionService,
	db *sql.DB,
	aiCache *aiService.AICacheService,
	flags *middleware.FeatureFlags,
) {
	handler := aiHandler.NewHandler(aiService, categoryRepo, transactionRepo, transactionService, db, aiCache, flags)

	ai := r.Group("/ai")
	{
		ai.POST("/extract/transactions", flags.Require("ai_extraction"), handler.ExtractTransactions)
		ai.POST("/reconcile/preview", flags.Require("ai_reconciliation"), handler.ReconciliationPreview)
		ai.GET("/reconcile/:session_id", flags.Require("ai_reconciliation"), handler.GetReconciliationSession)
		ai.POST("/reconcile/:session_id/apply", flags.Require("ai_reconciliation"), handler.ApplyReconciliationSession)
		ai.POST("/analyze/spending", flags.Require("ai_extraction"), handler.AnalyzeSpending)
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
