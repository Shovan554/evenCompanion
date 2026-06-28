import XCTest
@testable import EvenReminderCore

final class AppConfigTests: XCTestCase {

    // Use a unique suite per test to avoid cross-contamination
    private func freshDefaults(name: String = #function) -> UserDefaults {
        let suite = "com.test.AppConfig.\(name).\(UUID().uuidString)"
        let d = UserDefaults(suiteName: suite)!
        return d
    }

    // MARK: - Defaults

    func testRelayUrl_default_isEmpty() {
        let config = AppConfig(defaults: freshDefaults())
        XCTAssertEqual(config.relayUrl, "")
    }

    func testRelayToken_default_isEmpty() {
        let config = AppConfig(defaults: freshDefaults())
        XCTAssertEqual(config.relayToken, "")
    }

    func testPublishEnabled_default_isTrue() {
        let config = AppConfig(defaults: freshDefaults())
        XCTAssertTrue(config.publishEnabled)
    }

    func testScreensEnabled_default_allTrue() {
        let config = AppConfig(defaults: freshDefaults())
        XCTAssertTrue(config.screensEnabled["vitals"] ?? false)
        XCTAssertTrue(config.screensEnabled["netproc"] ?? false)
        XCTAssertTrue(config.screensEnabled["ports"] ?? false)
        XCTAssertTrue(config.screensEnabled["reminders"] ?? false)
    }

    // MARK: - Round-trips

    func testRelayUrl_setAndRead() {
        let d = freshDefaults()
        let config = AppConfig(defaults: d)
        config.relayUrl = "wss://example.com"
        // Read back via a new instance over the same defaults
        let config2 = AppConfig(defaults: d)
        XCTAssertEqual(config2.relayUrl, "wss://example.com")
    }

    func testRelayToken_setAndRead() {
        let d = freshDefaults()
        let config = AppConfig(defaults: d)
        config.relayToken = "secret-token-123"
        let config2 = AppConfig(defaults: d)
        XCTAssertEqual(config2.relayToken, "secret-token-123")
    }

    func testPublishEnabled_setFalseAndRead() {
        let d = freshDefaults()
        let config = AppConfig(defaults: d)
        config.publishEnabled = false
        let config2 = AppConfig(defaults: d)
        XCTAssertFalse(config2.publishEnabled)
    }

    func testScreensEnabled_setAndRead() {
        let d = freshDefaults()
        let config = AppConfig(defaults: d)
        config.screensEnabled = ["vitals": false, "netproc": true, "ports": false, "reminders": true]
        let config2 = AppConfig(defaults: d)
        XCTAssertFalse(config2.screensEnabled["vitals"] ?? true)
        XCTAssertTrue(config2.screensEnabled["netproc"] ?? false)
        XCTAssertFalse(config2.screensEnabled["ports"] ?? true)
        XCTAssertTrue(config2.screensEnabled["reminders"] ?? false)
    }

    func testScreensEnabled_partialUpdate_persistsCorrectly() {
        let d = freshDefaults()
        let config = AppConfig(defaults: d)
        // Default: all true; flip vitals off
        var screens = config.screensEnabled
        screens["vitals"] = false
        config.screensEnabled = screens
        let config2 = AppConfig(defaults: d)
        XCTAssertFalse(config2.screensEnabled["vitals"] ?? true)
        XCTAssertTrue(config2.screensEnabled["netproc"] ?? false)
    }
}
