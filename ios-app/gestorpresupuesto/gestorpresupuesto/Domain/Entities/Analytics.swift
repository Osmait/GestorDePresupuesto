import Foundation

struct CategoryExpense: Codable, Identifiable {
    let id: String
    let label: String
    let value: Double
    let color: String
    
    var categoryName: String { label }
    var totalAmount: Double { abs(value) }
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
