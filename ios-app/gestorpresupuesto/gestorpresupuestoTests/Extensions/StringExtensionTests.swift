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
