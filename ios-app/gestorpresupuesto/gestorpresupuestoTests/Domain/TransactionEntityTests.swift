import Testing
import Foundation
@testable import gestorpresupuesto

@Suite("Transaction Entity Tests")
struct TransactionEntityTests {

    @Test func isIncome_incomeType() {
        let txn = Transaction.fixture(typeTransaction: "income")
        #expect(txn.isIncome)
    }

    @Test func isIncome_expenseType() {
        let txn = Transaction.fixture(typeTransaction: "expense")
        #expect(!txn.isIncome)
    }

    @Test func transactionType_parsesCorrectly() {
        let txn = Transaction.fixture(typeTransaction: "income")
        #expect(txn.transactionType == .income)
    }

    @Test func transactionType_unknownReturnsNil() {
        let txn = Transaction.fixture(typeTransaction: "unknown")
        #expect(txn.transactionType == nil)
    }

    @Test func transactionType_allDisplayNames() {
        #expect(TransactionType.income.displayName == "Ingreso")
        #expect(TransactionType.expense.displayName == "Gasto")
        #expect(TransactionType.bill.displayName == "Factura")
        #expect(TransactionType.cardPayment.displayName == "Pago tarjeta")
        #expect(TransactionType.loanDisbursement.displayName == "Desembolso préstamo")
        #expect(TransactionType.loanCollection.displayName == "Cobro préstamo")
        #expect(TransactionType.investmentPurchase.displayName == "Compra inversión")
        #expect(TransactionType.investmentFunding.displayName == "Fondeo inversión")
    }

    // MARK: - TransactionFilter

    @Test func toQueryItems_defaultFilter() {
        let filter = TransactionFilter()
        let items = filter.toQueryItems()
        #expect(items.contains { $0.name == "page" && $0.value == "1" })
        #expect(items.contains { $0.name == "limit" && $0.value == "20" })
        #expect(items.contains { $0.name == "sort_by" && $0.value == "created_at" })
        #expect(items.contains { $0.name == "sort_order" && $0.value == "desc" })
    }

    @Test func toQueryItems_withOptionalFields() {
        var filter = TransactionFilter()
        filter.type = "income"
        filter.categoryId = "cat-1"
        filter.search = "test"
        let items = filter.toQueryItems()
        #expect(items.contains { $0.name == "type" && $0.value == "income" })
        #expect(items.contains { $0.name == "category_id" && $0.value == "cat-1" })
        #expect(items.contains { $0.name == "search" && $0.value == "test" })
    }

    @Test func toQueryItems_emptySearchOmitted() {
        var filter = TransactionFilter()
        filter.search = ""
        let items = filter.toQueryItems()
        #expect(!items.contains { $0.name == "search" })
    }

    @Test func toQueryItems_multipleCategories() {
        var filter = TransactionFilter()
        filter.categories = ["cat-1", "cat-2"]
        let items = filter.toQueryItems()
        let categoryItems = items.filter { $0.name == "categories" }
        #expect(categoryItems.count == 2)
    }

    @Test func toQueryItems_amountFilters() {
        var filter = TransactionFilter()
        filter.amountMin = 100
        filter.amountMax = 5000
        let items = filter.toQueryItems()
        #expect(items.contains { $0.name == "amount_min" })
        #expect(items.contains { $0.name == "amount_max" })
    }
}
