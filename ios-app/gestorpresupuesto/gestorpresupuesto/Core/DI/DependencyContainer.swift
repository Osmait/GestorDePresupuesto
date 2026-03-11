import Foundation
import os.log

final class DependencyContainer {
    static let shared = DependencyContainer()

    private var factories: [String: () -> Any] = [:]
    private var singletons: [String: Any] = [:]
    private let lock = NSLock()

    init() {}

    func register<T>(_ type: T.Type, factory: @escaping () -> T) {
        lock.lock()
        defer { lock.unlock() }
        let key = String(describing: type)
        factories[key] = factory
    }

    func registerSingleton<T>(_ type: T.Type, factory: @escaping () -> T) {
        lock.lock()
        defer { lock.unlock() }
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
        lock.lock()
        defer { lock.unlock() }
        let key = String(describing: type)
        guard let factory = factories[key] else {
            os_log(.fault, "DependencyContainer: No registration found for %{public}@", key)
            fatalError("No registration found for \(key)")
        }
        guard let instance = factory() as? T else {
            os_log(.fault, "DependencyContainer: Factory for %{public}@ did not produce expected type", key)
            fatalError("Factory for \(key) did not produce expected type")
        }
        return instance
    }

    func resolveOptional<T>(_ type: T.Type) -> T? {
        lock.lock()
        defer { lock.unlock() }
        let key = String(describing: type)
        guard let factory = factories[key] else { return nil }
        return factory() as? T
    }
}
