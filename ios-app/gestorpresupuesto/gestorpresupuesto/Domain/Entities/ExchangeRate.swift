import Foundation

struct ExchangeRateResponse: Codable {
    let usdToDop: Double
    let lastUpdated: String

    enum CodingKeys: String, CodingKey {
        case usdToDop = "usd_to_dop"
        case lastUpdated = "last_updated"
    }
}

struct ConvertResponse: Codable {
    let usd: Double
    let dop: Double
    let rate: Double
}
