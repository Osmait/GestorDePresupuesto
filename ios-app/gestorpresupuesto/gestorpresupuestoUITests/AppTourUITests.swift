import XCTest

/// A paced tour of the whole app, meant to be screen-recorded
/// (`xcrun simctl io <device> recordVideo`). Prints `TOUR_MARK|<chapter>|<epoch>`
/// at the start of each chapter so the recording can be split into chapters.
///
/// Opt-in, needs a running backend with this user:
/// `TEST_RUNNER_UI_TOUR=1 TEST_RUNNER_UI_EMAIL=… TEST_RUNNER_UI_PASSWORD=… xcodebuild test …`
final class AppTourUITests: XCTestCase {

    private var environment: [String: String] { ProcessInfo.processInfo.environment }

    override func setUpWithError() throws {
        continueAfterFailure = true
        try XCTSkipUnless(environment["UI_TOUR"] == "1", "Set UI_TOUR=1 to record the tour against a live backend")
    }

    @MainActor
    func testTour() throws {
        // UI_ORIENTATION=landscape runs the same flow on a rotated device.
        XCUIDevice.shared.orientation = environment["UI_ORIENTATION"] == "landscape" ? .landscapeLeft : .portrait
        let app = XCUIApplication()
        app.launch()

        mark("Inicio de sesión")
        logInIfNeeded(app)
        XCTAssertTrue(tab("Inicio", in: app).waitForExistence(timeout: 15))

        mark("Inicio")
        pause(3)
        scrollDown(app)
        scrollUp(app)

        mark("Barra lateral")
        if let toggle = sidebarToggle(in: app) {
            toggle.tap()
            pause(2.5)
            toggle.tap()
            pause(1)
        }

        mark("Movimientos")
        tab("Movimientos", in: app).tap()
        pause(3)
        scrollDown(app)
        scrollUp(app)

        mark("Plan mensual")
        tab("Plan", in: app).tap()
        pause(3)
        app.buttons["Día"].firstMatch.tap()
        pause(2.5)
        app.buttons["Categoría"].firstMatch.tap()
        pause(1.5)

        mark("Nuevo gasto fijo")
        app.navigationBars.buttons["Agregar ítem al plan"].tap()
        pause(1)
        app.buttons["Gasto fijo"].tap()
        let name = app.textFields["Nombre (ej. Alquiler)"]
        if name.waitForExistence(timeout: 5) {
            name.tap()
            name.typeText("Seguro del carro")
            let amount = app.textFields["Monto"]
            amount.tap()
            amount.typeText("4850")
            pause(2)
        }
        app.navigationBars.buttons["Cancelar"].tap()
        pause(1)

        mark("Análisis")
        tab("Análisis", in: app).tap()
        pause(3)
        scrollDown(app)
        scrollUp(app)

        mark("Más")
        tab("Más", in: app).tap()
        pause(3)

        let modules = [
            "Cuentas", "Presupuestos", "Categorías", "Recurrentes",
            "Tarjetas de crédito", "Inversiones", "Certificados", "Préstamos", "Metas de ahorro",
        ]
        for module in modules {
            let row = app.buttons[module].firstMatch
            var swipes = 0
            while !row.isHittable && swipes < 4 {
                app.collectionViews.firstMatch.swipeUp()
                swipes += 1
            }
            guard row.exists else { continue }
            mark(module)
            row.tap()
            pause(3)
            app.navigationBars.buttons.element(boundBy: 0).tap()
            pause(1)
        }

        mark("Modo oscuro")
        // The picker's accessibility label includes its value ("Apariencia, Sistema").
        let appearance = app.buttons.matching(NSPredicate(format: "label BEGINSWITH %@", "Apariencia")).firstMatch
        var swipes = 0
        while !appearance.isHittable && swipes < 4 {
            app.collectionViews.firstMatch.swipeUp()
            swipes += 1
        }
        if appearance.exists {
            appearance.tap()
            pause(1)
            app.buttons["Oscuro"].firstMatch.tap()
            pause(2)
            tab("Inicio", in: app).tap()
            pause(3)
            tab("Plan", in: app).tap()
            pause(3)
            tab("Movimientos", in: app).tap()
            pause(3)

            // Leave the simulator as it was.
            tab("Más", in: app).tap()
            pause(1)
            var back = 0
            while !appearance.isHittable && back < 4 {
                app.collectionViews.firstMatch.swipeUp()
                back += 1
            }
            appearance.tap()
            app.buttons["Sistema"].firstMatch.tap()
        }
        mark("Fin")
        pause(1)
    }

    // MARK: - Helpers

    private func mark(_ chapter: String) {
        print("TOUR_MARK|\(chapter)|\(Date().timeIntervalSince1970)")
    }

    private func pause(_ seconds: Double) {
        Thread.sleep(forTimeInterval: seconds)
    }

    @MainActor
    private func scrollDown(_ app: XCUIApplication) {
        app.swipeUp(velocity: .slow)
        pause(1.5)
    }

    @MainActor
    private func scrollUp(_ app: XCUIApplication) {
        app.swipeDown(velocity: .slow)
        pause(1)
    }

    /// iPhone shows a tab bar; iPad shows a tab strip (portrait) or an open
    /// sidebar (landscape), neither exposed as a tab bar.
    @MainActor
    private func tab(_ name: String, in app: XCUIApplication) -> XCUIElement {
        let tabBarButton = app.tabBars.buttons[name]
        if tabBarButton.exists { return tabBarButton }
        // iPad in landscape keeps the sidebar open; its tabs are list rows.
        let sidebarRow = app.cells.containing(.staticText, identifier: name).firstMatch
        if sidebarRow.exists { return sidebarRow }
        return app.buttons[name].firstMatch
    }

    /// The iPad tab strip's sidebar button; absent on iPhone.
    @MainActor
    private func sidebarToggle(in app: XCUIApplication) -> XCUIElement? {
        for label in ["Show Sidebar", "Mostrar barra lateral", "Sidebar", "Barra lateral"] {
            let button = app.buttons[label].firstMatch
            if button.exists { return button }
        }
        return nil
    }

    @MainActor
    private func logInIfNeeded(_ app: XCUIApplication) {
        let email = app.textFields["Email"]
        guard email.waitForExistence(timeout: 8) else { return }
        pause(1)
        email.tap()
        email.typeText(environment["UI_EMAIL"] ?? "")
        let password = app.secureTextFields["Contraseña"]
        password.tap()
        password.typeText(environment["UI_PASSWORD"] ?? "")
        pause(0.5)
        app.buttons["Iniciar Sesión"].tap()

        // iOS offers to save the password (a system prompt, owned by
        // SpringBoard) and the app may offer biometric enrollment; dismiss
        // both so they do not cover the tour.
        let springboard = XCUIApplication(bundleIdentifier: "com.apple.springboard")
        for owner in [springboard, app] {
            for label in ["Not Now", "Ahora no"] {
                let button = owner.buttons[label].firstMatch
                if button.waitForExistence(timeout: 3) {
                    button.tap()
                    break
                }
            }
        }
    }
}
