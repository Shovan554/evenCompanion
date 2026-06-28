@preconcurrency import EventKit
import Foundation

// MARK: - Pure helper

/// Returns true iff `due` is non-nil and strictly less than `now`.
public func isOverdue(due: Int?, now: Int) -> Bool {
    guard let due = due else { return false }
    return due < now
}

// MARK: - Protocol

public protocol RemindersProviding: Sendable {
    func requestAccess() async -> Bool
    func upcoming(limit: Int) async -> [Reminder]
    func complete(id: String) async
    func add(title: String) async
}

// MARK: - EventKit implementation

public final class EventKitRemindersStore: RemindersProviding, @unchecked Sendable {

    private let store = EKEventStore()

    public init() {}

    public func requestAccess() async -> Bool {
        if #available(macOS 14, *) {
            do {
                return try await store.requestFullAccessToReminders()
            } catch {
                return false
            }
        } else {
            return await withCheckedContinuation { continuation in
                store.requestAccess(to: .reminder) { granted, _ in
                    continuation.resume(returning: granted)
                }
            }
        }
    }

    public func upcoming(limit: Int) async -> [Reminder] {
        let now = Int(Date().timeIntervalSince1970)

        let calendars = store.calendars(for: .reminder)
        let predicate = store.predicateForIncompleteReminders(
            withDueDateStarting: nil,
            ending: nil,
            calendars: calendars.isEmpty ? nil : calendars
        )

        // Convert to value types inside the callback to avoid sending non-Sendable EKReminder.
        // Use nonisolated(unsafe) storage to pass the Sendable [Reminder] across thread boundary
        // without triggering Swift 6 sending diagnostics on the continuation.
        nonisolated(unsafe) var fetchedReminders: [Reminder] = []
        await withCheckedContinuation { (continuation: CheckedContinuation<Void, Never>) in
            store.fetchReminders(matching: predicate) { results in
                fetchedReminders = (results ?? []).map { ek -> Reminder in
                    let dueEpoch: Int? = ek.dueDateComponents?.date.map { Int($0.timeIntervalSince1970) }
                    return Reminder(
                        id: ek.calendarItemIdentifier,
                        title: ek.title ?? "",
                        due: dueEpoch,
                        overdue: isOverdue(due: dueEpoch, now: now)
                    )
                }
                continuation.resume()
            }
        }
        let reminders = fetchedReminders

        // Sort: non-nil due ascending, nil due last
        let sorted = reminders.sorted { a, b in
            switch (a.due, b.due) {
            case let (da?, db?): return da < db
            case (nil, _?): return false
            case (_?, nil): return true
            case (nil, nil): return false
            }
        }

        return Array(sorted.prefix(limit))
    }

    public func complete(id: String) async {
        let calendars = store.calendars(for: .reminder)
        let predicate = store.predicateForIncompleteReminders(
            withDueDateStarting: nil,
            ending: nil,
            calendars: calendars.isEmpty ? nil : calendars
        )

        await withCheckedContinuation { (continuation: CheckedContinuation<Void, Never>) in
            store.fetchReminders(matching: predicate) { [weak self] results in
                guard let self = self else { continuation.resume(); return }
                if let target = (results ?? []).first(where: { $0.calendarItemIdentifier == id }) {
                    target.isCompleted = true
                    try? self.store.save(target, commit: true)
                }
                continuation.resume()
            }
        }
    }

    public func add(title: String) async {
        let reminder = EKReminder(eventStore: store)
        reminder.title = title
        reminder.calendar = store.defaultCalendarForNewReminders()
        try? store.save(reminder, commit: true)
    }
}
