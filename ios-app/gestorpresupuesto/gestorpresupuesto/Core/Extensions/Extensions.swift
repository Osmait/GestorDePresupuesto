import SwiftUI

extension Color {
    init?(fromHex hex: String) {
        var hexSanitized = hex.trimmingCharacters(in: .whitespacesAndNewlines)
        hexSanitized = hexSanitized.replacingOccurrences(of: "#", with: "")
        
        guard hexSanitized.count == 6 else { return nil }
        
        var rgb: UInt64 = 0
        guard Scanner(string: hexSanitized).scanHexInt64(&rgb) else { return nil }
        
        self.init(
            red: Double((rgb & 0xFF0000) >> 16) / 255.0,
            green: Double((rgb & 0x00FF00) >> 8) / 255.0,
            blue: Double(rgb & 0x0000FF) / 255.0
        )
    }
    
    static func fromHex(_ hex: String) -> Color? {
        Color(fromHex: hex)
    }
    
    func toHex() -> String? {
        guard let components = UIColor(self).cgColor.components else { return nil }
        let r = Int(components[0] * 255)
        let g = Int(components[1] * 255)
        let b = Int(components[2] * 255)
        return String(format: "#%02X%02X%02X", r, g, b)
    }
}

extension Double {
    var currencyFormatted: String {
        let formatter = NumberFormatter()
        formatter.numberStyle = .currency
        formatter.locale = Locale(identifier: "es_DO")
        formatter.currencyCode = "DOP"
        formatter.currencySymbol = "RD$"
        return formatter.string(from: self as NSNumber) ?? "RD$\(self)"
    }

    func currencyFormatted(currency: String) -> String {
        let formatter = NumberFormatter()
        formatter.numberStyle = .currency
        switch currency.uppercased() {
        case "USD":
            formatter.locale = Locale(identifier: "en_US")
            formatter.currencyCode = "USD"
            formatter.currencySymbol = "US$"
        case "EUR":
            formatter.locale = Locale(identifier: "es_ES")
            formatter.currencyCode = "EUR"
        default:
            formatter.locale = Locale(identifier: "es_DO")
            formatter.currencyCode = "DOP"
            formatter.currencySymbol = "RD$"
        }
        return formatter.string(from: self as NSNumber) ?? "\(currency) \(self)"
    }

    var percentageFormatted: String {
        "\(Int(self * 100))%"
    }

    var compactFormatted: String {
        let absValue = abs(self)
        let sign = self < 0 ? "-" : ""
        if absValue >= 1_000_000 {
            return "\(sign)\(String(format: "%.1fM", absValue / 1_000_000))"
        } else if absValue >= 1_000 {
            return "\(sign)\(String(format: "%.1fK", absValue / 1_000))"
        }
        return "\(sign)\(String(format: "%.0f", absValue))"
    }
}

extension Date {
    var formatted: String {
        let formatter = DateFormatter()
        formatter.dateStyle = .medium
        formatter.locale = Locale(identifier: "es_MX")
        return formatter.string(from: self)
    }
    
    var shortFormatted: String {
        let formatter = DateFormatter()
        formatter.dateStyle = .short
        formatter.locale = Locale(identifier: "es_MX")
        return formatter.string(from: self)
    }
    
    var iso8601String: String {
        ISO8601DateFormatter().string(from: self)
    }
    
    static var startOfMonth: Date {
        let calendar = Calendar.current
        let components = calendar.dateComponents([.year, .month], from: Date())
        return calendar.date(from: components) ?? Date()
    }
    
    static var endOfMonth: Date {
        let calendar = Calendar.current
        var components = DateComponents()
        components.month = 1
        components.second = -1
        return calendar.date(byAdding: components, to: startOfMonth) ?? Date()
    }
}

extension String {
    var isNotBlank: Bool {
        !self.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty
    }
}
