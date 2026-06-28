import Foundation

// MARK: - CommandRunner protocol

/// Abstraction over running a subprocess. Injected into SnapshotBuilder so tests can use a fake.
public protocol CommandRunner: Sendable {
    func run(_ launchPath: String, _ args: [String]) -> String
}

// MARK: - SystemCommandRunner

/// Production implementation that runs real CLI commands via Foundation's Process.
public struct SystemCommandRunner: CommandRunner {
    public init() {}

    public func run(_ launchPath: String, _ args: [String]) -> String {
        let process = Process()
        process.executableURL = URL(fileURLWithPath: launchPath)
        process.arguments = args

        let pipe = Pipe()
        process.standardOutput = pipe
        process.standardError = Pipe() // swallow stderr

        do {
            try process.run()
            process.waitUntilExit()
        } catch {
            return ""
        }

        let data = pipe.fileHandleForReading.readDataToEndOfFile()
        return String(data: data, encoding: .utf8) ?? ""
    }
}
