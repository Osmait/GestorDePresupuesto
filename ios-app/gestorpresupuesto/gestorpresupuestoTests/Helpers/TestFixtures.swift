import Foundation
@testable import gestorpresupuesto

// MARK: - Account Fixtures

extension Account {
    static func fixture(
        id: String = "acc-1",
        name: String = "Cuenta Principal",
        bank: String = "BHD",
        userId: String? = "user-1",
        initialBalance: Double = 10000,
        createdAt: Date = Date()
    ) -> Account {
        Account(
            id: id, name: name, bank: bank,
            userId: userId, initialBalance: initialBalance, createdAt: createdAt
        )
    }
}

extension AccountResponse {
    static func fixture(
        account: Account = .fixture(),
        currentBalance: Double = 15000
    ) -> AccountResponse {
        AccountResponse(accountInfo: account, currentBalance: currentBalance)
    }
}

// MARK: - Transaction Fixtures

extension Transaction {
    static func fixture(
        id: String = "txn-1",
        name: String = "Test Transaction",
        description: String? = nil,
        amount: Double = 1000,
        typeTransaction: String = "income",
        accountId: String = "acc-1",
        categoryId: String = "cat-1",
        budgetId: String? = nil,
        currency: String? = "DOP",
        userId: String? = "user-1",
        createdAt: Date = Date()
    ) -> Transaction {
        Transaction(
            id: id, name: name, description: description,
            amount: amount, typeTransaction: typeTransaction,
            accountId: accountId, categoryId: categoryId,
            budgetId: budgetId, currency: currency,
            userId: userId, createdAt: createdAt
        )
    }
}

extension PaginatedTransactionResponse {
    static func fixture(
        data: [Transaction] = [],
        currentPage: Int = 1,
        totalPages: Int = 1,
        hasNextPage: Bool = false
    ) -> PaginatedTransactionResponse {
        let pagination = PaginationMeta(
            currentPage: currentPage,
            perPage: 20,
            totalPages: totalPages,
            totalRecords: data.count,
            hasNextPage: hasNextPage,
            hasPrevPage: false,
            nextPage: hasNextPage ? currentPage + 1 : nil,
            prevPage: nil
        )
        return PaginatedTransactionResponse(data: data, pagination: pagination)
    }
}

// MARK: - Category Fixtures

extension gestorpresupuesto.Category {
    static func fixture(
        id: String = "cat-1",
        name: String = "Alimentación",
        icon: String = "fork.knife",
        color: String = "#FF5733",
        userId: String? = "user-1",
        createdAt: Date = Date()
    ) -> gestorpresupuesto.Category {
        gestorpresupuesto.Category(
            id: id, name: name, icon: icon, color: color,
            userId: userId, createdAt: createdAt
        )
    }
}

// MARK: - Budget Fixtures

extension Budget {
    static func fixture(
        id: String = "bud-1",
        categoryId: String = "cat-1",
        userId: String = "user-1",
        amount: Double = 5000,
        categoryName: String? = "Alimentación",
        createdAt: Date = Date()
    ) -> Budget {
        Budget(
            id: id, categoryId: categoryId, userId: userId,
            amount: amount, categoryName: categoryName, createdAt: createdAt
        )
    }
}

extension BudgetResponse {
    static func fixture(
        id: String = "bud-1",
        categoryId: String = "cat-1",
        userId: String = "user-1",
        amount: Double = 5000,
        currentAmount: Double = -3000,
        categoryName: String? = "Alimentación",
        createdAt: Date = Date()
    ) -> BudgetResponse {
        BudgetResponse(
            id: id, categoryId: categoryId, userId: userId,
            amount: amount, currentAmount: currentAmount,
            categoryName: categoryName, createdAt: createdAt
        )
    }
}

// MARK: - Investment Fixtures

extension Investment {
    static func fixture(
        id: String = "inv-1",
        name: String = "Apple Inc",
        symbol: String = "AAPL",
        type: InvestmentType = .stock,
        quantity: Double = 10,
        purchasePrice: Double = 150,
        currentPrice: Double = 180,
        sourceAccountId: String? = nil,
        sourceAmount: Double? = nil,
        settlementCurrency: String? = "USD",
        exchangeRate: Double? = nil,
        createdAt: String = "2026-01-01",
        updatedAt: String? = nil,
        userId: String = "user-1"
    ) -> Investment {
        Investment(
            id: id, name: name, symbol: symbol, type: type,
            quantity: quantity, purchasePrice: purchasePrice,
            currentPrice: currentPrice, sourceAccountId: sourceAccountId,
            sourceAmount: sourceAmount, settlementCurrency: settlementCurrency,
            exchangeRate: exchangeRate, createdAt: createdAt,
            updatedAt: updatedAt, userId: userId
        )
    }
}

