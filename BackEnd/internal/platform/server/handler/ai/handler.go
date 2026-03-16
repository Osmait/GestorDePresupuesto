package ai

import (
	"database/sql"

	categoryRepo "github.com/osmait/gestorDePresupuesto/internal/platform/storage/postgress/category"
	transactionRepo "github.com/osmait/gestorDePresupuesto/internal/platform/storage/postgress/transaction"
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
}

func NewHandler(
	aiService *aiService.Service,
	categoryRepo categoryRepo.CategoryRepoInterface,
	transactionRepo transactionRepo.TransactionRepositoryInterface,
	transactionService *transactionService.TransactionService,
	db *sql.DB,
	aiCache *aiService.AICacheService,
) *Handler {
	return &Handler{
		aiService:             aiService,
		categoryRepository:    categoryRepo,
		transactionRepository: transactionRepo,
		transactionService:    transactionService,
		db:                    db,
		aiCache:               aiCache,
	}
}
