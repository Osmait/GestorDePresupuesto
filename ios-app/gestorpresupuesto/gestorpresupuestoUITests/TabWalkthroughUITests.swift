import XCTest

/// Logs in through the real login screen and visits every tab, attaching a
/// screenshot of each one to the test result.
///
/// Opt-in, needs a running backend with this user:
/// `TEST_RUNNER_UI_WALKTHROUGH=1 TEST_RUNNER_UI_EMAIL=… TEST_RUNNER_UI_PASSWORD=… xcodebuild test …`
final class TabWalkthroughUITests: XCTestCase {

    private var environment: [String: String] { ProcessInfo.processInfo.environment }

    override func setUpWithError() throws {
        continueAfterFailure = false
        try XCTSkipUnless(environment["UI_WALKTHROUGH"] == "1", "Set UI_WALKTHROUGH=1 to run against a live backend")
    }

    @MainActor
    func testWalkThroughTabs() throws {
        // UI_ORIENTATION=landscape runs the same flow on a rotated device.
        XCUIDevice.shared.orientation = environment["UI_ORIENTATION"] == "landscape" ? .landscapeLeft : .portrait
        let app = XCUIApplication()
        app.launch()

        logInIfNeeded(app)

        XCTAssertTrue(tab("Inicio", in: app).waitForExistence(timeout: 15), "tabs after login")

        let tabs = ["Inicio", "Movimientos", "Plan", "Análisis", "Más"]
        for tab in tabs {
            self.tab(tab, in: app).tap()
            XCTAssertTrue(app.navigationBars.firstMatch.waitForExistence(timeout: 10))
            sleep(3) // let the screen load its data
            XCTAssertFalse(app.staticTexts["Error al cargar"].exists, "\(tab) failed to load")
            attachScreenshot(named: tab, app: app)
        }

        // Plan: open the add menu and the new item form.
        tab("Plan", in: app).tap()
        app.navigationBars.buttons["Agregar ítem al plan"].tap()
        app.buttons["Gasto fijo"].tap()
        XCTAssertTrue(app.navigationBars["Nuevo ítem"].waitForExistence(timeout: 5))
        attachScreenshot(named: "Plan - nuevo ítem", app: app)
        app.navigationBars.buttons["Cancelar"].tap()

        // Más: open each module the user can see.
        tab("Más", in: app).tap()
        for module in ["Cuentas", "Presupuestos", "Categorías", "Recurrentes", "Tarjetas de crédito", "Préstamos", "Certificados", "Inversiones", "Metas de ahorro"] {
            let row = app.buttons[module].firstMatch
            var swipes = 0
            while !row.isHittable && swipes < 4 {
                app.collectionViews.firstMatch.swipeUp()
                swipes += 1
            }
            guard row.waitForExistence(timeout: 3) else {
                XCTFail("\(module) is not listed in Más")
                continue
            }
            row.tap()
            sleep(2)
            XCTAssertFalse(app.staticTexts["Error al cargar"].exists, "\(module) failed to load")
            attachScreenshot(named: "Más - \(module)", app: app)
            app.navigationBars.buttons.element(boundBy: 0).tap()
            // Wait for the Más list to be back before scrolling it.
            let list = app.collectionViews.firstMatch
            if list.waitForExistence(timeout: 3) { list.swipeDown() }
        }
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

    @MainActor
    private func logInIfNeeded(_ app: XCUIApplication) {
        let email = app.textFields["Email"]
        guard email.waitForExistence(timeout: 8) else { return }
        email.tap()
        email.typeText(environment["UI_EMAIL"] ?? "")
        let password = app.secureTextFields["Contraseña"]
        password.tap()
        password.typeText(environment["UI_PASSWORD"] ?? "")
        app.buttons["Iniciar Sesión"].tap()

        // The biometric enrollment prompt may appear after the first login.
        let notNow = app.buttons["Ahora no"]
        if notNow.waitForExistence(timeout: 4) { notNow.tap() }
    }

    @MainActor
    private func attachScreenshot(named name: String, app: XCUIApplication) {
        let attachment = XCTAttachment(screenshot: app.screenshot())
        attachment.name = name
        attachment.lifetime = .keepAlways
        add(attachment)
    }
}