// MARK: - Loan Fixtures

extension Loan {
    static func fixture(
        id: String = "loan-1",
        borrowerName: String = "Juan Pérez",
        borrowerContact: String = "809-555-1234",
        principalAmount: Double = 50000,
        currency: String = "DOP",
        interestMode: LoanInterestMode = .fixedTotal,
        annualRate: Double = 12,
        termMonths: Int = 12,
        startDate: String = "2026-01-01",
        sourceAccountId: String = "acc-1",
        notes: String = "",
        totalInterest: Double = 6000,
        totalAmount: Double = 56000,
        paidPrincipal: Double = 25000,
        paidInterest: Double = 3000,
        pendingAmount: Double = 28000,
        status: LoanStatus = .active,
        createdAt: String = "2026-01-01",
        updatedAt: String = "2026-01-01"
    ) -> Loan {
        Loan(
            id: id, borrowerName: borrowerName, borrowerContact: borrowerContact,
            principalAmount: principalAmount, currency: currency,
            interestMode: interestMode, annualRate: annualRate,
            termMonths: termMonths, startDate: startDate,
            sourceAccountId: sourceAccountId, notes: notes,
            totalInterest: totalInterest, totalAmount: totalAmount,
            paidPrincipal: paidPrincipal, paidInterest: paidInterest,
            pendingAmount: pendingAmount, status: status,
            createdAt: createdAt, updatedAt: updatedAt
        )
    }
}

extension LoanPayment {
    static func fixture(
        id: String = "lp-1",
        destinationAccountId: String = "acc-1",
        amount: Double = 5000,
        principalComponent: Double = 4000,
        interestComponent: Double = 1000,
        paymentDate: String = "2026-02-01",
        notes: String = "",
        createdAt: String = "2026-02-01"
    ) -> LoanPayment {
        LoanPayment(
            id: id, destinationAccountId: destinationAccountId,
            amount: amount, principalComponent: principalComponent,
            interestComponent: interestComponent, paymentDate: paymentDate,
            notes: notes, createdAt: createdAt
        )
    }
}

extension LoanSummary {
    static func fixture() -> LoanSummary {
        LoanSummary(
            totalPrincipal: 100000, totalPending: 50000,
            totalCollected: 50000, totalInterestEarned: 10000,
            overdueLoans: 0, activeLoans: 2
        )
    }
}

// MARK: - Certificate Fixtures

extension Certificate {
    static func fixture(
        id: String = "cert-1",
        bank: String = "BHD",
        baseCapital: Double = 100000,
        interestType: InterestType = .compound,
        currentInterestRate: Double = 12.5,
        currentTaxRate: Double = 10,
        cutDay: Int = 15,
        reinvestInterest: Bool = true,
        payoutAccountId: String? = nil,
        maturityDate: String? = "2027-01-01",
        status: CertificateStatus = .active,
        currency: String = "DOP",
        createdAt: String = "2026-01-01",
        updatedAt: String = "2026-01-01",
        effectiveCapital: Double = 105000,
        nextPaymentDate: String? = "2026-02-15",
        projectedPayment: ProjectedPayment? = nil
    ) -> Certificate {
        Certificate(
            id: id, bank: bank, baseCapital: baseCapital,
            interestType: interestType, currentInterestRate: currentInterestRate,
            currentTaxRate: currentTaxRate, cutDay: cutDay,
            reinvestInterest: reinvestInterest, payoutAccountId: payoutAccountId,
            maturityDate: maturityDate, status: status, currency: currency,
            createdAt: createdAt, updatedAt: updatedAt,
            effectiveCapital: effectiveCapital, nextPaymentDate: nextPaymentDate,
            projectedPayment: projectedPayment
        )
    }
}

extension CertificateSummary {
    static func fixture() -> CertificateSummary {
        CertificateSummary(
            totalCapital: 500000, totalGrossInterest: 25000,
            totalTaxWithheld: 2500, totalNetInterest: 22500,
            portfolioValue: 525000, activeCertificates: 3
        )
    }
}

// MARK: - CreditCard Fixtures

