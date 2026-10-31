import SwiftUI

extension Color {
    static let app = AppColors()
}

struct AppColors {
    // Values mirror FrontendNextjs/gestor/styles/globals.css ("Quiet Ledger",
    // see DESIGN.md): neutral ink, hue only for meaning. Gradients stay as API
    // but are flat (both stops equal) so legacy call sites render solid.

    // MARK: - Light Mode
    struct Light {
        static let background = Color(hex: "F4F4F5")
        static let surface = Color(hex: "FFFFFF")
        static let surfaceSecondary = Color(hex: "F4F4F5")

        static let primary = Color(hex: "18181B")
        static let primaryLight = Color(hex: "3F3F46")

        static let accent = Color(hex: "18181B")
        static let accentLight = Color(hex: "3F3F46")
        static let accentDark = Color(hex: "09090B")
        static let onAccent = Color(hex: "FAFAFA")

        static let textPrimary = Color(hex: "09090B")
        static let textSecondary = Color(hex: "66666F")
        static let textTertiary = Color(hex: "6B6B74")

        static let border = Color(hex: "E4E4E7")
        static let borderLight = Color(hex: "F4F4F5")

        static let success = Color(hex: "157F3C")
        static let successLight = Color(hex: "DCFCE7")
        static let warning = Color(hex: "A34A08")
        static let warningLight = Color(hex: "FFEDD5")
        static let error = Color(hex: "C71E1E")
        static let errorLight = Color(hex: "FEE2E2")
        static let info = Color(hex: "0369A0")
        static let infoLight = Color(hex: "E0F2FE")

        static let gradientPrimary = [accent, accent]
        static let gradientSuccess = [success, success]
        static let gradientWarning = [warning, warning]
        static let gradientError = [error, error]
        static let gradientIncome = [success, success]
        static let gradientExpense = [error, error]
    }

    // MARK: - Dark Mode
    struct Dark {
        static let background = Color(hex: "131416")
        static let surface = Color(hex: "1A1B1E")
        static let surfaceSecondary = Color(hex: "27292F")

        static let primary = Color(hex: "F9FAFB")
        static let primaryLight = Color(hex: "E4E4E7")

        static let accent = Color(hex: "F9FAFB")
        static let accentLight = Color(hex: "D4D4D8")
        static let accentDark = Color(hex: "FFFFFF")
        static let onAccent = Color(hex: "1A1B1E")

        static let textPrimary = Color(hex: "F9FAFB")
        static let textSecondary = Color(hex: "9CA1AD")
        static let textTertiary = Color(hex: "8C92A0")

        static let border = Color(hex: "27292F")
        static let borderLight = Color(hex: "323540")

        static let success = Color(hex: "4ADE80")
        static let successLight = Color(hex: "14532D")
        static let warning = Color(hex: "DB7706")
        static let warningLight = Color(hex: "431407")
        static let error = Color(hex: "F87171")
        static let errorLight = Color(hex: "450A0A")
        static let info = Color(hex: "0EA5E9")
        static let infoLight = Color(hex: "082F49")

        static let gradientPrimary = [accent, accent]
        static let gradientSuccess = [success, success]
        static let gradientWarning = [warning, warning]
        static let gradientError = [error, error]
        static let gradientIncome = [success, success]
        static let gradientExpense = [error, error]
    }

    // MARK: - Dynamic Colors
    var background: Color { Color(UIColor { $0.userInterfaceStyle == .dark ? UIColor(Dark.background) : UIColor(Light.background) }) }
    var surface: Color { Color(UIColor { $0.userInterfaceStyle == .dark ? UIColor(Dark.surface) : UIColor(Light.surface) }) }
    var surfaceSecondary: Color { Color(UIColor { $0.userInterfaceStyle == .dark ? UIColor(Dark.surfaceSecondary) : UIColor(Light.surfaceSecondary) }) }

    var primary: Color { Color(UIColor { $0.userInterfaceStyle == .dark ? UIColor(Dark.primary) : UIColor(Light.primary) }) }
    var accent: Color { Color(UIColor { $0.userInterfaceStyle == .dark ? UIColor(Dark.accent) : UIColor(Light.accent) }) }
    var onAccent: Color { Color(UIColor { $0.userInterfaceStyle == .dark ? UIColor(Dark.onAccent) : UIColor(Light.onAccent) }) }
    /// Text/icons on a success/error/warning/info fill. Same values as the web
    /// `--*-foreground` tokens (light text in light mode, dark text in dark).
    var onStatus: Color { onAccent }
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

    // Flat "gradients" built from the dynamic tokens, so they follow the
    // appearance the view renders in (UITraitCollection.current does not).
    var gradientPrimary: [Color] { [accent, accent] }
    var gradientSuccess: [Color] { [success, success] }
    var gradientError: [Color] { [error, error] }
    var gradientWarning: [Color] { [warning, warning] }
    var gradientIncome: [Color] { [success, success] }
    var gradientExpense: [Color] { [error, error] }

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
        var r: CGFloat = 0
        var g: CGFloat = 0
        var b: CGFloat = 0
        var a: CGFloat = 0
        guard UIColor(self).getRed(&r, green: &g, blue: &b, alpha: &a) else { return "#000000" }
        return String(format: "#%02X%02X%02X", Int(r * 255), Int(g * 255), Int(b * 255))
    }
}
