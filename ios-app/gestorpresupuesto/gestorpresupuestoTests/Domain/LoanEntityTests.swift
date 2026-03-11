import Testing
@testable import gestorpresupuesto

@Suite("Loan Entity Tests")
struct LoanEntityTests {

    @Test func progressPercent_normalCase() {
        let loan = Loan.fixture(totalAmount: 56000, paidPrincipal: 25000, paidInterest: 3000)
        #expect(loan.progressPercent == 28000.0 / 56000.0)
    }

    @Test func progressPercent_cappedAtOne() {
        let loan = Loan.fixture(totalAmount: 10000, paidPrincipal: 8000, paidInterest: 5000)
        #expect(loan.progressPercent == 1.0)
    }

    @Test func progressPercent_zeroTotal() {
        let loan = Loan.fixture(totalAmount: 0, paidPrincipal: 0, paidInterest: 0)
        #expect(loan.progressPercent == 0)
    }

    @Test func loanStatus_displayNames() {
        #expect(LoanStatus.active.displayName == "Activo")
        #expect(LoanStatus.paid.displayName == "Pagado")
        #expect(LoanStatus.defaulted.displayName == "Vencido")
        #expect(LoanStatus.cancelled.displayName == "Cancelado")
    }

    @Test func loanInterestMode_displayNames() {
        #expect(LoanInterestMode.fixedTotal.displayName == "Interés fijo total")
        #expect(LoanInterestMode.none.displayName == "Sin interés")
    }
}
