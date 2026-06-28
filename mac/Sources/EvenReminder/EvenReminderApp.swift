import SwiftUI
import AppKit
import EvenReminderCore

@main
struct EvenReminderApp: App {
    @StateObject private var model = AppModel()

    init() {
        // Use NSApplication.shared (lazily creates the instance); the global
        // NSApp is still nil this early in the SwiftUI App lifecycle.
        NSApplication.shared.setActivationPolicy(.accessory)
    }

    var body: some Scene {
        MenuBarExtra("Reminders", systemImage: "checklist") {
            RemindersView()
                .environmentObject(model)
        }
        .menuBarExtraStyle(.window)

        MenuBarExtra("Even Stats", systemImage: "gauge.medium") {
            SettingsView()
                .environmentObject(model)
                .task {
                    await model.start()
                }
        }
        .menuBarExtraStyle(.window)
    }
}
