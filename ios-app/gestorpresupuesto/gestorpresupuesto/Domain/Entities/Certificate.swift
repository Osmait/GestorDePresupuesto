import Foundation

enum InterestType: String, Codable, CaseIterable {
    case simple
    case compound

    var displayName: String {
        switch self {
        case .simple: return "Simple"
        case .compound: return "Compuesto"
        }
    }
}

enum CertificateStatus: String, Codable, CaseIterable {
    case active
    case matured
    case cancelled

    var displayName: String {
        switch self {
        case .active: return "Activo"
        case .matured: return "Vencido"
        case .cancelled: return "Cancelado"
        }
    }
}

struct Certificate: Codable, Identifiable, Equatable {
    let id: String
    let bank: String
    let baseCapital: Double
    let interestType: InterestType
    let currentInterestRate: Double
    let currentTaxRate: Double
    let cutDay: Int
    let reinvestInterest: Bool
    let payoutAccountId: String?
    let maturityDate: String?
    let status: CertificateStatus
    let currency: String
    let createdAt: String
    let updatedAt: String
    let effectiveCapital: Double
    let nextPaymentDate: String?
    let projectedPayment: ProjectedPayment?

    enum CodingKeys: String, CodingKey {
        case id, bank, status, currency
        case baseCapital = "base_capital"
        case interestType = "interest_type"
        case currentInterestRate = "current_interest_rate"
        case currentTaxRate = "current_tax_rate"
        case cutDay = "cut_day"
        case reinvestInterest = "reinvest_interest"
        case payoutAccountId = "payout_account_id"
        case maturityDate = "maturity_date"
        case createdAt = "created_at"
        case updatedAt = "updated_at"
        case effectiveCapital = "effective_capital"
        case nextPaymentDate = "next_payment_date"
        case projectedPayment = "projected_payment"
    }

    static func == (lhs: Certificate, rhs: Certificate) -> Bool {
        lhs.id == rhs.id
    }
}

struct ProjectedPayment: Codable {
    let grossInterest: Double
    let taxWithheld: Double
    let netInterest: Double

    enum CodingKeys: String, CodingKey {
        case grossInterest = "gross_interest"
        case taxWithheld = "tax_withheld"
        case netInterest = "net_interest"
    }
}

struct CertificatePayment: Codable, Identifiable {
    let id: String
    let certificateId: String
    let paymentDate: String
    let periodStart: String
    let periodEnd: String
    let grossInterest: Double
    let taxWithheld: Double
    let netInterest: Double
    let appliedRate: Double
    let appliedTaxRate: Double
    let appliedCapital: Double
    let transactionId: String?
    let createdAt: String

    enum CodingKeys: String, CodingKey {
        case id
        case certificateId = "certificate_id"
        case paymentDate = "payment_date"
        case periodStart = "period_start"
        case periodEnd = "period_end"
        case grossInterest = "gross_interest"
        case taxWithheld = "tax_withheld"
        case netInterest = "net_interest"
        case appliedRate = "applied_rate"
        case appliedTaxRate = "applied_tax_rate"
        case appliedCapital = "applied_capital"
        case transactionId = "transaction_id"
        case createdAt = "created_at"
    }
}

struct CertificateSummary: Codable {
    let totalCapital: Double
    let totalGrossInterest: Double
    let totalTaxWithheld: Double
    let totalNetInterest: Double
    let portfolioValue: Double
    let activeCertificates: Int

    enum CodingKeys: String, CodingKey {
        case totalCapital = "total_capital"
        case totalGrossInterest = "total_gross_interest"
        case totalTaxWithheld = "total_tax_withheld"
        case totalNetInterest = "total_net_interest"
        case portfolioValue = "portfolio_value"
        case activeCertificates = "active_certificates"
    }
}

struct CertificateWithHistory: Codable {
    let certificate: Certificate
    let payments: [CertificatePayment]
    let summary: CertificateSummary

    enum CodingKeys: String, CodingKey {
        case payments, summary
        // The backend returns the certificate fields at the top level
        case certificate = ""
    }

    init(from decoder: Decoder) throws {
        // Try decoding as nested first, then as flat
        let container = try decoder.container(keyedBy: DynamicCodingKey.self)
        if container.contains(DynamicCodingKey(stringValue: "payments")!) {
            payments = try container.decode([CertificatePayment].self, forKey: DynamicCodingKey(stringValue: "payments")!)
        } else {
            payments = []
        }
        if container.contains(DynamicCodingKey(stringValue: "summary")!) {
            summary = try container.decode(CertificateSummary.self, forKey: DynamicCodingKey(stringValue: "summary")!)
        } else {
            summary = CertificateSummary(totalCapital: 0, totalGrossInterest: 0, totalTaxWithheld: 0, totalNetInterest: 0, portfolioValue: 0, activeCertificates: 0)
        }
        certificate = try Certificate(from: decoder)
    }

    func encode(to encoder: Encoder) throws {
        var container = encoder.container(keyedBy: DynamicCodingKey.self)
        try container.encode(payments, forKey: DynamicCodingKey(stringValue: "payments")!)
        try container.encode(summary, forKey: DynamicCodingKey(stringValue: "summary")!)
        try certificate.encode(to: encoder)
    }
}

private struct DynamicCodingKey: CodingKey {
    var stringValue: String
    var intValue: Int?

    init?(stringValue: String) { self.stringValue = stringValue }
    init?(intValue: Int) { self.stringValue = "\(intValue)"; self.intValue = intValue }
}

struct CreateCertificateRequest: Codable {
    let bank: String
    let baseCapital: Double
    let interestType: String
    let currentInterestRate: Double
    let currentTaxRate: Double
    let cutDay: Int
    let reinvestInterest: Bool
    let payoutAccountId: String?
    let maturityDate: String?
    let currency: String?

    enum CodingKeys: String, CodingKey {
        case bank, currency
        case baseCapital = "base_capital"
        case interestType = "interest_type"
        case currentInterestRate = "current_interest_rate"
        case currentTaxRate = "current_tax_rate"
        case cutDay = "cut_day"
        case reinvestInterest = "reinvest_interest"
        case payoutAccountId = "payout_account_id"
        case maturityDate = "maturity_date"
    }
}

struct UpdateCertificateRequest: Codable {
    let bank: String?
    let baseCapital: Double?
    let currentInterestRate: Double?
    let currentTaxRate: Double?
    let cutDay: Int?
    let reinvestInterest: Bool?
    let payoutAccountId: String?
    let status: String?

    enum CodingKeys: String, CodingKey {
        case bank, status
        case baseCapital = "base_capital"
        case currentInterestRate = "current_interest_rate"
        case currentTaxRate = "current_tax_rate"
        case cutDay = "cut_day"
        case reinvestInterest = "reinvest_interest"
        case payoutAccountId = "payout_account_id"
    }
}

struct SimulatePaymentRequest: Codable {
    let capital: Double?
    let rate: Double?
    let taxRate: Double?
    let months: Int?

    enum CodingKeys: String, CodingKey {
        case capital, rate, months
        case taxRate = "tax_rate"
    }
}

struct SimulationResult: Codable {
    let payments: [ProjectedPayment]
    let totals: SimulationTotals
}

struct SimulationTotals: Codable {
    let grossInterest: Double
    let taxWithheld: Double
    let netInterest: Double

    enum CodingKeys: String, CodingKey {
        case grossInterest = "gross_interest"
        case taxWithheld = "tax_withheld"
        case netInterest = "net_interest"
    }
}
