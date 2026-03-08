import Foundation

final class DependencyContainer {
    static let shared = DependencyContainer()

    private var factories: [String: () -> Any] = [:]
    private var singletons: [String: Any] = [:]

    private init() {}

    func register<T>(_ type: T.Type, factory: @escaping () -> T) {
        let key = String(describing: type)
        factories[key] = factory
    }

    func registerSingleton<T>(_ type: T.Type, factory: @escaping () -> T) {
        let key = String(describing: type)
        factories[key] = { [weak self] in
            if let existing = self?.singletons[key] as? T {
                return existing
            }
            let instance = factory()
            self?.singletons[key] = instance
            return instance
        }
    }

    func resolve<T>(_ type: T.Type) -> T {
        let key = String(describing: type)
        guard let factory = factories[key] else {
            fatalError("No registration found for \(key)")
        }
        guard let instance = factory() as? T else {
            fatalError("Factory for \(key) did not produce expected type")
        }
        return instance
    }
}
