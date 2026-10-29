import Foundation
import SwiftUI
import Testing
@testable import gestorpresupuesto

@Suite("AmountText Tests")
struct AmountTextTests {

    @Test @MainActor func negative_usesMinusSign() {
        #expect(AmountText(value: -100).formatted.hasPrefix("−"))
    }

    @Test @MainActor func positive_signedOnlyWhenAsked() {
        #expect(!AmountText(value: 100).formatted.hasPrefix("+"))
        #expect(AmountText(value: 100, signed: true).formatted.hasPrefix("+"))
    }

    @Test @MainActor func zero_isNeverSigned() {
        let text = AmountText(value: 0.001, signed: true).formatted
        #expect(!text.hasPrefix("+"))
        #expect(!text.hasPrefix("−"))
    }
}

@Suite("AppAppearance Tests", .serialized)
struct AppAppearanceTests {

    private func makeDefaults() -> UserDefaults {
        let name = "AppAppearanceTests-\(UUID().uuidString)"
        return UserDefaults(suiteName: name)!
    }

    @Test func migrate_legacyDark_becomesDark() {
        let defaults = makeDefaults()
        defaults.set(true, forKey: AppAppearance.legacyDarkModeKey)

        AppAppearance.migrateLegacyPreference(defaults)

        #expect(defaults.string(forKey: AppAppearance.storageKey) == AppAppearance.dark.rawValue)
        #expect(defaults.object(forKey: AppAppearance.legacyDarkModeKey) == nil)
    }

    @Test func migrate_legacyLight_followsSystem() {
        let defaults = makeDefaults()
        defaults.set(false, forKey: AppAppearance.legacyDarkModeKey)

        AppAppearance.migrateLegacyPreference(defaults)

        #expect(defaults.string(forKey: AppAppearance.storageKey) == AppAppearance.system.rawValue)
    }

    @Test func migrate_keepsExistingChoice() {
        let defaults = makeDefaults()
        defaults.set(AppAppearance.light.rawValue, forKey: AppAppearance.storageKey)
        defaults.set(true, forKey: AppAppearance.legacyDarkModeKey)

        AppAppearance.migrateLegacyPreference(defaults)

        #expect(defaults.string(forKey: AppAppearance.storageKey) == AppAppearance.light.rawValue)
    }

    @Test func colorScheme_systemIsNil() {
        #expect(AppAppearance.system.colorScheme == nil)
        #expect(AppAppearance.dark.colorScheme == .dark)
    }
}
