import Testing
@testable import gestorpresupuesto

@Suite("User Entity Tests")
struct UserEntityTests {

    @Test func fullName_combinesNameAndLastName() {
        let user = User.fixture(name: "José", lastName: "Burgos")
        #expect(user.fullName == "José Burgos")
    }

    @Test func fullName_withDifferentNames() {
        let user = User.fixture(name: "María", lastName: "González López")
        #expect(user.fullName == "María González López")
    }
}
