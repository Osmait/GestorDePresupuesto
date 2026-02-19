import SwiftUI

extension Color {
    static let app = AppColors()
}

struct AppColors {
    // MARK: - Light Mode
    struct Light {
        static let background = Color(hex: "FFFFFF")
        static let surface = Color(hex: "F8F9FA")
        static let surfaceSecondary = Color(hex: "F1F3F5")
        
        static let primary = Color(hex: "1A1A2E")
        static let primaryLight = Color(hex: "2D2D44")
        
        static let accent = Color(hex: "3B82F6")
        static let accentLight = Color(hex: "60A5FA")
        static let accentDark = Color(hex: "2563EB")
        
        static let textPrimary = Color(hex: "1A1A2E")
        static let textSecondary = Color(hex: "6B7280")
        static let textTertiary = Color(hex: "9CA3AF")
        
        static let border = Color(hex: "E5E7EB")
        static let borderLight = Color(hex: "F3F4F6")
        
        static let success = Color(hex: "22C55E")
        static let successLight = Color(hex: "86EFAC")
        static let warning = Color(hex: "F59E0B")
        static let warningLight = Color(hex: "FCD34D")
        static let error = Color(hex: "EF4444")
        static let errorLight = Color(hex: "FCA5A5")
        static let info = Color(hex: "3B82F6")
        static let infoLight = Color(hex: "93C5FD")
        
        static let gradientPrimary = [Color(hex: "3B82F6"), Color(hex: "8B5CF6")]
        static let gradientSuccess = [Color(hex: "22C55E"), Color(hex: "10B981")]
        static let gradientWarning = [Color(hex: "F59E0B"), Color(hex: "F97316")]
        static let gradientError = [Color(hex: "EF4444"), Color(hex: "F87171")]
        static let gradientIncome = [Color(hex: "22C55E"), Color(hex: "14B8A6")]
        static let gradientExpense = [Color(hex: "EF4444"), Color(hex: "F97316")]
    }
    
    // MARK: - Dark Mode (Soft Dark)
    struct Dark {
        static let background = Color(hex: "131316")
        static let surface = Color(hex: "1C1C21")
        static let surfaceSecondary = Color(hex: "252529")
        
        static let primary = Color(hex: "FFFFFF")
        static let primaryLight = Color(hex: "E5E5E5")
        
        static let accent = Color(hex: "60A5FA")
        static let accentLight = Color(hex: "93C5FD")
        static let accentDark = Color(hex: "3B82F6")
        
        static let textPrimary = Color(hex: "F9FAFB")
        static let textSecondary = Color(hex: "9CA3AF")
        static let textTertiary = Color(hex: "6B7280")
        
        static let border = Color(hex: "2D2D32")
        static let borderLight = Color(hex: "3D3D42")
        
        static let success = Color(hex: "22C55E")
        static let successLight = Color(hex: "16A34A")
        static let warning = Color(hex: "F59E0B")
        static let warningLight = Color(hex: "D97706")
        static let error = Color(hex: "EF4444")
        static let errorLight = Color(hex: "DC2626")
        static let info = Color(hex: "3B82F6")
        static let infoLight = Color(hex: "2563EB")
        
        static let gradientPrimary = [Color(hex: "60A5FA"), Color(hex: "A78BFA")]
        static let gradientSuccess = [Color(hex: "22C55E"), Color(hex: "10B981")]
        static let gradientWarning = [Color(hex: "F59E0B"), Color(hex: "F97316")]
        static let gradientError = [Color(hex: "EF4444"), Color(hex: "F87171")]
        static let gradientIncome = [Color(hex: "22C55E"), Color(hex: "14B8A6")]
        static let gradientExpense = [Color(hex: "EF4444"), Color(hex: "F97316")]
    }
    
    // MARK: - Dynamic Colors
    var background: Color { Color(UIColor { $0.userInterfaceStyle == .dark ? UIColor(Dark.background) : UIColor(Light.background) }) }
    var surface: Color { Color(UIColor { $0.userInterfaceStyle == .dark ? UIColor(Dark.surface) : UIColor(Light.surface) }) }
    var surfaceSecondary: Color { Color(UIColor { $0.userInterfaceStyle == .dark ? UIColor(Dark.surfaceSecondary) : UIColor(Light.surfaceSecondary) }) }
    
