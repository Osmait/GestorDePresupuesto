import Foundation
import Testing
@testable import gestorpresupuesto

@Suite("MonthlyPlan Entity Tests")
struct MonthlyPlanEntityTests {

    private func decoder() -> JSONDecoder {
        let decoder = JSONDecoder()
        decoder.dateDecodingStrategy = .iso8601
        return decoder
    }

    @Test func item_decodesBackendPayload() throws {
        let json = """
        {"id":"p1","user_id":"u1","name":"Netflix","description":"","amount":15.49,
         "amount_dop":977.42,"currency":"USD","type":"bill","category_id":"c1",
         "day_of_month":27,"is_active":true,"created_at":"2026-10-01T00:00:00Z"}
        """
        let item = try decoder().decode(MonthlyPlanItem.self, from: Data(json.utf8))

        #expect(item.amountDop == 977.42)
        #expect(item.type == .bill)
        #expect(item.dayOfMonth == 27)
        #expect(item.accountId == nil)
        #expect(!item.isIncome)
    }

    @Test func item_decodesWithoutOptionalFields() throws {
        let json = """
        {"id":"p1","user_id":"u1","name":"Nómina","description":"","amount":48000,
         "amount_dop":48000,"currency":"DOP","type":"income","is_active":false,
         "created_at":"2026-10-01T00:00:00Z"}
        """
        let item = try decoder().decode(MonthlyPlanItem.self, from: Data(json.utf8))

        #expect(item.isIncome)
        #expect(item.dayOfMonth == nil)
        #expect(item.categoryId == nil)
        #expect(!item.isActive)
    }

    @Test func summary_decodesAndFlagsOvercommitted() throws {
        let json = """
        {"total_income":50000,"total_expenses":60000,"available":-10000,
         "committed_percentage":120,"usd_to_dop_rate":63.1,"income_count":1,"expenses_count":4}
        """
        let summary = try JSONDecoder().decode(MonthlyPlanSummary.self, from: Data(json.utf8))

        #expect(summary.isOvercommitted)
        #expect(summary.committedPercentage == 120)
    }

    @Test func request_encodesSnakeCaseKeys() throws {
        let request = MonthlyPlanItemRequest(
            name: "Alquiler", description: "", amount: 32000, currency: "DOP",
            type: .bill, categoryId: "c1", accountId: nil, dayOfMonth: 30, isActive: true
        )
        let object = try JSONSerialization.jsonObject(with: JSONEncoder().encode(request)) as? [String: Any]

        #expect(object?["day_of_month"] as? Int == 30)
        #expect(object?["category_id"] as? String == "c1")
        #expect(object?["is_active"] as? Bool == true)
        #expect(object?["type"] as? String == "bill")
    }
}
