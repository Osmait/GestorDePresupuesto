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
        var r: CGFloat = 0
        var g: CGFloat = 0
        var b: CGFloat = 0
        var a: CGFloat = 0
        guard UIColor(self).getRed(&r, green: &g, blue: &b, alpha: &a) else { return nil }
        return String(format: "#%02X%02X%02X", Int(r * 255), Int(g * 255), Int(b * 255))
    }
}

extension Double {
    private static let dopFormatter: NumberFormatter = {
        let f = NumberFormatter()
        f.numberStyle = .currency
        f.locale = Locale(identifier: "es_DO")
        f.currencyCode = "DOP"
        f.currencySymbol = "RD$"
        return f
    }()

    private static let usdFormatter: NumberFormatter = {
        let f = NumberFormatter()
        f.numberStyle = .currency
        f.locale = Locale(identifier: "en_US")
        f.currencyCode = "USD"
        f.currencySymbol = "US$"
        return f
    }()

    private static let eurFormatter: NumberFormatter = {
        let f = NumberFormatter()
        f.numberStyle = .currency
        f.locale = Locale(identifier: "es_ES")
        f.currencyCode = "EUR"
        return f
    }()

    var currencyFormatted: String {
        Self.dopFormatter.string(from: self as NSNumber) ?? "RD$\(self)"
    }

    func currencyFormatted(currency: String) -> String {
        let formatter: NumberFormatter
        switch currency.uppercased() {
        case "USD": formatter = Self.usdFormatter
        case "EUR": formatter = Self.eurFormatter
        default: formatter = Self.dopFormatter
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
    private static let mediumFormatter: DateFormatter = {
        let f = DateFormatter()
        f.dateStyle = .medium
        f.locale = Locale(identifier: "es_MX")
        return f
    }()

    private static let shortFormatter: DateFormatter = {
        let f = DateFormatter()
        f.dateStyle = .short
        f.locale = Locale(identifier: "es_MX")
        return f
    }()

    private static let isoFormatter = ISO8601DateFormatter()

    private static let relativeFormatter: RelativeDateTimeFormatter = {
        let f = RelativeDateTimeFormatter()
        f.locale = Locale(identifier: "es_MX")
        f.unitsStyle = .abbreviated
        return f
    }()

    var formatted: String {
        Self.mediumFormatter.string(from: self)
    }

    var shortFormatted: String {
        Self.shortFormatter.string(from: self)
    }

    var iso8601String: String {
        Self.isoFormatter.string(from: self)
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

    var timeAgoFormatted: String {
        Self.relativeFormatter.localizedString(for: self, relativeTo: Date())
    }
}

extension String {
    var isNotBlank: Bool {
        !self.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty
    }
}

// MARK: - App calendar

/// Days and months as the backend cuts them: in Santo Domingo time.
enum AppCalendar {
    static let timeZone = TimeZone(identifier: "America/Santo_Domingo") ?? .current

    /// Gregorian, Santo Domingo time, weeks from Monday (like the backend's
    /// this_week), whatever calendar the device uses.
    static let calendar: Calendar = {
        var calendar = Calendar(identifier: .gregorian)
        calendar.timeZone = timeZone
        calendar.firstWeekday = 2
        return calendar
    }()

    private static let dayFormatter: DateFormatter = {
        let formatter = DateFormatter()
        formatter.locale = Locale(identifier: "en_US_POSIX")
        formatter.calendar = calendar
        formatter.timeZone = timeZone
        formatter.dateFormat = "yyyy-MM-dd"
        return formatter
    }()

    /// The calendar day the API expects ("2026-10-31").
    static func dayString(_ date: Date) -> String {
        dayFormatter.string(from: date)
    }

    /// First and last day of the month containing `date`, as yyyy-MM-dd, and
    /// its name ("octubre 2026").
    static func monthRange(containing date: Date = Date()) -> (from: String, to: String, title: String) {
        let calendar = calendar
        let start = calendar.date(from: calendar.dateComponents([.year, .month], from: date)) ?? date
        let end = calendar.date(byAdding: DateComponents(month: 1, day: -1), to: start) ?? date

        let month = DateFormatter()
        month.locale = Locale(identifier: "es_DO")
        month.timeZone = timeZone
        month.dateFormat = "LLLL yyyy"

        return (dayString(start), dayString(end), month.string(from: start))
    }
}

// MARK: - Calendar days from the API

extension String {
    private static let calendarDayParser: DateFormatter = {
        let f = DateFormatter()
        f.locale = Locale(identifier: "en_US_POSIX")
        f.calendar = Calendar(identifier: .gregorian)
        f.timeZone = TimeZone(identifier: "UTC")
        f.dateFormat = "yyyy-MM-dd"
        return f
    }()

    private static let calendarDayFormatter: DateFormatter = {
        let f = DateFormatter()
        f.locale = Locale(identifier: "es_DO")
        f.timeZone = TimeZone(identifier: "UTC")
        f.dateStyle = .medium
        return f
    }()

    /// A calendar day sent as "2026-10-31" or "2026-10-31T12:00:00Z" (the API
    /// sends days at 12:00 UTC), formatted for display; the string itself if
    /// it is not a date.
    var calendarDayFormatted: String {
        guard count >= 10, let date = Self.calendarDayParser.date(from: String(prefix(10))) else { return self }
        return Self.calendarDayFormatter.string(from: date)
    }
}