extension CreditCard {
    static func fixture(
        id: String = "cc-1",
        name: String = "Visa Gold",
        bank: String = "BHD",
        lastFourDigits: String = "4321",
        cutDay: Int = 15,
        dueDay: Int = 5,
        balances: [CardBalance] = [.fixture()],
        nextCutDate: String? = nil,
        nextDueDate: String? = nil,
        createdAt: String = "2026-01-01",
        updatedAt: String = "2026-01-01"
    ) -> CreditCard {
        CreditCard(
            id: id, name: name, bank: bank,
            lastFourDigits: lastFourDigits, cutDay: cutDay, dueDay: dueDay,
            balances: balances, nextCutDate: nextCutDate, nextDueDate: nextDueDate,
            createdAt: createdAt, updatedAt: updatedAt
        )
    }
}

extension CardBalance {
    static func fixture(
        id: String = "bal-1",
        currency: String = "DOP",
        currentBalance: Double = 15000,
        creditLimit: Double = 100000,
        availableCredit: Double = 85000,
        utilizationPercent: Double = 15
    ) -> CardBalance {
        CardBalance(
            id: id, currency: currency, currentBalance: currentBalance,
            creditLimit: creditLimit, availableCredit: availableCredit,
            utilizationPercent: utilizationPercent
        )
    }
}

extension CardPayment {
    static func fixture(
        id: String = "cp-1",
        cardId: String = "cc-1",
        fromAccountId: String = "acc-1",
        currency: String = "DOP",
        amount: Double = 5000,
        sourceCurrency: String? = nil,
        sourceAmount: Double? = nil,
        exchangeRate: Double? = nil,
        includesInterest: Bool = false,
        interestAmount: Double = 0,
        paymentDate: String = "2026-02-01",
        status: String = "completed",
        notes: String = "",
        createdAt: String = "2026-02-01"
    ) -> CardPayment {
        CardPayment(
            id: id, cardId: cardId, fromAccountId: fromAccountId,
            currency: currency, amount: amount,
            sourceCurrency: sourceCurrency, sourceAmount: sourceAmount,
            exchangeRate: exchangeRate, includesInterest: includesInterest,
            interestAmount: interestAmount, paymentDate: paymentDate,
            status: status, notes: notes, createdAt: createdAt
        )
    }
}

extension CreditCardSummary {
    static func fixture() -> CreditCardSummary {
        CreditCardSummary(
            totalCards: 1, totalDebt: ["DOP": 15000],
            totalCreditLimit: ["DOP": 100000],
            avgUtilization: ["DOP": 15],
            byCard: [.fixture()]
        )
    }
}

// MARK: - RecurringTransaction Fixtures

extension RecurringTransaction {
    static func fixture(
        id: String = "rec-1",
        userId: String? = "user-1",
        name: String = "Salario",
        description: String? = nil,
        amount: Double = 50000,
        type: String = "income",
        accountId: String = "acc-1",
        categoryId: String = "cat-1",
        budgetId: String? = nil,
        dayOfMonth: Int = 15,
        lastExecutionDate: Date? = nil,
        createdAt: Date = Date()
    ) -> RecurringTransaction {
        RecurringTransaction(
            id: id, userId: userId, name: name, description: description,
            amount: amount, type: type, accountId: accountId,
            categoryId: categoryId, budgetId: budgetId,
            dayOfMonth: dayOfMonth, lastExecutionDate: lastExecutionDate,
            createdAt: createdAt
        )
    }
}

// MARK: - User Fixtures

extension User {
    static func fixture(
        id: String = "user-1",
        name: String = "José",
        lastName: String = "Burgos",
        email: String = "jose@test.com",
        role: String = "user",
        isDemo: Bool? = false,
        confirmed: Bool? = true,
        createdAt: Date = Date()
    ) -> User {
        User(
            id: id, name: name, lastName: lastName,
            email: email, role: role, isDemo: isDemo,
            confirmed: confirmed, createdAt: createdAt
        )
    }
}

// MARK: - Notification Fixtures

extension AppNotification {
    static func fixture(
        id: String = "notif-1",
        userId: String = "user-1",
        type: String = "budget_warning",
        message: String = "Presupuesto al 80%",
        amount: Double? = nil,
        isRead: Bool = false,
        createdAt: Date = Date()
    ) -> AppNotification {
        AppNotification(
            id: id, userId: userId, type: type,
            message: message, amount: amount,
            isRead: isRead, createdAt: createdAt
        )
    }
}

// MARK: - ExchangeRate Fixtures

extension ExchangeRateResponse {
    static func fixture() -> ExchangeRateResponse {
        ExchangeRateResponse(usdToDop: 58.5, lastUpdated: "2026-01-01")
    }
}
