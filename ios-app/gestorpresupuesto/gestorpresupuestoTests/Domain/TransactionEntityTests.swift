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
        // The backend reads a single comma-separated value.
        #expect(categoryItems.map(\.value) == ["cat-1,cat-2"])
    }

    @Test func toQueryItems_amountFilters() {
        var filter = TransactionFilter()
        filter.amountMin = 100
        filter.amountMax = 5000
        let items = filter.toQueryItems()
        #expect(items.contains { $0.name == "amount_min" })
        #expect(items.contains { $0.name == "amount_max" })
    }

    // MARK: - Ledger types written by the backend

    @Test func isInflow_followsBalanceEffect() {
        for type in ["income", "loan_collection", "loan_cancellation_refund", "adjustment_in", "card_payment_received"] {
            #expect(Transaction.fixture(typeTransaction: type).isInflow, "\(type)")
        }
        for type in ["bill", "card_payment", "adjustment_out", "loan_disbursement", "investment_funding"] {
            #expect(!Transaction.fixture(typeTransaction: type).isInflow, "\(type)")
        }
    }

    @Test func signedAmount_cardPaymentReceivedIsPositive() {
        #expect(Transaction.fixture(amount: 5000, typeTransaction: "card_payment_received").signedAmount == 5000)
        #expect(Transaction.fixture(amount: 5000, typeTransaction: "card_payment").signedAmount == -5000)
    }

    @Test func editableAndDeletable_matchBackendRules() {
        #expect(Transaction.fixture(typeTransaction: "bill").isEditable)
        #expect(!Transaction.fixture(typeTransaction: "card_payment").isEditable)
        #expect(Transaction.fixture(typeTransaction: "adjustment_in").isDeletable)
        #expect(!Transaction.fixture(typeTransaction: "adjustment_in").isEditable)
        #expect(!Transaction.fixture(typeTransaction: "card_payment_received").isDeletable)
        #expect(!Transaction.fixture(typeTransaction: "loan_collection").isDeletable)
    }

    @Test func newTypes_parse() {
        #expect(Transaction.fixture(typeTransaction: "card_payment_received").transactionType == .cardPaymentReceived)
        #expect(Transaction.fixture(typeTransaction: "adjustment_out").transactionType == .adjustmentOut)
    }

    @Test func filter_includeSummary() {
        var filter = TransactionFilter()
        #expect(!filter.toQueryItems().contains { $0.name == "include_summary" })
        filter.includeSummary = true
        #expect(filter.toQueryItems().contains { $0.name == "include_summary" && $0.value == "true" })
    }

    @Test func paginatedResponse_decodesSummary() throws {
        let json = """
        {"data": [], "pagination": {"current_page": 1, "per_page": 20, "total_pages": 0, "total_records": 0,
          "has_next_page": false, "has_prev_page": false},
         "summary": {"total_income": 100, "total_expenses": 40, "net_amount": 60, "income_count": 1,
          "expense_count": 1, "average_income": 100, "average_expense": 40, "largest_income": 100, "largest_expense": 40}}
        """
        let response = try JSONDecoder().decode(PaginatedTransactionResponse.self, from: Data(json.utf8))
        #expect(response.summary?.totalExpenses == 40)
    }
}
