import Foundation

struct CategoryExpense: Codable, Identifiable {
    let id: String
    let label: String
    let value: Double
    let color: String
    let transactionCount: Int?
    let dopTotal: Double?
    let usdTotal: Double?

    var categoryName: String { label }
    var totalAmount: Double { abs(value) }

    enum CodingKeys: String, CodingKey {
        case id, label, value, color
        case transactionCount = "transaction_count"
        case dopTotal = "dop_total"
        case usdTotal = "usd_total"
    }
}

struct MonthlySummary: Codable, Identifiable {
    let month: String
    let ingresos: Double
    let gastos: Double

    var id: String { month }

    enum CodingKeys: String, CodingKey {
        case month
        case ingresos = "Ingresos"
        case gastos = "Gastos"
    }

    var totalIncome: Double { ingresos }
    var totalExpenses: Double { abs(gastos) }
    var netAmount: Double { ingresos + gastos }
}

struct DashboardSummary: Codable {
    let totalIncome: Double
    let totalExpenses: Double
    let netAmount: Double
    let usdToDopRate: Double
    let accountsTotal: Double
    let investmentsTotal: Double
    let certificatesTotal: Double
    let accountsCount: Int
    let investmentsCount: Int
    let certificatesCount: Int
    let categoryExpenses: [CategoryExpense]
    let monthlySummary: [MonthlySummary]

    enum CodingKeys: String, CodingKey {
        case totalIncome = "total_income"
        case totalExpenses = "total_expenses"
        case netAmount = "net_amount"
        case usdToDopRate = "usd_to_dop_rate"
        case accountsTotal = "accounts_total"
        case investmentsTotal = "investments_total"
        case certificatesTotal = "certificates_total"
        case accountsCount = "accounts_count"
        case investmentsCount = "investments_count"
        case certificatesCount = "certificates_count"
        case categoryExpenses = "category_expenses"
        case monthlySummary = "monthly_summary"
    }
}
