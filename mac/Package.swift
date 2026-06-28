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
            path: "Sources/EvenReminder",
            linkerSettings: [
                .unsafeFlags([
                    "-Xlinker", "-sectcreate",
                    "-Xlinker", "__TEXT",
                    "-Xlinker", "__info_plist",
                    "-Xlinker", "Sources/EvenReminder/Info.plist",
                ])
            ]
        ),
        .testTarget(
            name: "EvenReminderCoreTests",
            dependencies: ["EvenReminderCore"],
            path: "Tests/EvenReminderCoreTests"
        ),
    ]
)
