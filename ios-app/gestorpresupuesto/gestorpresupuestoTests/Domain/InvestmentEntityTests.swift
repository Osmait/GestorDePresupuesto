import Testing
@testable import gestorpresupuesto

@Suite("Investment Entity Tests")
struct InvestmentEntityTests {

    @Test func totalCost_calculatesCorrectly() {
        let inv = Investment.fixture(quantity: 10, purchasePrice: 150)
        #expect(inv.totalCost == 1500)
    }

    @Test func totalValue_calculatesCorrectly() {
        let inv = Investment.fixture(quantity: 10, currentPrice: 180)
        #expect(inv.totalValue == 1800)
    }

    @Test func gainLoss_profitCase() {
        let inv = Investment.fixture(quantity: 10, purchasePrice: 150, currentPrice: 180)
        #expect(inv.gainLoss == 300)
    }

    @Test func gainLoss_lossCase() {
        let inv = Investment.fixture(quantity: 10, purchasePrice: 180, currentPrice: 150)
        #expect(inv.gainLoss == -300)
    }

    @Test func gainLossPercent_calculatesCorrectly() {
        let inv = Investment.fixture(quantity: 10, purchasePrice: 100, currentPrice: 120)
        #expect(inv.gainLossPercent == 20.0)
    }

    @Test func gainLossPercent_zeroCost() {
        let inv = Investment.fixture(quantity: 0, purchasePrice: 0, currentPrice: 100)
        #expect(inv.gainLossPercent == 0)
    }

    @Test func isProfit_whenPositive() {
        let inv = Investment.fixture(purchasePrice: 100, currentPrice: 120)
        #expect(inv.isProfit)
    }

    @Test func isProfit_whenZero() {
        let inv = Investment.fixture(purchasePrice: 100, currentPrice: 100)
        #expect(inv.isProfit)
    }

    @Test func isProfit_whenNegative() {
        let inv = Investment.fixture(purchasePrice: 120, currentPrice: 100)
        #expect(!inv.isProfit)
    }

    @Test func investmentType_displayNames() {
        #expect(InvestmentType.stock.displayName == "Acción")
        #expect(InvestmentType.crypto.displayName == "Cripto")
        #expect(InvestmentType.fixedIncome.displayName == "Renta Fija")
    }

    @Test func investmentType_icons() {
        #expect(InvestmentType.stock.icon == "chart.line.uptrend.xyaxis")
        #expect(InvestmentType.crypto.icon == "bitcoinsign.circle.fill")
        #expect(InvestmentType.fixedIncome.icon == "banknote.fill")
    }

    @Test func investmentType_rawValues() {
        #expect(InvestmentType.stock.rawValue == "stock")
        #expect(InvestmentType.crypto.rawValue == "crypto")
        #expect(InvestmentType.fixedIncome.rawValue == "fixed_income")
    }
}
