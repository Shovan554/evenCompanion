import SwiftUI
import AppKit
import EvenReminderCore

@main
struct EvenReminderApp: App {
    @StateObject private var model = AppModel()

    init() {
        NSApp.setActivationPolicy(.accessory)
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
