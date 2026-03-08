import SwiftUI

struct Category: Codable, Identifiable, Equatable, Hashable {
    let id: String
    let name: String
    let icon: String
    let color: String
    let userId: String?
    let createdAt: Date
    
    enum CodingKeys: String, CodingKey {
        case id
        case name
        case icon
        case color
        case userId = "user_id"
        case createdAt = "created_at"
    }
    
    var colorValue: Color {
        Color.fromHex(color) ?? .gray
    }
}

struct CreateCategoryRequest: Codable {
    let name: String
    let icon: String
    let color: String
}

struct UpdateCategoryRequest: Codable {
    let name: String
    let icon: String
    let color: String
}
