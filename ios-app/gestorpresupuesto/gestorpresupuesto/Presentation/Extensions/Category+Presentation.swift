import SwiftUI

extension Category {
    var colorValue: Color {
        Color.fromHex(color) ?? Color.app.textSecondary
    }
}

/// Spoken names for the category color palette (VoiceOver cannot describe a swatch).
enum CategoryColorName {
    private static let names: [String: String] = [
        "#EF4444": "Rojo", "#F97316": "Naranja", "#F59E0B": "Ámbar", "#84CC16": "Lima",
        "#22C55E": "Verde", "#14B8A6": "Verde azulado", "#06B6D4": "Cian", "#3B82F6": "Azul",
        "#6366F1": "Índigo", "#8B5CF6": "Violeta", "#A855F7": "Púrpura", "#EC4899": "Rosa",
        "#F43F5E": "Rosa intenso", "#78716C": "Piedra", "#64748B": "Pizarra", "#0EA5E9": "Celeste",
    ]

    static func name(for hex: String) -> String {
        names[hex.uppercased()] ?? "Color \(hex)"
    }
}
