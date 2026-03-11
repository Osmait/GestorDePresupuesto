import Testing
import Foundation
@testable import gestorpresupuesto

@Suite("Double Formatting Tests")
struct DoubleFormattingTests {

    // MARK: - currencyFormatted (default DOP)

    @Test func currencyFormatted_positiveAmount() {
        let value = 1500.50
        let formatted = value.currencyFormatted
        #expect(formatted.contains("RD$"))
        #expect(formatted.contains("1"))
    }

    @Test func currencyFormatted_zero() {
        let formatted = 0.0.currencyFormatted
        #expect(formatted.contains("RD$"))
        #expect(formatted.contains("0"))
    }

    @Test func currencyFormatted_negativeAmount() {
        let formatted = (-1500.0).currencyFormatted
        #expect(formatted.contains("RD$"))
        #expect(formatted.contains("1"))
    }

    // MARK: - currencyFormatted(currency:)

    @Test func currencyFormatted_USD() {
        let formatted = 1500.0.currencyFormatted(currency: "USD")
        #expect(formatted.contains("US$"))
    }

    @Test func currencyFormatted_EUR() {
        let formatted = 1500.0.currencyFormatted(currency: "EUR")
        // EUR formatting depends on locale but should contain the amount
        #expect(formatted.contains("1"))
    }

    @Test func currencyFormatted_defaultCurrency() {
        let formatted = 1500.0.currencyFormatted(currency: "DOP")
        #expect(formatted.contains("RD$"))
    }

    @Test func currencyFormatted_unknownCurrency_defaultsToDOP() {
        let formatted = 1500.0.currencyFormatted(currency: "XYZ")
        #expect(formatted.contains("RD$"))
    }

    // MARK: - compactFormatted

    @Test func compactFormatted_millions() {
        #expect(1_500_000.0.compactFormatted == "1.5M")
    }

    @Test func compactFormatted_thousands() {
        #expect(1_500.0.compactFormatted == "1.5K")
    }

    @Test func compactFormatted_lessThanThousand() {
        #expect(500.0.compactFormatted == "500")
    }

    @Test func compactFormatted_negative() {
        #expect((-2_500.0).compactFormatted == "-2.5K")
    }

    // MARK: - percentageFormatted

    @Test func percentageFormatted_normalCase() {
        #expect(0.75.percentageFormatted == "75%")
    }

    @Test func percentageFormatted_zero() {
        #expect(0.0.percentageFormatted == "0%")
    }

    @Test func percentageFormatted_full() {
        #expect(1.0.percentageFormatted == "100%")
    }
}
