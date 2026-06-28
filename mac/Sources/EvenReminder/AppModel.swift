import SwiftUI
import EvenReminderCore
import Foundation

private struct RelayCommand: Decodable {
    let cmd: String
    let id: String?
}

@MainActor
final class AppModel: ObservableObject {

    let config: AppConfig
    private let builder: SnapshotBuilder
    private var publisher: any RelayPublishing
    private var remindersStore: any RemindersProviding
    let makePublisher: (AppConfig) -> any RelayPublishing

    @Published var connectionStatus: String = "Disconnected"
    @Published var reminders: [Reminder] = []
    /// Last add-reminder error, surfaced in the UI. Nil when the last add succeeded.
    @Published var addError: String?
    @Published var relayUrl: String
    @Published var relayToken: String
    @Published var publishEnabled: Bool
    @Published var screensEnabled: [String: Bool]

    private var prevSample: NetSample?
    private var loopTask: Task<Void, Never>?

    init(
        config: AppConfig = AppConfig(),
        remindersStore: (any RemindersProviding)? = nil,
        publisher: (any RelayPublishing)? = nil,
        makePublisher: ((AppConfig) -> any RelayPublishing)? = nil
    ) {
        self.config = config
        self.builder = SnapshotBuilder(runner: SystemCommandRunner())
        self.relayUrl = config.relayUrl
        self.relayToken = config.relayToken
        self.publishEnabled = config.publishEnabled
        self.screensEnabled = config.screensEnabled

        let store = remindersStore ?? EventKitRemindersStore()
        self.remindersStore = store

        let factory: (AppConfig) -> any RelayPublishing = makePublisher
            ?? { cfg in WebSocketRelayPublisher(base: cfg.relayUrl, token: cfg.relayToken) }
        self.makePublisher = factory

        let pub = publisher ?? factory(config)
        self.publisher = pub

        // Wire up command handler
        pub.onCommand = { [weak pub] text in
            guard pub != nil else { return }
            Task { @MainActor [weak self] in
                guard let self = self else { return }
                await self.handleCommand(text)
            }
        }
    }

    func start() async {
        _ = await remindersStore.requestAccess()
        publisher.start()
        connectionStatus = "Connected"

        loopTask?.cancel()
        loopTask = Task { [weak self] in
            while !Task.isCancelled {
                try? await Task.sleep(nanoseconds: 1_000_000_000)
                guard let self = self, !Task.isCancelled else { break }
                await self.tick()
            }
        }
    }

    private func tick() async {
        // Refresh reminders
        let fetched = await remindersStore.upcoming(limit: 10)
        self.reminders = fetched

        guard config.publishEnabled else { return }

        // Capture values needed in detached task (avoid sending self across isolation boundary)
        let b = builder
        let p = prevSample

        let (snap, sample) = await Task.detached {
            b.build(
                now: Date().timeIntervalSince1970,
                host: Host.current().localizedName ?? "Mac",
                prev: p
            )
        }.value

        // Inject reminders into snapshot
        var finalSnap = snap
        finalSnap.reminders = self.reminders

        publisher.publish(snapshotJSON(finalSnap))
        prevSample = sample
    }

    private func handleCommand(_ text: String) async {
        guard let data = text.data(using: .utf8),
              let cmd = try? JSONDecoder().decode(RelayCommand.self, from: data)
        else { return }

        if cmd.cmd == "completeReminder", let id = cmd.id {
            await remindersStore.complete(id: id)
            // Refresh reminders after completing
            let fetched = await remindersStore.upcoming(limit: 10)
            self.reminders = fetched
        }
    }

    func addReminder(title: String) async {
        let trimmed = title.trimmingCharacters(in: .whitespaces)
        guard !trimmed.isEmpty else { return }

        // Make sure access is granted before trying to write — a denied/undetermined
        // store is the most common reason an add silently does nothing.
        let granted = await remindersStore.requestAccess()
        guard granted else {
            self.addError = "Reminders access not granted. Allow it in System Settings → Privacy & Security → Reminders."
            return
        }

        if let error = await remindersStore.add(title: trimmed) {
            self.addError = error
            return
        }
        self.addError = nil
        let fetched = await remindersStore.upcoming(limit: 10)
        self.reminders = fetched
    }

    func toggleLaunchAtLogin() {
        if LoginItem.isEnabled {
            LoginItem.disable()
        } else {
            LoginItem.enable()
        }
    }

    func applyConfig() {
        // Save published values back to config
        config.relayUrl = relayUrl
        config.relayToken = relayToken
        config.publishEnabled = publishEnabled
        config.screensEnabled = screensEnabled

        // Stop old publisher, create new one with updated URL/token via factory
        publisher.stop()
        let newPub = makePublisher(config)
        newPub.onCommand = { [weak newPub] text in
            guard newPub != nil else { return }
            Task { @MainActor [weak self] in
                guard let self = self else { return }
                await self.handleCommand(text)
            }
        }
        publisher = newPub
        publisher.start()
        connectionStatus = "Connected"
    }
}
