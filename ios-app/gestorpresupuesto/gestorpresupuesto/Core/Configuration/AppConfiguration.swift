import Foundation

enum AppEnvironment: String {
    case development
    case staging
    case production
}

struct AppConfiguration {
    static var current: AppConfiguration = {
        #if DEBUG
        return AppConfiguration(environment: .development)
        #else
        return AppConfiguration(environment: .production)
        #endif
    }()

    let environment: AppEnvironment
    let baseURL: String

    init(environment: AppEnvironment) {
        self.environment = environment

        // Priority: 1) Scheme env var  2) Info.plist  3) Default per environment
        if let envURL = ProcessInfo.processInfo.environment["API_BASE_URL"],
           !envURL.isEmpty {
            self.baseURL = envURL
        } else if let plistURL = Bundle.main.object(forInfoDictionaryKey: "API_BASE_URL") as? String,
                  !plistURL.isEmpty {
            self.baseURL = plistURL
        } else {
            switch environment {
            case .development:
                self.baseURL = "http://127.0.0.1:8080"
            case .staging:
                self.baseURL = "https://staging-api.sbfinance.app"
            case .production:
                self.baseURL = "https://api.sbfinance.app"
            }
        }

        #if DEBUG
        print("🌐 API Base URL: \(self.baseURL)")
        #endif
    }
}
