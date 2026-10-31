import Testing
import Foundation
@testable import gestorpresupuesto

@Suite("API error messages")
struct APIErrorMessageTests {

    @Test func decodesFlatError() {
        #expect(ErrorMessage.decode(from: Data(#"{"error": "invalid symbol"}"#.utf8)) == "invalid symbol")
    }

    @Test func decodesNestedError() {
        let json = #"{"error": {"code": "VALIDATION", "message": "El monto es inválido"}}"#
        #expect(ErrorMessage.decode(from: Data(json.utf8)) == "El monto es inválido")
    }

    @Test func decodesMessageField() {
        #expect(ErrorMessage.decode(from: Data(#"{"message": "Not found"}"#.utf8)) == "Not found")
    }

    @Test func emptyBodyHasNoMessage() {
        #expect(ErrorMessage.decode(from: Data()) == nil)
    }

    @Test func serverErrorShowsServerMessage() {
        #expect(APIError.serverError(400, "El monto es inválido").errorDescription == "El monto es inválido")
        #expect(APIError.serverError(500, nil).errorDescription == "Error del servidor (500)")
    }
}
