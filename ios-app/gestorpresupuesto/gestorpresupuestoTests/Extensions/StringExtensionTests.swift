import Testing
@testable import gestorpresupuesto

@Suite("String Extension Tests")
struct StringExtensionTests {

    @Test func isNotBlank_nonEmptyString() {
        #expect("hello".isNotBlank)
    }

    @Test func isNotBlank_emptyString() {
        #expect(!"".isNotBlank)
    }

    @Test func isNotBlank_whitespaceOnly() {
        #expect(!"   ".isNotBlank)
        #expect(!"\n\t".isNotBlank)
    }
}

@Suite("Calendar day formatting")
struct CalendarDayFormattingTests {

    @Test func noonUTCKeepsTheDay() {
        #expect("2026-10-31T12:00:00Z".calendarDayFormatted == "2026-10-31".calendarDayFormatted)
        #expect("2026-10-31".calendarDayFormatted.contains("31"))
    }

    @Test func notADateIsReturnedAsIs() {
        #expect("pendiente".calendarDayFormatted == "pendiente")
    }
}
