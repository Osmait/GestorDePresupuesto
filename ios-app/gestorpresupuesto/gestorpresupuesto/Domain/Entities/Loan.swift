import Foundation

enum LoanStatus: String, Codable, CaseIterable {
    case active
    case paid
    case defaulted
    case cancelled

    var displayName: String {
        switch self {
        case .active: return "Activo"
        case .paid: return "Pagado"
        case .defaulted: return "Vencido"
        case .cancelled: return "Cancelado"
        }
    }
}

enum LoanInterestMode: String, Codable, CaseIterable {
    case fixedTotal = "fixed_total"
    case none

    var displayName: String {
        switch self {
        case .fixedTotal: return "Interés fijo total"
        case .none: return "Sin interés"
        }
    }
}

enum LoanInstallmentStatus: String, Codable {
    case pending
    case partial
    case paid
    case overdue
}

struct Loan: Codable, Identifiable, Equatable {
    let id: String
    let borrowerName: String
    let borrowerContact: String
    let principalAmount: Double
    let currency: String
    let interestMode: LoanInterestMode
    let annualRate: Double
    let termMonths: Int
    let startDate: String
    let sourceAccountId: String
    let notes: String
    let totalInterest: Double
    let totalAmount: Double
    let paidPrincipal: Double
    let paidInterest: Double
    let pendingAmount: Double
    let status: LoanStatus
    let createdAt: String
    let updatedAt: String

    enum CodingKeys: String, CodingKey {
        case id, currency, notes, status
        case borrowerName = "borrower_name"
        case borrowerContact = "borrower_contact"
        case principalAmount = "principal_amount"
        case interestMode = "interest_mode"
        case annualRate = "annual_rate"
        case termMonths = "term_months"
        case startDate = "start_date"
        case sourceAccountId = "source_account_id"
        case totalInterest = "total_interest"
        case totalAmount = "total_amount"
        case paidPrincipal = "paid_principal"
        case paidInterest = "paid_interest"
        case pendingAmount = "pending_amount"
        case createdAt = "created_at"
        case updatedAt = "updated_at"
    }

    static func == (lhs: Loan, rhs: Loan) -> Bool {
        lhs.id == rhs.id
    }

    var progressPercent: Double {
        guard totalAmount > 0 else { return 0 }
        return min((paidPrincipal + paidInterest) / totalAmount, 1.0)
    }
}

struct LoanInstallment: Codable, Identifiable {
    let id: String
    let installmentNumber: Int
    let dueDate: String
    let expectedAmount: Double
    let paidAmount: Double
    let status: LoanInstallmentStatus
    let paidAt: String?

    enum CodingKeys: String, CodingKey {
        case id, status
        case installmentNumber = "installment_number"
        case dueDate = "due_date"
        case expectedAmount = "expected_amount"
        case paidAmount = "paid_amount"
        case paidAt = "paid_at"
    }
}

struct LoanPayment: Codable, Identifiable {
    let id: String
    let destinationAccountId: String
    let amount: Double
    let principalComponent: Double
    let interestComponent: Double
    let paymentDate: String
    let notes: String
    let createdAt: String

    enum CodingKeys: String, CodingKey {
        case id, amount, notes
        case destinationAccountId = "destination_account_id"
        case principalComponent = "principal_component"
        case interestComponent = "interest_component"
        case paymentDate = "payment_date"
        case createdAt = "created_at"
    }
}

struct LoanDetails: Codable {
    let loan: Loan
    let installments: [LoanInstallment]
    let payments: [LoanPayment]
}

struct LoanSummary: Codable {
    let totalPrincipal: Double
    let totalPending: Double
    let totalCollected: Double
    let totalInterestEarned: Double
    let overdueLoans: Int
    let activeLoans: Int

    enum CodingKeys: String, CodingKey {
        case totalPrincipal = "total_principal"
        case totalPending = "total_pending"
        case totalCollected = "total_collected"
        case totalInterestEarned = "total_interest_earned"
        case overdueLoans = "overdue_loans"
        case activeLoans = "active_loans"
    }
}

struct CreateLoanRequest: Codable {
    let borrowerName: String
    let borrowerContact: String?
    let principalAmount: Double
    let currency: String?
    let interestMode: String
    let annualRate: Double
    let termMonths: Int
    let startDate: String?
    let sourceAccountId: String
    let notes: String?

    enum CodingKeys: String, CodingKey {
        case currency, notes
        case borrowerName = "borrower_name"
        case borrowerContact = "borrower_contact"
        case principalAmount = "principal_amount"
        case interestMode = "interest_mode"
        case annualRate = "annual_rate"
        case termMonths = "term_months"
        case startDate = "start_date"
        case sourceAccountId = "source_account_id"
    }
}

struct RegisterLoanPaymentRequest: Codable {
    let destinationAccountId: String
    let amount: Double
    let paymentDate: String?
    let notes: String?

    enum CodingKeys: String, CodingKey {
        case amount, notes
        case destinationAccountId = "destination_account_id"
        case paymentDate = "payment_date"
    }
}
