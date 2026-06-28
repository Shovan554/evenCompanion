// swift-tools-version: 6.0
import PackageDescription

let package = Package(
    name: "EvenReminder",
    platforms: [
        .macOS(.v14)
    ],
    targets: [
        .target(
            name: "EvenReminderCore",
            path: "Sources/EvenReminderCore"
        ),
        .executableTarget(
            name: "EvenReminder",
            dependencies: ["EvenReminderCore"],
            path: "Sources/EvenReminder"
        ),
        .testTarget(
            name: "EvenReminderCoreTests",
            dependencies: ["EvenReminderCore"],
            path: "Tests/EvenReminderCoreTests"
        ),
    ]
)
