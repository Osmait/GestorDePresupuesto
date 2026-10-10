package ai

import (
	"context"
	"database/sql"

	"github.com/osmait/gestorDePresupuesto/internal/platform/server/middleware"
	categoryRepo "github.com/osmait/gestorDePresupuesto/internal/platform/storage/postgress/category"
	transactionRepo "github.com/osmait/gestorDePresupuesto/internal/platform/storage/postgress/transaction"
	"github.com/osmait/gestorDePresupuesto/internal/platform/storage/postgress/txhelper"
	aiService "github.com/osmait/gestorDePresupuesto/internal/services/ai"
	transactionService "github.com/osmait/gestorDePresupuesto/internal/services/transaction"
)

type Handler struct {
	aiService             *aiService.Service
	categoryRepository    categoryRepo.CategoryRepoInterface
	transactionRepository transactionRepo.TransactionRepositoryInterface
	transactionService    *transactionService.TransactionService
	db                    *sql.DB
	aiCache               *aiService.AICacheService
	flags                 *middleware.FeatureFlags
}

func NewHandler(
	aiService *aiService.Service,
	categoryRepo categoryRepo.CategoryRepoInterface,
	transactionRepo transactionRepo.TransactionRepositoryInterface,
	transactionService *transactionService.TransactionService,
	db *sql.DB,
	aiCache *aiService.AICacheService,
	flags *middleware.FeatureFlags,
) *Handler {
	return &Handler{
		aiService:             aiService,
		categoryRepository:    categoryRepo,
		transactionRepository: transactionRepo,
		transactionService:    transactionService,
		db:                    db,
		aiCache:               aiCache,
		flags:                 flags,
	}
}

// q returns the request's RLS transaction (or the pool outside a request).
// AI routes run after RLSMiddleware, which already holds the request's pooled
// connection: querying h.db directly would need a second connection and
// deadlock the pool under load.
func (h *Handler) q(ctx context.Context) txhelper.Querier {
	return txhelper.FromContext(ctx, h.db)
}
