import SwiftUI

/// Light/dark preference. Defaults to the system setting, like the web
/// (`next-themes`, `defaultTheme='system'`).
enum AppAppearance: String, CaseIterable, Identifiable {
    case system
    case light
    case dark

    static let storageKey = "appearance"
    /// Pre-tab-bar builds stored a Bool under this key.
    static let legacyDarkModeKey = "isDarkMode"

    var id: String { rawValue }

    var title: String {
        switch self {
        case .system: "Sistema"
        case .light: "Claro"
        case .dark: "Oscuro"
        }
    }

    var colorScheme: ColorScheme? {
        switch self {
        case .system: nil
        case .light: .light
        case .dark: .dark
        }
    }

    /// Carries over an explicit dark mode chosen before `appearance` existed.
    static func migrateLegacyPreference(_ defaults: UserDefaults = .standard) {
        guard defaults.string(forKey: storageKey) == nil,
              defaults.object(forKey: legacyDarkModeKey) != nil else { return }
        let wasDark = defaults.bool(forKey: legacyDarkModeKey)
        defaults.set((wasDark ? AppAppearance.dark : .system).rawValue, forKey: storageKey)
        defaults.removeObject(forKey: legacyDarkModeKey)
    }
}
