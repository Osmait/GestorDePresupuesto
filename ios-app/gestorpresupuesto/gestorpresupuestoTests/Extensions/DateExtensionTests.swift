import Testing
import Foundation
@testable import gestorpresupuesto

@Suite("Date Extension Tests")
struct DateExtensionTests {

    @Test func iso8601String_formatsCorrectly() {
        let date = Date(timeIntervalSince1970: 0)
        let iso = date.iso8601String
        #expect(iso.contains("1970"))
        #expect(iso.contains("T"))
    }

    @Test func startOfMonth_isFirstDay() {
        let startOfMonth = Date.startOfMonth
        let calendar = Calendar.current
        let day = calendar.component(.day, from: startOfMonth)
        #expect(day == 1)
    }

    @Test func endOfMonth_isAfterStartOfMonth() {
        let start = Date.startOfMonth
        let end = Date.endOfMonth
        #expect(end > start)
    }

    @Test func formatted_returnsNonEmpty() {
        let date = Date()
        #expect(!date.formatted.isEmpty)
    }

    @Test func shortFormatted_returnsNonEmpty() {
        let date = Date()
        #expect(!date.shortFormatted.isEmpty)
    }

    @Test func timeAgoFormatted_returnsNonEmpty() {
        let pastDate = Date(timeIntervalSinceNow: -3600)
        let formatted = pastDate.timeAgoFormatted
        #expect(!formatted.isEmpty)
    }
}
