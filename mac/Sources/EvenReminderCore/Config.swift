import Foundation

public final class AppConfig {

    private let defaults: UserDefaults

    // MARK: - Keys

    private enum Key {
        static let relayUrl       = "relayUrl"
        static let relayToken     = "relayToken"
        static let publishEnabled = "publishEnabled"
        static let screensEnabled = "screensEnabled"
    }

    // MARK: - Default screen keys

    private static let defaultScreens: [String: Bool] = [
        "vitals":    true,
        "netproc":   true,
        "ports":     true,
        "reminders": true,
    ]

    // MARK: - Init

    public init(defaults: UserDefaults = .standard) {
        self.defaults = defaults
    }

    // MARK: - Properties

    public var relayUrl: String {
        get { defaults.string(forKey: Key.relayUrl) ?? "" }
        set { defaults.set(newValue, forKey: Key.relayUrl) }
    }

    public var relayToken: String {
        get { defaults.string(forKey: Key.relayToken) ?? "" }
        set { defaults.set(newValue, forKey: Key.relayToken) }
    }

    public var publishEnabled: Bool {
        get {
            // If key not set, defaults.bool returns false — so we need to distinguish
            if defaults.object(forKey: Key.publishEnabled) == nil { return true }
            return defaults.bool(forKey: Key.publishEnabled)
        }
        set { defaults.set(newValue, forKey: Key.publishEnabled) }
    }

    public var screensEnabled: [String: Bool] {
        get {
            guard let stored = defaults.dictionary(forKey: Key.screensEnabled) as? [String: Bool] else {
                return Self.defaultScreens
            }
            // Merge with defaults so any missing keys default to true
            var result = Self.defaultScreens
            for (k, v) in stored { result[k] = v }
            return result
        }
        set {
            defaults.set(newValue, forKey: Key.screensEnabled)
        }
    }
}