    var primary: Color { Color(UIColor { $0.userInterfaceStyle == .dark ? UIColor(Dark.primary) : UIColor(Light.primary) }) }
    var accent: Color { Color(UIColor { $0.userInterfaceStyle == .dark ? UIColor(Dark.accent) : UIColor(Light.accent) }) }
    var accentLight: Color { Color(UIColor { $0.userInterfaceStyle == .dark ? UIColor(Dark.accentLight) : UIColor(Light.accentLight) }) }
    
    var textPrimary: Color { Color(UIColor { $0.userInterfaceStyle == .dark ? UIColor(Dark.textPrimary) : UIColor(Light.textPrimary) }) }
    var textSecondary: Color { Color(UIColor { $0.userInterfaceStyle == .dark ? UIColor(Dark.textSecondary) : UIColor(Light.textSecondary) }) }
    var textTertiary: Color { Color(UIColor { $0.userInterfaceStyle == .dark ? UIColor(Dark.textTertiary) : UIColor(Light.textTertiary) }) }
    
    var border: Color { Color(UIColor { $0.userInterfaceStyle == .dark ? UIColor(Dark.border) : UIColor(Light.border) }) }
    var borderLight: Color { Color(UIColor { $0.userInterfaceStyle == .dark ? UIColor(Dark.borderLight) : UIColor(Light.borderLight) }) }
    
    var success: Color { Color(UIColor { $0.userInterfaceStyle == .dark ? UIColor(Dark.success) : UIColor(Light.success) }) }
    var warning: Color { Color(UIColor { $0.userInterfaceStyle == .dark ? UIColor(Dark.warning) : UIColor(Light.warning) }) }
    var error: Color { Color(UIColor { $0.userInterfaceStyle == .dark ? UIColor(Dark.error) : UIColor(Light.error) }) }
    var info: Color { Color(UIColor { $0.userInterfaceStyle == .dark ? UIColor(Dark.info) : UIColor(Light.info) }) }
    
    var gradientPrimary: [Color] { Color(UIColor { $0.userInterfaceStyle == .dark ? UIColor(Dark.accent) : UIColor(Light.accent) }) == Color(Dark.accent) ? Dark.gradientPrimary : Light.gradientPrimary }
    var gradientSuccess: [Color] { Color(UIColor { $0.userInterfaceStyle == .dark ? UIColor(Dark.success) : UIColor(Light.success) }) == Color(Dark.success) ? Dark.gradientSuccess : Light.gradientSuccess }
    var gradientError: [Color] { Color(UIColor { $0.userInterfaceStyle == .dark ? UIColor(Dark.error) : UIColor(Light.error) }) == Color(Dark.error) ? Dark.gradientError : Light.gradientError }
    var gradientWarning: [Color] { Color(UIColor { $0.userInterfaceStyle == .dark ? UIColor(Dark.warning) : UIColor(Light.warning) }) == Color(Dark.warning) ? Dark.gradientWarning : Light.gradientWarning }
    var gradientIncome: [Color] { Color(UIColor { $0.userInterfaceStyle == .dark ? UIColor(Dark.success) : UIColor(Light.success) }) == Color(Dark.success) ? Dark.gradientIncome : Light.gradientIncome }
    var gradientExpense: [Color] { Color(UIColor { $0.userInterfaceStyle == .dark ? UIColor(Dark.error) : UIColor(Light.error) }) == Color(Dark.error) ? Dark.gradientExpense : Light.gradientExpense }
    
    init() {}
}

// MARK: - Color Extension for Hex
extension Color {
    init(hex: String) {
        let hex = hex.trimmingCharacters(in: CharacterSet.alphanumerics.inverted)
        var int: UInt64 = 0
        Scanner(string: hex).scanHexInt64(&int)
        let a, r, g, b: UInt64
        switch hex.count {
        case 3: (a, r, g, b) = (255, (int >> 8) * 17, (int >> 4 & 0xF) * 17, (int & 0xF) * 17)
        case 6: (a, r, g, b) = (255, int >> 16, int >> 8 & 0xFF, int & 0xFF)
        case 8: (a, r, g, b) = (int >> 24, int >> 16 & 0xFF, int >> 8 & 0xFF, int & 0xFF)
        default: (a, r, g, b) = (255, 0, 0, 0)
        }
        self.init(
            .sRGB,
            red: Double(r) / 255,
            green: Double(g) / 255,
            blue: Double(b) / 255,
            opacity: Double(a) / 255
        )
    }
    
    func toHexString() -> String {
        guard let components = UIColor(self).cgColor.components else { return "#000000" }
        let r = Int(components[0] * 255)
        let g = Int(components[1] * 255)
        let b = Int(components[2] * 255)
        return String(format: "#%02X%02X%02X", r, g, b)
    }
}
