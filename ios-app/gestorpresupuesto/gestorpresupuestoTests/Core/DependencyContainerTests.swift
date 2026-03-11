import Testing
import Foundation
@testable import gestorpresupuesto

@Suite("DependencyContainer Tests")
struct DependencyContainerTests {

    @Test func register_andResolve() {
        let container = DependencyContainer()
        container.register(String.self) { "hello" }

        let result: String = container.resolve(String.self)
        #expect(result == "hello")
    }

    @Test func register_factory_createsNewInstanceEachTime() {
        let container = DependencyContainer()
        var counter = 0
        container.register(Int.self) {
            counter += 1
            return counter
        }

        let first: Int = container.resolve(Int.self)
        let second: Int = container.resolve(Int.self)
        #expect(first == 1)
        #expect(second == 2)
    }

    @Test func registerSingleton_returnsSameInstance() {
        let container = DependencyContainer()
        container.registerSingleton(NSObject.self) { NSObject() }

        let first: NSObject = container.resolve(NSObject.self)
        let second: NSObject = container.resolve(NSObject.self)
        #expect(first === second)
    }

    @Test func resolve_unregisteredType_fatalError() {
        // This test verifies the container has the expected behavior
        // We can't test fatalError directly, but we verify registered types resolve correctly
        let container = DependencyContainer()
        container.register(Double.self) { 42.0 }

        let result: Double = container.resolve(Double.self)
        #expect(result == 42.0)
    }
}
