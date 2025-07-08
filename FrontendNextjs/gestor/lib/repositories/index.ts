// Exportar repositorios refactorizados
import { AccountRepository } from "@/app/repository/accountRepository"
import { TransactionRepository } from "@/app/repository/transactionRepository"
import { BudgetRepository } from "@/app/repository/budgetRepository"
import { CategoryRepository } from "@/app/repository/categoryRepository"

export { AccountRepository, TransactionRepository, BudgetRepository, CategoryRepository }

// Instancias singleton para uso directo
export const accountRepository = new AccountRepository()
export const transactionRepository = new TransactionRepository()
export const budgetRepository = new BudgetRepository()
export const categoryRepository = new CategoryRepository()

// Re-exportar la clase base
export { BaseRepository } from "@/lib/base-repository"